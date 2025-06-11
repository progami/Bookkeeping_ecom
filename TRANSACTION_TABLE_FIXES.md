# Transaction Table Fixes

## Issues Addressed

1. **Description Field**: 
   - Fixed: Was incorrectly showing reference as description
   - Now: Shows actual transaction description from line items or Xero description field

2. **Column Ordering**: 
   - Old order: Date, Reference, Description, Contact, Amount, Account, Category
   - New order: Date, Description, Contact/Payee, Reference, Amount, Bank Account, GL Account
   - This order better reflects typical accounting workflows

3. **GL Account Display**:
   - Now shows both account code and account name
   - Displays suggested account code from matched rules
   - Clear "Uncategorized" label when no account assigned

4. **Data Sync Fix**:
   - Updated sync logic to properly capture description from Xero
   - Priority: Line item description > Transaction description > Contact name

## Changes Made

### 1. API Route Updates (`/api/v1/xero/sync-all-fixed/route.ts`)
```typescript
// Fixed description field mapping
description: tx.lineItems?.[0]?.description || tx.description || tx.contact?.name || null,
```

### 2. Transaction Display (`/app/bookkeeping/transactions/page.tsx`)
- Reordered columns for better UX
- Added proper empty state displays
- Enhanced GL account display with account names
- Shows suggested accounts from rule matching

### 3. Transaction API (`/api/v1/xero/transactions/route.ts`)
- Added GL account name lookup
- Maps account codes to account names
- Returns both code and name for display

### 4. Helper Functions (`/lib/xero-helpers.ts`)
- Created getGLAccounts() to fetch chart of accounts
- Reusable Xero client helper
- Automatic token refresh handling

## To Apply Changes

1. **Run a full sync** to update existing transaction descriptions:
   - Go to Transactions page
   - Click "Full Sync" button
   - This will re-fetch all transactions with correct descriptions

2. **Column Labels**:
   - "Category" → "GL Account" (more accurate accounting term)
   - "Account" → "Bank Account" (clearer distinction)
   - "Contact" → "Contact/Payee" (covers both scenarios)

## Result

The transaction table now:
- Shows accurate descriptions from Xero
- Has logical column ordering (Date → Description → Payee → Reference → Amount)
- Displays GL account codes with names
- Shows suggested categorizations from rules
- Provides clear empty states when data is missing