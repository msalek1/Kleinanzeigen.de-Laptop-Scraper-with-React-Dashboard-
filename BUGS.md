# Kleinanzeigen Notebook Scraper - Bug Tracker

This file tracks bugs, their root causes, and fixes for the project.

## Active Bugs

*No active bugs at this time.*

---

## Resolved Bugs

### BUG-001: Database Race Condition on Docker Startup

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-001 |
| **Status** | Resolved |
| **Module** | Backend |
| **Severity** | Critical |
| **Reported** | 2025-12-04 |
| **Resolved** | 2025-12-05 |

**Description:**  
When starting the backend with multiple gunicorn workers in Docker, multiple workers simultaneously attempted to create database tables, causing PostgreSQL "duplicate key value violates unique constraint pg_class_relname_nsp_index" errors for sequences like `listings_id_seq`.

**Steps to Reproduce:**
1. Run `docker compose up --build`
2. Backend container starts with gunicorn and 2+ workers
3. Multiple workers call `db.create_all()` simultaneously
4. PostgreSQL throws duplicate key constraint errors

**Affected Features:**  
- Backend startup
- Database initialization
- All API endpoints (backend fails to start)

**Root Cause:**  
The `init_db(app)` function was called at module import time in `app.py`, meaning each gunicorn worker process independently tried to create database tables. PostgreSQL sequences have unique name constraints, and the race condition caused conflicts when multiple workers tried to create `listings_id_seq` simultaneously.

**Fix Summary:**  
1. Created a dedicated `init_db.py` script that runs **before** gunicorn starts
2. Used PostgreSQL advisory locks (`pg_advisory_lock(12345)`) to ensure only one process creates tables
3. Modified `Dockerfile` to run `init_db.py` in a startup script before spawning gunicorn workers
4. Removed automatic `db.create_all()` from the Flask app module-level code

**Tests Added/Updated:**
- Manual Docker integration test (start/stop containers)

**Related Files:**
- `backend/init_db.py` (new)
- `backend/app.py` (modified)
- `backend/Dockerfile` (modified)
- `docker-compose.yml` (modified)

---

### BUG-002: Scraper Timeout in Docker Container

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-002 |
| **Status** | Resolved |
| **Module** | Scraper |
| **Severity** | High |
| **Reported** | 2025-12-04 |
| **Resolved** | 2025-12-05 |

**Description:**  
Playwright scraper was timing out when running inside Docker container, failing with `Page.goto: Timeout 30000ms exceeded` errors when trying to scrape Kleinanzeigen.

**Steps to Reproduce:**
1. Run backend in Docker container
2. Trigger a scrape job via API
3. Scraper times out waiting for `networkidle` state

**Affected Features:**  
- Scraper job execution
- Listing data collection

**Root Cause:**  
The `wait_until='networkidle'` parameter expects all network activity to cease, which may never happen on pages with analytics, ads, or persistent WebSocket connections. Docker's network layer and resource constraints exacerbated the issue.

**Fix Summary:**  
1. Changed Playwright `wait_until` from `'networkidle'` to `'domcontentloaded'`
2. Increased page timeout from 30000ms to 60000ms
3. Added explicit 2-second sleep after navigation to allow dynamic content to load

**Tests Added/Updated:**
- `tests/test_scraper.py::TestScraper` (uses mocked responses)

**Related Files:**
- `backend/scraper.py`

---

### Template Entry

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-XXX |
| **Status** | Open / In Progress / Resolved |
| **Module** | Backend / Frontend / Scraper |
| **Severity** | Critical / High / Medium / Low |
| **Reported** | YYYY-MM-DD |
| **Resolved** | YYYY-MM-DD |

**Description:**  
Brief description of the bug.

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Affected Features:**  
List of features impacted.

**Root Cause:**  
Explanation of why the bug occurred.

**Fix Summary:**  
Description of the fix applied.

**Tests Added/Updated:**
- `tests/test_file.py::test_name`

**Related Files:**
- `path/to/file.py`

---

## Bug Tracking Guidelines

### Severity Levels

- **Critical**: Application crashes, data loss, security vulnerability
- **High**: Major feature broken, no workaround available
- **Medium**: Feature partially broken, workaround available
- **Low**: Minor issue, cosmetic problems

### Module Classification

- **Backend**: Flask API, database models, services
- **Frontend**: React components, UI issues
- **Scraper**: Selector failures, parsing issues, compliance problems

### For Scraper-Related Bugs

When documenting scraper selector bugs, include:
1. The failing selector
2. Example of the HTML that caused the failure
3. The corrected selector
4. A test case with an HTML fixture

Example:
```
Failing selector: `.price-tag`
HTML sample: `<div class="aditem-main--middle--price-shipping--price">450 €</div>`
Corrected selector: `.aditem-main--middle--price-shipping--price`
Test: tests/test_scraper.py::TestSelectors::test_price_selector
```
