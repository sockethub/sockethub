#!/bin/sh
set -eu

php /usr/local/bin/initialize-baikal.php
chown nginx:nginx /tmp/baikal.sqlite
