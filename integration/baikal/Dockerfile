FROM ckulka/baikal:0.10.1-nginx

COPY baikal.yaml /var/www/baikal/config/baikal.yaml
COPY initialize.php /usr/local/bin/initialize-baikal.php
COPY initialize.sh /docker-entrypoint.d/30-initialize-baikal.sh
RUN chmod +x /docker-entrypoint.d/30-initialize-baikal.sh
