# Cash Flow Module Setup Guide

## Prerequisites Installed ✅
- Redis (v8.0.2) - Running on localhost:6379
- Node packages: bottleneck, ioredis, recharts
- Database tables created via Prisma

## Environment Variables Added ✅
```env
# Redis Configuration
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""
REDIS_DB="0"

# Cron Job Secret
CRON_SECRET="dev-secret-12345"
```

## Starting the Application

1. **Ensure Redis is running:**
   ```bash
   brew services list | grep redis
   # Should show: redis started
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Open https://localhost:3003
   - Navigate to Finance Dashboard
   - Click on "Cash Flow Management" (now marked as Active)

## Using the Cash Flow Module

### Initial Setup
1. **Connect to Xero** (if not already connected):
   - Go to Bookkeeping module
   - Click "Connect to Xero"
   - Complete OAuth flow

2. **Sync Cash Flow Data:**
   - In Cash Flow module, click "Sync Data"
   - This will pull:
     - Open invoices and bills
     - Repeating transactions
     - Calculate payment patterns
     - Generate tax obligations

3. **Import Budgets (Optional):**
   - Click "Download Template" to get Excel template
   - Fill in budget data
   - Click "Import Budget" to upload
   - OR import from Xero Budget Manager export

### Features Available
- **90-day Cash Flow Forecast** with daily projections
- **Scenario Planning** (best/worst case toggle)
- **Critical Alerts** for low balance, large payments, tax dues
- **Budget Import/Export** via Excel
- **UK Tax Calculations** (VAT, PAYE/NI, Corporation Tax)
- **Confidence Levels** for each forecast component

### API Endpoints
- `GET /api/v1/cashflow/forecast?days=90` - Get forecast
- `POST /api/v1/cashflow/sync` - Trigger data sync
- `GET /api/v1/cashflow/budget/template` - Download template
- `POST /api/v1/cashflow/budget/import` - Import budgets
- `POST /api/v1/cashflow/reconcile` - Full reconciliation

## Troubleshooting

### Redis Connection Issues
```bash
# Check Redis status
redis-cli ping
# Should return: PONG

# Restart Redis if needed
brew services restart redis
```

### Rate Limiting
The module implements Xero's rate limits:
- 60 requests per minute
- 5000 requests per day
- 5 concurrent requests per tenant

### Weekly Reconciliation (Optional)
To catch deleted/voided transactions, set up a weekly cron job:
```bash
curl -X POST https://localhost:3003/api/v1/cashflow/reconcile \
  -H "Authorization: Bearer dev-secret-12345"
```

## Module Architecture
- **Rate Limiter**: Bottleneck + Redis for distributed limiting
- **Data Sync**: Delta syncs with ModifiedAfter filter
- **Forecast Engine**: Multi-source confidence-weighted projections
- **Tax Calculator**: UK-specific tax obligations with accurate due dates
- **Budget System**: Excel/CSV import with Xero export support