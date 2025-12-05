"""
SQLAlchemy database models for the Kleinanzeigen Notebook Scraper.

Contains the Listing model and related database entities for storing
scraped notebook listings with normalized data.
"""

from datetime import datetime
from typing import Any, Dict, Optional
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Listing(db.Model):
    """
    Represents a notebook listing scraped from Kleinanzeigen.
    
    Attributes:
        id: Internal primary key.
        external_id: Kleinanzeigen's listing ID (unique).
        url: Full URL to the listing page.
        title: Listing title/headline.
        price_eur: Price in euros as integer cents (None if "VB" or not specified).
        price_negotiable: Whether the price is negotiable ("VB").
        location_city: City name extracted from location.
        location_state: German state/region if available.
        description: Short description or snippet from listing.
        condition: Item condition (e.g., "Neu", "Gebraucht").
        posted_at: When the listing was posted on Kleinanzeigen.
        scraped_at: When we scraped this listing.
        updated_at: Last time this record was updated.
        image_url: URL to the listing's main image.
        seller_type: Private or commercial seller.
        raw_html: Optional raw HTML for debugging (not stored by default).
    """
    
    __tablename__ = 'listings'
    
    id = db.Column(db.Integer, primary_key=True)
    external_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    url = db.Column(db.String(500), unique=True, nullable=False)
    title = db.Column(db.String(500), nullable=False)
    
    # Price stored in cents to avoid floating point issues
    price_eur = db.Column(db.Integer, nullable=True)
    price_negotiable = db.Column(db.Boolean, default=False)
    
    # Location
    location_city = db.Column(db.String(200), nullable=True, index=True)
    location_state = db.Column(db.String(100), nullable=True)
    
    # Listing details
    description = db.Column(db.Text, nullable=True)
    condition = db.Column(db.String(50), nullable=True)
    
    # Timestamps
    posted_at = db.Column(db.DateTime, nullable=True)
    scraped_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Additional metadata
    image_url = db.Column(db.String(500), nullable=True)
    seller_type = db.Column(db.String(50), nullable=True)
    
    # Keywords that matched this listing (comma-separated)
    search_keywords = db.Column(db.Text, nullable=True)
    
    # Debug field - not populated by default
    raw_html = db.Column(db.Text, nullable=True)
    
    def __repr__(self) -> str:
        return f'<Listing {self.external_id}: {self.title[:50]}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert listing to dictionary for API responses.
        
        Returns:
            Dict containing all listing fields in JSON-serializable format.
        """
        # Parse search_keywords into list
        keywords_list = []
        if self.search_keywords:
            keywords_list = [k.strip() for k in self.search_keywords.split(',') if k.strip()]
        
        return {
            'id': self.id,
            'external_id': self.external_id,
            'url': self.url,
            'title': self.title,
            'price_eur': self.price_eur / 100 if self.price_eur else None,
            'price_negotiable': self.price_negotiable,
            'location': {
                'city': self.location_city,
                'state': self.location_state,
            },
            'description': self.description,
            'condition': self.condition,
            'posted_at': self.posted_at.isoformat() if self.posted_at else None,
            'scraped_at': self.scraped_at.isoformat() if self.scraped_at else None,
            'image_url': self.image_url,
            'seller_type': self.seller_type,
            'search_keywords': keywords_list,
        }
    
    @classmethod
    def from_scraped_dict(cls, data: Dict[str, Any]) -> 'Listing':
        """
        Create a Listing instance from scraped data dictionary.
        
        This method handles the normalization of raw scraped data into
        the database model format.
        
        Args:
            data: Dictionary containing scraped listing data with keys:
                - external_id: str
                - url: str
                - title: str
                - price: float or None
                - price_negotiable: bool
                - city: str or None
                - state: str or None
                - description: str or None
                - condition: str or None
                - posted_at: datetime or None
                - image_url: str or None
                - seller_type: str or None
        
        Returns:
            Listing: New Listing instance (not yet added to session).
        """
        # Convert price from euros to cents
        price_cents = None
        if data.get('price') is not None:
            price_cents = int(data['price'] * 100)
        
        return cls(
            external_id=data['external_id'],
            url=data['url'],
            title=data['title'],
            price_eur=price_cents,
            price_negotiable=data.get('price_negotiable', False),
            location_city=data.get('city'),
            location_state=data.get('state'),
            description=data.get('description'),
            condition=data.get('condition'),
            posted_at=data.get('posted_at'),
            image_url=data.get('image_url'),
            seller_type=data.get('seller_type'),
        )


class ScraperConfig(db.Model):
    """
    Stores scraper configuration settings managed via admin panel.
    
    Uses a singleton pattern - only one row should exist (id=1).
    
    Attributes:
        id: Primary key (always 1 for singleton).
        keywords: Comma-separated search keywords for scraping.
        city: Target city/location filter.
        categories: Comma-separated category slugs to scrape.
        update_interval_minutes: How often to auto-run the scraper (0 = disabled).
        page_limit: Maximum pages to scrape per run.
        is_active: Whether auto-scraping is enabled.
        last_modified: When config was last updated.
    """
    
    __tablename__ = 'scraper_config'
    
    id = db.Column(db.Integer, primary_key=True)
    keywords = db.Column(db.Text, default='notebook,laptop', nullable=False)
    city = db.Column(db.String(200), default='', nullable=False)
    categories = db.Column(db.Text, default='c278', nullable=False)  # c278 = notebooks
    update_interval_minutes = db.Column(db.Integer, default=60, nullable=False)
    page_limit = db.Column(db.Integer, default=5, nullable=False)
    is_active = db.Column(db.Boolean, default=False, nullable=False)
    last_modified = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self) -> str:
        return f'<ScraperConfig keywords={self.keywords[:30]}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary for API responses."""
        return {
            'id': self.id,
            'keywords': self.keywords,
            'keywords_list': [k.strip() for k in self.keywords.split(',') if k.strip()],
            'city': self.city,
            'categories': self.categories,
            'categories_list': [c.strip() for c in self.categories.split(',') if c.strip()],
            'update_interval_minutes': self.update_interval_minutes,
            'page_limit': self.page_limit,
            'is_active': self.is_active,
            'last_modified': self.last_modified.isoformat() if self.last_modified else None,
        }
    
    @classmethod
    def get_config(cls) -> 'ScraperConfig':
        """
        Get the singleton config instance, creating it if needed.
        
        Returns:
            ScraperConfig: The configuration instance.
        """
        config = cls.query.get(1)
        if not config:
            config = cls(id=1)
            db.session.add(config)
            db.session.commit()
        return config


class ScraperJob(db.Model):
    """
    Tracks scraper job executions for monitoring and debugging.
    
    Attributes:
        id: Primary key.
        status: Job status (pending, running, completed, failed).
        started_at: When the job started.
        completed_at: When the job finished.
        pages_scraped: Number of pages successfully scraped.
        listings_found: Total listings found.
        listings_new: New listings added to database.
        listings_updated: Existing listings updated.
        error_message: Error details if job failed.
    """
    
    __tablename__ = 'scraper_jobs'
    
    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.String(20), default='pending', nullable=False)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    pages_scraped = db.Column(db.Integer, default=0)
    listings_found = db.Column(db.Integer, default=0)
    listings_new = db.Column(db.Integer, default=0)
    listings_updated = db.Column(db.Integer, default=0)
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self) -> str:
        return f'<ScraperJob {self.id}: {self.status}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert job to dictionary for API responses."""
        return {
            'id': self.id,
            'status': self.status,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'pages_scraped': self.pages_scraped,
            'listings_found': self.listings_found,
            'listings_new': self.listings_new,
            'listings_updated': self.listings_updated,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
