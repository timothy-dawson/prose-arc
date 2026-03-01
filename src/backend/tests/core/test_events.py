"""Tests for the in-process EventBus."""

from app.core.events import EventBus


def test_subscribe_and_publish() -> None:
    bus = EventBus()
    received: list[dict] = []

    bus.subscribe("test.event", lambda payload: received.append(payload))
    bus.publish("test.event", {"value": 42})

    assert len(received) == 1
    assert received[0]["value"] == 42


def test_multiple_handlers_called_in_order() -> None:
    bus = EventBus()
    order: list[int] = []

    bus.subscribe("seq.event", lambda _: order.append(1))
    bus.subscribe("seq.event", lambda _: order.append(2))
    bus.subscribe("seq.event", lambda _: order.append(3))
    bus.publish("seq.event", {})

    assert order == [1, 2, 3]


def test_no_handlers_is_a_noop() -> None:
    bus = EventBus()
    # Should not raise
    bus.publish("unknown.event", {"data": "anything"})


def test_unsubscribe_removes_handler() -> None:
    bus = EventBus()
    called: list[bool] = []

    def handler(payload: dict) -> None:
        called.append(True)

    bus.subscribe("evt", handler)
    bus.unsubscribe("evt", handler)
    bus.publish("evt", {})

    assert called == []


def test_clear_removes_all_handlers() -> None:
    bus = EventBus()
    called: list[bool] = []

    bus.subscribe("a", lambda _: called.append(True))
    bus.subscribe("b", lambda _: called.append(True))
    bus.clear()
    bus.publish("a", {})
    bus.publish("b", {})

    assert called == []


def test_event_isolation() -> None:
    bus = EventBus()
    received: list[str] = []

    bus.subscribe("event.a", lambda p: received.append("a"))
    bus.publish("event.b", {})

    assert received == []


def test_payload_passed_correctly() -> None:
    bus = EventBus()
    payloads: list[dict] = []

    bus.subscribe("user.registered", lambda p: payloads.append(p))
    bus.publish("user.registered", {"user_id": "abc-123", "email": "user@example.com"})

    assert payloads[0] == {"user_id": "abc-123", "email": "user@example.com"}
