# Kleinanzeigen Notebook Scraper - Wiki

## Übersicht

Der Kleinanzeigen Notebook Scraper ist eine Full-Stack-Anwendung, die Notebook-Anzeigen von Kleinanzeigen sammelt, normalisiert und für Marktanalysen und Suchzwecke anzeigt.

**Zweck:** Persönliche Forschung und Bildungszwecke zur Analyse des deutschen Gebraucht-Notebook-Marktes.

**Tech Stack:**
- **Backend:** Python, Flask, SQLAlchemy, Playwright, BeautifulSoup
- **Frontend:** React, TypeScript, TailwindCSS, Framer Motion, React Query
- **Datenbank:** PostgreSQL (Produktion) / SQLite (Entwicklung)
- **Infrastruktur:** Docker, Docker Compose

---

## Architektur

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React SPA      │────▶│  Flask API      │────▶│  PostgreSQL     │
│  (Frontend)     │     │  (Backend)      │     │  (Datenbank)    │
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
                        │  (Extern)       │
                        └─────────────────┘
```

---

## Benutzerrollen

### Endbenutzer
- Durchsuchen und Suchen von Notebook-Anzeigen
- Filtern nach Preis, Standort, Zustand
- Anzeigen von Details und Statistiken
- Zugriff auf externe Anzeigen-Links

### Admin
- Starten von Scraper-Jobs
- Überwachen von Job-Status und Logs
- Verwalten der Scraper-Konfiguration
- Anzeigen von Systemstatistiken

---

## Backend-Module

### `app.py` - Flask-Anwendung
Haupt-Flask-Anwendungsfabrik und API-Routen-Registrierung.

**Verantwortlichkeiten:**
- Anwendungsinitialisierung mit Factory-Pattern
- Blueprint-Registrierung
- Fehlerbehandlung
- CORS-Konfiguration

### `config.py` - Konfiguration
Umgebungsgesteuerte Konfigurationsverwaltung.

**Wichtige Einstellungen:**
- `DATABASE_URL` - Datenbankverbindungsstring
- `SCRAPER_BASE_URL` - Kleinanzeigen Kategorie-URL
- `SCRAPER_PAGE_LIMIT` - Max. Seiten pro Scrape
- `SCRAPER_DELAY_SECONDS` - Höfliche Verzögerung zwischen Anfragen

### `models.py` - Datenbankmodelle
SQLAlchemy ORM-Modelle für die Datenpersistenz.

**Modelle:**
- `Listing` - Gesscrapte Notebook-Anzeigen
- `ScraperJob` - Verfolgung der Job-Ausführung
- `ScraperConfig` - Admin-Konfiguration für Scraper-Einstellungen
- `PriceHistory` - Preisverlauf für Anzeigen

**Wichtige Felder (Listing):**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `external_id` | String | Kleinanzeigen Anzeigen-ID |
| `url` | String | Vollständige Anzeigen-URL |
| `title` | String | Anzeigentitel |
| `price_eur` | Integer | Preis in Cent |
| `price_negotiable` | Boolean | VB-Flag |
| `location_city` | String | Stadtname |
| `condition` | String | Artikelzustand |
| `search_keywords` | String | Kommagetrennte Suchbegriffe, die diese Anzeige gefunden haben |

### `scraper.py` - Scraping-Logik
Playwright + BeautifulSoup Scraping-Implementierung.

**Klassen:**
- `RobotsChecker` - Überprüfung der robots.txt-Konformität
- `KleinanzeigenScraper` - Haupt-Scraper-Klasse

**Wichtige Methoden:**
- `scrape()` - Haupteinstiegspunkt für das Scraping
- `scrape_page()` - Scraping einer einzelnen Seite
- `_parse_listing()` - HTML-zu-Dict-Konvertierung
- `_extract_price()` - Preisnormalisierung

---

## Frontend-Struktur

### UI/UX-Verbesserungen (Design 2025)
- **Glassmorphism Header:** Sticky Header mit `backdrop-blur-md` und halbtransparenten Hintergründen.
- **Gestaffelte Animationen:** `ListingGrid`-Elemente erscheinen nacheinander mit einer leichten Verzögerung unter Verwendung von `framer-motion`-Varianten.
- **Mikro-Interaktionen:** Hover-Lift, Skalierungseffekte und Tipp-Feedback auf `ListingCard` und Buttons.
- **Weiche Übergänge:** `AnimatePresence` für sanftes Ein- und Ausblenden von Filterpanels und Gitterelementen.
- **Ladezustände:** Animierter Spinner und Skeleton-ähnliches Gefühl für eine bessere wahrgenommene Leistung.

### Seiten

| Seite | Pfad | Beschreibung |
|-------|------|--------------|
| HomePage | `/` | Hauptanzeigenraster mit Filtern |
| Stats View | `/?view=stats` | Statistik-Panel |
| AdminPage | `/admin` | Scraper-Konfigurationspanel |

### Komponenten

| Komponente | Zweck |
|------------|-------|
| `Layout` | Seiten-Wrapper mit Glassmorphism Header/Footer |
| `Header` | Sticky Navigation und Branding mit Slide-Down-Entry |
| `FilterBar` | Such-/Filtersteuerungen mit erweiterbarer Animation |
| `ListingCard` | Individuelle Anzeigenanzeige mit Hover/Tap-Animationen |
| `ListingGrid` | Gestaffeltes animiertes Raster von Anzeigenkarten |
| `Pagination` | Seitennavigation |
| `StatsPanel` | Aggregierte Statistiken |
| `ListingModal` | Vollständiges Anzeigen-Detail-Modal mit Preisverlauf |
| `ScraperProgressPanel` | Echtzeit-Scraper-Fortschrittsanzeige |
| `PriceAlertModal` | Preisalarm-Verwaltung |

### Services

| Service | Datei | Zweck |
|---------|-------|-------|
| API Client | `src/services/api.ts` | Zentralisierte HTTP-Aufrufe |
| React Query Hooks | `src/hooks/useApi.ts` | Datenabruf/-caching |

### Hooks

| Hook | Datei | Zweck |
|------|-------|-------|
| `useFavorites` | `src/hooks/useFavorites.ts` | Favoriten in localStorage verwalten |
| `usePriceAlerts` | `src/hooks/useFavorites.ts` | Preisalarme in localStorage verwalten |
| `useScraperSSE` | `src/hooks/useScraperSSE.ts` | Abonnement für Echtzeit-Scraper-Fortschritt via SSE |

---

## API-Referenz

### Basis-URL
```
Entwicklung: http://localhost:5000/api/v1
Produktion: https://ihre-domain.de/api/v1
```

### Endpunkte

#### Gesundheitsprüfung
```
GET /api/health
```
Gibt den API-Gesundheitsstatus zurück.

**Antwort:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-04T10:30:00Z"
}
```

