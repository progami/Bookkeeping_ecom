# Setup & Configuration Guide

## Prerequisites

- Node.js 18+ 
- npm or yarn
- SQLite (included)
- Redis (optional, for caching)

## Quick Start

1. **Clone and Install**:
```bash
git clone [repository-url]
cd bookkeeping
npm install
```

2. **Environment Variables**:
```bash
cp .env.example .env
```

Required variables:
```env
# Database
DATABASE_URL="file:./bookkeeping.db"

# Xero OAuth
XERO_CLIENT_ID="your_client_id"
XERO_CLIENT_SECRET="your_client_secret"

# Application
NEXT_PUBLIC_APP_URL="https://localhost:3003"
NODE_ENV="development"

# Redis (optional)
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""
REDIS_DB="0"

# Cron Job Secret (for scheduled tasks)
CRON_SECRET="dev-secret-12345"
```

3. **Database Setup**:
```bash
npm run prisma:generate
npm run prisma:migrate
```

4. **SSL Certificates** (for HTTPS):
```bash
# Certificates are included in /certificates directory
# Or generate new ones with mkcert:
mkcert -install
mkcert localhost
```

5. **Start Development Server**:
```bash
npm run dev
# Opens https://localhost:3003
```

## Xero Configuration

1. Create a Xero app at [developer.xero.com](https://developer.xero.com)
2. Set OAuth 2.0 redirect URI: `https://localhost:3003/api/v1/xero/auth/callback`
3. Copy Client ID and Secret to `.env`
4. Scopes required:
   - `accounting.settings`
   - `accounting.transactions`
   - `accounting.contacts`
   - `accounting.reports.read`
   - `offline_access`

## Redis Setup (Optional)

Redis is used for:
- Cash flow forecast caching
- Rate limiting
- Session management

Install Redis:
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt-get install redis-server
sudo systemctl start redis
```

## Development Commands

```bash
# Start development server with HTTPS
npm run dev

# Database management
npm run prisma:studio      # Visual database editor
npm run prisma:migrate     # Run migrations
npm run prisma:generate    # Generate Prisma client

# Testing
npm run test              # Run all tests
npm run test:e2e          # End-to-end tests
npm run test:unit         # Unit tests
npm run type-check        # TypeScript validation

# Code quality
npm run lint              # Run ESLint
npm run lint:fix          # Auto-fix issues

# Build for production
npm run build
npm run start
```

## Troubleshooting

### SSL Certificate Issues
- Ensure certificates are in the `/certificates` directory
- Accept the self-signed certificate warning in your browser
- For Chrome: Type "thisisunsafe" on the warning page

### Xero Connection Issues
- Verify Client ID and Secret are correct
- Check redirect URI matches exactly
- Ensure all required scopes are enabled

### Database Issues
```bash
# Reset database
rm bookkeeping.db
npm run prisma:migrate dev --name init

# View database
npm run prisma:studio
```

### Redis Connection Issues
- Check Redis is running: `redis-cli ping`
- Verify Redis configuration in `.env`
- Application works without Redis (features degraded)

## Production Deployment

See [Deployment Guide](../README.md#-deployment) in the main README.