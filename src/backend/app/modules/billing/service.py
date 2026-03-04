"""Billing service — manages subscriptions via Stripe.

Stripe API calls are STUBBED in this version. To wire up real billing:
1. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_CORE,
   STRIPE_PRICE_AI_STARTER, STRIPE_PRICE_AI_PRO in your .env file.
2. Replace each `# TODO: stripe.*` stub with the real stripe call.
3. Run `stripe listen --forward-to localhost:8100/api/v1/billing/webhook`
   during local development.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_db
from app.modules.billing.models import Subscription
from app.modules.billing.schemas import (
    PLAN_ORDER,
    BillingPortalResponse,
    CheckoutCreate,
    CheckoutResponse,
    SubscriptionResponse,
)
from app.modules.identity.models import User

logger = structlog.get_logger(__name__)


class BillingService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # ── Subscription query ────────────────────────────────────────────────────

    async def get_subscription(self, user_id: uuid.UUID) -> SubscriptionResponse:
        """Return the user's current subscription (free plan if no row exists)."""
        stmt = select(Subscription).where(Subscription.user_id == user_id)
        result = await self._db.execute(stmt)
        sub = result.scalar_one_or_none()
        if sub is None:
            # Implicit free tier — no DB row required
            return SubscriptionResponse(user_id=user_id, plan="free", status="active")
        return SubscriptionResponse.model_validate(sub)

    async def has_plan(self, user_id: uuid.UUID, min_plan: str) -> bool:
        """Return True if the user's current plan is at or above min_plan."""
        sub = await self.get_subscription(user_id)
        current_idx = PLAN_ORDER.index(sub.plan) if sub.plan in PLAN_ORDER else 0
        min_idx = PLAN_ORDER.index(min_plan) if min_plan in PLAN_ORDER else 0
        return current_idx >= min_idx and sub.status == "active"

    # ── Checkout ──────────────────────────────────────────────────────────────

    async def create_checkout_session(
        self, user_id: uuid.UUID, data: CheckoutCreate
    ) -> CheckoutResponse:
        """
        Create a Stripe Checkout session and return the redirect URL.

        Stub: returns a placeholder URL. Replace with real Stripe call when keys are ready.
        """
        if data.plan not in ("core", "ai_starter", "ai_pro"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown plan: {data.plan}",
            )

        # TODO: stripe.checkout.Session.create(
        #     customer=...,
        #     line_items=[{"price": settings.stripe_price_map[data.plan], "quantity": 1}],
        #     mode="payment" if data.plan == "core" else "subscription",
        #     success_url=f"{settings.app_url}/billing?success=1",
        #     cancel_url=f"{settings.app_url}/billing?canceled=1",
        # )
        logger.info("checkout_session_stub", user_id=str(user_id), plan=data.plan)
        return CheckoutResponse(
            url="https://checkout.stripe.com/stub",
            session_id="stub_session_id",
        )

    # ── Portal ────────────────────────────────────────────────────────────────

    async def create_portal_session(self, user_id: uuid.UUID) -> BillingPortalResponse:
        """
        Create a Stripe Billing Portal session for managing an existing subscription.

        Stub: replace with real Stripe call when keys are ready.
        """
        # TODO: stripe.billing_portal.Session.create(customer=..., return_url=...)
        logger.info("portal_session_stub", user_id=str(user_id))
        return BillingPortalResponse(url="https://billing.stripe.com/stub")

    # ── Webhook ───────────────────────────────────────────────────────────────

    async def handle_webhook(self, payload: bytes, sig_header: str) -> None:
        """
        Process a Stripe webhook event.

        Stub: parses the payload without signature verification.
        Replace with `stripe.Webhook.construct_event(payload, sig_header, secret)`.
        """
        import json

        try:
            event: dict[str, Any] = json.loads(payload)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload")

        event_type: str = event.get("type", "")
        logger.info("stripe_webhook_received", event_type=event_type)

        # TODO: verify signature
        # stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)

        match event_type:
            case "checkout.session.completed":
                await self._handle_checkout_completed(event.get("data", {}).get("object", {}))
            case "customer.subscription.updated":
                await self._handle_subscription_updated(event.get("data", {}).get("object", {}))
            case "customer.subscription.deleted":
                await self._handle_subscription_deleted(event.get("data", {}).get("object", {}))
            case _:
                logger.debug("stripe_event_unhandled", event_type=event_type)

    async def _handle_checkout_completed(self, session: dict[str, Any]) -> None:
        """Create or update Subscription row after successful checkout."""
        stripe_customer_id: str = session.get("customer", "") or ""
        stripe_sub_id: str | None = session.get("subscription")
        metadata: dict[str, str] = session.get("metadata", {})
        user_id_str: str = metadata.get("user_id", "")
        plan: str = metadata.get("plan", "core")

        if not user_id_str:
            logger.warning("checkout_completed_missing_user_id")
            return

        try:
            user_uuid = uuid.UUID(user_id_str)
        except ValueError:
            logger.warning("checkout_completed_invalid_user_id", user_id=user_id_str)
            return

        stmt = select(Subscription).where(Subscription.user_id == user_uuid)
        result = await self._db.execute(stmt)
        sub = result.scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if sub is None:
            sub = Subscription(
                user_id=user_uuid,
                stripe_customer_id=stripe_customer_id,
                stripe_subscription_id=stripe_sub_id,
                plan=plan,
                status="active",
                purchased_at=now,
            )
            self._db.add(sub)
        else:
            sub.stripe_customer_id = stripe_customer_id
            sub.stripe_subscription_id = stripe_sub_id
            sub.plan = plan
            sub.status = "active"
            sub.purchased_at = now

        await self._db.flush()
        await self._db.refresh(sub)
        logger.info("subscription_activated", user_id=user_id_str, plan=plan)

    async def _handle_subscription_updated(self, stripe_sub: dict[str, Any]) -> None:
        stripe_sub_id: str = stripe_sub.get("id", "")
        new_status: str = stripe_sub.get("status", "active")

        stmt = select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id)
        result = await self._db.execute(stmt)
        sub = result.scalar_one_or_none()
        if sub:
            sub.status = "active" if new_status == "active" else new_status
            await self._db.flush()

    async def _handle_subscription_deleted(self, stripe_sub: dict[str, Any]) -> None:
        stripe_sub_id: str = stripe_sub.get("id", "")

        stmt = select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id)
        result = await self._db.execute(stmt)
        sub = result.scalar_one_or_none()
        if sub:
            sub.status = "canceled"
            await self._db.flush()


# ---------------------------------------------------------------------------
# require_plan dependency
# ---------------------------------------------------------------------------


def require_plan(min_plan: str) -> Any:
    """FastAPI dependency: raises 403 if user's plan is below min_plan."""

    async def _check(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> None:
        svc = BillingService(db)
        if not await svc.has_plan(current_user.id, min_plan):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires the '{min_plan}' plan or higher.",
            )

    return _check
