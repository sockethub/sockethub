FROM python:3.13-alpine

RUN pip install --no-cache-dir Radicale==3.7.7
COPY config /etc/radicale/config
COPY users /etc/radicale/users
EXPOSE 5232
CMD ["radicale", "--config", "/etc/radicale/config"]
