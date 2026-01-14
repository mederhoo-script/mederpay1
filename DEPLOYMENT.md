# MederPay Deployment Guide

## Production Deployment Checklist

### Pre-Deployment

- [ ] Update all environment variables
- [ ] Generate strong SECRET_KEY
- [ ] Configure production database
- [ ] Set up SSL certificates
- [ ] Configure domain names
- [ ] Set DEBUG=False
- [ ] Configure CORS allowed origins
- [ ] Set up email backend
- [ ] Configure static file serving
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Configure backup strategy

### Backend Deployment

#### Option 1: Docker (Recommended)

1. **Build production image:**
   ```bash
   cd backend
   docker build -t mederpay-backend:latest .
   ```

2. **Push to registry:**
   ```bash
   docker tag mederpay-backend:latest your-registry/mederpay-backend:latest
   docker push your-registry/mederpay-backend:latest
   ```

3. **Deploy with Docker Compose:**
   ```yaml
   version: '3.8'
   
   services:
     db:
       image: postgres:15
       environment:
         POSTGRES_DB: mederpay
         POSTGRES_USER: ${DB_USER}
         POSTGRES_PASSWORD: ${DB_PASSWORD}
       volumes:
         - postgres_data:/var/lib/postgresql/data
       restart: always
   
     backend:
       image: your-registry/mederpay-backend:latest
       command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4
       environment:
         - DEBUG=False
         - SECRET_KEY=${SECRET_KEY}
         - DB_HOST=db
         - DB_NAME=mederpay
         - DB_USER=${DB_USER}
         - DB_PASSWORD=${DB_PASSWORD}
         - ALLOWED_HOSTS=${ALLOWED_HOSTS}
       ports:
         - "8000:8000"
       depends_on:
         - db
       restart: always
   
     nginx:
       image: nginx:alpine
       volumes:
         - ./nginx.conf:/etc/nginx/nginx.conf
         - ./staticfiles:/static
       ports:
         - "80:80"
         - "443:443"
       depends_on:
         - backend
       restart: always
   
   volumes:
     postgres_data:
   ```

4. **Run migrations:**
   ```bash
   docker-compose exec backend python manage.py migrate
   docker-compose exec backend python manage.py collectstatic --noinput
   ```

#### Option 2: Traditional Server

1. **Install system dependencies:**
   ```bash
   sudo apt update
   sudo apt install python3.11 python3-pip python3-venv postgresql nginx supervisor
   ```

2. **Clone repository:**
   ```bash
   git clone https://github.com/your-repo/mederpay1.git
   cd mederpay1/backend
   ```

3. **Set up virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements/production.txt
   ```

4. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

5. **Set up database:**
   ```bash
   sudo -u postgres createdb mederpay
   python manage.py migrate
   python manage.py collectstatic --noinput
   ```

6. **Configure Gunicorn:**
   Create `/etc/supervisor/conf.d/mederpay.conf`:
   ```ini
   [program:mederpay]
   directory=/path/to/mederpay1/backend
   command=/path/to/mederpay1/backend/venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 4
   user=www-data
   autostart=true
   autorestart=true
   redirect_stderr=true
   stdout_logfile=/var/log/mederpay/gunicorn.log
   ```

7. **Configure Nginx:**
   Create `/etc/nginx/sites-available/mederpay`:
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;
       
       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       
       location /static/ {
           alias /path/to/mederpay1/backend/staticfiles/;
       }
   }
   ```

8. **Enable and restart services:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/mederpay /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   sudo supervisorctl reread
   sudo supervisorctl update
   sudo supervisorctl start mederpay
   ```

### Frontend Deployment

#### Option 1: Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   cd frontend
   vercel --prod
   ```

3. **Configure environment variables in Vercel dashboard:**
   - Go to Project Settings → Environment Variables
   - Add:
     - `NEXT_PUBLIC_API_URL`: Your backend API URL
     - `NEXT_PUBLIC_MONNIFY_API_KEY`: Your Monnify API key

#### Option 2: Traditional Server

1. **Build application:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Install PM2:**
   ```bash
   npm install -g pm2
   ```

3. **Start application:**
   ```bash
   pm2 start npm --name "mederpay-frontend" -- start
   pm2 save
   pm2 startup
   ```

4. **Configure Nginx:**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

### Android Apps Deployment

