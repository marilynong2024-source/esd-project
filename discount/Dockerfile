FROM python:3.11-slim

WORKDIR /app
COPY app.py .

RUN pip install flask flask-cors requests

EXPOSE 5112
CMD ["python", "app.py"]

