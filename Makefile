.PHONY: dev down build test test-web-app lint lint-api-server lint-web-app lint-fix \
        dev-v2 build-v2 test-web-app-v2 lint-web-app-v2

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
	cd apps/web-app && npm test --if-present

## Run only web-app tests
test-web-app:
	cd apps/web-app && npm test

## Lint api-server
lint-api-server:
	cd apps/api-server && uv run ruff check .

## Lint web-app
lint-web-app:
	cd apps/web-app && npm run lint

## Run all linters
lint: lint-api-server lint-web-app lint-web-app-v2

## Auto-fix lint issues
lint-fix:
	cd apps/api-server && uv run ruff check --fix .
	cd apps/web-app && npm run lint -- --fix

# --- web-app-v2 (Figma rebuild, runs on port 3001 beside legacy on 3000) ---

## Start backend services in background, then the v2 frontend in foreground (port 3001)
dev-v2:
	docker-compose up -d
	cd apps/web-app-v2 && npm run dev

## Build the v2 Next.js web app
build-v2:
	cd apps/web-app-v2 && npm run build

## Lint web-app-v2
lint-web-app-v2:
	cd apps/web-app-v2 && npm run lint

## Run web-app-v2 unit tests
## Unit only for now: `npm test` also runs Playwright, and web-app-v2 has no
## e2e specs yet (RALPH wave 5b owns them). Switch to `npm test` once they land.
test-web-app-v2:
	cd apps/web-app-v2 && npm run test:unit
