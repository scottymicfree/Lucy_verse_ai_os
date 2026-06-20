class EventBus:
    def __init__(self):
        self.subscribers = []

    def subscribe(self, callback):
        """Add a callback to be notified of new events."""
        self.subscribers.append(callback)

    def publish(self, event_data: dict):
        """Publish an event to all subscribers."""
        print(f"[EventBus] Dispatching event: {event_data.get('type', 'unknown')} from {event_data.get('source', 'unknown')}")
        for callback in self.subscribers:
            try:
                callback(event_data)
            except Exception as e:
                print(f"[EventBus] Error in subscriber callback: {e}")

# Global singleton event bus
system_event_bus = EventBus()
