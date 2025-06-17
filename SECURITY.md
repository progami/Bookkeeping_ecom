# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of our software seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please do NOT:
- Open a public issue
- Disclose the vulnerability publicly before it has been addressed

### Please DO:
- Email your findings to security@[domain].com
- Provide detailed steps to reproduce the vulnerability
- Include the impact of the vulnerability
- Suggest a fix if you have one

### What to expect:
1. **Acknowledgment**: We will acknowledge receipt within 48 hours
2. **Assessment**: We will assess the vulnerability and its impact
3. **Fix**: We will develop and test a fix
4. **Disclosure**: We will coordinate disclosure with you
5. **Credit**: We will credit you for the discovery (unless you prefer to remain anonymous)

## Security Measures

### Authentication & Authorization
- JWT-based authentication with secure HTTP-only cookies
- Session validation with multiple permission levels
- Automatic token refresh
- CSRF protection on all state-changing operations

### Data Protection
- All sensitive data encrypted at rest
- TLS/HTTPS required for all communications
- Input validation using Zod schemas
- SQL injection prevention via Prisma ORM
- XSS prevention (React default escaping)

### API Security
- Rate limiting on all endpoints
- Request size limits
- Timeout protection
- IP-based blocking for suspicious activity

### Dependency Security
- Regular dependency updates
- Automated vulnerability scanning
- No known vulnerabilities in production dependencies

### Infrastructure Security
- Environment variables for secrets
- No hardcoded credentials
- Secure cookie configuration
- Content Security Policy headers
- HSTS headers in production

## Best Practices for Contributors

1. **Never commit secrets**: Use environment variables
2. **Validate all inputs**: Use Zod schemas
3. **Escape all outputs**: Let React handle it
4. **Use parameterized queries**: Prisma handles this
5. **Keep dependencies updated**: Run `npm audit` regularly
6. **Follow least privilege**: Request minimum permissions
7. **Log security events**: Use the audit logging system

## Security Checklist for PRs

- [ ] No hardcoded secrets or credentials
- [ ] All user inputs validated
- [ ] Authentication required for protected routes
- [ ] Rate limiting applied to new endpoints
- [ ] No new dependencies with known vulnerabilities
- [ ] Security implications documented
- [ ] Tests include security scenarios

## Contact

For security concerns, contact: security@[domain].com

For general questions, open an issue or discussion.