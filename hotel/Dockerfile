FROM python:3.11-slim

WORKDIR /app
COPY app.py extra_hotels_data.py .

RUN pip install flask flask-cors

EXPOSE 5103
CMD ["python", "app.py"]

