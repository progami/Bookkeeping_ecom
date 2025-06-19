# Backend Architecture Guide

This document outlines the backend architecture patterns and conventions used in this application. These patterns are designed to be reusable across different business domains while maintaining consistency and scalability.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Core Design Principles](#core-design-principles)
- [Project Structure](#project-structure)
- [Key Components](#key-components)
- [API Design Standards](#api-design-standards)
- [Data Layer](#data-layer)
- [Background Jobs & Queues](#background-jobs--queues)
- [Authentication & Security](#authentication--security)
- [Error Handling](#error-handling)
- [Logging & Monitoring](#logging--monitoring)
- [Testing Strategy](#testing-strategy)
- [Performance Considerations](#performance-considerations)

## Architecture Overview

This application follows a modular, service-oriented architecture built on Next.js 14 with the following key characteristics:

- **Hybrid Rendering**: Server-side rendering for initial loads, client-side for interactions
- **API-First Design**: All business logic exposed through RESTful APIs
- **Queue-Based Processing**: Asynchronous operations handled via BullMQ/Redis
- **Database Agnostic**: Prisma ORM for database flexibility
- **OAuth 2.0 Integration**: Standardized third-party service authentication

## Core Design Principles

### 1. Separation of Concerns
- **Routes**: Handle HTTP requests/responses only
- **Services**: Contain business logic
- **Data Access**: Isolated in repository patterns
- **Workers**: Process background jobs independently

### 2. Stateless Architecture
- No server-side session storage
- JWT tokens for authentication
- Redis for temporary state and caching

### 3. Error Resilience
- Graceful degradation
- Comprehensive error boundaries
- Retry mechanisms for external services

### 4. Security First
- Input validation on all endpoints
- SQL injection prevention via Prisma
- XSS protection through proper escaping
- CSRF tokens for state-changing operations

## Project Structure

```
/
├── app/                    # Next.js 14 app directory
│   ├── api/               # API routes
│   │   └── v1/           # Versioned API endpoints
│   │       ├── auth/     # Authentication endpoints
│   │       ├── [domain]/ # Domain-specific endpoints
│   │       └── system/   # System health/monitoring
│   └── [pages]/          # Frontend pages
├── lib/                   # Core library code
│   ├── api/              # API utilities
│   ├── auth/             # Authentication logic
│   ├── errors/           # Error handling
│   ├── queue/            # Queue management
│   │   ├── processors/   # Job processors
│   │   └── workers/      # Worker initialization
│   └── utils/            # Shared utilities
├── prisma/               # Database schema
├── components/           # React components
└── contexts/            # React contexts
```

## Key Components

### 1. API Route Handler Pattern

```typescript
// app/api/v1/[domain]/[resource]/route.ts
import { createApiHandler } from '@/lib/api-helpers';
import { validateSession } from '@/lib/auth/session-validation';
import { z } from 'zod';

const requestSchema = z.object({
  // Define request validation
});

export const POST = createApiHandler({
  authenticate: true,
  schema: requestSchema,
  handler: async (req, { user, body }) => {
    // Business logic here
    return { success: true, data: result };
  }
});
```

### 2. Service Layer Pattern

```typescript
// lib/services/[domain]-service.ts
export class DomainService {
  constructor(
    private prisma: PrismaClient,
    private cache: RedisClient,
    private externalClient: ExternalAPIClient
  ) {}

  async performOperation(params: OperationParams): Promise<Result> {
    // 1. Validate business rules
    // 2. Check cache
    // 3. Perform operation
    // 4. Update cache
    // 5. Return result
  }
}
```

### 3. Queue Processor Pattern

```typescript
// lib/queue/processors/[domain]-processor.ts
import { Job, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';

export async function processDomainJob(job: Job<JobData>) {
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    // Process job
    return { success: true };
  } catch (error) {
    // Handle error
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export const domainWorker = new Worker(
  'domain-queue',
  processDomainJob,
  { connection: redis }
);
```

## API Design Standards

### Versioning
- All APIs versioned under `/api/v1/`
- Version in URL, not headers
- Deprecation notices via headers

### RESTful Conventions
```
GET    /api/v1/resources       # List
POST   /api/v1/resources       # Create
GET    /api/v1/resources/:id   # Read
PUT    /api/v1/resources/:id   # Update
DELETE /api/v1/resources/:id   # Delete
```

### Response Format
```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "uuid"
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

### Pagination
```typescript
{
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Data Layer

### Prisma Schema Conventions

```prisma
model DomainEntity {
  id        String   @id @default(cuid())
  
  // External references
  externalId String? @unique
  userId     String
  user       User    @relation(fields: [userId], references: [id])
  
  // Domain fields
  name      String
  status    String
  metadata  Json?
  
  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  
  // Indexes
  @@index([userId, status])
  @@index([externalId])
}
```

### Database Migrations
```bash
# Development
npm run db:migrate:dev

# Production
npm run db:migrate:deploy
```

### Caching Strategy
- Redis for session data
- Cache-aside pattern for frequently accessed data
- TTL based on data volatility

## Background Jobs & Queues

### Queue Configuration
```typescript
// lib/queue/config.ts
export const QUEUE_NAMES = {
  SYNC: 'sync-queue',
  WEBHOOK: 'webhook-queue',
  NOTIFICATION: 'notification-queue'
};

export const QUEUE_OPTIONS = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 1000
  }
};
```

### Job Processing
1. Jobs are queued via API endpoints
2. Workers process jobs asynchronously
3. Progress tracked in Redis
4. Results stored in database

## Authentication & Security

### OAuth 2.0 Flow
```typescript
// 1. Initialize OAuth
const authUrl = await oauthClient.buildAuthUrl({
  scopes: ['read', 'write'],
  state: generateState()
});

// 2. Handle callback
const tokens = await oauthClient.exchangeCode(code);

// 3. Store encrypted tokens
await storeTokens(userId, encrypt(tokens));

// 4. Use tokens
const client = await createAuthenticatedClient(userId);
```

### Session Management
- JWT tokens with refresh capability
- Secure, httpOnly cookies
- Token rotation on refresh

### Security Headers
```typescript
// middleware.ts
export const config = {
  headers: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
};
```

## Error Handling

### Error Classes
```typescript
// lib/errors/
export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

export class ValidationError extends ApiError {
  constructor(details: any) {
    super('VALIDATION_ERROR', 400, 'Validation failed', details);
  }
}
```

### Global Error Handler
```typescript
// lib/api/error-handler.ts
export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return NextResponse.json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    }, { status: error.statusCode });
  }
  
  // Log unexpected errors
  logger.error('Unexpected error', error);
  
  return NextResponse.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  }, { status: 500 });
}
```

## Logging & Monitoring

### Structured Logging
```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({
      level: 'INFO',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  error: (message: string, error: Error, meta?: any) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      message,
      error: {
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};
```

### Audit Logging
```typescript
// Track all state changes
await auditLog({
  action: 'RESOURCE_UPDATED',
  resourceType: 'Order',
  resourceId: orderId,
  userId: user.id,
  changes: diff(oldData, newData),
  metadata: { ip: req.ip }
});
```

### Performance Monitoring
- Track API response times
- Monitor queue processing times
- Alert on error thresholds

## Testing Strategy

### Unit Tests
```typescript
// __tests__/services/domain-service.test.ts
describe('DomainService', () => {
  let service: DomainService;
  let mockPrisma: MockPrismaClient;
  
  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = new DomainService(mockPrisma);
  });
  
  it('should perform operation successfully', async () => {
    // Test implementation
  });
});
```

### Integration Tests
```typescript
// __tests__/api/resources.test.ts
describe('POST /api/v1/resources', () => {
  it('should create resource', async () => {
    const response = await fetch('/api/v1/resources', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' })
    });
    
    expect(response.status).toBe(201);
  });
});
```

### E2E Tests
- Playwright for full user flows
- Test against staging environment
- Run critical paths before deployment

## Performance Considerations

### Database Optimization
- Use indexes for frequent queries
- Implement cursor-based pagination for large datasets
- Connection pooling via Prisma

### Caching Strategy
- Cache API responses with appropriate TTLs
- Use Redis for session storage
- Implement cache warming for critical data

### Rate Limiting
```typescript
// lib/rate-limiter.ts
export const rateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Async Processing
- Use queues for heavy operations
- Implement webhooks for real-time updates
- Stream large responses

## Best Practices

### 1. Configuration Management
- Use environment variables for secrets
- Validate config on startup
- Never commit sensitive data

### 2. Dependency Injection
- Pass dependencies explicitly
- Use factories for complex objects
- Mock dependencies in tests

### 3. Data Validation
- Validate all inputs with Zod
- Sanitize data before storage
- Escape output appropriately

### 4. Documentation
- Document all API endpoints
- Include request/response examples
- Maintain changelog for breaking changes

### 5. Monitoring
- Log all errors with context
- Track business metrics
- Set up alerts for anomalies

## Migration Guide

When adapting this architecture for a new domain:

1. **Replace Domain-Specific Code**
   - Update Prisma schema for your entities
   - Implement your business logic in services
   - Create appropriate API endpoints

2. **Configure External Services**
   - Set up OAuth for your provider
   - Configure webhooks if needed
   - Implement service-specific clients

3. **Adjust Queue Processors**
   - Define your job types
   - Implement processors for each type
   - Configure retry strategies

4. **Update Configuration**
   - Set environment variables
   - Configure rate limits
   - Adjust cache TTLs

5. **Implement Tests**
   - Write unit tests for services
   - Add integration tests for APIs
   - Create E2E tests for critical flows

## Conclusion

This architecture provides a solid foundation for building scalable, maintainable applications. The patterns are domain-agnostic and can be adapted for various business needs while maintaining consistency across services.

For questions or improvements, please refer to the team's engineering standards or create a pull request with proposed changes.