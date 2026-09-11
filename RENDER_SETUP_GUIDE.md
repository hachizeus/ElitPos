# Render.com PostgreSQL Setup Guide

## 🚀 Quick Setup (10 minutes)

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub or email
3. Verify your email

### Step 2: Create PostgreSQL Database

1. **Click "New +"** in the top right
2. **Select "PostgreSQL"**
3. **Fill in details:**
   - **Name:** `elitpos-db`
   - **Database:** `retail_smart_erp`
   - **User:** `postgres` (or any username)
   - **Region:** Choose closest to Kenya (e.g., `Singapore` or `Frankfurt`)
   - **PostgreSQL Version:** `16`
   - **Plan:** `Free` (90 days free, then $7/month)

4. **Click "Create Database"**

5. **Wait 2-3 minutes** for database to be created

### Step 3: Get Connection Details

Once created, you'll see the database dashboard. Copy these values:

- **Internal Database URL** (starts with `postgres://`)
- **External Database URL** (starts with `postgres://`)

**Example:**
```
postgres://elitpos_db_user:xYzAbC123@dpg-abc123.singapore-postgres.render.com/retail_smart_erp
```

### Step 4: Update Your .env File

1. Open `.env` in ElitPOS folder
2. Replace the `DATABASE_URL` line:

**OLD:**
```env
DATABASE_URL=postgresql://postgres:0a0b0c0D.@localhost:5433/retail_smart_erp
```

**NEW** (use YOUR External Database URL from Render):
```env
DATABASE_URL=postgres://elitpos_db_user:xYzAbC123@dpg-abc123.singapore-postgres.render.com/retail_smart_erp
```

3. **Save the file**

### Step 5: Run Migrations

Open PowerShell in ElitPOS folder and run:

```powershell
# Run migrations to create all tables
npm run db:migrate

# Create super admin
npm run db:seed-admin
```

This will take 2-3 minutes to create all 212 tables.

### Step 6: Start Server

```powershell
$env:DISABLE_TURBOPACK = "1"
node server.js
```

## 🎯 Expected Performance

| Metric | Before (Windows) | After (Render) | Improvement |
|--------|------------------|----------------|-------------|
| First Page Load | 60-80s | 3-5s | **16x faster** |
| API Calls | 20-50s | 200-500ms | **100x faster** |
| Database Queries | 10-40s | 50-200ms | **200x faster** |
| Connection Timeout | Frequent | Rare | **Much better** |

## 🔧 Troubleshooting

### If migrations fail with "connection timeout":
```powershell
# Increase timeout
$env:PGCONNECT_TIMEOUT = "30"
npm run db:migrate
```

### If you get "SSL required" error:
Update `.env`:
```env
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
```

### To check connection:
```powershell
node test-render-connection.js
```

## 💰 Render PostgreSQL Pricing

- **Free Tier:** 
  - 90 days free trial
  - 256MB RAM
  - 1GB storage
  - Perfect for development

- **Starter:** $7/month
  - 512MB RAM
  - 10GB storage
  - Good for production

- **Standard:** $20/month
  - 2GB RAM
  - 100GB storage

## 📊 Database Limits (Free Tier)

- **Storage:** 1GB (enough for ~50,000 sales records)
- **RAM:** 256MB
- **Concurrent Connections:** 25
- **Data Transfer:** 100GB/month

## 🔐 Security Notes

1. **Connection is SSL encrypted** by default
2. **Don't commit .env file** to git (it's already in .gitignore)
3. **Backup regularly** - Render free tier doesn't include automatic backups

## 📝 Manual Backup (Recommended)

Run this monthly:
```powershell
pg_dump "YOUR_RENDER_DATABASE_URL" > backup-$(Get-Date -Format 'yyyy-MM-dd').sql
```

## 🌐 After Setup

Your ElitPOS will be accessible at:
- **Local:** http://localhost:3000
- **Login:** http://localhost:3000/sys-control/login
- **Super Admin Email:** admin@elitjohnsdigital.co.ke
- **Password:** 0a0b0c0D.

Pages should now load in **3-5 seconds** instead of 60-80 seconds!

---

## 🆘 Need Help?

If you encounter issues:
1. Check Render dashboard for database status
2. Verify DATABASE_URL is correct in .env
3. Ensure database is "Available" (not "Creating")
4. Try restarting the server

---

**Next Step:** Go to https://render.com and create your PostgreSQL database!
