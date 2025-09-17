# Branch Protection Rules

This document outlines the recommended branch protection rules for the `main` branch to ensure code quality and stability.

## Recommended Settings for `main` Branch

Navigate to **Settings → Branches** in your GitHub repository and add a branch protection rule for `main` with the following settings:

### ✅ Required Status Checks

Enable **"Require status checks to pass before merging"** with:
- **Test and Lint** (from CI workflow)
- Enable **"Require branches to be up to date before merging"**

### ✅ Pull Request Reviews

Enable **"Require pull request reviews before merging"** with:
- Required approving reviews: **1**
- Enable **"Dismiss stale pull request approvals when new commits are pushed"**
- Optional: Enable **"Require review from CODEOWNERS"** if using CODEOWNERS file

### ✅ Additional Protections

- Enable **"Require conversation resolution before merging"**
- Enable **"Require linear history"** (prevents merge commits)
- Enable **"Include administrators"** to apply rules to repository admins
- Enable **"Do not allow bypassing the above settings"**

### ✅ Optional But Recommended

- Enable **"Require deployments to succeed before merging"** if using deployment workflows
- Enable **"Lock branch"** to make the branch read-only (only for releases)
- Enable **"Require signed commits"** for enhanced security

## How to Apply These Rules

1. Go to your repository on GitHub
2. Click on **Settings** → **Branches**
3. Click **"Add rule"** or **"Add branch protection rule"**
4. Enter `main` as the branch name pattern
5. Configure the settings as described above
6. Click **"Create"** or **"Save changes"**

## CI Status Checks

The following checks will run automatically on all PRs to `main`:

- **Linting**: ESLint checks for code style and potential issues
- **Type Checking**: TypeScript compilation without emit
- **Unit Tests**: All test suites must pass
- **Coverage**: Code coverage must be above 60%
- **Build**: Extension must build successfully

## Notes for Contributors

- All PRs must pass CI checks before merging
- Keep your branch up to date with `main` before requesting review
- Resolve all review comments before merging
- Write meaningful commit messages
- Add tests for new features or bug fixes