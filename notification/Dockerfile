FROM python:3.11-slim

WORKDIR /app
COPY app.py smu_integration.py .

RUN pip install flask flask-cors pika requests

EXPOSE 5106
CMD ["python", "app.py"]