#### Anzeigen auflisten
```
GET /api/v1/listings
```
Paginierte Anzeigen mit optionalen Filtern abrufen.

**Query-Parameter:**
| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `page` | int | Seitennummer (Standard: 1) |
| `per_page` | int | Elemente pro Seite (Standard: 20, Max: 100) |
| `q` | string | Suchanfrage (Titel/Beschreibung) |
| `min_price` | float | Mindestpreis in EUR |
| `max_price` | float | Höchstpreis in EUR |
| `location` | string | Standortfilter |
| `condition` | string | Zustandsfilter |
| `keyword` | string | Filter nach Suchbegriff-Tag |
| `sort` | string | Sortierfeld (price, posted_at, scraped_at) |
| `order` | string | Sortierreihenfolge (asc, desc) |

**Antwort:**
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

#### Einzelne Anzeige abrufen
```
GET /api/v1/listings/{id}
```
Eine einzelne Anzeige per ID abrufen.

#### Statistiken abrufen
```
GET /api/v1/stats
```
Aggregierte Statistiken abrufen.

**Antwort:**
```json
{
  "data": {
    "total_listings": 500,
    "average_price": 650.50,
    "min_price": 50.0,
    "max_price": 3500.0,
    "listings_by_city": [
      {"city": "Berlin", "count": 120},
      {"city": "München", "count": 85}
    ]
  }
}
```

#### Suchbegriffe abrufen
```
GET /api/v1/keywords
```
Alle eindeutigen Suchbegriffe aus Anzeigen mit ihren Zählungen abrufen. Wird für Keyword-Filter-Tags im Dashboard verwendet.

**Antwort:**
```json
{
  "data": [
    {"keyword": "asus rog", "count": 45},
    {"keyword": "msi katana", "count": 32},
    {"keyword": "lenovo legion", "count": 28}
  ]
}
```

#### Scraper-Jobs auflisten
```
GET /api/v1/scraper/jobs
```
Liste der Scraper-Job-Ausführungen abrufen.

#### Scraper-Job starten
```
POST /api/v1/scraper/jobs
```
Einen neuen Scraper-Job starten (nur Admin).

**Anfrage-Body:**
```json
{
  "page_limit": 5
}
```

