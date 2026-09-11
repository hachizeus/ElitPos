# 🇰🇪 HostAfrica Setup Guide - ElitPOS

## Complete Deployment: elitpos.elitjohnsdigital.co.ke

---

## 📋 Prerequisites

1. **HostAfrica Account** with:
   - VPS or Shared Hosting (VPS recommended)
   - cPanel or SSH access
   - PostgreSQL support
   - Node.js support (version 18+)

2. **Domain:** elitjohnsdigital.co.ke (already registered)

3. **What You'll Deploy:**
   - PostgreSQL Database (hosted on HostAfrica)
   - Next.js Application (ElitPOS)
   - Domain: elitpos.elitjohnsdigital.co.ke

---

## 🎯 Deployment Options

### Option A: VPS (Recommended) - Full Control
- Complete control over server
- Better performance
- Can run Node.js directly
- Cost: ~$10-20/month

### Option B: Shared Hosting with Node.js
- Easier setup
- cPanel interface
- May have resource limits
- Cost: ~$5-10/month

---

## 🚀 Option A: VPS Deployment (Recommended)

### Step 1: Access Your VPS

```bash
# SSH into your VPS
ssh root@your-vps-ip
# Or use HostAfrica cPanel Terminal
```

### Step 2: Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# Install Git
sudo apt install -y git

# Install PM2 (process manager)
sudo npm install -g pm2

# Verify installations
node --version  # Should show v20.x
npm --version
psql --version  # Should show 16.x
```

### Step 3: Setup PostgreSQL Database

```bash
# Switch to postgres user
sudo -i -u postgres

# Create database and user
psql
```

In PostgreSQL prompt:
```sql
-- Create database
CREATE DATABASE elit_pos;

-- Create user with password
CREATE USER elitpos_user WITH ENCRYPTED PASSWORD 'YourStrongPassword123!';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE elit_pos TO elitpos_user;

-- Grant schema privileges
\c elit_pos
GRANT ALL ON SCHEMA public TO elitpos_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO elitpos_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO elitpos_user;

-- Exit
\q
exit
```

### Step 4: Configure PostgreSQL for Remote Access

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Find and change:
```conf
listen_addresses = '*'  # Listen on all interfaces
max_connections = 100
```

Edit pg_hba.conf:
```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Add at the end:
```conf
# Allow ElitPOS connection
host    retail_smart_erp    elitpos_user    0.0.0.0/0    scram-sha-256
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Step 5: Setup Firewall

```bash
# Allow SSH, HTTP, HTTPS, and PostgreSQL
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5432/tcp
sudo ufw enable
```

### Step 6: Clone Your ElitPOS Repository

```bash
# Create app directory
sudo mkdir -p /var/www/elitpos
cd /var/www/elitpos

# Clone repository (you'll push to GitHub first)
git clone https://github.com/hachizeus/ElitPos.git .

# Or upload files via FTP/cPanel File Manager
```

### Step 7: Configure Environment Variables

```bash
# Create production .env
nano .env
```

```env
# Database
DATABASE_URL=postgresql://elitpos_user:YourStrongPassword123!@localhost:5432/elit_pos

# Auth
NEXTAUTH_URL=https://elitpos.elitjohnsdigital.co.ke
NEXTAUTH_SECRET=generate-a-random-32-char-secret-here

# Domain
NEXT_PUBLIC_BASE_DOMAIN=elitpos.elitjohnsdigital.co.ke
NEXT_PUBLIC_LANDING_DOMAIN=elitpos.elitjohnsdigital.co.ke
NEXT_PUBLIC_APP_DOMAIN=elitpos.elitjohnsdigital.co.ke
NEXT_PUBLIC_APP_NAME=ElitPOS

# File Storage - ImageKit
IMAGEKIT_PUBLIC_KEY=public_7ByNqLc+dhzteB1WzpqkNlK+T8w=
IMAGEKIT_PRIVATE_KEY=private_u6ODgj9Ti1YLL18AeYqXmnAg7Ac=
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/elitpos
IMAGEKIT_FOLDER=elitpos

# Email - Resend
RESEND_API_KEY=re_a2jZz4xC_NiZRDctL55wY3KviGicu9k9J
SYSTEM_EMAIL_FROM=info@elitjohnsdigital.co.ke

# AI Features
DEEPSEEK_API_KEY=sk-a5faa7141756420e97c4c1c143432b09
GEMINI_API_KEY=AQ.Ab8RN6Kp6VD1bypENRfP1I1xeyoQO_0OLnMOv_FCAkN04RUFTg

# Server
PORT=3000
NODE_ENV=production
```

### Step 8: Install Dependencies & Build

```bash
# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Create super admin
npm run db:seed-admin

# Build for production
npm run build

# Build custom server
npm run build:server
```

### Step 9: Start Application with PM2

```bash
# Start with PM2
pm2 start server.js --name elitpos

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs

# Check status
pm2 status
pm2 logs elitpos
```

### Step 10: Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/elitpos
```

```nginx
server {
    listen 80;
    server_name elitpos.elitjohnsdigital.co.ke;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name elitpos.elitjohnsdigital.co.ke;

    # SSL certificates (we'll add with Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/elitpos.elitjohnsdigital.co.ke/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/elitpos.elitjohnsdigital.co.ke/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Static files caching
    location /_next/static {
        proxy_pass http://localhost:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

Enable site:
```bash
# Enable configuration
sudo ln -s /etc/nginx/sites-available/elitpos /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 11: Setup SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d elitpos.elitjohnsdigital.co.ke

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 12: DNS Configuration

