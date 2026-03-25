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
        rk = getattr(method, "routing_key", None) or ""
        if isinstance(rk, bytes):
            rk = rk.decode("utf-8", errors="replace")
        try:
            try:
                payload = json.loads(body.decode("utf-8"))
            except Exception:
                payload = {"raw": body.decode("utf-8", errors="ignore")}
            print(f"[notification] AMQP received routing_key={rk!r}", flush=True)
            NOTIFICATIONS.append(
                {
                    "source": "amqp",
                    "routing_key": rk,
                    "payload": payload,
                }
            )

            # Optional: SMU Lab Utilities SendEmail (see smu_integration.py + env vars)
            smu_out = send_email_for_amqp_event(rk, payload)
            if smu_out and not smu_out.get("skipped"):
                NOTIFICATIONS.append(
                    {
                        "source": "smu_sendemail",
                        "routing_key": rk,
                        "result": smu_out,
                    }
                )

            twilio_out = send_sms_for_amqp_event(rk, payload) or {}
            NOTIFICATIONS.append(
                {
                    "source": "twilio_sms",
                    "routing_key": rk,
                    "result": twilio_out,
                }
            )
            if twilio_out.get("ok"):
                print(
                    f"[notification] Twilio SMS sent sid={twilio_out.get('sid')}",
                    flush=True,
                )
            elif twilio_out.get("skipped"):
                print(
                    f"[notification] Twilio skipped: {twilio_out.get('reason')}",
                    flush=True,
                )
            elif twilio_out.get("error"):
                print(
                    f"[notification] Twilio error: {twilio_out.get('error')}",
                    flush=True,
                )
        except Exception as e:
            print(f"[notification] callback error routing_key={rk!r}: {e}", flush=True)
            NOTIFICATIONS.append(
                {
                    "source": "callback_error",
                    "routing_key": rk,
                    "error": str(e),
                }
            )
        finally:
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
                # Explicit keys — more reliable than wildcards across RabbitMQ semantics.
                for rk in ("booking.confirmed", "booking.cancelled"):
                    channel.queue_bind(
                        exchange=exchange_name,
                        queue=queue_name,
                        routing_key=rk,
                    )
                print(
                    f"[notification] Queue {queue_name!r} bound to "
                    f"booking.confirmed + booking.cancelled on {exchange_name!r}",
                    flush=True,
                )
                channel.basic_consume(queue=queue_name, on_message_callback=callback)
                tw_en = os.environ.get("TWILIO_ENABLED", "")
                tw_to = os.environ.get("TWILIO_TO_NUMBER", "")
                tw_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
                print("[notification] Waiting for AMQP messages...", flush=True)
                print(
                    f"[notification] Twilio env: ENABLED={tw_en!r} TO_SET={bool(str(tw_to).strip())} "
                    f"SID_SET={bool(str(tw_sid).strip())}",
                    flush=True,
                )
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


