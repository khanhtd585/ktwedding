SHELL := /bin/bash

ENV_FILE ?= .env.production
COMPOSE_FILE ?= docker-compose.production.yml
TAIL ?= 200
COMPOSE = EVERAFTER_ENV_FILE=$(ENV_FILE) docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE)

.DEFAULT_GOAL := help
.PHONY: help setup validate build up down restart ps logs logs-check logs-app logs-proxy health deploy

help: ## Show available deployment commands.
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup: ## Create the production env file and persistent SQLite directory once.
	@if [ ! -f "$(ENV_FILE)" ]; then cp .env.production.example "$(ENV_FILE)"; echo "Created $(ENV_FILE). Fill in its Google values and secrets before deploying."; else echo "$(ENV_FILE) already exists; it was not changed."; fi
	@mkdir -p data
	@sudo chown 10001:10001 data
	@echo "SQLite directory is ready: $$(pwd)/data"

validate: ## Validate the Docker Compose configuration without starting it.
	@test -f "$(ENV_FILE)" || (echo "Missing $(ENV_FILE). Run 'make setup' first."; exit 1)
	@$(COMPOSE) config --quiet
	@echo "Compose configuration is valid."

build: validate ## Build the Everafter application image.
	@$(COMPOSE) build

up: validate ## Build and start the production stack in the background.
	@$(COMPOSE) up -d --build
	@$(MAKE) ps

down: ## Stop the production stack without deleting SQLite or Caddy data.
	@$(COMPOSE) down

restart: down up ## Restart the production stack.

ps: ## Show container status.
	@$(COMPOSE) ps

logs: ## Follow logs for both the application and Caddy. Set TAIL=500 if needed.
	@$(COMPOSE) logs -f --tail=$(TAIL)

logs-check: ## Print recent logs once, without following them.
	@$(COMPOSE) logs --tail=$(TAIL)

logs-app: ## Follow only Everafter application logs.
	@$(COMPOSE) logs -f --tail=$(TAIL) everafter

logs-proxy: ## Follow only Caddy HTTPS/reverse-proxy logs.
	@$(COMPOSE) logs -f --tail=$(TAIL) caddy

health: ## Request the public HTTPS health endpoint from DOMAIN in the env file.
	@domain="$$(sed -n 's/^DOMAIN=//p' "$(ENV_FILE)" | head -n 1)"; test -n "$$domain" || (echo "DOMAIN is missing in $(ENV_FILE)."; exit 1); curl --fail --silent --show-error "https://$$domain/healthz"; echo

deploy: up health ## Start/rebuild the stack, then check the public health endpoint.
