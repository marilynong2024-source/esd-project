FROM python:3.11-slim

WORKDIR /app
COPY app.py aviationstack_client.py .

RUN pip install flask flask-cors requests

EXPOSE 5102
CMD ["python", "app.py"]

