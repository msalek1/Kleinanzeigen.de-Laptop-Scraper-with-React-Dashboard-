# Kleinanzeigen Notebook Scraper

Eine Full-Stack-Anwendung, die Notebook-Anzeigen von Kleinanzeigen scrapt, normalisierte Daten speichert und diese über eine REST-API und ein React-Frontend für Suche, Filterung und Analyse bereitstellt.

> ⚠️ **Haftungsausschluss:** Dieses Projekt dient ausschließlich persönlichen Forschungs- und Bildungszwecken. Beachten Sie vor dem Scraping stets die Nutzungsbedingungen und die robots.txt von Kleinanzeigen.

## Funktionen

- 🔍 **Suche & Filter** - Finden Sie Notebooks nach Stichwort, Preisspanne, Standort und Zustand
- 📊 **Marktstatistiken** - Durchschnittspreise, Preisverteilung und Top-Städte anzeigen
- 🤖 **Automatisches Scraping** - Playwright-basierter Scraper mit Ratenbegrenzung und robots.txt-Konformität
- 📱 **Responsive UI** - Modernes React-Frontend mit TailwindCSS und Framer Motion (2025 Design)
- 🐳 **Docker Ready** - Full-Stack-Deployment mit Docker Compose

## Schnellstart

### Voraussetzungen

- Python 3.12+
- Node.js 20+
- PostgreSQL (oder SQLite für die Entwicklung nutzen)
- Docker & Docker Compose (optional)

### Backend-Einrichtung

```bash
cd backend

# Virtuelle Umgebung erstellen
python -m venv .venv
.\.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# Abhängigkeiten installieren
pip install -r requirements.txt

# Playwright Browser installieren
playwright install chromium

# Entwicklungsserver starten
flask --app app run --debug --port 5000
```

### Frontend-Einrichtung

```bash
cd frontend

# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev
```

### Docker-Einrichtung

```bash
# Full-Stack starten
docker compose up --build

# Stoppen
docker compose down
```

## Projektstruktur

```
├── backend/
│   ├── app.py          # Flask Einstiegspunkt und API-Routen
│   ├── config.py       # Umgebungskonfiguration
│   ├── models.py       # SQLAlchemy Datenbankmodelle
│   ├── scraper.py      # Playwright + BeautifulSoup Scraper
│   ├── tests/          # Pytest Test-Suite
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/ # React Komponenten
│   │   ├── pages/      # Seiten-Komponenten
│   │   ├── hooks/      # React Query Hooks
│   │   └── services/   # API Client
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── WIKI.md            # Architekturdokumentation
├── BUGS.md            # Bug-Tracker
└── README.md
```

## API-Endpunkte

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `/api/health` | Gesundheitsprüfung |
| GET | `/api/v1/listings` | Anzeigen auflisten (paginiert, filterbar) |
| GET | `/api/v1/listings/{id}` | Einzelne Anzeige abrufen |
| GET | `/api/v1/stats` | Aggregierte Statistiken abrufen |
| GET | `/api/v1/scraper/jobs` | Scraper-Jobs auflisten |
| POST | `/api/v1/scraper/jobs` | Neuen Scraper-Job starten |
| GET | `/api/v1/scraper/jobs/{id}` | Job-Status abrufen |

## Konfiguration

Kopieren Sie `.env.example` nach `.env` und konfigurieren Sie:

```env
# Flask
SECRET_KEY=ihr-geheimer-schluessel
DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/kleinanzeigen

# Scraper
SCRAPER_PAGE_LIMIT=5
SCRAPER_DELAY_SECONDS=3.0

# CORS
CORS_ORIGINS=http://localhost:5173
```

## Testen

```bash
# Backend-Tests
cd backend
pytest
pytest --cov=. --cov-report=html

# Frontend
cd frontend
npm run lint
npm run type-check
```

## Dokumentation

- [WIKI.md](./WIKI.md) - Architektur- und API-Dokumentation
- [BUGS.md](./BUGS.md) - Bug-Tracker und Fix-Historie

## Lizenz

MIT Lizenz - Siehe LICENSE-Datei für Details.
