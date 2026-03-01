"""
In-process synchronous event bus.

Modules communicate via domain events rather than direct coupling.
All handlers are called synchronously in registration order within the
same request/task context — this is a function call, not a network hop.

Usage:
    from app.core.events import bus

    # Subscribe (typically done at module import time)
    bus.subscribe("user.registered", handle_user_registered)

    # Publish (within a service method)
    bus.publish("user.registered", {"user_id": str(user.id), "email": user.email})
"""

from collections import defaultdict
from collections.abc import Callable
from typing import Any


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[str, list[Callable[[dict[str, Any]], None]]] = defaultdict(list)

    def subscribe(self, event: str, handler: Callable[[dict[str, Any]], None]) -> None:
        """Register a handler for the given event name."""
        self._handlers[event].append(handler)

    def unsubscribe(self, event: str, handler: Callable[[dict[str, Any]], None]) -> None:
        """Remove a previously registered handler (useful in tests)."""
        self._handlers[event] = [h for h in self._handlers[event] if h is not handler]

    def publish(self, event: str, payload: dict[str, Any]) -> None:
        """Call all handlers registered for this event, in order."""
        for handler in self._handlers[event]:
            handler(payload)

    def clear(self) -> None:
        """Remove all handlers. Used in test teardown."""
        self._handlers.clear()


# Module-level singleton — import this everywhere
bus = EventBus()
