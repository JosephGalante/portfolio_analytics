# Portfolio Analytics

Real-time portfolio analytics MVP built to demonstrate backend and systems design skills. The platform models an event-driven architecture: FastAPI serves REST and websocket APIs, Redis carries hot data and events, a background worker recalculates only affected portfolios, PostgreSQL stores durable history, and a Next.js dashboard consumes both REST and pushed updates.

## Architecture

Services:
- `api`: FastAPI app exposing portfolios, holdings, valuations, snapshots, and websocket endpoints.
- `worker`: consumes price ticks from Redis Stream, persists `price_events`, recalculates affected portfolios, stores snapshots, refreshes cache, and publishes live updates.
- `simulator`: generates fake stock ticks for symbols like `AAPL`, `MSFT`, `NVDA`, `GOOGL`, and `AMZN`.
- `postgres`: source of truth for users, portfolios, holdings, price events, and historical snapshots.
- `redis`: used for Stream-based tick transport, latest symbol price cache, latest portfolio valuation cache, and Pub/Sub fanout.
- `frontend`: Next.js dashboard for creating portfolios, managing holdings, and observing live valuation changes.

Data flow:
1. `simulator` writes a fake price tick into Redis Stream `price_ticks` and updates `symbol:{ticker}:last_price`.
2. `worker` reads the tick, stores a `price_events` row, finds portfolios holding the changed symbol, and recalculates only those portfolios.
3. `worker` writes the latest valuation to Redis key `portfolio:{id}:valuation`, inserts a `portfolio_snapshots` row in Postgres, and publishes the valuation to `portfolio_updates:{id}`.
4. `api` listens to Redis Pub/Sub and forwards those messages to websocket clients connected at `/ws/portfolios/{portfolio_id}`.
5. `frontend` loads initial data via REST and then updates the selected portfolio live through websocket pushes.

## Stack

- Backend: FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL
- Cache / event infra: Redis
- Frontend: Next.js
- Local orchestration: Docker Compose

## Project Layout

```text
backend/
  app/
    api/          # REST + websocket routes
    core/         # settings and shared constants
    db/           # SQLAlchemy + Redis clients + seed bootstrap
    models/       # ORM models
    schemas/      # request/response contracts
    services/     # portfolio, holding, valuation, snapshot logic
    websocket/    # Redis Pub/Sub bridge + connection manager
    workers/      # simulator and valuation worker
    main.py
  alembic/
frontend/
  app/
  components/
  lib/
docker-compose.yml
```

## Implemented API Surface

REST:
- `POST /portfolios`
- `GET /portfolios`
- `GET /portfolios/{portfolio_id}`
- `POST /portfolios/{portfolio_id}/holdings`
- `GET /portfolios/{portfolio_id}/holdings`
- `GET /portfolios/{portfolio_id}/valuation`
- `GET /portfolios/{portfolio_id}/snapshots`

Realtime:
- `GET /ws/portfolios/{portfolio_id}`

Notes:
- The MVP assumes a single seeded demo user created at API startup.
- Holdings are upserted by `(portfolio_id, symbol)`.
- Valuation reads Redis first and falls back to recalculating from holdings plus latest cached symbol prices if the portfolio cache is cold.

## Local Setup

### Prerequisites

- Docker Desktop or another running Docker daemon
- Docker Compose support

### Environment

You can run the stack with built-in defaults, but keeping a local env file is cleaner:

```bash
cp .env.example .env
```

### Start Everything

```bash
docker compose up --build
```

Useful URLs:
- API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Frontend: `http://localhost:3000`

### Demo Flow

1. Open the frontend.
2. Create a portfolio.
3. Add holdings such as `AAPL` or `MSFT`.
4. Watch valuation start reflecting cached symbol prices.
5. Keep the dashboard open and observe websocket-driven valuation changes and snapshots as new ticks arrive.

## Verification Status

Verified in this session:
- Python modules compile with `python3 -m compileall backend/app`.
- Compose YAML parses successfully.

Blocked in this session:
- Full `docker compose up --build` could not complete because the local Docker daemon was not running.
- End-to-end runtime validation of migrations, worker processing, and frontend live updates still needs to be exercised once Docker is running locally.

If you hit the same issue, start Docker Desktop first and rerun:

```bash
docker compose up --build
```

## Key Tradeoffs

- Single seeded user instead of auth: keeps the MVP focused on systems design while preserving a realistic user-owned schema.
- Redis Stream + Pub/Sub instead of a heavier queue: enough to show event-driven design without introducing Kafka or Celery complexity.
- Snapshot on every affected revaluation: simple and interview-friendly, but intentionally higher write volume than a sampled production design.
- In-memory websocket connection manager: acceptable for one API instance; multi-instance scaling would need a shared realtime layer.
- No event deduplication or consumer-group offset persistence yet: fine for MVP, but a production worker would need stronger idempotency semantics.

## Future Improvements

- Add authentication and user-scoped authorization.
- Add pagination and filtering for portfolio and snapshot queries.
- Upgrade the worker to Redis consumer groups with acknowledgment semantics.
- Add rate limiting, retries, and event deduplication.
- Add charts for valuation history and per-holding contribution.
- Add API, worker, websocket, and integration tests.
- Add metrics, tracing, and structured logging.