In your domain registrar (or HostAfrica DNS management):

```
Type: A
Name: elitpos
Value: YOUR_VPS_IP_ADDRESS
TTL: 3600
```

Wait 10-30 minutes for DNS propagation.

---

## 🔧 Option B: Shared Hosting (cPanel)

### Step 1: Create PostgreSQL Database in cPanel

1. Login to cPanel
2. Go to **PostgreSQL Databases**
3. Create database: `elitpos_retail_smart_erp`
4. Create user: `elitpos_user`
5. Set strong password
6. Add user to database with ALL PRIVILEGES

### Step 2: Setup Node.js Application

1. In cPanel, go to **Setup Node.js App**
2. Click **Create Application**
3. Fill in:
   ```
   Node.js version: 20.x
   Application mode: Production
   Application root: elitpos
   Application URL: elitpos.elitjohnsdigital.co.ke
   Application startup file: server.js
   ```

### Step 3: Upload Files

1. Use **File Manager** or **FTP**
2. Upload all ElitPOS files to `/home/yourusername/elitpos/`
3. Make sure to upload:
   - All `src/` folder
   - `public/` folder
   - `drizzle/` folder
   - `package.json`
   - `next.config.ts`
   - `server.js`

### Step 4: Configure Environment

1. In cPanel File Manager, edit `.env`:
   ```env
   DATABASE_URL=postgresql://elitpos_user:password@localhost:5432/elit_pos
   NEXTAUTH_URL=https://elitpos.elitjohnsdigital.co.ke
   NEXTAUTH_SECRET=your-secret-here
   NODE_ENV=production
   # ... (rest of your .env)
   ```

### Step 5: Install & Deploy

1. In cPanel Node.js App section:
2. Click **Run NPM Install**
3. Wait for dependencies to install
4. Open Terminal and run:
   ```bash
   cd elitpos
   npm run db:migrate
   npm run db:seed-admin
   npm run build
   npm run build:server
   ```
5. Click **Restart** in Node.js App section

### Step 6: Setup Domain

1. In cPanel **Domains** section
2. Add subdomain: `elitpos.elitjohnsdigital.co.ke`
3. Point to `/home/yourusername/elitpos/`
4. Enable SSL (AutoSSL or Let's Encrypt)

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Site accessible at https://elitpos.elitjohnsdigital.co.ke
- [ ] SSL certificate is valid (green padlock)
- [ ] Login page loads quickly (3-5 seconds)
- [ ] Can login with super admin credentials
- [ ] Dashboard loads without errors
- [ ] Database queries are fast (<1 second)
- [ ] WebSocket connection works (check browser console)

---

## 🔐 Security Best Practices

```bash
# 1. Change PostgreSQL password regularly
ALTER USER elitpos_user WITH PASSWORD 'NewStrongPassword123!';

# 2. Restrict PostgreSQL access (pg_hba.conf)
# Only allow from localhost if app is on same server
host    retail_smart_erp    elitpos_user    127.0.0.1/32    scram-sha-256

# 3. Setup automatic backups
# Create backup script
sudo nano /root/backup-elitpos.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/elitpos"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U elitpos_user -h localhost elit_pos | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
sudo chmod +x /root/backup-elitpos.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add line:
0 2 * * * /root/backup-elitpos.sh
```

---

## 📊 Monitoring & Maintenance

### Check Application Status
```bash
pm2 status
pm2 logs elitpos --lines 100
```

### Check Database Performance
```bash
sudo -u postgres psql elit_pos
```
```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Slow queries
SELECT pid, now() - query_start as duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
ORDER BY duration DESC;
```

### Update Application
```bash
cd /var/www/elitpos
git pull origin main
npm install
npm run build
npm run build:server
pm2 restart elitpos
```

---

## 💰 Expected Costs (HostAfrica Kenya)

| Service | Specs | Cost (KES) |
|---------|-------|------------|
| VPS Basic | 2GB RAM, 2 CPU, 40GB SSD | ~1,500/month |
| VPS Standard | 4GB RAM, 4 CPU, 80GB SSD | ~3,000/month |
| Shared + Node.js | 10GB Space, Node.js support | ~500/month |

---

## 🆘 Troubleshooting

### Issue: "Cannot connect to database"
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check if database exists
sudo -u postgres psql -l | grep elit_pos

# Test connection
psql "postgresql://elitpos_user:password@localhost:5432/elit_pos"
```

### Issue: "Port 3000 already in use"
```bash
# Check what's using port 3000
sudo lsof -i :3000

# Kill process if needed
pm2 delete elitpos
pm2 start server.js --name elitpos
```

### Issue: "502 Bad Gateway"
```bash
# Check if app is running
pm2 status

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Restart services
pm2 restart elitpos
sudo systemctl restart nginx
```

---

## 📞 HostAfrica Support

- **Website:** https://hostafrica.co.ke
- **Phone:** +254 20 XXX XXXX (check their website)
- **Email:** support@hostafrica.co.ke
- **Ticket System:** Login to client area

---

## 🎉 Success!

Your ElitPOS is now live at:
**https://elitpos.elitjohnsdigital.co.ke**

Login with:
- **Email:** admin@elitjohnsdigital.co.ke
- **Password:** 0a0b0c0D.

Expected performance:
- ✅ Page loads: 2-3 seconds
- ✅ API calls: 100-300ms
- ✅ Database queries: 50-150ms
- ✅ 100% uptime with PM2

---

**Next Steps:**
1. Change super admin password
2. Create your first tenant
3. Add test data
4. Setup regular backups
5. Monitor logs and performance
