# Kleinanzeigen Notebook Scraper - Wiki

## Overview

The Kleinanzeigen Notebook Scraper is a full-stack application that collects, normalizes, and displays notebook listings from Kleinanzeigen for market analysis and search purposes.

**Purpose:** Personal research and educational use for analyzing the German used notebook market.

**Tech Stack:**
- **Backend:** Python, Flask, SQLAlchemy, Playwright, BeautifulSoup
- **Frontend:** React, TypeScript, TailwindCSS, Framer Motion, React Query
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
- `ScraperConfig` - Admin configuration for scraper settings
- `PriceHistory` - Price change tracking for listings

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
| `search_keywords` | String | Comma-separated search keywords that found this listing |

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

### UI/UX Enhancements (2025 Design)
- **Glassmorphism Header:** Sticky header with `backdrop-blur-md` and semi-transparent backgrounds.
- **Staggered Animations:** `ListingGrid` items cascade in with a slight delay using `framer-motion` variants.
- **Micro-interactions:** Hover lift, scale effects, and tap feedback on `ListingCard` and buttons.
- **Smooth Transitions:** `AnimatePresence` used for smooth entry/exit of filter panels and grid items.
- **Loading States:** Animated spinner and skeleton-like feel for better perceived performance.

### Pages

| Page | Path | Description |
|------|------|-------------|
| HomePage | `/` | Main listings grid with filters |
| Stats View | `/?view=stats` | Statistics panel |
| AdminPage | `/admin` | Scraper configuration panel |

### Components

| Component | Purpose |
|-----------|---------|
| `Layout` | Page wrapper with glassmorphism header/footer |
| `Header` | Sticky navigation and branding with slide-down entry |
| `FilterBar` | Search/filter controls with expandable animation |
| `ListingCard` | Individual listing display with hover/tap animations |
| `ListingGrid` | Staggered animated grid of listing cards |
| `Pagination` | Page navigation |
| `StatsPanel` | Aggregate statistics |
| `ListingModal` | Full listing detail modal with price history |
| `ScraperProgressPanel` | Real-time scraper progress display |
| `PriceAlertModal` | Price alert management |

### Services

| Service | File | Purpose |
|---------|------|---------|
| API Client | `src/services/api.ts` | Centralized HTTP calls |
| React Query Hooks | `src/hooks/useApi.ts` | Data fetching/caching |

### Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useFavorites` | `src/hooks/useFavorites.ts` | Manage favorite listings in localStorage |
| `usePriceAlerts` | `src/hooks/useFavorites.ts` | Manage price alerts in localStorage |
| `useScraperSSE` | `src/hooks/useScraperSSE.ts` | Subscribe to real-time scraper progress via SSE |

---

## High-Priority Features (2025)

### 1. Real-time Scraper Progress (SSE)

**Backend:**
- `sse.py` - Server-Sent Events manager with thread-safe queue
- Endpoint: `GET /api/v1/scraper/jobs/{job_id}/progress`
- Events: `connected`, `progress`, `complete`, `error`

**Frontend:**
- `useScraperSSE` hook for subscribing to progress updates
- `ScraperProgressPanel` component for displaying progress
- Auto-connects when scraper job is triggered

**Progress Data:**
```typescript
interface ScraperProgress {
  status: 'running' | 'completed' | 'failed'
  current_keyword: string
  keyword_index: number
  total_keywords: number
  listings_found: number
  elapsed_seconds: number
  message: string
}
```

### 2. Listing Detail Modal

**Component:** `ListingModal.tsx`

**Features:**
- Full-screen modal with large image display
- Complete listing metadata (title, price, location, condition)
- Price history chart (using Recharts)
- Price trend indicator (up/down/stable)
- Favorite toggle button
- External link to original listing

### 3. Price History Tracking

**Backend:**
- `PriceHistory` model tracking price changes over time
- Automatic recording when listing price changes during scrape
- Stored in `price_history` table with foreign key to `listings`

**Data Structure:**
```python
class PriceHistory(db.Model):
    id: int
    listing_id: int (FK → listings.id)
    price_cents: int | null
    recorded_at: datetime
```

