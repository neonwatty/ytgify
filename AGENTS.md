# Repository Guidelines

## Project Structure & Module Organization
`src/` holds runtime folders (`background/`, `content/`, `popup/`) plus shared utilities under `components/`, `lib/`, `utils/`, and `shared/`. Styling helpers live in `themes/`, and assets live under `icons/`, `logos/`, and `store-assets/`, while all Jest/Playwright configs and fixtures sit in `tests/`. Treat `dist/` and other generated folders as throwaway outputs.

## Build, Test, and Development Commands
- `npm run dev` — webpack watch build feeding the unpacked extension in `dist/`.
- `npm run build` / `npm run build:production` — normal bundle vs Chrome Web Store package (removes localhost permissions and zips).
- `npm run lint`, `npm run typecheck`, `npm run format[:check]` — enforce ESLint + TypeScript + Prettier consistency.
- `npm test`, `npm run test:e2e`, `npm run test:e2e:mock`, `npm run test:layout` — Jest unit tests, real Playwright runs, mock YouTube runs, and CSS/layout guards.
- `npm run validate:pre-push` — complete gate (lint, build, typecheck, Jest, mock e2e, layout, fast e2e smoke).

## Coding Style & Naming Conventions
Stick to strict TypeScript with React function components and typed hooks. Use the `@/` aliases instead of long relative paths; components are PascalCase, hooks start with `use`, and utilities are camelCase inside their feature folder. Run Prettier (`npm run format`) for 2-space indentation, trailing commas, and single quotes, keep Tailwind utilities loosely grouped, and avoid DOM APIs inside MV3 files (manifest, service worker).

## Testing Guidelines
Jest + Testing Library specs (`*.spec.ts[x]`) live beside the code they cover or under `tests/unit`. Playwright suites stay in `tests/e2e/`, and mock fixtures in `tests/e2e-mock/` are regenerated with `npm run generate:test-videos`. Run `npm run test:e2e` before every PR, lean on `npm run test:e2e:mock` and `npm run test:layout` for quick checks, and share `npm run test:coverage` output whenever shared utilities change.

## Commit & Pull Request Guidelines
Use the short, imperative summaries seen in history (`Fix text overlay navigation`, `Update version number…`), keep commits single-purpose, and reference issue IDs in the body. Pull requests should explain the UX impact, call out manifest or permission edits, include screenshots/GIFs for UI tweaks, and list the validation commands run (ideally `npm run validate:pre-push` plus relevant e2e suites).

## Security & Configuration Tips
Never commit secrets; the extension only talks to YouTube and localhost fixtures. After any permission or CSP change, verify `npm run build:production` still strips localhost scopes, and test both light/dark themes through `src/themes/` helpers whenever shared CSS changes.
