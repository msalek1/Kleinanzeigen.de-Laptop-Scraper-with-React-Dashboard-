Kleinanzeigen Notebook Scraper
Full‑stack app that scrapes notebook listings from https://www.kleinanzeigen.de/s-notebooks/c278, stores normalized data, and exposes it via a REST API and React frontend for search, filters, and analysis.​

Core Commands
Backend (Python + Flask):

Create venv: python -m venv .venv && source .venv/bin/activate (Windows: .\.venv\Scripts\activate)

Install deps: pip install -r requirements.txt

Run dev API: flask --app app run --debug --port 5000

Run tests: pytest

Format: ruff check . && black .

Frontend (React):

Install deps: npm install (or pnpm install if lockfile exists)

Run dev UI: npm run dev

Build: npm run build

Lint: npm run lint​

Docker (if docker-compose.yml present):

Start full stack: docker compose up --build

Stop: docker compose down

Always make sure the backend is running on http://localhost:5000 before using the React app.

Project Layout
Expected repo layout:

backend/ – Flask API, scraping logic, DB models

app.py – Flask entrypoint and API routes (/api/listings, /api/search, health checks)

scraper.py – Kleinanzeigen scraping logic (Playwright + BeautifulSoup)

models.py – SQLAlchemy models for Listing and related tables

config.py – env‑driven configuration (DB URL, scraping settings)

tests/ – API and scraper tests

frontend/ – React SPA for browsing and filtering listings

src/components/ – ListingCard, ListingGrid, SearchBar, etc.

src/pages/ – Home page (main listings view)

src/services/api.ts|js – API client wrapping /api/* calls

infrastructure/ (optional) – Docker, CI, deployment manifests

Backend code stays in backend/, frontend in frontend/; shared, environment‑agnostic docs or schemas can live at the repo root (for example JSON schemas for listings).​

Build & Test
Backend:

Unit tests: cd backend && pytest

Type checking (if mypy configured): mypy .

Lint/format: ruff check . && black .

Local dev DB (PostgreSQL):

Use DATABASE_URL env var (for example postgresql+psycopg2://user:pass@localhost:5432/kleinanzeigen)

Run migrations (if Alembic present): alembic upgrade head​

Frontend:

Run unit tests: cd frontend && npm test

Lint: npm run lint

Type check (if TypeScript): npm run type-check

Before merging or tagging a release, ensure:

All backend tests and linters pass

All frontend tests and linting pass

The dev flow works end‑to‑end: scrape at least one page, list results in UI, filter by price and text

Architecture Overview
Scraper layer (backend):

Uses Playwright (headless Chromium) to load Kleinanzeigen notebook pages so that dynamic content is rendered, then parses HTML with BeautifulSoup.​

Normalizes raw listing data into a common schema (title, price in EUR as number, location, URL, description, metadata like posted date and negotiable flag).

API layer (backend):

Flask app exposes REST endpoints under /api:

GET /api/listings – paginated listings with query params like page, min_price, max_price, q, location.

POST /api/scrape – optional admin‑only trigger to scrape one or more pages and persist to DB.

GET /api/stats – aggregate statistics (average price per GPU/CPU, etc.) if implemented.

Persistence layer:

PostgreSQL via SQLAlchemy ORM.

Unique constraint on listing URL or listing external ID to avoid duplicates.

Background task (cron, systemd timer, or external scheduler) periodically triggers scraping and updates records.​

Frontend:

React SPA that calls the Flask API with Axios or Fetch.

Core features: listing grid, detail modal, filters (price range, keyword, city, condition, GPU/CPU tags), pagination / infinite scroll.

Optional: charts (price distribution per GPU, evolution over time) using a client‑side chart library.

Security & Scraping Constraints
Scraping ethics and legality:

Always respect Kleinanzeigen’s Terms of Service and robots.txt before scraping in production. This project is primarily for personal research and educational use.​

Do not attempt to bypass rate limits, captchas, or other access controls.

Request behavior:

Use a realistic User-Agent string and rotate it only if really needed.

Implement rate limiting and backoff:

Default delay between page requests: at least 2–5 seconds.

On HTTP 429 or similar errors, increase delay and limit the number of retries.

Consider using Playwright built‑in wait strategies (wait_until="networkidle" or similar) instead of aggressive polling.

Sensitive data:

Do not scrape or store full seller contact details if pages expose them; limit to fields required for market analysis (title, price, high‑level location, core specs).

Never commit real API keys, DB passwords, or proxy credentials; use env vars and .env files that are git‑ignored.​

Conventions & Patterns
Backend:

Frameworks: Flask, SQLAlchemy, Playwright, BeautifulSoup, pytest.

Style: PEP 8 + black formatting; favor smaller, composable functions.

Scraper:

All Kleinanzeigen‑specific scraping logic stays in scraper.py (or a scraper/ package).

Keep selectors centralized (for example constants like TITLE_SELECTOR, PRICE_SELECTOR) to simplify maintenance when the site HTML changes.

Scraper should return Python dicts or Pydantic models, not ORM objects; persistence happens in a separate service layer.

Models:

A single Listing model with normalized fields (price_eur, city, state, raw_html optional for debugging).

Add helper methods like Listing.from_scraped_dict(data) to encapsulate mapping logic.

Frontend:

React with functional components and hooks.

Centralized API client in src/services/api.*.

UI state:

URL query params mirror filters when possible (for sharable links).

Keep server‑side filtering as the source of truth; client should avoid re‑implementing complex filter logic where a backend query is available.​

Git & workflow:

Branch naming: feature/<slug>, bugfix/<slug>, chore/<slug>.

Before opening a PR:

Backend tests + linting

Frontend tests + linting

Short PR description explaining the change, any new env vars, and how to verify.

Environment & External Services
Environment variables (backend):

DATABASE_URL – PostgreSQL connection string.

SCRAPER_BASE_URL – defaults to https://www.kleinanzeigen.de/s-notebooks/c278.

SCRAPER_PAGE_LIMIT – max pages per run to avoid hammering the site.

PLAYWRIGHT_BROWSER – usually chromium; can be overridden for debugging.

Optional:

HTTP_PROXY, HTTPS_PROXY – if routing through a proxy provider.

Local tooling:

Playwright requires a browser install; after installing dependencies run playwright install for the supported browsers used by the scraper.​

For reproducible dev: pin Python and Node versions in .tool-versions or similar.

Gotchas & Tips for Agents
Do not change scraper selectors casually; changes must be tested against real pages and ideally captured in unit tests with saved HTML fixtures.

When updating scraping logic, add or update tests that:

Load a saved Kleinanzeigen HTML sample.

Assert correct extraction for title, price (as number), location, URL, and negotiable flag.

If adding new filters (for example by GPU model), extend:

Scraper normalization to parse that attribute.

DB schema with a new column and migration.

Backend query logic.

Frontend filter component and query params.

If Kleinanzeigen changes markup heavily, prefer updating Playwright DOM queries instead of falling back to brittle string parsing.

Agents should prefer minimal, well‑scoped changes, keep behavior backward compatible for existing API consumers, and always verify the full stack locally (scrape → API → UI) before considering a task complete.