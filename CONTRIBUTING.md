# Contributing to Nexus Console

Thank you for your interest in contributing to Nexus Console! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct: be respectful, inclusive, and professional.

## Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/nexus-console.git
   cd nexus-console
   ```

2. **Install Dependencies**
   ```bash
   # Frontend dependencies
   npm install
   
   # Backend dependencies (using UV)
   cd server
   uv sync
   ```
   
   **Note**: We use [UV](https://github.com/astral-sh/uv) for Python dependency management. Install it with:
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

3. **Run Development Environment**
   ```bash
   # Terminal 1: Backend
   npm run server:dev
   
   # Terminal 2: Frontend
   npm run dev
   ```

## Development Workflow

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Run Tests**
   ```bash
   # Frontend tests
   npm run test
   npm run typecheck
   npm run lint
   
   # Backend tests (if Python code exists)
   cd server
   uv run pytest
   uv run mypy .
   uv run ruff check .
   ```

4. **Commit Changes**
   - Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
   - Keep commits focused and atomic

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Architecture Guidelines

### Module Structure
- **Core**: Terminal orchestration and state management
- **Transport**: WebSocket and protocol handling
- **FileSystem**: File system abstraction
- **Security**: Command sanitization
- **Cache**: Performance optimization
- **UI**: User interface components

### Code Style
- Use TypeScript for type safety
- Follow functional programming principles where appropriate
- Prefer composition over inheritance
- Keep functions small and focused
- Document complex logic
- Maximum line length: 100 characters (enforced by ESLint)
- Use explicit function return types
- Follow security best practices (no hardcoded secrets, validate inputs)

### Testing
- Write unit tests for utilities
- Integration tests for core functionality
- E2E tests for critical user paths
- Maintain >80% code coverage

### Performance
- Profile before optimizing
- Use WebWorkers for CPU-intensive tasks
- Implement proper caching strategies
- Monitor bundle size

## Pull Request Process

1. **Before Submitting**
   - Ensure all tests pass
   - Update documentation
   - Add changeset if needed
   - Rebase on latest main

2. **PR Description**
   - Clearly describe the change
   - Link related issues
   - Include screenshots for UI changes
   - List breaking changes

3. **Review Process**
   - Address review feedback promptly
   - Keep discussions focused
   - Be open to suggestions

## Release Process

We use semantic versioning and automated releases:

1. **Version Bumps**
   - `patch`: Bug fixes
   - `minor`: New features
   - `major`: Breaking changes

2. **Changesets**
   ```bash
   npx changeset add
   ```

3. **Release**
   - Automated via GitHub Actions
   - Publishes to npm
   - Creates GitHub release

## Getting Help

- Check existing issues and discussions
- Join our Discord server
- Reach out to maintainers

## Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing to Nexus Console! 🚀