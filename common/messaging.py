from __future__ import annotations

import json
import logging
import os
import ssl
from typing import Any

import pika

log = logging.getLogger(__name__)

EXCHANGE_EVENTS = os.getenv("RABBITMQ_EXCHANGE_EVENTS", "furniture.events")


def publish_event(routing_key: str, payload: dict[str, Any]) -> None:
    """Best-effort publish; no-op without RABBITMQ_URL."""
    url = os.getenv("RABBITMQ_URL", "").strip()
    if not url:
        return
    if url.startswith("amqps://"):
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        parameters = pika.URLParameters(url)
        parameters.ssl_options = pika.SSLOptions(ssl_context)
    else:
        parameters = pika.URLParameters(url)
    conn = None
    try:
        conn = pika.BlockingConnection(parameters)
        chan = conn.channel()
        chan.exchange_declare(exchange=EXCHANGE_EVENTS, exchange_type="topic", durable=True)
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        props = pika.BasicProperties(content_type="application/json", delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE)
        chan.basic_publish(exchange=EXCHANGE_EVENTS, routing_key=routing_key, body=body, properties=props)
    except Exception:
        log.exception("Failed to publish event %s", routing_key)
    finally:
        if conn and conn.is_open:
            conn.close()
