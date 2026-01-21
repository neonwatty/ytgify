# YTGify Chrome Extension - Makefile
# ===================================

.PHONY: help install clean build dev test lint format typecheck validate all

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

#-------------------------------------------------------------------------------
# Help
#-------------------------------------------------------------------------------

help: ## Show this help message
	@echo "$(CYAN)YTGify Chrome Extension$(RESET)"
	@echo "========================"
	@echo ""
	@echo "$(GREEN)Available targets:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'

#-------------------------------------------------------------------------------
# Setup
#-------------------------------------------------------------------------------

install: ## Install dependencies
	npm install

install-dev: ## Install dependencies (development mode)
	NODE_ENV=development npm install

#-------------------------------------------------------------------------------
# Build
#-------------------------------------------------------------------------------

build: ## Build for production (uses production API)
	npm run build

build-local: ## Build for local development (uses localhost:3000)
	npm run build:local

build-production: ## Build for production release
	npm run build:production

dev: ## Start development mode with watch
	npm run dev

dev-local: ## Start development mode with local API
	npm run dev:local

clean: ## Clean build artifacts
	npm run clean

#-------------------------------------------------------------------------------
# Testing
#-------------------------------------------------------------------------------

test: ## Run unit tests
	npm test

test-watch: ## Run unit tests in watch mode
	npm run test:watch

test-coverage: ## Run unit tests with coverage
	npm run test:coverage

test-e2e: ## Run E2E tests (headless)
	npm run test:e2e

test-e2e-headed: ## Run E2E tests (headed/visible browser)
	npm run test:e2e:headed

test-e2e-debug: ## Run E2E tests in debug mode
	npm run test:e2e:debug

test-integration: ## Run backend integration tests
	npm run test:integration

test-all: ## Run all tests (unit + E2E)
	npm run test:all

#-------------------------------------------------------------------------------
# Code Quality
#-------------------------------------------------------------------------------

lint: ## Run ESLint
	npm run lint

lint-fix: ## Run ESLint with auto-fix
	npm run lint:fix

format: ## Format code with Prettier
	npm run format

format-check: ## Check code formatting
	npm run format:check

typecheck: ## Run TypeScript type checking
	npm run typecheck

knip: ## Check for unused code/dependencies
	npm run knip

#-------------------------------------------------------------------------------
# Validation
#-------------------------------------------------------------------------------

validate: lint typecheck test ## Run lint, typecheck, and tests
	@echo "$(GREEN)All validations passed!$(RESET)"

validate-full: lint typecheck knip test test-e2e ## Full validation including E2E
	@echo "$(GREEN)Full validation passed!$(RESET)"

pre-push: ## Run pre-push validation
	npm run validate:pre-push

#-------------------------------------------------------------------------------
# Utilities
#-------------------------------------------------------------------------------

generate-test-videos: ## Generate test videos for E2E tests
	npm run generate:test-videos

#-------------------------------------------------------------------------------
# Composite Commands
#-------------------------------------------------------------------------------

all: clean install build test ## Clean, install, build, and test

ci: install build lint typecheck test ## CI pipeline
	@echo "$(GREEN)CI pipeline passed!$(RESET)"

local-setup: install-dev build-local ## Setup for local development
	@echo "$(GREEN)Local development setup complete!$(RESET)"
	@echo "$(YELLOW)Remember to reload the extension in chrome://extensions$(RESET)"
