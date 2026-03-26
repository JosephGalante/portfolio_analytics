# Portfolio Analytics

Real-time portfolio analytics MVP built to demonstrate backend and systems design skills. The platform models an event-driven architecture: FastAPI serves REST and websocket APIs, Redis carries hot data and events, a background worker recalculates only affected portfolios, PostgreSQL stores durable history, and a Next.js dashboard consumes both REST and pushed updates.

## Architecture

Services:
- `api`: FastAPI app exposing portfolios, holdings, valuations, snapshots, and websocket endpoints.
- `market-data`: polls Finnhub for symbols currently held in user portfolios and publishes changed prices into Redis Stream.
- `worker`: consumes price ticks from Redis Stream, persists `price_events`, recalculates affected portfolios, stores snapshots, refreshes cache, and publishes live updates.
- `postgres`: source of truth for users, portfolios, holdings, price events, and historical snapshots.
- `redis`: used for Stream-based tick transport, latest symbol price cache, latest portfolio valuation cache, and Pub/Sub fanout.
- `frontend`: Next.js dashboard for creating portfolios, managing holdings, and observing live valuation changes.

Data flow:
1. When a holding is added, the API validates the ticker against Finnhub, stores the holding, and emits an immediate price tick into Redis Stream `price_ticks`.
2. `market-data` polls Finnhub every few seconds for symbols currently held across all portfolios and only publishes a new tick when the price changes.
3. `worker` reads each tick, stores a `price_events` row, finds portfolios holding the changed symbol, and recalculates only those portfolios.
4. `worker` writes the latest valuation to Redis key `portfolio:{id}:valuation`, inserts a `portfolio_snapshots` row in Postgres, and publishes the valuation to `portfolio_updates:{id}`.
5. `api` listens to Redis Pub/Sub and forwards those messages to websocket clients connected at `/ws/portfolios/{portfolio_id}`.
6. `frontend` loads initial data via REST and then updates the selected portfolio live through websocket pushes.
Zero-cost deploy note:
- Render's free tier does not include background workers. For a free public deployment, this repo supports `RUN_EMBEDDED_WORKERS=true`, which starts the valuation worker and market-data poller inside the API process. Local Docker Compose still runs them as separate services.

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
    db/           # SQLAlchemy + Redis clients
    models/       # ORM models
    schemas/      # request/response contracts
    services/     # auth, market data, portfolio, holding, valuation logic
    websocket/    # Redis Pub/Sub bridge + connection manager
    workers/      # market data poller and valuation worker
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
- `GET /health`
- `GET /ready`
- `GET /auth/me`
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
- The app supports Stytch-backed password auth end-to-end. The frontend sends a Stytch session JWT as a Bearer token, the backend verifies that session with Stytch, and portfolios remain scoped to the mapped local user record.
- `GET /health` is a cheap liveness check. `GET /ready` verifies Postgres, Redis, and required auth/market-data config before returning `200`.
- Holdings are upserted by `(portfolio_id, symbol)`.
- Real quote data comes from Finnhub's free quote endpoint. The app polls only symbols that are actually held, then reuses the existing Redis Stream -> worker -> websocket pipeline.
- Valuation reads Redis first and falls back to recalculating from holdings plus latest cached symbol prices if the portfolio cache is cold. If a symbol price is missing from Redis, the API fetches the latest price on demand and warms the symbol cache before returning the valuation.
- Decimal-valued API fields are serialized as normalized strings such as `"200"` or `"300.5"`, not JSON numbers and not zero-padded strings like `"300.5000"`.
- The frontend validates those decimal-string payloads at the API boundary before updating UI state.

## Local Setup

### Prerequisites

- Docker Desktop or another running Docker daemon
- Docker Compose support

### Environment

You can run the stack with built-in defaults, but keeping a local env file is cleaner:

```bash
cp .env.example .env
```

Important env vars for the real market-data path:
- `FINNHUB_API_KEY`
- `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN`
- `STYTCH_PROJECT_ID`
- `STYTCH_SECRET`

Env assumptions:
- Docker Compose reads the repo-root `.env`.
- Local standalone Next.js development reads `frontend/.env.local`, not the root `.env`.
- Backend-only env vars stay unprefixed: `DATABASE_URL`, `REDIS_URL`, `STYTCH_*`, `FINNHUB_*`, `APP_*`.
- Browser-exposed frontend env vars must be `NEXT_PUBLIC_*`.
- Production websocket URLs must use `wss://`, not `ws://`.

### Start Everything

```bash
docker compose up --build
```

Useful URLs:
- API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`
- Readiness: `http://localhost:8000/ready`
- Frontend: `http://localhost:3000`

### Demo Flow

1. Open the frontend.
2. Request the password setup email, set your password, and sign in with email + password.
3. Create a portfolio.
4. Add holdings such as `AAPL`, `MSFT`, or any other supported symbol.
5. Watch valuation fetch and cache a real quote immediately.
6. Keep the dashboard open and observe websocket-driven valuation changes and snapshots as the market-data poller publishes fresh ticks.

## Free Deployment Plan

This repo can be deployed for zero dollars with:
- `frontend`: Vercel Hobby
- `backend`: one Render free web service
- `postgres`: Supabase free Postgres
- `redis`: Upstash Redis free

The important repo-specific tradeoff is on the backend:
- Render free web services are available, but Render free background workers are not. This repo handles that by running `RUN_EMBEDDED_WORKERS=true` in production so the API, valuation worker, and market-data poller all run in the same Render service.

### 1. Supabase

1. Create a free Supabase project.
2. In the project dashboard, open the database connect panel and copy the direct Postgres connection information.
3. Build this repo's SQLAlchemy async URL from that value:
   - use the same host, port, database, username, and password
   - replace the scheme with `postgresql+asyncpg://`
   - keep SSL enabled