**API Response:**
- `price_history` array included in listing responses
- `price_trend` calculated from last two price points

### 4. Favorites/Watchlist

**Storage:** localStorage (`kleinanzeigen_favorites`)

**Features:**
- Heart button on listing cards (shows on hover, filled when favorited)
- Favorites page (`/favorites`) showing all saved listings
- Badge count in header navigation
- Toggle favorite from card or modal

**Hook API:**
```typescript
const { favorites, isFavorite, toggleFavorite, favoritesCount } = useFavorites()
```

### 5. Quick Price Alerts

**Storage:** localStorage (`kleinanzeigen_price_alerts`)

**Features:**
- Bell icon in header opens alert modal
- Set max price threshold per keyword
- Notifications when listings match criteria
- Active alerts count badge

**Hook API:**
```typescript
const { alerts, addAlert, removeAlert, checkListingsForAlerts } = usePriceAlerts()
```

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
| `keyword` | string | Filter by search keyword tag |
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
      "seller_type": null,
      "search_keywords": ["asus rog", "gaming laptop"]
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

#### Get Search Keywords
```
GET /api/v1/keywords
```
Get all unique search keywords from listings with their counts. Used for keyword filter tags in the dashboard.

**Response:**
```json
{
  "data": [
    {"keyword": "asus rog", "count": 45},
    {"keyword": "msi katana", "count": 32},
    {"keyword": "lenovo legion", "count": 28}
  ]
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

#### Get Scraper Job Progress (SSE)
```
GET /api/v1/scraper/jobs/{id}/progress
```
Server-Sent Events stream for real-time job progress.

**Events:**
- `connected` - Initial connection established
- `progress` - Job progress update
- `complete` - Job finished successfully
- `error` - Job failed with error

**Progress Event Data:**
```json
{
  "status": "running",
  "current_keyword": "laptop",
  "keyword_index": 2,
  "total_keywords": 5,
  "listings_found": 45,
  "elapsed_seconds": 30,
  "message": "Scraping keyword 2/5: laptop"
}
```

#### Get Admin Configuration
```
GET /api/v1/admin/config
```
Get current scraper configuration settings.

**Response:**
```json
{
  "data": {
    "id": 1,
    "keywords": "notebook,laptop",
    "keywords_list": ["notebook", "laptop"],
    "city": "",
    "categories": "c278",
    "categories_list": ["c278"],
    "update_interval_minutes": 60,
    "page_limit": 5,
    "is_active": false,
    "last_modified": "2024-12-04T10:30:00Z"
  }
}
```

#### Update Admin Configuration
```
PUT /api/v1/admin/config
```
Update scraper configuration (admin only).

**Request Body:**
```json
{
  "keywords": "thinkpad,macbook",
  "city": "berlin",
  "categories": "c278,c225",
  "update_interval_minutes": 30,
  "page_limit": 10,
  "is_active": true
}
```

#### Get Available Categories
```
GET /api/v1/admin/categories
```
Get list of available Kleinanzeigen categories.

#### Get Available Cities
```
GET /api/v1/admin/cities
```
Get list of major German cities for filtering.

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
1. Admin clicks "Run Scraper Now" button in Admin panel
2. POST /api/v1/scraper/jobs triggered
3. Backend reads ScraperConfig from database
4. Scraper URL built from config (keywords, city, categories)
5. ScraperJob record created (status: running)
6. Playwright browser launched
7. robots.txt checked
8. Pages scraped with delays
9. HTML parsed with BeautifulSoup
10. Listings normalized and saved to DB
11. ScraperJob updated (status: completed)
12. Frontend receives job summary
13. Listings cache invalidated
```

### Admin Configuration Flow
```
1. Admin navigates to /admin
2. Frontend loads config via GET /api/v1/admin/config
3. Admin modifies keywords, city, categories, or timer
4. Admin clicks "Save Configuration"
5. PUT /api/v1/admin/config updates database
6. Next scraper job uses new configuration
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
