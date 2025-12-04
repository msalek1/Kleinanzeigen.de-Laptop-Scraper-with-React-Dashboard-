---
trigger: always_on
---

# Kleinanzeigen Notebook Scraper – Flask + React

This repository contains a Flask backend (REST API + scraping logic) and a React frontend SPA.  
The Flask backend exposes a secure REST API that the React frontend consumes over HTTPS, respecting Kleinanzeigen's Terms of Service and robots.txt. [web:61][web:62][web:67]  
Main priorities: **scraping compliance, security, clean code, clear architecture, complete documentation, and maintainable error tracking.**

---

## Security priorities (Flask backend)

- Always treat security as a first-class concern, especially for authentication, scraper compliance, and data handling. [web:62][web:63][web:68]
- Follow official Flask security documentation and deployment checklist:
  - CSRF protection (use `flask-wtf` for forms if needed; JSON endpoints with proper CORS headers). [web:62][web:68]
  - XSS protection through template escaping and avoiding `render_template_string` with user input. [web:68]
  - SQL injection prevention by using SQLAlchemy ORM exclusively. [web:62][web:68]
  - Secure sessions and strong password handling (if multi-user auth needed; use `werkzeug` utilities). [web:62][web:71]
- In production:
  - `DEBUG = False`
  - Proper `FLASK_ENV = production`
  - HTTPS enforced (reverse proxy, HSTS headers, secure cookies). [web:62][web:77]
  - Use `Flask-Talisman` to set security headers (CSP, X-Frame-Options, etc.). [web:68]
- Never log or expose API keys, proxy credentials, database passwords, or listing data in plain text. [web:62]
- Use environment variables for all secrets; never commit `.env` files or hardcoded credentials. [web:77]
- **Scraper compliance:**
  - Always check and respect the target site's `robots.txt` before scraping (see `scraper/robots_checker.py`). [web:67][web:70][web:76]
  - Verify Kleinanzeigen's Terms of Service and do not bypass rate limits or access controls. [web:67][web:73][web:79]
  - Implement polite backoff strategies (2–5 second delays between requests); observe HTTP 429 responses. [web:67][web:76]
  - Use realistic, rotating User-Agent headers and identify your scraper (e.g., `X-Scraper-ID` header). [web:67]
- For API endpoints, enforce authentication and authorization using token-based or session-based auth. Validate every request. [web:63][web:65]
- Before changing security-related logic or scraper behavior, document the rationale and request explicit confirmation. [web:62]

---

## Coding style and best practices (backend – Flask)

- Prefer clear, explicit, readable code over clever one-liners.
- Follow Flask and SQLAlchemy best practices for application structure:
  - Factory pattern for app initialization (`create_app(config)`).
  - Blueprints for modular route organization (e.g., `api`, `admin`, `scraper`).
  - Services/use-case modules to encapsulate business logic (scraping, filtering, data transformation). [web:64][web:74]
- Use the SQLAlchemy ORM exclusively; never write raw SQL unless unavoidable, and always use parameterized queries. [web:62][web:68]
- Keep views thin; move scraping logic, filtering, and normalization into service modules. [web:74]
- Use type hints in Python (especially in service functions and utilities). [web:64]
- Keep functions and methods single-responsibility. [web:64]
- Wrap async scraping tasks using Celery or APScheduler for background jobs (e.g., scheduled scrapes). [web:76]

---

## Coding style and best practices (frontend – React)

- Use modern React with functional components and hooks.
- Centralize HTTP logic in a dedicated API client module (e.g., `src/api/client.ts` or `src/services/apiClient.js`) instead of calling `fetch` or `axios` everywhere. [web:69][web:72][web:75]
- Prefer state management through React Query (TanStack Query) for server-state caching and synchronization. Avoid unnecessary global state. [web:72][web:75][web:80]
- Keep React components focused on presentation and orchestration; delegate data fetching to hooks (e.g., `useQuery`, custom hooks) and business logic to dedicated modules. [web:69][web:75]
- Avoid duplication of business rules in React; backend is the single source of truth for validations, filters, and permissions. [web:78]

---

## API design and routing (Flask)

- The Flask backend exposes a REST API (using Flask + Flask-RESTx or Blueprints) that the React frontend consumes. [web:64][web:77]
- Use clear, resource-oriented URLs and HTTP methods:
  - `GET /api/v1/listings/` – list all (paginated, filterable).
  - `POST /api/v1/listings/` – not typically used; scraping is admin-only.
  - `GET /api/v1/listings/{id}/` – retrieve a single listing.
  - `GET /api/v1/stats/` – aggregate statistics (average price, trends, etc.).
  - `POST /api/v1/scraper/jobs/` – trigger a scraping job (admin-only).
  - `GET /api/v1/scraper/jobs/{job_id}/` – check job status and logs. [web:64][web:77]
