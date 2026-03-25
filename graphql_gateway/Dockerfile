FROM python:3.11-slim

WORKDIR /app
COPY app.py .

RUN pip install flask flask-cors requests graphene

EXPOSE 5110
CMD ["python", "app.py"]
