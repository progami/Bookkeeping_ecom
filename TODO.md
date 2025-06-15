# Production Readiness TODO List

## 🚨 CRITICAL (P0) - Security & Data Integrity

### Authentication & Security
- [x] **Fix CSRF Token Generation** - Replace Math.random() with crypto.randomBytes() ✅
  - File: `app/api/v1/xero/auth/route.ts:11`
  - Risk: Predictable tokens enable CSRF attacks
  ```typescript
  // Replace: Math.random().toString(36).substring(7)
  // With: crypto.randomBytes(32).toString('hex')
  ```

- [x] **Fix Cookie Security Configuration** ✅
  - File: `app/api/v1/xero/auth/route.ts:23`
  - Use environment-based configuration for secure flag
  ```typescript
  secure: process.env.NODE_ENV === 'production'
  ```

- [ ] **Implement Request Body Validation**
  - Add Zod validation to all API endpoints
  - Priority endpoints: `/api/v1/bookkeeping/sops/*`, `/api/v1/xero/*`
  - Create shared validation schemas

- [x] **Remove Sensitive Data from Logs** ✅
  - Files: `lib/xero-session.ts:64-85`, multiple locations
  - Implement log sanitization utility
  - Use structured logging (Winston/Pino)

### Database Issues
- [x] **Fix Prisma Connection Leak** 🔴 ✅
  - File: `app/api/v1/bookkeeping/sops/[id]/route.ts:4`
  - Import singleton from `lib/prisma.ts`
  - Never create new PrismaClient in routes

- [x] **Replace Float with Decimal for Money** 🔴 ✅
  - Update schema.prisma: All financial amounts
  - Use Prisma's Decimal type or store as integers (cents)
  - Risk: Financial calculation errors

- [x] **Add Database Transactions** ✅
  - Wrap all sync operations in Prisma transactions
  - Prevent partial data corruption on failures

### Memory & Performance
- [x] **Fix OAuth State Store Memory Leak** ✅
  - File: `lib/oauth-state.ts`
  - Add max size limit (e.g., 1000 states)
  - Implement background cleanup interval

- [x] **Fix Token Refresh Race Condition** ✅
  - File: `lib/xero-client.ts:106-124`
  - Implement mutex/lock for token refresh
  - Use Redis SET with NX flag

## 🔴 HIGH PRIORITY (P1) - Production Essentials

### Infrastructure
- [ ] **Create Health Check Endpoint**
  ```typescript
  // /api/health
  - Database connectivity
  - Redis connectivity
  - Xero API status
  - Memory usage
  ```

- [ ] **Add Security Headers Middleware**
  ```typescript
  - Strict-Transport-Security
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - Content-Security-Policy
  ```

- [ ] **Implement Request Size Limits**
  - Add body size limit middleware (1MB default)
  - Configure file upload limits

- [ ] **Add Request Timeout Configuration**
  - Set global timeout (30s)
  - Longer timeout for sync operations (5min)

### Error Handling
- [ ] **Implement Centralized Error Handler**
  - Create error middleware
  - Standardize error response format
  - Strip stack traces in production

- [ ] **Add Graceful Shutdown Handlers**
  - Fix `lib/redis.ts:38-41` timeout issue
  - Close database connections properly
  - Drain request queue

### Monitoring & Logging
- [ ] **Implement Structured Logging**
  - Replace console.log with Winston/Pino
  - Add request ID tracking
  - Implement log levels (debug/info/warn/error)

- [ ] **Add Metrics Endpoints**
  - API request counts
  - Response times
  - Error rates
  - Rate limit status

## ⚠️ MEDIUM PRIORITY (P2) - Optimization & Quality

### API Design
- [ ] **Add OpenAPI/Swagger Documentation**
  - Document all endpoints
  - Include request/response schemas
  - Generate client SDKs

- [ ] **Implement API Versioning Strategy**
  - Plan v2 structure
  - Add deprecation headers
  - Create migration guide

### Rate Limiting Enhancements
- [ ] **Add Per-IP Rate Limiting**
  - Prevent tenant ID spoofing
  - Use Redis for distributed limiting

- [ ] **Fix Rate Limiter State Persistence**
  - Move from in-memory to Redis
  - Handle Redis connection failures gracefully

