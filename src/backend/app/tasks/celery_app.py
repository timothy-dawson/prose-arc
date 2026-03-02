"""
Celery application instance.

Three queues:
  - default  → general background work (emails, notifications, cleanup)
  - ai       → AI inference tasks (long-running, resource-intensive)
  - export   → document export (DOCX, PDF, ePub) — potentially slow

In development, the worker processes all 3 queues.
In production, ai and export queues can be routed to dedicated workers.
"""

from celery import Celery
from kombu import Queue

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "prosearc",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.manuscript_tasks",
        # "app.tasks.ai_tasks",
        # "app.tasks.export_tasks",
    ],
)

celery_app.conf.update(
    task_queues=[
        Queue("default"),
        Queue("ai"),
        Queue("export"),
    ],
    task_default_queue="default",
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Prevent tasks from being re-queued endlessly on failure
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Result expiry
    result_expires=3600,  # 1 hour
    # Worker settings
    worker_prefetch_multiplier=1,  # one task at a time per worker process (fair for long tasks)
)
