BACKEND_PYTHON := backend/.venv/bin/python
FRONTEND_NPM := npm --prefix frontend

.PHONY: lint format backend-lint backend-format frontend-lint frontend-format frontend-format-check

lint: backend-lint frontend-lint

format: backend-format frontend-format

backend-lint:
	$(BACKEND_PYTHON) -m ruff check backend/app

backend-format:
	$(BACKEND_PYTHON) -m ruff format backend/app

frontend-lint:
	$(FRONTEND_NPM) run lint

frontend-format:
	$(FRONTEND_NPM) run format

frontend-format-check:
	$(FRONTEND_NPM) run format:check
