.PHONY: dev down build test test-web-app typecheck lint lint-api-server lint-web-app lint-fix

## Start backend services in background, then frontend in foreground
dev:
	docker-compose up -d
	cd apps/web-app && npm run dev

## Stop all services
down:
	docker-compose down

## Build the Next.js web app
build:
	cd apps/web-app && npm run build

## Run all tests
test:
	cd apps/api-server && uv run pytest || [ $$? -eq 5 ]
	cd apps/web-app && npm run test:unit

## Run only web-app tests
## Unit only for now: `npm test` also runs Playwright, and web-app has no
## e2e specs yet (RALPH wave 5b owns them). Switch to `npm test` once they land.
test-web-app:
	cd apps/web-app && npm run test:unit

## Typecheck the web app
typecheck:
	cd apps/web-app && npm run typecheck

## Lint api-server
lint-api-server:
	cd apps/api-server && uv run ruff check .

## Lint web-app
lint-web-app:
	cd apps/web-app && npm run lint

## Run all linters
lint: lint-api-server lint-web-app

## Auto-fix lint issues
lint-fix:
	cd apps/api-server && uv run ruff check --fix .
	cd apps/web-app && npm run lint -- --fix
