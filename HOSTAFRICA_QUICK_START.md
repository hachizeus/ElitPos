# 🚀 HostAfrica Quick Start - ElitPOS

## ⚡ 30-Minute Deployment

### 📋 What You Need
- HostAfrica VPS or Shared Hosting account
- SSH or cPanel access
- Domain: elitpos.elitjohnsdigital.co.ke
- 30 minutes

---

## 🎯 Quick Setup (Choose Your Method)

### Method 1: VPS with SSH (Best Performance) ⭐

#### 1. Prepare Files Locally (5 minutes)
```powershell
# On your Windows PC
cd C:\Users\Lenovo\Desktop\ElitPOS
.\PREPARE_FOR_DEPLOYMENT.ps1
```

#### 2. Upload to Server (10 minutes)
```bash
# Option A: Using Git (Recommended)
# First, push to GitHub:
git add .
git commit -m "Prepare for HostAfrica deployment"
git push origin main

# On server:
ssh root@your-server-ip
git clone https://github.com/hachizeus/ElitPos.git /var/www/elitpos

# Option B: Using SCP
scp -r ./ElitPOS/* root@your-server-ip:/var/www/elitpos/
```

#### 3. Setup Database (5 minutes)
```bash
# On server
sudo -i -u postgres psql

# In PostgreSQL:
CREATE DATABASE retail_smart_erp;
CREATE USER elitpos_user WITH PASSWORD 'StrongPassword123!';
GRANT ALL PRIVILEGES ON DATABASE retail_smart_erp TO elitpos_user;
\q
exit
```

#### 4. Deploy Application (10 minutes)
```bash
cd /var/www/elitpos

# Install dependencies
npm install

# Create .env
nano .env
# Paste production config (see below)

# Run migrations
npm run db:migrate
npm run db:seed-admin

# Build
npm run build
npm run build:server

# Start
pm2 start server.js --name elitpos
pm2 save
```

#### 5. Setup Nginx (5 minutes)
```bash
sudo nano /etc/nginx/sites-available/elitpos
# Paste nginx config from guide

sudo ln -s /etc/nginx/sites-available/elitpos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL
sudo certbot --nginx -d elitpos.elitjohnsdigital.co.ke
```

---

### Method 2: cPanel (Easier, Slower)

#### 1. Create Database (3 minutes)
- cPanel → PostgreSQL Databases
- Create: `elitpos_retail_smart_erp`
- User: `elitpos_user`
- Password: Strong password
- Add user to database

#### 2. Upload Files (10 minutes)
- cPanel → File Manager
- Navigate to `/public_html/elitpos/`
- Upload all files from local ElitPOS folder
- **Exclude:** node_modules, .next, .git

#### 3. Setup Node.js App (5 minutes)
- cPanel → Setup Node.js App
- Create Application:
  - Version: 20.x
  - Root: elitpos
  - URL: elitpos.elitjohnsdigital.co.ke
  - Startup: server.js

#### 4. Configure & Deploy (10 minutes)
- Edit .env in File Manager (use .env.production template)
- In cPanel Terminal:
```bash
cd elitpos
npm install
npm run db:migrate
npm run db:seed-admin
npm run build
npm run build:server
```
- Restart Node.js app in cPanel

#### 5. Setup Domain (2 minutes)
- cPanel → Domains
- Add: elitpos.elitjohnsdigital.co.ke
- Enable SSL (AutoSSL)

---

## 📝 Production .env Template

```env
DATABASE_URL=postgresql://elitpos_user:YOUR_PASSWORD@localhost:5432/elitpos_retail_smart_erp
NEXTAUTH_URL=https://elitpos.elitjohnsdigital.co.ke
NEXTAUTH_SECRET=GENERATE_WITH_PREPARE_SCRIPT
NEXT_PUBLIC_BASE_DOMAIN=elitpos.elitjohnsdigital.co.ke
NEXT_PUBLIC_LANDING_DOMAIN=elitpos.elitjohnsdigital.co.ke
NEXT_PUBLIC_APP_DOMAIN=elitpos.elitjohnsdigital.co.ke
NEXT_PUBLIC_APP_NAME=ElitPOS
NODE_ENV=production
PORT=3000

# Copy these from your local .env
IMAGEKIT_PUBLIC_KEY=your_key
IMAGEKIT_PRIVATE_KEY=your_key
IMAGEKIT_URL_ENDPOINT=your_endpoint
RESEND_API_KEY=your_key
SYSTEM_EMAIL_FROM=info@elitjohnsdigital.co.ke
DEEPSEEK_API_KEY=your_key
GEMINI_API_KEY=your_key
```

---

## ✅ Quick Verification

After deployment:
```bash
# Check app is running
pm2 status
pm2 logs elitpos

# Check database
psql "postgresql://elitpos_user:password@localhost:5432/retail_smart_erp" -c "\dt"

# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check SSL
curl -I https://elitpos.elitjohnsdigital.co.ke
```

Visit: https://elitpos.elitjohnsdigital.co.ke
- Should load in 2-3 seconds ✅
- SSL should be valid (green padlock) ✅
- Login should work ✅

---

## 🔧 Common Commands

```bash
# Restart app
pm2 restart elitpos

# View logs
pm2 logs elitpos --lines 100

# Update app (after git push)
cd /var/www/elitpos
git pull
npm install
npm run build
pm2 restart elitpos

# Backup database
pg_dump -U elitpos_user retail_smart_erp > backup.sql

# Restore database
psql -U elitpos_user retail_smart_erp < backup.sql

# Check disk space
df -h

# Check memory
free -h

# Check port usage
sudo lsof -i :3000
```

---

## 🆘 Troubleshooting

### Can't connect to site
```bash
# Check Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# Check app
pm2 status
pm2 logs elitpos
```

### Database errors
```bash
# Check PostgreSQL
sudo systemctl status postgresql
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# Test connection
psql "postgresql://elitpos_user:password@localhost:5432/retail_smart_erp"
```

### SSL not working
```bash
# Renew certificate
sudo certbot renew
sudo systemctl restart nginx
```

---

## 📞 Support Contacts

**HostAfrica:**
- Website: https://hostafrica.co.ke
- Support: support@hostafrica.co.ke

**Your Domain:**
- elitjohnsdigital.co.ke
- Subdomain: elitpos.elitjohnsdigital.co.ke

**ElitPOS Login:**
- URL: https://elitpos.elitjohnsdigital.co.ke/sys-control/login
- Email: admin@elitjohnsdigital.co.ke
- Password: 0a0b0c0D. (change after first login!)

---

## 🎉 Success Checklist

- [ ] Site accessible at https://elitpos.elitjohnsdigital.co.ke
- [ ] SSL certificate valid
- [ ] Page loads in 2-3 seconds
- [ ] Can login with super admin
- [ ] Dashboard loads successfully
- [ ] Can create tenant/company
- [ ] No console errors
- [ ] WebSocket connected
- [ ] Database queries are fast

---

**Total Time:** ~30 minutes
**Expected Performance:** 2-3 second page loads, <500ms API calls
**Status:** Production Ready! 🚀

For detailed instructions, see: **HOSTAFRICA_SETUP_GUIDE.md**