**Antwort:**
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
  "message": "Scraping abgeschlossen. 80 neue Anzeigen, 45 aktualisiert."
}
```

#### Scraper-Job-Status abrufen
```
GET /api/v1/scraper/jobs/{id}
```
Status eines bestimmten Jobs abrufen.

#### Scraper-Job-Fortschritt (SSE) abrufen
```
GET /api/v1/scraper/jobs/{id}/progress
```
Server-Sent Events Stream für Echtzeit-Job-Fortschritt.

**Events:**
- `connected` - Initiale Verbindung hergestellt
- `progress` - Job-Fortschritts-Update
- `complete` - Job erfolgreich abgeschlossen
- `error` - Job mit Fehler fehlgeschlagen

**Fortschritts-Event-Daten:**
```json
{
  "status": "running",
  "current_keyword": "laptop",
  "keyword_index": 2,
  "total_keywords": 5,
  "listings_found": 45,
  "elapsed_seconds": 30,
  "message": "Scrape Keyword 2/5: laptop"
}
```

#### Admin-Konfiguration abrufen
```
GET /api/v1/admin/config
```
Aktuelle Scraper-Konfigurationseinstellungen abrufen.

**Antwort:**
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

#### Admin-Konfiguration aktualisieren
```
PUT /api/v1/admin/config
```
Scraper-Konfiguration aktualisieren (nur Admin).

**Anfrage-Body:**
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

#### Verfügbare Kategorien abrufen
```
GET /api/v1/admin/categories
```
Liste der verfügbaren Kleinanzeigen-Kategorien abrufen.

#### Verfügbare Städte abrufen
```
GET /api/v1/admin/cities
```
Liste der wichtigsten deutschen Städte für die Filterung abrufen.

---

## Sicherheit & Konformität

### Authentifizierung
- Entwicklung: Keine Authentifizierung erforderlich
- Produktion: Token-basierte oder Session-Authentifizierung empfohlen für Scraper-Endpunkte

### CORS
- Konfiguriert über `CORS_ORIGINS` Umgebungsvariable
- Nur whitelisted Origins in der Produktion erlaubt

### Scraper-Konformität

**robots.txt Beachtung:**
- Scraper prüft robots.txt vor dem Scraping
- Nicht erlaubte Pfade werden nicht aufgerufen

**Ratenbegrenzung:**
- Mindestens 2 Sekunden Verzögerung zwischen Anfragen
- Konfigurierbar über `SCRAPER_DELAY_SECONDS`
- Automatisches Backoff bei HTTP 429

**User-Agent:**
- Realistischer Browser-User-Agent verwendet
- Keine aggressive Rotation oder Spoofing

**Datenhandhabung:**
- Keine persönlichen Verkäuferdaten gespeichert
- Nur marktrelevante Felder erfasst
- Echte Daten nicht in der Versionskontrolle gespeichert

---

## Datenfluss

### Benutzersuchfluss
```
1. Benutzer gibt Suchanfrage in FilterBar ein
2. FilterBar aktualisiert URL-Query-Parameter
3. HomePage erkennt Parameteränderung
4. useListings Hook ruft GET /api/v1/listings?q=... auf
5. Backend fragt PostgreSQL mit Filtern ab
6. Ergebnisse werden als JSON zurückgegeben
7. ListingGrid rendert ListingCard-Komponenten
```

### Scraper-Job-Fluss
```
1. Admin klickt "Run Scraper Now" Button im Admin-Panel
2. POST /api/v1/scraper/jobs ausgelöst
3. Backend liest ScraperConfig aus Datenbank
4. Scraper-URL wird aus Konfiguration gebaut (Keywords, Stadt, Kategorien)
5. ScraperJob-Datensatz erstellt (Status: running)
6. Playwright-Browser gestartet
7. robots.txt geprüft
8. Seiten mit Verzögerungen gescrapt
9. HTML mit BeautifulSoup geparst
10. Anzeigen normalisiert und in DB gespeichert
11. ScraperJob aktualisiert (Status: completed)
12. Frontend erhält Job-Zusammenfassung
13. Anzeigen-Cache invalidiert
```

### Admin-Konfigurationsfluss
```
1. Admin navigiert zu /admin
2. Frontend lädt Konfiguration via GET /api/v1/admin/config
3. Admin ändert Keywords, Stadt, Kategorien oder Timer
4. Admin klickt "Save Configuration"
5. PUT /api/v1/admin/config aktualisiert Datenbank
6. Nächster Scraper-Job verwendet neue Konfiguration
```

### Reaktion auf Markup-Änderungen
```
1. Scraper kann Daten nicht extrahieren
2. Fehler mit Selektor-Details protokolliert
3. Entwickler aktualisiert SELECTORS in scraper.py
4. Neue HTML-Fixture zu Tests hinzugefügt
5. Tests verifizieren korrigierte Selektoren
6. Fix deployt
```

---

## Einrichtung der Entwicklungsumgebung

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

## Testen

### Backend-Tests
```bash
cd backend
pytest
pytest --cov=. --cov-report=html

# Frontend
cd frontend
npm run lint
npm run type-check
```

---

## Umgebungsvariablen

| Variable | Erforderlich | Standard | Beschreibung |
|----------|--------------|----------|--------------|
| `SECRET_KEY` | Ja (Prod) | dev-key | Flask Geheimschlüssel |
| `DATABASE_URL` | Nein | sqlite:///kleinanzeigen.db | Datenbankverbindung |
| `SCRAPER_BASE_URL` | Nein | Kleinanzeigen notebooks | Scrape-Ziel |
| `SCRAPER_PAGE_LIMIT` | Nein | 5 | Max. Seiten pro Lauf |
| `SCRAPER_DELAY_SECONDS` | Nein | 3.0 | Verzögerung zwischen Anfragen |
| `CORS_ORIGINS` | Nein | localhost:5173 | Erlaubte Origins |

---

## Mitwirken

1. Feature-Branch erstellen: `feature/ihr-feature`
2. Änderungen gemäß Code-Konventionen vornehmen
3. Tests hinzufügen/aktualisieren
4. BUGS.md aktualisieren, wenn ein Fehler behoben wird
5. WIKI.md aktualisieren, wenn sich die Architektur ändert
6. Alle Tests und Linting ausführen
7. PR mit Beschreibung einreichen