4. Set that final value as `DATABASE_URL` in Render.

Example shape:

```text
postgresql+asyncpg://postgres.<project-ref>:<password>@db.<project-ref>.supabase.co:5432/postgres?ssl=require
```

### 2. Upstash

1. Create one free Redis database in Upstash.
2. Copy the Redis endpoint, port, and password from the database connection page.
3. Build `REDIS_URL` for this repo:

```text
rediss://:PASSWORD@ENDPOINT:PORT
```

4. Set that value in Render as `REDIS_URL`.

### 3. Render

1. Create a new `Web Service` from this repo.
2. Set the service to use the repo's Docker configuration with [backend/Dockerfile](/Users/joe/Desktop/sand/portfolio_analytics/backend/Dockerfile).
3. Choose the `Free` instance type.
4. Set the health check path to `/ready`.
5. Add these env vars in Render:
   - `APP_ENV=production`
   - `APP_CORS_ORIGINS=["https://<your-vercel-domain>"]`
   - `DATABASE_URL=<your-supabase-asyncpg-url>`
   - `REDIS_URL=<your-upstash-rediss-url>`
   - `STYTCH_PROJECT_ID=<your-stytch-project-id>`
   - `STYTCH_SECRET=<your-stytch-secret>`
   - `STYTCH_API_URL=<match your Stytch environment>`
   - `FINNHUB_API_KEY=<your-finnhub-key>`
   - `RUN_EMBEDDED_WORKERS=true`
6. Deploy the service.
7. Note the final Render backend URL, for example `https://portfolio-analytics-api.onrender.com`.

### 4. Vercel

1. Import the same repo into Vercel as a separate project.
2. Set the root directory to `frontend`.
3. Add these env vars in Vercel:
   - `NEXT_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com`
   - `NEXT_PUBLIC_WS_BASE_URL=wss://<your-render-service>.onrender.com`
   - `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN=<your-stytch-public-token>`
   - `NEXT_PUBLIC_STYTCH_LOGIN_REDIRECT_URL=https://<your-vercel-domain>`
   - `NEXT_PUBLIC_STYTCH_PASSWORD_RESET_REDIRECT_URL=https://<your-vercel-domain>/authenticate`
4. Deploy.

### 5. Stytch

1. In Stytch, make sure the project environment matches the API base URL you set on the backend.
2. Add your deployed frontend URLs as redirect URLs:
   - `https://<your-vercel-domain>`
   - `https://<your-vercel-domain>/authenticate`
3. Use the Stytch public token in Vercel and the project ID plus secret in Render.

### 6. Post-Deploy Check

1. Open `https://<your-render-service>.onrender.com/health` and confirm it returns `200`.
2. Open `https://<your-render-service>.onrender.com/ready` and confirm it returns `200` with `database`, `redis`, `stytch`, and `market_data` all healthy/configured.
3. Open the Vercel frontend, complete password setup, sign in, create a portfolio, add a holding, and confirm the valuation updates live.

## Verification Status

Verified in this session:
- `backend/.venv/bin/pytest backend/tests`
- `backend/.venv/bin/python -m ruff check backend/app backend/tests`
- `npm --prefix frontend run syntax`
- `npm --prefix frontend run test`
- `npm --prefix frontend run lint`

## Key Tradeoffs

- Stytch for identity plus local ownership mapping: better than shipping homemade browser auth, but it still introduces an external auth dependency and provider-specific operational configuration.
- Free near-real-time market data via Finnhub quote polling: strong MVP tradeoff, but intentionally rate-limited and less scalable than a licensed streaming feed. The app avoids paying for provider websockets by polling on the backend and reusing its own websocket layer for client updates.
- Free deployment via one Render web service plus `RUN_EMBEDDED_WORKERS=true`: good zero-cost portfolio-project compromise, but it couples the API and background loops into one runtime and gives up independent scaling.
- On-demand symbol validation and cold-cache price fetches: better UX for arbitrary tickers, but it means the API can incur provider latency during holding creation or the first valuation request for a symbol.
- Redis Stream + Pub/Sub instead of a heavier queue: enough to show event-driven design without introducing Kafka or Celery complexity.
- Snapshot on every affected revaluation: simple and interview-friendly, but intentionally higher write volume than a sampled production design.
- In-memory websocket connection manager: acceptable for one API instance; multi-instance scaling would need a shared realtime layer.
- No event deduplication or consumer-group offset persistence yet: fine for MVP, but a production worker would need stronger idempotency semantics.

## Ideal Paid Version

If budget were available, I would replace the free polling path with a licensed real-time feed and a dedicated ingestion service:
- use a paid equities provider with exchange-licensed streaming data
- keep a persistent upstream websocket or SIP/direct feed connection instead of polling REST endpoints
- fan quotes into Redis Streams or Kafka with provider timestamps preserved
- add symbol metadata, market-hours awareness, and exchange-specific entitlement handling
- support corporate actions, splits, and richer reference data
- sample or debounce snapshot creation to control write volume under high-frequency ticks
- add observability around quote lag, drop rate, consumer lag, and fanout latency

That architecture is more expensive, but it removes the biggest current compromise: free polling is good enough for a demo and small-scale MVP, not for production-grade market data.

## Future Improvements

- Add pagination and filtering for portfolio and snapshot queries.
- Upgrade the worker to Redis consumer groups with acknowledgment semantics.
- Move from free polling to a licensed streaming market-data provider.
- Split the embedded-worker production fallback back into separate deployable services once paid infra is acceptable.
- Add rate limiting, retries, and event deduplication.
- Add charts for valuation history and per-holding contribution.
- Add API, worker, websocket, and integration tests.
- Add metrics, tracing, and structured logging.
