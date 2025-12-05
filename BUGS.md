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

### BUG-003: Keywords Concatenated Instead of Searched Separately

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-003 |
| **Status** | Resolved |
| **Module** | Backend / Scraper |
| **Severity** | High |
| **Reported** | 2025-12-05 |
| **Resolved** | 2025-12-05 |

**Description:**  
When multiple keywords were configured in the admin panel (e.g., "asus rog, msi katana, lenovo legion"), they were being concatenated with `+` signs into a single URL instead of running separate searches for each keyword. This resulted in incorrect search URLs like:
```
https://www.kleinanzeigen.de/s-notebooks/berlin/c278?keywords=asus+rog+msi+katana+lenovo+legion+hp+omen
```
Instead of searching each keyword separately.

**Steps to Reproduce:**
1. Go to Admin panel
2. Add multiple keywords: "asus rog, msi katana, lenovo legion"
3. Run scraper
4. Observe concatenated URL in logs

**Affected Features:**  
- Scraper job execution
- Search accuracy
- Listing data collection

**Root Cause:**  
The `trigger_scraper()` function in `app.py` was replacing commas with `+` signs and building a single URL with all keywords combined:
```python
keyword_param = keywords.replace(',', '+').replace(' ', '+')
```
This treated all keywords as a single search phrase rather than separate search queries.

**Fix Summary:**  
1. Refactored `trigger_scraper()` to parse keywords into a list and iterate through each one separately
2. Each keyword now triggers its own scraper run with a clean URL
3. Added deduplication logic using `seen_external_ids` set to prevent duplicate listings when the same item appears in multiple keyword searches
4. Added per-keyword error handling so one failed keyword doesn't abort the entire job
5. Fixed URL building in `scraper.py` to correctly handle pagination with query parameters

**Example of corrected behavior:**
```
Keyword: 'asus rog' - URL: .../c278?keywords=asus+rog
Keyword: 'msi katana' - URL: .../c278?keywords=msi+katana
Keyword: 'lenovo legion' - URL: .../c278?keywords=lenovo+legion
```

**Tests Added/Updated:**
- Manual testing with multiple keywords in admin panel

**Related Files:**
- `backend/app.py` (major refactor of `trigger_scraper()`)
- `backend/scraper.py` (fixed pagination URL building)

---

### BUG-004: Scraper Lacks Retry Logic and Robust Error Handling

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-004 |
| **Status** | Resolved |
| **Module** | Scraper |
| **Severity** | Medium |
| **Reported** | 2025-12-05 |
| **Resolved** | 2025-12-05 |

**Description:**  
The scraper would fail silently or abort entirely when encountering transient errors like network timeouts, rate limiting (HTTP 429), or server errors (HTTP 5xx). There was no retry mechanism.

**Steps to Reproduce:**
1. Run scraper during high traffic period
2. Encounter rate limit or timeout
3. Scraper returns empty results without retrying

**Affected Features:**  
- Scraper reliability
- Data collection completeness

**Root Cause:**  
The `scrape_page()` method had basic error handling but no retry logic. Rate limiting responses would just return empty results, and network errors would abort the page entirely.

**Fix Summary:**  
1. Added retry logic with configurable `MAX_RETRIES = 3`
2. Implemented exponential backoff for rate limiting (429 responses)
3. Added retry for server errors (5xx)
4. Added retry when no listings found (possible page load issue)
5. Individual listing parse failures now logged and skipped instead of aborting
6. Per-keyword error handling in `trigger_scraper()` continues with remaining keywords

**Tests Added/Updated:**
- Manual testing with simulated network issues

**Related Files:**
- `backend/scraper.py` (`scrape_page()` method)
- `backend/app.py` (`trigger_scraper()`)

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