- All API endpoints must:
  - Return JSON responses with a consistent structure (e.g., `{ "data": ..., "errors": ..., "pagination": ... }`).
  - Use appropriate HTTP status codes (2xx success, 4xx client errors, 5xx server errors). [web:64][web:77]
- Version the API with a prefix such as `/api/v1/` to support future non-breaking changes. [web:64][web:77]
- Group routes by domain/concern:
  - `/api/v1/listings/` – listing retrieval and filtering.
  - `/api/v1/scraper/` – job management and configuration.
  - `/api/v1/admin/` – settings, roles, audit logs (if multi-user).

---

## Authentication, authorization, and CORS

- For multi-user scenarios:
  - Use server-side authentication (token-based with `flask-jwt-extended` or session-based). Never rely on React-only checks. [web:63][web:65]
  - For token auth: use short-lived access tokens with refresh tokens; store tokens in HTTP-only cookies where possible. [web:65]
  - Enforce authorization checks on every endpoint (role-based access, object-level checks). Hiding UI elements in React is insufficient. [web:63]
- For single-user / local dev:
  - Optional: use a simple API key in headers or basic HTTP auth (only over HTTPS in production).
- Configure CORS correctly:
  - Use `flask-cors` library.
  - Explicitly whitelist the React frontend origin(s).
  - Do not enable `CORS_ALLOW_ALL_ORIGINS` in production. [web:62][web:77]
- All scraper endpoints (job trigger, config updates) must require admin authentication or API key validation. [web:67][web:76]

---

## Using the API from React

- Implement a shared API client (e.g., `src/api/client.ts`) that:
  - Sets the base URL (`http://localhost:5000/api/v1` or production endpoint).
  - Handles JSON serialization/deserialization.
  - Injects auth credentials (tokens or cookies). [web:69][web:72]
  - Normalizes error responses for the UI.
- React components should:
  - Call high-level functions like `getListings({ page, minPrice, maxPrice })` or `triggerScrapeJob()` instead of hardcoded URLs.
  - Use `useQuery` / custom hooks to manage loading/error states and caching.
- Implement global behavior for:
  - 401/403 responses (redirect to login or show "not authorized").
  - Network errors (show generic error state; optionally retry with exponential backoff).
  - Job polling (check scraper job status at intervals). [web:69][web:72][web:80]

---

## Frontend security best practices

- Never directly inject untrusted HTML into the DOM. Avoid `dangerouslySetInnerHTML`; sanitize inputs with libraries like `DOMPurify` if necessary. [web:68]
- Do not store secrets (API keys, internal endpoints) in React code or `.env` files bundled with the frontend. [web:68]
- Validate user input on the client for UX, but always enforce validation on the backend. [web:68]
- Do not expose internal implementation details (raw database IDs, debug info, unfiltered listing counts) in API responses without purpose. [web:68]

---

## Documentation in code (docstrings and comments)

- Every non-trivial function and method in Flask must include a concise docstring covering:
  - High-level purpose.
  - Important parameters and types.
  - Return value(s) and side effects (database writes, HTTP calls, scraper invocations, etc.).
- For security-sensitive and compliance-critical functions (auth, rate limiting, scraper selector extraction, robots.txt checks), docstrings must also capture:
  - Security assumptions.
  - Compliance boundaries (which site rules are respected).
  - Failure conditions and error handling.
- In React:
  - Document complex hooks, reusable components, and utilities with JSDoc-style blocks explaining inputs, outputs, and data sources.
- Comments should focus on *why* something is done in a particular way, not restate the obvious *what*.

---

## BUGS.md – bug tracking and fixes

- Maintain a `BUGS.md` file at the project root to track:
  - Bug ID, status, module (backend/frontend/scraper), severity.
  - Description, steps to reproduce, and affected features.
  - Root cause (parsing failure, API mismatch, compliance breach, etc.).
  - Fix summary and tests added or updated.
- For every bug fix:
  - Add or update an entry in `BUGS.md`.
  - Describe the root cause in 1–3 sentences.
  - Link to relevant tests (names or file paths).
  - If the bug involves scraper selectors, include an example of the corrected HTML pattern.
- Do not silently change behavior. Tie changes to a bug ID, ticket, or clear explanation in commits and `BUGS.md`.

---

## WIKI.md – architecture and features