1. **Generate signing key:**
   ```bash
   keytool -genkey -v -keystore mederpay-release.keystore -alias mederpay -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Build signed APKs:**
   - Open Android Studio
   - Build → Generate Signed Bundle/APK
   - Select APK
   - Choose keystore and key
   - Build release APK for both App A and App B

3. **Distribute:**
   - Upload to internal distribution platform
   - Or distribute directly to agents
   - Ensure both apps are installed on customer devices

### SSL Configuration

1. **Install Certbot:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Obtain certificates:**
   ```bash
   sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
   ```

3. **Auto-renewal:**
   ```bash
   sudo certbot renew --dry-run
   ```

### Database Backup

1. **Create backup script:**
   ```bash
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   BACKUP_DIR="/backups/mederpay"
   
   mkdir -p $BACKUP_DIR
   
   pg_dump -U postgres mederpay | gzip > $BACKUP_DIR/mederpay_$DATE.sql.gz
   
   # Keep only last 30 days
   find $BACKUP_DIR -type f -mtime +30 -delete
   ```

2. **Set up cron job:**
   ```bash
   0 2 * * * /path/to/backup-script.sh
   ```

### Monitoring

#### Sentry Setup

1. **Install Sentry SDK:**
   ```bash
   pip install sentry-sdk
   ```

2. **Configure in Django settings:**
   ```python
   import sentry_sdk
   from sentry_sdk.integrations.django import DjangoIntegration
   
   sentry_sdk.init(
       dsn="your-sentry-dsn",
       integrations=[DjangoIntegration()],
       traces_sample_rate=1.0,
       send_default_pii=True
   )
   ```

#### Application Monitoring

1. **Set up logging:**
   ```python
   LOGGING = {
       'version': 1,
       'disable_existing_loggers': False,
       'handlers': {
           'file': {
               'level': 'INFO',
               'class': 'logging.FileHandler',
               'filename': '/var/log/mederpay/django.log',
           },
       },
       'loggers': {
           'django': {
               'handlers': ['file'],
               'level': 'INFO',
               'propagate': True,
           },
       },
   }
   ```

2. **Monitor with systemd:**
   ```bash
   sudo journalctl -u mederpay -f
   ```

### Performance Optimization

1. **Database connection pooling:**
   ```python
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.postgresql',
           'CONN_MAX_AGE': 600,
           'OPTIONS': {
               'connect_timeout': 10,
           }
       }
   }
   ```

2. **Caching:**
   ```python
   CACHES = {
       'default': {
           'BACKEND': 'django.core.cache.backends.redis.RedisCache',
           'LOCATION': 'redis://127.0.0.1:6379/1',
       }
   }
   ```

3. **Static file serving:**
   - Use CDN for static files
   - Enable Gzip compression
   - Set proper cache headers

### Security Hardening

1. **Firewall configuration:**
   ```bash
   sudo ufw allow 22
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

2. **Fail2ban:**
   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

3. **Regular updates:**
   ```bash
   sudo apt update && sudo apt upgrade
   ```

### Post-Deployment

- [ ] Verify all endpoints are accessible
- [ ] Test authentication flow
- [ ] Verify database connections
- [ ] Test file uploads
- [ ] Verify email sending
- [ ] Check monitoring dashboards
- [ ] Verify backup restoration
- [ ] Load testing
- [ ] Security audit
- [ ] Update documentation

## Troubleshooting

### Common Issues

1. **Database connection errors:**
   - Check credentials in .env
   - Verify PostgreSQL is running
   - Check firewall rules

2. **Static files not loading:**
   - Run `collectstatic` command
   - Check Nginx configuration
   - Verify file permissions

3. **CORS errors:**
   - Update CORS_ALLOWED_ORIGINS
   - Verify API URL in frontend

4. **Android app not connecting:**
   - Update API_BASE_URL in build.gradle
   - Check network connectivity
   - Verify SSL certificates

## Rollback Procedure

1. **Backend rollback:**
   ```bash
   docker-compose down
   docker pull your-registry/mederpay-backend:previous-version
   docker-compose up -d
   ```

2. **Frontend rollback:**
   ```bash
   vercel rollback
   ```

3. **Database rollback:**
   ```bash
   python manage.py migrate app_name migration_number
   ```

## Maintenance

### Regular Tasks

- Daily: Check logs and monitoring
- Weekly: Review security alerts
- Monthly: Update dependencies
- Quarterly: Security audit
- Annually: Review and update documentation

---

For support during deployment, contact DevOps team
