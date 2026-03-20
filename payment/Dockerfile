FROM python:3.11-slim

WORKDIR /app
COPY app.py .

RUN pip install flask flask-cors

EXPOSE 5104
CMD ["python", "app.py"]