- Maintain a `WIKI.md` file at the project root describing:
  - Overall system purpose: collect, normalize, and display notebook listings from Kleinanzeigen for market analysis and search.
  - User roles (e.g., End User browsing listings; Admin managing scraper jobs and settings).
  - High-level architecture (Flask REST API, React SPA, PostgreSQL, background scraper tasks via Celery/APScheduler).
  - Main Flask modules and their responsibilities:
    - `api/listings` – listing queries, filtering, pagination.
    - `api/scraper` – job creation, status checks, logs.
    - `scraper/` – Playwright + BeautifulSoup logic, selector extraction, data normalization.
    - `models/` – SQLAlchemy models (Listing, ScraperJob, etc.).
    - `services/` – business logic for filtering, stats, compliance checks.
  - Main React sections/pages and how they map to backend APIs:
    - `ListingGrid` component → `GET /api/v1/listings/`
    - `FilterBar` component → query params sent to `GET /api/v1/listings/?q=...&minPrice=...`
    - `JobDashboard` component → `GET /api/v1/scraper/jobs/`, `POST /api/v1/scraper/jobs/`
- For each domain (Listings, Scraper Jobs), `WIKI.md` should describe:
  - Key models and relationships.
  - Service classes and how they interact with models and views.
  - API endpoints and which React components call them.
- `WIKI.md` must include:
  - An "API Reference" section listing endpoints, methods, parameters, and response shapes.
  - A "Security & Compliance" section summarizing auth, robots.txt respect, rate limiting, and User-Agent policies.
  - A "Data Flow" section describing typical flows:
    - User searches → frontend calls `/listings?q=...` → backend queries DB and returns results.
    - Admin triggers scrape → backend invokes Playwright task → stores in DB → React polls `/scraper/jobs/{id}` for status.
    - Scraper handles Kleinanzeigen markup changes → selector extraction logic in `scraper.py` is updated and tested.

---

## Testing and quality

- For each bug fix, add at least one regression test that would fail before the fix and pass after.
- Cover new features with unit tests (services, utilities) and integration tests (API endpoints, React components where feasible). [web:64][web:74]
- Keep tests deterministic and isolated; mock external scraping and database calls. [web:64]
- For scraper-specific code:
  - Tests should use saved HTML fixtures (snippets of real Kleinanzeigen listings) to avoid live scraping during CI.
  - Tests must validate selector accuracy and price/spec normalization.
- For security-sensitive code, ensure tests cover:
  - Permission checks (expected 403/401 for unauthorized scraper operations).
  - Rate limiting and backoff behavior.
  - robots.txt compliance verification.
- For API endpoints, test:
  - Correct HTTP status codes and response shapes.
  - Pagination and filtering.
  - Error conditions (malformed queries, missing auth, etc.).

---

## What to avoid

- Do not disable Flask security middleware or CORS restrictions without documented justification. [web:62][web:77]
- Do not introduce new scraping libraries or proxy services without documenting:
  - Why they are needed (e.g., Playwright for JavaScript rendering vs. BeautifulSoup).
  - How they are configured and kept compliant with robots.txt. [web:67][web:70]
- Do not hardcode secrets, API keys, proxy credentials, or Kleinanzeigen-specific URLs into the repo. Use environment variables. [web:77]
- Do not bypass rate limiting, User-Agent validation, or robots.txt checks "to make scraping faster". [web:67][web:73][web:76]
- Do not commit real scraped listing data or personally identifiable information (seller contact details, email addresses) into version control. [web:76][web:79]
- Do not silently ignore or log HTTP errors and parsing failures without notifying the admin. Include meaningful error messages in scraper logs. [web:76]

---

## How the agent should help

- When writing or modifying Flask code:
  - Enforce security best practices by default (safe query patterns, HTTPS-only headers, rate limiting).
  - Add or improve docstrings for every non-trivial function, method, and class.
  - Propose tests for new or changed logic, especially scraper and authorization paths.
  - Validate that any new scraper behavior respects robots.txt and Kleinanzeigen's ToS.

- When writing or modifying React code:
  - Use the shared API client and avoid duplicating fetch logic.
  - Keep components simple; move reusable logic into custom hooks or utilities.
  - Respect the documented API contracts; update `WIKI.md` when endpoints or flows change.
  - Implement proper loading/error states and user feedback for long-running scraper jobs.

- When refactoring:
  - Preserve behavior; document the rationale and impact in comments or commit messages.
  - If changing scraper selectors, include a test case with a real HTML sample to verify correctness.

- When ambiguity exists (scraper compliance, permission rules, data contracts):
  - Ask clarifying questions rather than guessing behavior.
  - If uncertain about Kleinanzeigen's policies, check robots.txt and ToS links documented in the code.

---

## File locations & discovery

This `AGENTS.md` file lives at the repo root. Agents read it before planning any change, giving them the same tribal knowledge needed to maintain compliance, security, and code quality across the Flask backend and React frontend.
