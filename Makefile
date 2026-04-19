.PHONY: dev down build test lint

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

## Run all linters
lint:
	cd apps/api-server && uv run ruff check .
	cd apps/web-app && npm run lint
