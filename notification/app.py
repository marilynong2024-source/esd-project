from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import threading
import time
import pika
import json

from smu_integration import send_email_for_amqp_event
from twilio_integration import send_sms_for_amqp_event

app = Flask(__name__)
CORS(app)

NOTIFICATIONS = []


@app.route("/notify/manual", methods=["POST"])
def notify_manual():
    data = request.get_json() or {}
    NOTIFICATIONS.append(data)
    return jsonify({"code": 200, "data": data}), 200


@app.route("/notifications", methods=["GET"])
def list_notifications():
    return jsonify({"code": 200, "data": NOTIFICATIONS}), 200


def start_amqp_consumer():
    rabbit_host = os.environ.get("RABBIT_HOST", "localhost")
    rabbit_port = int(os.environ.get("RABBIT_PORT", "5672"))
    exchange_name = os.environ.get("EXCHANGE_NAME", "travel_topic")
    exchange_type = os.environ.get("EXCHANGE_TYPE", "topic")
    queue_name = os.environ.get("QUEUE_NAME", "Notification")

    def callback(ch, method, properties, body):
        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            payload = {"raw": body.decode("utf-8", errors="ignore")}
        print(f"[notification] received event: {payload}")
        NOTIFICATIONS.append(
            {
                "source": "amqp",
                "routing_key": method.routing_key,
                "payload": payload,
            }
        )

        # Optional: SMU Lab Utilities SendEmail (see smu_integration.py + env vars)
        smu_out = send_email_for_amqp_event(method.routing_key, payload)
        if smu_out and not smu_out.get("skipped"):
            NOTIFICATIONS.append(
                {
                    "source": "smu_sendemail",
                    "routing_key": method.routing_key,
                    "result": smu_out,
                }
            )
        elif smu_out and smu_out.get("skipped"):
            # Only log once per process to avoid noise — skip reason is in first skipped result
            pass

        twilio_out = send_sms_for_amqp_event(method.routing_key, payload)
        if twilio_out and not twilio_out.get("skipped"):
            NOTIFICATIONS.append(
                {
                    "source": "twilio_sms",
                    "routing_key": method.routing_key,
                    "result": twilio_out,
                }
            )

        ch.basic_ack(delivery_tag=method.delivery_tag)

    def run():
        params = pika.ConnectionParameters(
            host=rabbit_host,
            port=rabbit_port,
            heartbeat=300,
            blocked_connection_timeout=300,
        )
        for attempt in range(1, 61):
            try:
                connection = pika.BlockingConnection(params)
                channel = connection.channel()
                channel.exchange_declare(
                    exchange=exchange_name, exchange_type=exchange_type, durable=True
                )
                channel.queue_declare(queue=queue_name, durable=True)
                channel.queue_bind(
                    exchange=exchange_name,
                    queue=queue_name,
                    routing_key="booking.cancelled",
                )
                channel.basic_consume(queue=queue_name, on_message_callback=callback)
                print("[notification] Waiting for AMQP messages...", flush=True)
                channel.start_consuming()
                return
            except Exception as e:
                print(
                    f"[notification] AMQP setup failed ({attempt}/60): {e}",
                    flush=True,
                )
                time.sleep(2)
        print("[notification] AMQP consumer stopped after max retries.", flush=True)

    thread = threading.Thread(target=run, daemon=True)
    thread.start()


def _should_start_amqp_consumer() -> bool:
    """Avoid starting the consumer twice with Flask's debug reloader parent process."""
    debug = os.environ.get("FLASK_DEBUG", "").strip().lower() in ("1", "true", "yes")
    if not debug:
        return True
    return os.environ.get("WERKZEUG_RUN_MAIN") == "true"


if __name__ == "__main__":
    if _should_start_amqp_consumer():
        start_amqp_consumer()
    debug = os.environ.get("FLASK_DEBUG", "").strip().lower() in ("1", "true", "yes")
    app.run(host="0.0.0.0", port=5106, debug=debug)


