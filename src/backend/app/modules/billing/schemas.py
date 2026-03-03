import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CheckoutCreate(BaseModel):
    plan: str  # core | ai_starter | ai_pro


class CheckoutResponse(BaseModel):
    url: str
    session_id: str | None = None


class BillingPortalResponse(BaseModel):
    url: str


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID | None = None
    user_id: uuid.UUID
    plan: str  # free | core | ai_starter | ai_pro
    status: str  # active | canceled | past_due | expired
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    purchased_at: datetime | None = None
    expires_at: datetime | None = None


# Plan ordering for tier checks
PLAN_ORDER = ["free", "core", "ai_starter", "ai_pro"]
