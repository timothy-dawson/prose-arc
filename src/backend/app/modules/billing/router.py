"""Billing API router."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_db
from app.modules.billing.schemas import (
    BillingPortalResponse,
    CheckoutCreate,
    CheckoutResponse,
    SubscriptionResponse,
)
from app.modules.billing.service import BillingService
from app.modules.identity.models import User

router = APIRouter(tags=["billing"])


@router.get("/billing/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubscriptionResponse:
    svc = BillingService(db)
    return await svc.get_subscription(current_user.id)


@router.post("/billing/checkout", response_model=CheckoutResponse)
async def create_checkout(
    data: CheckoutCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CheckoutResponse:
    svc = BillingService(db)
    return await svc.create_checkout_session(current_user.id, data)


@router.post("/billing/portal", response_model=BillingPortalResponse)
async def create_portal(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BillingPortalResponse:
    svc = BillingService(db)
    return await svc.create_portal_session(current_user.id)


@router.post("/billing/webhook", status_code=200)
async def stripe_webhook(
    request: Request,
    stripe_signature: Annotated[str | None, Header(alias="stripe-signature")] = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Stripe webhook endpoint — no auth, verified by signature."""
    payload = await request.body()
    svc = BillingService(db)
    await svc.handle_webhook(payload, stripe_signature or "")
    await db.commit()
    return {"status": "ok"}
