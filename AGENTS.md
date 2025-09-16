# Repository Guidelines
The following standards keep the YouTube GIF Maker Chrome extension maintainable and predictable for everyone contributing.

## Project Structure & Module Organization
Source lives under `src/`, with feature logic in `content/`, background services in `background/`, and shared UI in `components/` and `lib/`. Hooks reside in `hooks/`, while cross-cutting helpers stay in `utils/` and contract types in `types/`. Integration assets (icons, logos, manifest) sit at the repository root, and generated extension builds land in `dist/` (do not commit). Automated coverage reports and Playwright artifacts are stored in `coverage/` and `playwright-report/` respectively.

## Build, Test, and Development Commands
- `npm run dev` — webpack watch build; pair with `npm run dev:reload` to auto-refresh a loaded unpacked extension.
- `npm run start` — clean the `dist/` directory and run both dev watchers (preferred locally).
- `npm run build` — production bundle used for packaging, aligns with Chrome submission assets in `store-assets/`.
- `npm run pack` — assemble a distributable ZIP via `scripts/pack-extension.js` after verifying tests.

## Coding Style & Naming Conventions
The codebase is TypeScript-first with React function components. Use 2-space indentation, `PascalCase` for components, `camelCase` for utilities, and `SCREAMING_SNAKE_CASE` only for constants mirrored in Chrome storage. Tailwind utility classes should group by layout → color → state to ease diff review. Run `npm run lint` and `npm run typecheck` before pushing; ESLint (typescript-eslint, React, hooks) plus Prettier defaults govern formatting.

## Testing Guidelines
Unit tests live in `tests/unit` and component folders as `*.test.tsx`; exercise UI behaviour with Testing Library and keep fixtures under `tests/fixtures`. Launch Jest suites with `npm run test` or focus by file pattern (`npm run test -- <pattern>`). For coverage badges, use `npm run test:coverage` and target ≥90% lines on modified modules. End-to-end flows live under `tests/e2e` and should be run via `npm run test:e2e` before packaging.

## Commit & Pull Request Guidelines
Follow the conventional commit style visible in `git log` (`feat:`, `fix:`, `refactor:`, etc.); scope optional but recommended (`feat(popup): ...`). Commits must stay focused and include relevant screenshots or GIFs when UI changes touch the popup or content overlay. Pull requests should summarize behaviour, list test commands executed, and link tracking issues. Request review before merging; rebase instead of merge commits to keep history linear.
