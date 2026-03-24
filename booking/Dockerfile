FROM python:3.11-slim

WORKDIR /app
COPY booking/app.py .
COPY travellerprofile ./travellerprofile

# Install all Python dependencies, including RabbitMQ client
RUN pip install flask flask-cors requests flask_sqlalchemy pymysql pika

EXPOSE 5101
CMD ["python", "app.py"]



