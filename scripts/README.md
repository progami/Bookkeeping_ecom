# Database Management Scripts

This directory contains utility scripts for database maintenance and data management.

## Account Management

### `sync-gl-accounts.ts`
Syncs General Ledger accounts from Xero to local database.
```bash
npx tsx scripts/sync-gl-accounts.ts
```

### `fix-all-account-codes.ts`
Fixes missing account codes on all transactions by mapping from GL accounts.
```bash
npx tsx scripts/fix-all-account-codes.ts
```

### `fix-all-gl-accounts.ts`
Associates GL accounts with reconciled transactions that are missing them.
```bash
npx tsx scripts/fix-all-gl-accounts.ts
```

### `update-to-xero-accounts.ts`
Updates local GL accounts to match Xero's current chart of accounts.
```bash
npx tsx scripts/update-to-xero-accounts.ts
```

## Database Utilities

### `check-db.ts`
Checks database connection and displays table statistics.
```bash
npx tsx scripts/check-db.ts
```

### `reset-database.ts`
**CAUTION**: Completely resets the database, removing all data.
```bash
npx tsx scripts/reset-database.ts
```

### `populate-test-accounts.ts`
Populates database with test data for development.
```bash
npx tsx scripts/populate-test-accounts.ts
```

## Transaction Utilities

### `resync-transactions-with-gl.ts`
Re-syncs transactions and ensures proper GL account associations.
```bash
npx tsx scripts/resync-transactions-with-gl.ts
```

### `inspect-xero-transaction.ts`
Inspects a specific Xero transaction by ID for debugging.
```bash
npx tsx scripts/inspect-xero-transaction.ts <transaction-id>
```

### `inspect-line-items.ts`
Analyzes line items in transactions to understand data structure.
```bash
npx tsx scripts/inspect-line-items.ts
```

## Verification Scripts

### `verify-gl-accounts.ts`
Verifies GL account integrity and relationships.
```bash
npx tsx scripts/verify-gl-accounts.ts
```

### `check-account-mapping.ts`
Checks account code mappings between transactions and GL accounts.
```bash
npx tsx scripts/check-account-mapping.ts
```

## SOP Management

### `sync-sop-data.ts`
Syncs Standard Operating Procedures data to the database.
```bash
npx tsx scripts/sync-sop-data.ts
```

## Authentication

### `xero-auth.ts`
Standalone Xero authentication test script.
```bash
npx tsx scripts/xero-auth.ts
```

## Usage Notes

1. Always backup your database before running modification scripts
2. Most scripts require Xero authentication to be configured
3. Run verification scripts after major data changes
4. Use `check-db.ts` first to ensure database connectivity