FROM python:3.14-alpine

RUN pip install --no-cache-dir Radicale==3.7.7
RUN addgroup -S radicale && adduser -S -G radicale radicale && \
    mkdir -p /var/lib/radicale && chown -R radicale:radicale /var/lib/radicale
COPY config /etc/radicale/config
COPY users /etc/radicale/users
EXPOSE 5232
USER radicale
CMD ["radicale", "--config", "/etc/radicale/config"]
