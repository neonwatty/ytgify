# Contributing to YTgify

Thank you for your interest in contributing to the YTgify Chrome Extension! This guide will help you get started with development and ensure your contributions meet our quality standards.

## 🚀 Getting Started

### Prerequisites

- Node.js 22.x or higher
- npm 10.x or higher
- Chrome browser for testing

### Setup

1. Fork and clone the repository:

```bash
git clone https://github.com/[your-username]/ytgify.git
cd ytgify
```

2. Install dependencies:

```bash
npm install
```

3. Start development mode:

```bash
npm run dev
```

4. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## 📝 Development Workflow

### Available Scripts

- `npm run dev` - Start webpack in watch mode
- `npm run build` - Build production extension
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm test` - Run unit tests
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:watch` - Run tests in watch mode
- `npm run validate:pre-push` - Run full validation suite (same as Git hooks)

### Automated Quality Checks

⚠️ **Important**: This project uses Git hooks to ensure code quality:

**On Commit (fast):**

- ESLint on staged files only

**On Push (comprehensive):**

1. Full ESLint check
2. Full extension build
3. TypeScript type checking
4. Unit tests
5. E2E tests (wizard-basic.spec.ts with 3 parallel workers)

**Why Local Testing?** Testing Chrome extensions that interact with YouTube videos cannot be reliably done in GitHub Actions due to:

- YouTube blocking CI server IPs
- Video playback requiring real browser environments
- Chrome extension loading issues in headless mode
- Regional content and cookie consent variations

**Timing**:

- Commits are instant (only lint checks)
- Pushes take ~3-5 minutes (full validation with parallel E2E testing)

To test what will run:

**On commit:**

```bash
npx lint-staged
```

**On push:**

```bash
npm run validate:pre-push
```

### Code Style

We use ESLint and TypeScript for code quality. Before submitting a PR:

1. **Run linting**: `npm run lint`
2. **Fix linting issues**: `npm run lint:fix`
3. **Check types**: `npm run typecheck`

### Testing

All new features and bug fixes should include tests:

1. **Run tests**: `npm test`
2. **Check coverage**: `npm run test:coverage`
3. **Coverage requirement**: Maintain at least 60% code coverage

Test files should be placed in `tests/unit/` following the same structure as `src/`.

## 🔄 Pull Request Process

### Before Creating a PR

1. **Create a feature branch**:

```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes** following our coding standards

3. **Commit frequently** - commits only run quick lint checks

4. **Push validation** - Git hooks ensure all tests pass before pushing to remote

5. **Write meaningful commit messages**:
   - Use present tense ("Add feature" not "Added feature")
   - Keep first line under 50 characters
   - Reference issues and pull requests liberally

### Creating a PR

1. **Push your branch** to your fork
2. **Create a Pull Request** against the `main` branch
3. **Fill out the PR template** completely
4. **Wait for CI checks** to pass

### PR Requirements

All PRs must:

- ✅ Pass all CI checks (linting, tests, type checking, build)
- ✅ Maintain or improve code coverage (minimum 60%)
- ✅ Include tests for new functionality
- ✅ Update documentation if needed
- ✅ Have a clear description of changes
- ✅ Reference any related issues

## 🏗️ Architecture Guidelines

### Project Structure

```
src/
├── background/     # Background service worker
├── content/        # Content scripts for YouTube
├── popup/          # Extension popup UI
├── lib/            # Shared libraries and utilities
├── types/          # TypeScript type definitions
└── components/     # React components
```

### Key Principles

1. **Chrome Manifest V3**: All code must be compatible with Manifest V3
2. **React Components**: Use functional components with hooks
3. **TypeScript**: Use proper typing, avoid `any`
4. **Message Passing**: Use typed messages for cross-component communication
5. **Error Handling**: Always handle errors gracefully with user feedback

### Chrome APIs

- Use `chrome.runtime` for message passing
- Use `chrome.storage` for persistent data
- Use `chrome.tabs` for tab management
- Follow Chrome Extension best practices

## 🐛 Reporting Issues

### Before Filing an Issue

1. Search existing issues to avoid duplicates
2. Try to reproduce with the latest version
3. Check if it's a Chrome/YouTube update issue

### Filing an Issue

Include:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Chrome version
- Console errors (if any)
- Screenshots/GIFs (if applicable)

## 💡 Feature Requests

We welcome feature suggestions! Please:

1. Check existing issues/PRs first
2. Describe the use case clearly
3. Explain why it would benefit users
4. Consider implementation complexity

## 🔒 Security

For security vulnerabilities, please email directly instead of creating a public issue. Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## 📚 Additional Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [Project README](README.md)
- [Branch Protection Rules](.github/BRANCH_PROTECTION.md)

## ❓ Questions?

Feel free to:

- Open a discussion in GitHub Discussions
- Ask in existing issues
- Reach out to maintainers

Thank you for contributing! 🎉
