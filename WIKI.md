# Kleinanzeigen Notebook Scraper - Wiki

## Overview

The Kleinanzeigen Notebook Scraper is a full-stack application that collects, normalizes, and displays notebook listings from Kleinanzeigen for market analysis and search purposes.

**Purpose:** Personal research and educational use for analyzing the German used notebook market.

**Tech Stack:**
- **Backend:** Python, Flask, SQLAlchemy, Playwright, BeautifulSoup
- **Frontend:** React, TypeScript, TailwindCSS, React Query
- **Database:** PostgreSQL (production) / SQLite (development)
- **Infrastructure:** Docker, Docker Compose

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React SPA      │────▶│  Flask API      │────▶│  PostgreSQL     │
│  (Frontend)     │     │  (Backend)      │     │  (Database)     │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │  Playwright     │
                        │  Scraper        │
                        │                 │
                        └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Kleinanzeigen  │
                        │  (External)     │
                        └─────────────────┘
```

---

## User Roles

### End User
- Browse and search notebook listings
- Filter by price, location, condition
- View listing details and statistics
- Access external listing links

### Admin
- Trigger scraper jobs
- Monitor job status and logs
- Manage scraper configuration
- View system statistics

---

## Backend Modules

### `app.py` - Flask Application
Main Flask application factory and API route registration.

**Responsibilities:**
- Application initialization with factory pattern
- Blueprint registration
- Error handling
- CORS configuration

### `config.py` - Configuration
Environment-driven configuration management.

**Key Settings:**
- `DATABASE_URL` - Database connection string
- `SCRAPER_BASE_URL` - Kleinanzeigen category URL
- `SCRAPER_PAGE_LIMIT` - Max pages per scrape
- `SCRAPER_DELAY_SECONDS` - Polite delay between requests

### `models.py` - Database Models
SQLAlchemy ORM models for data persistence.

**Models:**
- `Listing` - Scraped notebook listings
- `ScraperJob` - Job execution tracking

**Key Fields (Listing):**
| Field | Type | Description |
|-------|------|-------------|
| `external_id` | String | Kleinanzeigen listing ID |
| `url` | String | Full listing URL |
| `title` | String | Listing title |
| `price_eur` | Integer | Price in cents |
| `price_negotiable` | Boolean | VB flag |
| `location_city` | String | City name |
| `condition` | String | Item condition |

### `scraper.py` - Scraping Logic
Playwright + BeautifulSoup scraping implementation.

**Classes:**
- `RobotsChecker` - robots.txt compliance verification
- `KleinanzeigenScraper` - Main scraper class

**Key Methods:**
- `scrape()` - Main entry point for scraping
- `scrape_page()` - Single page scraping
- `_parse_listing()` - HTML to dict conversion
- `_extract_price()` - Price normalization

---

## Frontend Structure

### Pages

| Page | Path | Description |
|------|------|-------------|
| HomePage | `/` | Main listings grid with filters |
| Stats View | `/?view=stats` | Statistics panel |

### Components

| Component | Purpose |
|-----------|---------|
| `Layout` | Page wrapper with header/footer |
| `Header` | Navigation and branding |
| `FilterBar` | Search and filter controls |
| `ListingCard` | Individual listing display |
| `ListingGrid` | Grid of listing cards |
| `Pagination` | Page navigation |
| `StatsPanel` | Aggregate statistics |

### Services

| Service | File | Purpose |
|---------|------|---------|
| API Client | `src/services/api.ts` | Centralized HTTP calls |
| React Query Hooks | `src/hooks/useApi.ts` | Data fetching/caching |

---

## API Reference

### Base URL
```
Development: http://localhost:5000/api/v1
Production: https://your-domain.com/api/v1
```

### Endpoints

#### Health Check
```
GET /api/health
```
Returns API health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-04T10:30:00Z"
}
```