- [ ] **Validate Tenant ID Against Session**
  - File: `middleware/xero-rate-limit.ts:16-17`
  - Prevent rate limit bypass

### Database Optimization
- [ ] **Add Composite Indexes**
  ```sql
  @@index([bankAccountId, date])
  @@index([status, type, date])
  @@index([contactId, type])
  ```

- [ ] **Implement Query Performance Monitoring**
  - Use Prisma's query logging
  - Identify slow queries
  - Add query timeouts

### Business Logic
- [ ] **Implement Idempotency Keys**
  - Payment creation
  - Sync operations
  - Critical mutations

- [ ] **Add Audit Trail Table**
  - Track all data modifications
  - Include user, timestamp, changes
  - Comply with financial regulations

- [ ] **Implement Data Retention Policy**
  - Archive old sync logs
  - Purge expired sessions
  - Compress historical data

## 📋 LONG TERM (P3) - Architecture & Scale

### Infrastructure Evolution
- [ ] **Migrate from SQLite to PostgreSQL**
  - Better concurrency
  - True decimal support
  - Connection pooling

- [ ] **Fix Redis Performance Issues**
  - Investigate root cause
  - Implement circuit breaker
  - Add fallback mechanisms

- [ ] **Implement Event-Driven Architecture**
  - Use message queue for syncs
  - Decouple Xero integration
  - Enable real-time updates

### Advanced Features
- [ ] **Add Webhook Support**
  - Implement HMAC validation
  - Handle Xero webhooks
  - Real-time data updates

- [ ] **Implement Caching Strategy**
  - Cache Xero responses
  - Add cache invalidation
  - Use ETags for efficiency

- [ ] **Add Multi-Region Support**
  - Handle timezone properly
  - Currency conversion
  - Localization

## 📚 Xero-Specific Best Practices

### Token Management (Based on Xero Docs)
- [ ] **Implement 25-Minute Token Refresh**
  - Refresh before 30-minute expiry
  - Handle refresh token rotation
  - Store only latest token set

- [ ] **Add Token Refresh Monitoring**
  - Track refresh failures
  - Alert on repeated failures
  - Implement fallback auth flow

- [ ] **Secure Token Storage**
  - Encrypt tokens at rest
  - Use secure session storage
  - Implement token rotation

### API Usage
- [ ] **Implement Exponential Backoff**
  - Handle 429 rate limit errors
  - Use Retry-After header
  - Queue failed requests

- [ ] **Add Request Correlation IDs**
  - Track requests across services
  - Aid in debugging
  - Required for Xero support

- [ ] **Implement Batch Operations**
  - Use Xero's batch endpoints
  - Reduce API call count
  - Improve sync performance

## 🧪 Testing & Quality

- [ ] **Create Integration Test Suite**
  - Test Xero API integration
  - Mock external services
  - Test error scenarios

- [ ] **Add Load Testing**
  - Test rate limiting
  - Identify bottlenecks
  - Validate scaling strategy

- [ ] **Implement E2E Testing**
  - Test critical user flows
  - Automated regression testing
  - Performance benchmarks

## 📊 Metrics to Track

- [ ] API response times (p50, p95, p99)
- [ ] Error rates by endpoint
- [ ] Rate limit usage percentage
- [ ] Database query performance
- [ ] Memory usage trends
- [ ] Token refresh success rate
- [ ] Sync operation duration
- [ ] Active user sessions

## 🚀 Deployment Checklist

- [ ] Environment variables validated
- [ ] SSL certificates configured
- [ ] Database migrations tested
- [ ] Backup strategy implemented
- [ ] Monitoring alerts configured
- [ ] Error tracking enabled (Sentry)
- [ ] Log aggregation setup
- [ ] Runbook documented

---

**Estimated Timeline:**
- P0 items: 1-2 weeks (MUST complete before production)
- P1 items: 2-3 weeks (Highly recommended)
- P2 items: 3-4 weeks (Important for scale)
- P3 items: 4-8 weeks (Long-term improvements)

**Total: 10-17 weeks for full production readiness**

**Minimum Viable Production: Complete all P0 + critical P1 items (3-4 weeks)**