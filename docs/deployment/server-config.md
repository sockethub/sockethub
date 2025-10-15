# Server Configuration Examples

This guide provides example configurations for deploying Sockethub behind reverse
proxies and load balancers in production environments.

## Nginx Configuration

### Basic Nginx Reverse Proxy

```nginx
upstream sockethub_backend {
    server localhost:10550;
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name sockethub.example.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sockethub.example.com;
    
    # SSL Configuration
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    
    location / {
        proxy_pass http://sockethub_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific settings
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 60;
    }
    
    # Optional: Serve static assets directly
    location /examples/ {
        proxy_pass http://sockethub_backend;
    }
}
```

### Nginx with SSL (Let's Encrypt)

```nginx
server {
    listen 443 ssl;
    server_name sockethub.example.com;
    
    # Let's Encrypt SSL
    ssl_certificate /etc/letsencrypt/live/sockethub.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sockethub.example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    location / {
        proxy_pass http://localhost:10550;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers (if needed)
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers 
            "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
    }
    
    # Handle preflight requests
    location ~ ^/sockethub {
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
            add_header Access-Control-Allow-Headers 
                "Origin, X-Requested-With, Content-Type, Accept, Authorization";
            return 204;
        }
        
        proxy_pass http://localhost:10550;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## HAProxy Configuration

### HAProxy with SSL Termination

```
global
    daemon
    maxconn 4096
    ssl-default-bind-options no-sslv3 no-tls-tickets
    ssl-default-bind-ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384
    tune.ssl.default-dh-param 2048

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option httplog
    option dontlognull

frontend sockethub_frontend
    bind *:443 ssl crt /path/to/ssl/cert.pem
    bind *:80
    redirect scheme https if !{ ssl_fc }
    
    # WebSocket detection
    acl is_websocket hdr(Upgrade) -i websocket
    acl is_sockethub path_beg /sockethub
    
    use_backend sockethub_backend if is_websocket or is_sockethub
    default_backend sockethub_backend

backend sockethub_backend
    balance roundrobin
    server sockethub1 localhost:10550 check
    # Add more servers for load balancing:
    # server sockethub2 localhost:10551 check
    # server sockethub3 localhost:10552 check
    
    # WebSocket settings
    timeout tunnel 3600s
    timeout server 3600s
```

## Apache Configuration

### Apache with mod_proxy_wstunnel

```apache
<VirtualHost *:443>
    ServerName sockethub.example.com
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /path/to/ssl/cert.pem
    SSLCertificateKeyFile /path/to/ssl/private.key
    SSLCertificateChainFile /path/to/ssl/chain.pem
    
    # Enable required modules
    LoadModule proxy_module modules/mod_proxy.so
    LoadModule proxy_http_module modules/mod_proxy_http.so
    LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so
    
    ProxyPreserveHost On
    ProxyRequests Off
    
    # WebSocket proxy
    ProxyPass /sockethub/ ws://localhost:10550/sockethub/
    ProxyPassReverse /sockethub/ ws://localhost:10550/sockethub/
    
    # HTTP proxy for other requests
    ProxyPass / http://localhost:10550/
    ProxyPassReverse / http://localhost:10550/
    
    # Headers for WebSocket
    ProxyPassReverse / http://localhost:10550/
    ProxyPassReverseMatch ^/(.*) http://localhost:10550/$1
</VirtualHost>
```

## Docker Compose with Reverse Proxy

### Complete Stack with Nginx

```yaml
version: '3.8'

services:
  redis:
    image: redis:alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    
  sockethub:
    build: .
    restart: unless-stopped
    depends_on:
      - redis
    environment:
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
    volumes:
      - ./sockethub.config.json:/app/packages/sockethub/sockethub.config.json
    expose:
      - "10550"
      
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - sockethub

volumes:
  redis_data:
```

## Load Balancing Multiple Instances

### Nginx Load Balancer

```nginx
upstream sockethub_cluster {
    least_conn;
    server sockethub1.internal:10550;
    server sockethub2.internal:10550;
    server sockethub3.internal:10550;
    
    # Health checks
    keepalive 32;
}

server {
    listen 443 ssl;
    server_name sockethub.example.com;
    
    location / {
        proxy_pass http://sockethub_cluster;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        
        # Sticky sessions for WebSocket
        ip_hash;
    }
}
```

### Redis Cluster Configuration

For high availability, configure Redis clustering:

```yaml
# docker-compose.yml for Redis Cluster
version: '3.8'

services:
  redis-node-1:
    image: redis:alpine
    command: redis-server --port 7001 --cluster-enabled yes \
             --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7001:7001"
      
  redis-node-2:
    image: redis:alpine
    command: redis-server --port 7002 --cluster-enabled yes \
             --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7002:7002"
      
  redis-node-3:
    image: redis:alpine
    command: redis-server --port 7003 --cluster-enabled yes \
             --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7003:7003"
```

## Security Considerations

### Rate Limiting (Nginx)

```nginx
http {
    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=sockethub_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=sockethub_burst:10m rate=100r/m;
    
    server {
        location / {
            # Apply rate limiting
            limit_req zone=sockethub_limit burst=20 nodelay;
            limit_req zone=sockethub_burst burst=50 nodelay;
            
            proxy_pass http://sockethub_backend;
        }
    }
}
```

### Firewall Rules

```bash
# UFW rules for Ubuntu/Debian
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw deny 10550/tcp    # Block direct access to Sockethub
sudo ufw deny 6379/tcp     # Block direct access to Redis
sudo ufw enable
```

### TLS Best Practices

```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Security headers
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

## Monitoring Setup

### Health Check Endpoint

Add to Sockethub configuration:

```json
{
  "host": "0.0.0.0",
  "port": 10550,
  "healthCheck": {
    "enabled": true,
    "path": "/health"
  }
}
```

### Nginx Health Checks

```nginx
location /health {
    access_log off;
    proxy_pass http://sockethub_backend/health;
    proxy_set_header Host $host;
}
```

### Monitoring with Prometheus

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'sockethub'
    static_configs:
      - targets: ['sockethub.example.com:10550']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

## Troubleshooting

### Common Issues

**WebSocket connection failures:**

- Check `Upgrade` and `Connection` headers are proxied
- Verify timeout settings for long-lived connections
- Ensure proxy supports HTTP/1.1

**CORS issues:**

- Add appropriate CORS headers in proxy configuration
- Handle OPTIONS preflight requests
- Check client-side origin configuration

**SSL/TLS problems:**

- Verify certificate chain is complete
- Check cipher suite compatibility
- Ensure TLS version support

### Debug Logging

Enable debug logging in proxy:

```nginx
# Nginx debug
error_log /var/log/nginx/sockethub_error.log debug;
access_log /var/log/nginx/sockethub_access.log combined;
```

```apache
# Apache debug
LogLevel proxy:debug
ErrorLog /var/log/apache2/sockethub_error.log
CustomLog /var/log/apache2/sockethub_access.log combined
```
