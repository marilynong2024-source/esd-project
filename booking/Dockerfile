FROM python:3.11-slim

WORKDIR /app
COPY booking/app.py booking/traveller_os.py booking/fx_quote.py booking/catalog_validate.py ./
COPY travellerprofile/outsystems_client.py ./traveller_outsystems_client.py

RUN pip install flask flask-cors requests flask_sqlalchemy pymysql pika

EXPOSE 5101
CMD ["python", "app.py"]
