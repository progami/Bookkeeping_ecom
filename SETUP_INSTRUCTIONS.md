# Bookkeeping Module - Standalone Setup Instructions

This is a standalone version of the bookkeeping module extracted from the main Ecom OS application.

## Features

- **Dashboard**: Overview of categorization rules and system status
- **Rule Management**: Create, edit, delete, and manage categorization rules
- **Advanced Features**: Search, filter, sort, bulk actions, and more
- **Beautiful UI**: Unique emerald/cyan/purple themed interface

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   ```

3. **Initialize database**:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Access the application**:
   Open http://localhost:3000 in your browser

## Project Structure

```
bookkeeping_standalone/
├── app/
│   ├── api/v1/bookkeeping/    # API routes
│   ├── bookkeeping/            # UI pages
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home page (redirects to /bookkeeping)
├── lib/
│   ├── prisma.ts               # Prisma client
│   └── utils.ts                # Utility functions
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Seed data
├── tests/                      # Test files
└── [config files]              # Various configuration files
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run prisma:studio` - Open Prisma Studio

## Database

This standalone version uses SQLite by default. To use PostgreSQL:

1. Update `.env`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/bookkeeping"
   ```

2. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

## Testing

Run the comprehensive test suite:
```bash
npm test
```

For Playwright tests:
```bash
npx playwright test
```

## Notes

- All bookkeeping functionality is preserved from the main application
- The module runs independently without dependencies on other Ecom OS modules
- Authentication has been removed for simplicity (can be added back if needed)
- The UI maintains the same design and user experience as in the main app