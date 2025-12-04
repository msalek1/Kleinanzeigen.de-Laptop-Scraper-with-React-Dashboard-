# Kleinanzeigen Notebook Scraper

A full-stack application that scrapes notebook listings from Kleinanzeigen, stores normalized data, and exposes it via a REST API and React frontend for search, filters, and analysis.

> ⚠️ **Disclaimer:** This project is for personal research and educational use only. Always respect Kleinanzeigen's Terms of Service and robots.txt before scraping.

## Features

- 🔍 **Search & Filter** - Find notebooks by keyword, price range, location, and condition
- 📊 **Market Statistics** - View average prices, price distribution, and top cities
- 🤖 **Automated Scraping** - Playwright-powered scraper with rate limiting and robots.txt compliance
- 📱 **Responsive UI** - Modern React frontend with TailwindCSS
- 🐳 **Docker Ready** - Full-stack deployment with Docker Compose

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL (or use SQLite for development)
- Docker & Docker Compose (optional)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
.\.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Run development server
flask --app app run --debug --port 5000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

### Docker Setup

```bash
# Start full stack
docker compose up --build

# Stop
docker compose down
```

## Project Structure

```
├── backend/
│   ├── app.py          # Flask entrypoint and API routes
│   ├── config.py       # Environment configuration
│   ├── models.py       # SQLAlchemy database models
│   ├── scraper.py      # Playwright + BeautifulSoup scraper
│   ├── tests/          # Pytest test suite
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── hooks/      # React Query hooks
│   │   └── services/   # API client
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── WIKI.md            # Architecture documentation
├── BUGS.md            # Bug tracker
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/v1/listings` | List listings (paginated, filterable) |
| GET | `/api/v1/listings/{id}` | Get single listing |
| GET | `/api/v1/stats` | Get aggregate statistics |
| GET | `/api/v1/scraper/jobs` | List scraper jobs |
| POST | `/api/v1/scraper/jobs` | Trigger new scraper job |
| GET | `/api/v1/scraper/jobs/{id}` | Get job status |

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# Flask
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/kleinanzeigen

# Scraper
SCRAPER_PAGE_LIMIT=5
SCRAPER_DELAY_SECONDS=3.0

# CORS
CORS_ORIGINS=http://localhost:5173
```

## Testing

```bash
# Backend tests
cd backend
pytest
pytest --cov=. --cov-report=html

# Frontend
cd frontend
npm run lint
npm run type-check
```

## Documentation

- [WIKI.md](./WIKI.md) - Architecture and API documentation
- [BUGS.md](./BUGS.md) - Bug tracker and fix history

## License

MIT License - See LICENSE file for details.