#### List Listings
```
GET /api/v1/listings
```
Get paginated listings with optional filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | int | Page number (default: 1) |
| `per_page` | int | Items per page (default: 20, max: 100) |
| `q` | string | Search query (title/description) |
| `min_price` | float | Minimum price in EUR |
| `max_price` | float | Maximum price in EUR |
| `location` | string | City filter |
| `condition` | string | Condition filter |
| `sort` | string | Sort field (price, posted_at, scraped_at) |
| `order` | string | Sort order (asc, desc) |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "external_id": "123456789",
      "url": "https://www.kleinanzeigen.de/...",
      "title": "Dell XPS 15 Laptop",
      "price_eur": 750.0,
      "price_negotiable": true,
      "location": {
        "city": "Berlin",
        "state": null
      },
      "description": "...",
      "condition": "Gebraucht",
      "posted_at": "2024-12-01T10:00:00",
      "scraped_at": "2024-12-04T08:00:00",
      "image_url": "https://...",
      "seller_type": null
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total_pages": 5,
    "total_items": 100,
    "has_next": true,
    "has_prev": false
  }
}
```

#### Get Single Listing
```
GET /api/v1/listings/{id}
```
Get a single listing by ID.

#### Get Statistics
```
GET /api/v1/stats
```
Get aggregate statistics.

**Response:**
```json
{
  "data": {
    "total_listings": 500,
    "average_price": 650.50,
    "min_price": 50.0,
    "max_price": 3500.0,
    "listings_by_city": [
      {"city": "Berlin", "count": 120},
      {"city": "Munich", "count": 85}
    ]
  }
}
```

#### List Scraper Jobs
```
GET /api/v1/scraper/jobs
```
Get list of scraper job executions.

#### Trigger Scraper Job
```
POST /api/v1/scraper/jobs
```
Trigger a new scraper job (admin only).

**Request Body:**
```json
{
  "page_limit": 5
}
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "status": "completed",
    "pages_scraped": 5,
    "listings_found": 125,
    "listings_new": 80,
    "listings_updated": 45
  },
  "message": "Scraping completed. 80 new listings, 45 updated."
}
```

#### Get Scraper Job Status
```
GET /api/v1/scraper/jobs/{id}
```
Get status of a specific job.

---

## Security & Compliance

### Authentication
- Development: No authentication required
- Production: Token-based or session authentication recommended for scraper endpoints

### CORS
- Configured via `CORS_ORIGINS` environment variable
- Only whitelisted origins allowed in production

### Scraper Compliance

**robots.txt Respect:**
- Scraper checks robots.txt before scraping
- Disallowed paths are not accessed

**Rate Limiting:**
- Minimum 2-second delay between requests
- Configurable via `SCRAPER_DELAY_SECONDS`
- Automatic backoff on HTTP 429

**User-Agent:**
- Realistic browser User-Agent used
- No aggressive rotation or spoofing

**Data Handling:**
- No personal seller data stored
- Only market-relevant fields captured
- Real data not committed to version control

---

## Data Flow

### User Search Flow
```
1. User enters search query in FilterBar
2. FilterBar updates URL query params
3. HomePage detects param change
4. useListings hook calls GET /api/v1/listings?q=...
5. Backend queries PostgreSQL with filters
6. Results returned as JSON
7. ListingGrid renders ListingCard components
```

### Scraper Job Flow
```
1. Admin clicks "Scrape New Listings" button
2. POST /api/v1/scraper/jobs triggered
3. Backend creates ScraperJob record (status: running)
4. Playwright browser launched
5. robots.txt checked
6. Pages scraped with delays
7. HTML parsed with BeautifulSoup
8. Listings normalized and saved to DB
9. ScraperJob updated (status: completed)
10. Frontend receives job summary
11. Listings cache invalidated
```

### Markup Change Response
```
1. Scraper fails to extract data
2. Error logged with selector details
3. Developer updates SELECTORS in scraper.py
4. New HTML fixture added to tests
5. Tests verify corrected selectors
6. Fix deployed
```

---

## Development Setup

### Backend
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate  # Windows
pip install -r requirements.txt
playwright install chromium
flask --app app run --debug --port 5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Docker
```bash
docker compose up --build
```

---

## Testing

### Backend Tests
```bash
cd backend
pytest
pytest --cov=. --cov-report=html
```

### Frontend Tests
```bash
cd frontend
npm test
npm run lint
npm run type-check
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes (prod) | dev-key | Flask secret key |
| `DATABASE_URL` | No | sqlite:///kleinanzeigen.db | Database connection |
| `SCRAPER_BASE_URL` | No | Kleinanzeigen notebooks | Scrape target |
| `SCRAPER_PAGE_LIMIT` | No | 5 | Max pages per run |
| `SCRAPER_DELAY_SECONDS` | No | 3.0 | Delay between requests |
| `CORS_ORIGINS` | No | localhost:5173 | Allowed origins |

---

## Contributing

1. Create a feature branch: `feature/your-feature`
2. Make changes following code conventions
3. Add/update tests
4. Update BUGS.md if fixing a bug
5. Update WIKI.md if changing architecture
6. Run all tests and linting
7. Submit PR with description
