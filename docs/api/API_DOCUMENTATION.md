# Bookkeeping App API Documentation

## Base URL
- Development: `https://localhost:3003/api/v1`
- Production: `https://yourdomain.com/api/v1`

## Authentication

All API endpoints require authentication via Xero OAuth 2.0. The authentication state is managed through secure HttpOnly cookies.

### Rate Limiting

All endpoints are rate limited to prevent abuse:
- Authentication endpoints: 5 requests per 15 minutes
- Sync endpoints: 2 requests per hour
- Status endpoints: 60 requests per minute
- Report endpoints: 30 requests per minute
- Default: 100 requests per minute

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets
- `Retry-After`: Seconds to wait (only on 429 responses)

## Endpoints

### Authentication

#### Connect to Xero
```
GET /xero/auth
```
Initiates OAuth 2.0 flow with Xero.

**Response:** Redirects to Xero authorization page

---

#### OAuth Callback
```
GET /xero/auth/callback
```
Handles OAuth callback from Xero. Sets authentication cookie.

**Query Parameters:**
- `code`: Authorization code from Xero
- `state`: CSRF protection state

**Response:** Redirects to `/finance?connected=true` on success

---

#### Disconnect from Xero
```
POST /xero/disconnect
```
Disconnects from Xero and clears authentication.

**Response:**
```json
{
  "success": true,
  "message": "Disconnected from Xero"
}
```

---

### Status

#### Check Xero Connection Status
```
GET /xero/status
```
Returns current Xero connection status and organization details.

**Response:**
```json
{
  "connected": true,
  "organization": {
    "tenantId": "string",
    "tenantName": "string",
    "tenantType": "ORGANISATION"
  },
  "lastSync": "2025-06-15T10:30:00Z"
}
```

---

#### Check Database Status
```
GET /database/status
```
Returns database statistics and health status.

**Response:**
```json
{
  "hasData": true,
  "lastSync": "2025-06-15T10:30:00Z",
  "transactionCount": 1234,
  "accountCount": 5,
  "invoiceCount": 89
}
```

---

### Data Synchronization

#### Sync Data from Xero
```
POST /xero/sync
```
Synchronizes data from Xero to local database.

**Request Body:**
```json
{
  "forceFullSync": false  // Optional, defaults to false
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "glAccounts": 150,
    "bankAccounts": 5,
    "transactions": 1234,
    "invoices": 89,
    "bills": 45,
    "created": 100,
    "updated": 50
  }
}
```

---

### Financial Reports

#### Balance Sheet
```
GET /xero/reports/balance-sheet
```
Returns balance sheet data from local database.

**Query Parameters:**
- `date`: Report date (YYYY-MM-DD), defaults to today

**Response:**
```json
{
  "currentAssets": 50000,
  "currentLiabilities": 20000,
  "accountsReceivable": 15000,
  "accountsPayable": 8000,
  "inventory": 5000,
  "workingCapital": 30000
}
```

---

#### Profit & Loss
```
GET /xero/reports/profit-loss
```
Returns profit and loss statement data.

**Query Parameters:**
- `fromDate`: Start date (YYYY-MM-DD)
- `toDate`: End date (YYYY-MM-DD)
- `period`: Alternative to dates: "7d", "30d", "90d", "ytd"

**Response:**
```json
{
  "totalRevenue": 150000,
  "totalExpenses": 100000,
  "netProfit": 50000,
  "grossProfit": 80000,
  "operatingProfit": 60000
}
```

---

#### VAT Liability
```
GET /xero/reports/vat-liability
```
Returns VAT/tax liability report.

**Response:**
```json
{
  "totalTaxCollected": 15000,
  "totalTaxPaid": 8000,
  "netTaxLiability": 7000,
  "byTaxRate": [
    {
      "taxType": "OUTPUT2",
      "rate": 20,
      "collected": 10000,
      "paid": 5000
    }
  ]
}
```

---

### Bookkeeping

#### List Bank Accounts
```
GET /bookkeeping/bank-accounts
```
Returns all synchronized bank accounts.

**Response:**
```json
{
  "accounts": [
    {
      "id": "uuid",
      "name": "Business Current Account",
      "code": "090",
      "currencyCode": "GBP",
      "balance": 25000,
      "status": "ACTIVE"
    }
  ]
}
```

---

#### Get Transactions
```
GET /bookkeeping/transactions
```
Returns paginated list of bank transactions.

**Query Parameters:**
- `accountId`: Filter by bank account ID
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)
- `status`: Filter by status (reconciled, unreconciled)

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "date": "2025-06-15",
      "description": "Payment received",
      "amount": 1000,
      "status": "reconciled",
      "accountId": "uuid",
      "contactName": "Customer Ltd"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1234,
    "totalPages": 25
  }
}
```

---

#### Cash Balance
```
GET /bookkeeping/cash-balance
```
Returns total cash balance across all accounts.

**Response:**
```json
{
  "totalBalance": 75000,
  "byAccount": [
    {
      "accountId": "uuid",
      "accountName": "Current Account",
      "balance": 50000,
      "currency": "GBP"
    }
  ],
  "byCurrency": {
    "GBP": 70000,
    "USD": 5000
  }
}
```

---

### Analytics

#### Top Vendors
```
GET /analytics/top-vendors
```
Returns vendor spending analysis.

**Query Parameters:**
- `period`: Time period ("7d", "30d", "90d", "year")
- `limit`: Number of vendors to return (default: 10)

**Response:**
```json
{
  "vendorCount": 45,
  "totalSpend": 250000,
  "topVendors": [
    {
      "vendorId": "uuid",
      "name": "Supplier Co Ltd",
      "totalSpend": 50000,
      "transactionCount": 25,
      "percentOfTotal": 20
    }
  ],
  "period": "30d"
}
```

---

#### Category Spend
```
GET /analytics/category-spend
```
Returns spending breakdown by GL account categories.

**Query Parameters:**
- `period`: Time period ("7d", "30d", "90d", "year")

**Response:**
```json
{
  "categories": [
    {
      "accountCode": "400",
      "accountName": "Advertising",
      "totalSpend": 15000,
      "transactionCount": 45,
      "percentOfTotal": 6
    }
  ],
  "totalSpend": 250000,
  "period": "30d"
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": {}  // Optional additional details
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (authenticated but not allowed)
- `404`: Not Found
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

## Security

1. **Authentication**: All endpoints require valid Xero OAuth session
2. **HTTPS**: All requests must use HTTPS
3. **CORS**: Restricted to configured origins
4. **Rate Limiting**: Prevents abuse and ensures fair usage
5. **Input Validation**: All inputs are validated using Zod schemas
6. **SQL Injection**: Protected via Prisma ORM
7. **XSS**: Content-Security-Policy headers applied

## Webhooks (Future)

Webhook support is planned for real-time updates:
- Transaction created/updated
- Invoice paid
- Sync completed
- Error notifications