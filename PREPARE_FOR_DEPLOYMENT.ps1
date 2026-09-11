# ==============================================================================
# PREPARE ELITPOS FOR HOSTAFRICA DEPLOYMENT
# ==============================================================================

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   Prepare ElitPOS for HostAfrica" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if production build exists
Write-Host "[1/6] Checking build status..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Write-Host "  ✓ .next folder exists" -ForegroundColor Green
} else {
    Write-Host "  ⚠ No build found. Building now..." -ForegroundColor Yellow
    npm run build
}

# Step 2: Build custom server
Write-Host "[2/6] Building custom server..." -ForegroundColor Yellow
npm run build:server
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ server.js built" -ForegroundColor Green
} else {
    Write-Host "  ✗ Server build failed" -ForegroundColor Red
    exit 1
}

# Step 3: Create production .env template
Write-Host "[3/6] Creating production .env template..." -ForegroundColor Yellow
$envTemplate = @"
# ==============================================================================
# PRODUCTION ENVIRONMENT - HostAfrica
# ==============================================================================

# ── Database (REQUIRED) ──────────────────────────────────────────────────────
# Get these from cPanel > PostgreSQL Databases
DATABASE_URL=postgresql://elitpos_user:YOUR_DB_PASSWORD@localhost:5432/elitpos_retail_smart_erp

# ── Auth / NextAuth (REQUIRED) ───────────────────────────────────────────────
NEXTAUTH_URL=https://elitpos.elitjohnsdigital.co.ke
NEXTAUTH_SECRET=CHANGE_THIS_TO_RANDOM_32_CHAR_STRING

# ── Domain Routing ───────────────────────────────────────────────────────────
NEXT_PUBLIC_BASE_DOMAIN=elitpos.elitjohnsdigital.co.ke
NEXT_PUBLIC_LANDING_DOMAIN=elitpos.elitjohnsdigital.co.ke
NEXT_PUBLIC_APP_DOMAIN=elitpos.elitjohnsdigital.co.ke
NEXT_PUBLIC_APP_NAME=ElitPOS

# ── File Storage — ImageKit ─────────────────────────────────────────────────
IMAGEKIT_PUBLIC_KEY=public_7ByNqLc+dhzteB1WzpqkNlK+T8w=
IMAGEKIT_PRIVATE_KEY=private_u6ODgj9Ti1YLL18AeYqXmnAg7Ac=
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/elitpos
IMAGEKIT_FOLDER=elitpos

# ── Email — Resend ──────────────────────────────────────────────────────────
RESEND_API_KEY=re_a2jZz4xC_NiZRDctL55wY3KviGicu9k9J
SYSTEM_EMAIL_FROM=info@elitjohnsdigital.co.ke

# ── AI Features ─────────────────────────────────────────────────────────────
DEEPSEEK_API_KEY=sk-a5faa7141756420e97c4c1c143432b09
GEMINI_API_KEY=AQ.Ab8RN6Kp6VD1bypENRfP1I1xeyoQO_0OLnMOv_FCAkN04RUFTg

# ── Server ──────────────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=production

# ── Cron Jobs ───────────────────────────────────────────────────────────────
CRON_SECRET=dev-cron-secret
"@

$envTemplate | Out-File -FilePath ".env.production" -Encoding UTF8
Write-Host "  ✓ .env.production created" -ForegroundColor Green
Write-Host "    Upload this and rename to .env on server" -ForegroundColor Gray

# Step 4: Create deployment package list
Write-Host "[4/6] Creating deployment package list..." -ForegroundColor Yellow
$deployFiles = @"
# ======================================
# Files to Upload to HostAfrica
# ======================================

REQUIRED FILES/FOLDERS:
  ✓ src/                    (all application code)
  ✓ public/                 (static assets)
  ✓ drizzle/                (database migrations)
  ✓ scripts/                (build and utility scripts)
  ✓ package.json            (dependencies)
  ✓ package-lock.json       (lock file)
  ✓ next.config.ts          (Next.js config)
  ✓ tsconfig.json           (TypeScript config)
  ✓ drizzle.config.ts       (Database config)
  ✓ server.js               (custom server - IMPORTANT!)
  ✓ .env.production         (rename to .env on server)

OPTIONAL (for reference):
  • HOSTAFRICA_SETUP_GUIDE.md
  • README_RENDER_MIGRATION.md
  • PERFORMANCE_STATUS.md

DO NOT UPLOAD:
  ✗ node_modules/          (install on server with: npm install)
  ✗ .next/                 (build on server with: npm run build)
  ✗ .git/                  (not needed)
  ✗ .env                   (contains local settings)
  ✗ *.ps1                  (Windows scripts)
  ✗ test-*.js              (test files)

STEPS AFTER UPLOAD:
1. Install dependencies:    npm install
2. Run migrations:          npm run db:migrate
3. Create super admin:      npm run db:seed-admin
4. Build application:       npm run build
5. Build server:            npm run build:server
6. Start with PM2:          pm2 start server.js --name elitpos
"@

$deployFiles | Out-File -FilePath "DEPLOYMENT_CHECKLIST.txt" -Encoding UTF8
Write-Host "  ✓ DEPLOYMENT_CHECKLIST.txt created" -ForegroundColor Green

# Step 5: Test if essential files exist
Write-Host "[5/6] Verifying essential files..." -ForegroundColor Yellow
$essentialFiles = @(
    "package.json",
    "next.config.ts",
    "server.js",
    "drizzle.config.ts"
)

$missing = @()
foreach ($file in $essentialFiles) {
    if (Test-Path $file) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file MISSING!" -ForegroundColor Red
        $missing += $file
    }
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "  ERROR: Missing essential files!" -ForegroundColor Red
    Write-Host "  Run npm run build:server to generate server.js" -ForegroundColor Yellow
    exit 1
}

# Step 6: Generate random secret
Write-Host "[6/6] Generating NEXTAUTH_SECRET..." -ForegroundColor Yellow
$secret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "  ✓ Generated: $secret" -ForegroundColor Green
Write-Host "    Add this to your .env file on server" -ForegroundColor Gray

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  ✅ Ready for Deployment!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Read HOSTAFRICA_SETUP_GUIDE.md" -ForegroundColor White
Write-Host "  2. Upload files listed in DEPLOYMENT_CHECKLIST.txt" -ForegroundColor White
Write-Host "  3. Update .env.production with your database credentials" -ForegroundColor White
Write-Host "  4. Follow the deployment steps in the guide" -ForegroundColor White
Write-Host ""
Write-Host "Your NEXTAUTH_SECRET (save this):" -ForegroundColor Yellow
Write-Host "  " -NoNewline
Write-Host $secret -ForegroundColor White
Write-Host ""
