# Contributing to Bookkeeping Automation Platform

Thank you for your interest in contributing to our project! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/bookkeeping.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Commit with conventional commits: `git commit -m "feat: add new feature"`
6. Push to your fork: `git push origin feature/your-feature-name`
7. Create a Pull Request

## Development Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Set up database
npm run prisma:generate
npm run prisma:migrate

# Start development server
npm run dev
```

## Pull Request Guidelines

### Before Submitting

1. **Test Your Changes**
   - Run `npm run test` to ensure all tests pass
   - Run `npm run type-check` for TypeScript validation
   - Run `npm run lint:fix` to fix any linting issues

2. **Update Documentation**
   - Update README.md if needed
   - Add JSDoc comments for new functions
   - Update API documentation if you changed endpoints

3. **Follow Code Style**
   - Use TypeScript for all new code
   - Follow existing patterns and conventions
   - Use meaningful variable and function names
   - Keep functions small and focused

### PR Requirements

- **Title**: Use conventional commit format (e.g., "feat: add vendor analytics")
- **Description**: 
  - Explain what changes you made
  - Why you made them
  - Link to any relevant issues
- **Screenshots**: Include for UI changes
- **Tests**: Add tests for new features
- **Breaking Changes**: Clearly document any breaking changes

## Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add cash flow forecasting module
fix: resolve sync error with Xero API
docs: update README with new endpoints
```

## Code Review Process

1. All submissions require review before merging
2. Reviewers will check for:
   - Code quality and style
   - Test coverage
   - Documentation
   - Performance implications
   - Security considerations

## Development Guidelines

### TypeScript

- Use strict mode
- Define interfaces for all data structures
- Avoid `any` type - use `unknown` if needed
- Use enums for constants

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use proper prop typing
- Implement error boundaries where appropriate

### API Development

- Follow RESTful conventions
- Validate all inputs with Zod schemas
- Return consistent error responses
- Document all endpoints

### Testing

- Write unit tests for utilities and helpers
- Write integration tests for API endpoints
- Write E2E tests for critical user flows
- Aim for >80% code coverage

## Reporting Issues

### Bug Reports

Include:
- Clear description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable
- Environment details (OS, browser, Node version)

### Feature Requests

Include:
- Clear description of the feature
- Use case and benefits
- Proposed implementation (if any)
- Mockups or examples (if applicable)

## Questions?

Feel free to:
- Open an issue for questions
- Join our discussions
- Contact the maintainers

Thank you for contributing! 🎉