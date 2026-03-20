FROM python:3.11-slim

WORKDIR /app
COPY app.py .

RUN pip install flask flask-cors pika

EXPOSE 5106
CMD ["python", "app.py"]


