# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- User authentication system with JWT tokens
- Multi-step setup wizard for new users
- Real-time sync progress indicators
- Selective entity import with date ranges
- Login autofill for development testing
- Professional documentation structure

### Fixed
- Authentication middleware security vulnerability
- Missing UI components (checkbox, label)
- Database migration for authentication fields

### Changed
- Reorganized repository structure for enterprise standards
- Moved database files to dedicated data directory
- Cleaned up duplicate files and old documentation

## [1.0.0] - 2025-01-15

### Added
- Initial release of Bookkeeping Automation Platform
- Xero integration with OAuth 2.0 + PKCE
- Finance dashboard with real-time metrics
- Bookkeeping module with transaction management
- Cash flow forecasting (90-day)
- Analytics module with vendor intelligence
- Database schema viewer
- API documentation viewer
- Dark theme UI with Tailwind CSS
- SQLite database with Prisma ORM
- Comprehensive test suite with Playwright

### Security
- Implemented secure cookie storage
- Added input validation with Zod
- Rate limiting on all API endpoints
- CSRF protection
- XSS prevention

### Performance
- Database-first architecture
- Query result caching
- Optimized API responses
- Batch operations support