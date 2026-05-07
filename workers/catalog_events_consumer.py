"""Example event-driven integration: logs catalog/cutting events from RabbitMQ."""

from __future__ import annotations

import json
import logging
import os
import ssl

import pika

from common.messaging import EXCHANGE_EVENTS

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

QUEUE = os.getenv("INTEGRATION_EVENTS_QUEUE", "furniture.integration.bridge")


def consume_forever() -> None:
    url = os.getenv("RABBITMQ_URL", "").strip()
    if not url:
        log.warning("RABBITMQ_URL not set — consumer idle")
        return
    params = pika.URLParameters(url)
    if url.startswith("amqps://"):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        params.ssl_options = pika.SSLOptions(ctx)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.exchange_declare(exchange=EXCHANGE_EVENTS, exchange_type="topic", durable=True)
    channel.queue_declare(queue=QUEUE, durable=True)
    prefix = os.getenv("EVENT_BIND_PREFIX", "")
    binds = prefix.split(",") if prefix else ["catalog.#", "cutting.#"]
    bind_keys = [b.strip() for b in binds if b.strip()]
    for key in bind_keys:
        channel.queue_bind(queue=QUEUE, exchange=EXCHANGE_EVENTS, routing_key=key)

    log.info(
        "Integration worker subscribed to '%s' on exchange '%s' with keys=%s",
        QUEUE,
        EXCHANGE_EVENTS,
        bind_keys,
    )

    def _callback(ch, method, properties, body):
        payload = {}
        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            payload = {"raw": body.decode("utf-8", errors="replace")}
        log.info("[event] rk=%s body=%s", method.routing_key, payload)
        ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_qos(prefetch_count=50)
    channel.basic_consume(queue=QUEUE, on_message_callback=_callback)
    channel.start_consuming()


if __name__ == "__main__":
    consume_forever()
