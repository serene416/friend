import os

from celery import Celery


def _resolve_broker_url() -> str:
    return os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL", "redis://redis:6379/0")


def _resolve_result_backend() -> str:
    return os.getenv("CELERY_RESULT_BACKEND") or os.getenv("REDIS_URL", "redis://redis:6379/0")


celery_app = Celery(
    "backend",
    broker=_resolve_broker_url(),
    backend=_resolve_result_backend(),
)
