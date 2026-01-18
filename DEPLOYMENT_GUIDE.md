# MederPay Production Deployment Guide

## Prerequisites

- Ubuntu 20.04+ server with root access
- Domain name pointed to server
- PostgreSQL 14+
- Redis 6+
- Python 3.10+
- Nginx
- SSL certificate (Let's Encrypt recommended)

## 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3.10 python3.10-venv python3-pip postgresql postgresql-contrib redis-server nginx certbot python3-certbot-nginx git

# Create app user
sudo useradd -m -s /bin/bash mederpay
sudo usermod -aG sudo mederpay
```

## 2. Database Setup

```bash
# Create PostgreSQL database
sudo -u postgres psql
```

```sql
CREATE DATABASE mederpay_prod;
CREATE USER mederpay WITH PASSWORD 'your_secure_password';
ALTER ROLE mederpay SET client_encoding TO 'utf8';
ALTER ROLE mederpay SET default_transaction_isolation TO 'read committed';
ALTER ROLE mederpay SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE mederpay_prod TO mederpay;
\q
```

## 3. Application Deployment

```bash
# Switch to app user
sudo su - mederpay

# Clone repository
git clone https://github.com/mederhoo-script/mederpay1.git
cd mederpay1/backend

# Create virtual environment
python3.10 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements/production.txt
pip install -r requirements-production.txt

# Create environment file
cat > .env << EOF
# Django
DJANGO_ENV=production
SECRET_KEY=$(python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DEBUG=False

# Database
DATABASE_URL=postgresql://mederpay:your_secure_password@localhost:5432/mederpay_prod

# Redis
REDIS_URL=redis://127.0.0.1:6379/1

# Sentry (optional but recommended)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@yourdomain.com

# Monnify
MONNIFY_API_KEY=your_api_key
MONNIFY_SECRET_KEY=your_secret_key
MONNIFY_CONTRACT_CODE=your_contract_code
MONNIFY_BASE_URL=https://api.monnify.com

# CORS (if using separate frontend)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
EOF

# Run migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Create superuser
python manage.py createsuperuser
```

## 4. Gunicorn Setup

```bash
# Create Gunicorn configuration
mkdir -p /home/mederpay/mederpay1/backend/config/gunicorn

cat > /home/mederpay/mederpay1/backend/config/gunicorn/gunicorn.conf.py << EOF
import multiprocessing

bind = "127.0.0.1:8000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "gevent"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
timeout = 30
keepalive = 2

# Logging
accesslog = "/var/log/mederpay/gunicorn-access.log"
errorlog = "/var/log/mederpay/gunicorn-error.log"
loglevel = "info"

# Process naming
proc_name = "mederpay"

# Server mechanics
daemon = False
pidfile = "/var/run/mederpay/gunicorn.pid"
user = "mederpay"
group = "mederpay"
EOF

# Create log directory
sudo mkdir -p /var/log/mederpay
sudo chown mederpay:mederpay /var/log/mederpay

# Create run directory
sudo mkdir -p /var/run/mederpay
sudo chown mederpay:mederpay /var/run/mederpay
```

## 5. Systemd Service

```bash
# Create systemd service file
sudo cat > /etc/systemd/system/mederpay.service << EOF
[Unit]
Description=MederPay Gunicorn Service
After=network.target postgresql.service redis.service

[Service]
Type=notify
User=mederpay
Group=mederpay
WorkingDirectory=/home/mederpay/mederpay1/backend
Environment="PATH=/home/mederpay/mederpay1/backend/venv/bin"
ExecStart=/home/mederpay/mederpay1/backend/venv/bin/gunicorn \\
    --config /home/mederpay/mederpay1/backend/config/gunicorn/gunicorn.conf.py \\
    config.wsgi:application
ExecReload=/bin/kill -s HUP \$MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable mederpay
sudo systemctl start mederpay
sudo systemctl status mederpay
```

## 6. Nginx Configuration

```bash
# Create Nginx configuration
sudo cat > /etc/nginx/sites-available/mederpay << 'EOF'
upstream mederpay_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (will be added by certbot)
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client body size (for file uploads)
    client_max_body_size 20M;

    # Logging
    access_log /var/log/nginx/mederpay-access.log;
    error_log /var/log/nginx/mederpay-error.log;

    # Static files
    location /static/ {
        alias /home/mederpay/mederpay1/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias /home/mederpay/mederpay1/backend/media/;
        expires 7d;
    }

    # API and admin
    location / {
        proxy_pass http://mederpay_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health/ {
        proxy_pass http://mederpay_backend;
        access_log off;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/mederpay /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site

# Test configuration
sudo nginx -t

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Restart Nginx
sudo systemctl restart nginx
```

## 7. Redis Configuration

```bash
# Configure Redis for production
sudo nano /etc/redis/redis.conf
```

Update these settings:
```
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

```bash
# Restart Redis
sudo systemctl restart redis
```

## 8. Automated Backups

```bash
# Create backup script
sudo cat > /usr/local/bin/mederpay-backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/mederpay"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
sudo -u postgres pg_dump mederpay_prod | gzip > $BACKUP_DIR/mederpay_db_$TIMESTAMP.sql.gz

# Backup media files
tar -czf $BACKUP_DIR/mederpay_media_$TIMESTAMP.tar.gz /home/mederpay/mederpay1/backend/media

# Keep only last 30 days of backups
find $BACKUP_DIR -name "mederpay_*" -mtime +30 -delete

echo "Backup completed: $TIMESTAMP"
EOF

sudo chmod +x /usr/local/bin/mederpay-backup.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/mederpay-backup.sh >> /var/log/mederpay/backup.log 2>&1
```

## 9. Monitoring Setup

```bash
# Install monitoring tools
pip install sentry-sdk

# Configure in .env (already done above)
# SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

## 10. Post-Deployment Checks

```bash
# Check service status
sudo systemctl status mederpay
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status redis

# Check logs
sudo journalctl -u mederpay -f
tail -f /var/log/nginx/mederpay-access.log
tail -f /var/log/mederpay/gunicorn-error.log

# Test endpoints
curl https://yourdomain.com/admin/
curl https://yourdomain.com/api/health/

# Run tests
cd /home/mederpay/mederpay1/backend
source venv/bin/activate
python manage.py test
```

## 11. Maintenance Commands

```bash
# Update application
sudo su - mederpay
cd mederpay1
git pull
cd backend
source venv/bin/activate
pip install -r requirements/production.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart mederpay

# View logs
sudo journalctl -u mederpay -n 100 -f

# Restart services
sudo systemctl restart mederpay
sudo systemctl restart nginx

# Database backup (manual)
/usr/local/bin/mederpay-backup.sh
```

## 12. Security Checklist

- [ ] Firewall configured (UFW)
- [ ] SSH key-based authentication only
- [ ] Fail2ban installed and configured
- [ ] Regular security updates enabled
- [ ] Database password is strong
- [ ] SECRET_KEY is secure and random
- [ ] SSL certificate installed and auto-renewal configured
- [ ] Backups tested and verified
- [ ] Monitoring (Sentry) configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Admin interface secured

## 13. Troubleshooting

### Service won't start
```bash
sudo journalctl -u mederpay -n 50
# Check for permission issues, missing dependencies
```

### 502 Bad Gateway
```bash
# Check if Gunicorn is running
sudo systemctl status mederpay
# Check Nginx logs
tail -f /var/log/nginx/mederpay-error.log
```

### Database connection errors
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
# Test connection
psql -U mederpay -d mederpay_prod -h localhost
```

### Static files not loading
```bash
# Re-collect static files
cd /home/mederpay/mederpay1/backend
source venv/bin/activate
python manage.py collectstatic --noinput
sudo systemctl restart nginx
```

## Support

For issues, contact: support@mederpay.com
