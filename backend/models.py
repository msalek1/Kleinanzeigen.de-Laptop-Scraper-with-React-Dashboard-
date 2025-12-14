"""
SQLAlchemy database models for the Kleinanzeigen Notebook Scraper.

Contains the Listing model and related database entities for storing
scraped notebook listings with normalized data.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from flask_sqlalchemy import SQLAlchemy
import random
import string

db = SQLAlchemy()


# Association table for many-to-many relationship between Listing and Tag
listing_tags = db.Table(
    'listing_tags',
    db.Column('listing_id', db.Integer, db.ForeignKey('listings.id', ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)


class Tag(db.Model):
    """
    Hardware specification tag for filtering listings.
    
    Categories include: cpu_brand, cpu_model, ram, storage, gpu, 
    screen_size, brand, refresh_rate, os
    
    Attributes:
        id: Primary key.
        category: Tag category (e.g., 'cpu_model', 'ram', 'gpu').
        value: Normalized tag value (e.g., 'i7-12700H', '16GB RAM').
        display_name: Optional user-friendly display name.
    """
    
    __tablename__ = 'tags'
    
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50), nullable=False, index=True)
    value = db.Column(db.String(100), nullable=False)
    display_name = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('category', 'value', name='uq_tag_category_value'),
    )
    
    def __repr__(self) -> str:
        return f'<Tag {self.category}:{self.value}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert tag to dictionary for API responses."""
        return {
            'id': self.id,
            'category': self.category,
            'value': self.value,
            'display_name': self.display_name or self.value,
        }


class ArchivedListing(db.Model):
    """
    Tracks listings archived by users (synced across devices via sync code).
    
    Users can generate a sync code and use it on other devices to sync
    their archived listings.
    
    Attributes:
        id: Primary key.
        listing_id: Foreign key to the archived listing.
        sync_code: Short 8-character alphanumeric code for cross-device sync.
        archived_at: When the listing was archived.
    """
    
    __tablename__ = 'archived_listings'
    
    id = db.Column(db.Integer, primary_key=True)
    listing_id = db.Column(db.Integer, db.ForeignKey('listings.id', ondelete='CASCADE'), nullable=False, index=True)
    sync_code = db.Column(db.String(8), nullable=False, index=True)
    archived_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('listing_id', 'sync_code', name='uq_archived_listing_sync'),
    )
    
    def __repr__(self) -> str:
        return f'<ArchivedListing listing={self.listing_id} sync={self.sync_code}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert archived listing to dictionary for API responses."""
        return {
            'id': self.id,
            'listing_id': self.listing_id,
            'sync_code': self.sync_code,
            'archived_at': self.archived_at.isoformat() if self.archived_at else None,
        }
    
    @staticmethod
    def generate_sync_code() -> str:
        """
        Generate a unique 8-character alphanumeric sync code.
        Format: 4 uppercase letters + 4 digits (e.g., 'GAME2024').
        """
        letters = ''.join(random.choices(string.ascii_uppercase, k=4))
        digits = ''.join(random.choices(string.digits, k=4))
        return letters + digits


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
        item_type: Heuristic classification (laptop, accessory, other).
        raw_html: Optional raw HTML for debugging (not stored by default).
        price_history: Relationship to price history records.
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

    # Heuristic classification to support laptop-focused views
    item_type = db.Column(db.String(20), nullable=True, index=True)
    
    # Laptop sub-category for more specific filtering (gaming, business, ultrabook, etc.)
    laptop_category = db.Column(db.String(30), nullable=True, index=True)
    
    # Debug field - not populated by default
    raw_html = db.Column(db.Text, nullable=True)
    
    # Relationship to price history
    price_history = db.relationship('PriceHistory', backref='listing', lazy='dynamic', cascade='all, delete-orphan')
    
    # Relationship to hardware tags (many-to-many)
    tags = db.relationship('Tag', secondary=listing_tags, lazy='dynamic',
                           backref=db.backref('listings', lazy='dynamic'))
    
    def __repr__(self) -> str:
        return f'<Listing {self.external_id}: {self.title[:50]}>'
    
    def to_dict(self, include_price_history: bool = True) -> Dict[str, Any]:
        """
        Convert listing to dictionary for API responses.
        
        Args:
            include_price_history: Whether to include price history data.
        
        Returns:
            Dict containing all listing fields in JSON-serializable format.
        """
        # Parse search_keywords into list
        keywords_list = []
        if self.search_keywords:
            keywords_list = [k.strip() for k in self.search_keywords.split(',') if k.strip()]
        
        result = {
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
            'item_type': self.item_type,
            'laptop_category': self.laptop_category,
            'tags': [tag.to_dict() for tag in self.tags.all()] if self.tags else [],
        }
        
        # Include price history if requested
        if include_price_history:
            history = self.price_history.order_by(PriceHistory.recorded_at.asc()).limit(20).all()
            result['price_history'] = [h.to_dict() for h in history]
        
        return result
    
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
            item_type=data.get('item_type'),
            laptop_category=data.get('laptop_category'),
        )


class PriceHistory(db.Model):
    """
    Tracks price changes for listings over time.
    
    Each time a listing's price changes during scraping, a new record
    is created to track the history.
    
    Attributes:
        id: Primary key.
        listing_id: Foreign key to the listing.
        price: Price in cents at this point in time.
        recorded_at: When this price was recorded.
    """
    
    __tablename__ = 'price_history'
    
    id = db.Column(db.Integer, primary_key=True)
    listing_id = db.Column(db.Integer, db.ForeignKey('listings.id', ondelete='CASCADE'), nullable=False, index=True)
    price = db.Column(db.Integer, nullable=True)  # Price in cents
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self) -> str:
        return f'<PriceHistory listing={self.listing_id} price={self.price}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert price history entry to dictionary."""
        return {
            'price': self.price / 100 if self.price else None,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None,
        }


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
    # Optional JSON string with live progress data (for SSE/polling)
    progress_json = db.Column(db.Text, nullable=True)
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
            'progress_json': self.progress_json,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# =============================================================================
# AI Recommendation Engine Models
# =============================================================================

class UserPreferences(db.Model):
    """
    Explicit user-defined search criteria for laptop recommendations.
    
    Uses sync_code as pseudo-user ID (no auth system yet).
    
    Attributes:
        sync_code: Unique identifier for the user (from archive sync feature).
        keywords: Comma-separated keywords to prioritize (e.g., "thinkpad,16gb,ssd").
        min_price: Minimum price filter in EUR cents.
        max_price: Maximum price filter in EUR cents.
        brands: Comma-separated preferred brands.
        weight_price: Importance of price in scoring (0.0-1.0).
        weight_specs: Importance of specs/keywords in scoring (0.0-1.0).
        weight_brand: Importance of brand in scoring (0.0-1.0).
    """
    
    __tablename__ = 'user_preferences'
    
    id = db.Column(db.Integer, primary_key=True)
    sync_code = db.Column(db.String(8), unique=True, nullable=False, index=True)
    keywords = db.Column(db.Text, nullable=True)  # comma-separated
    min_price = db.Column(db.Integer, nullable=True)  # cents
    max_price = db.Column(db.Integer, nullable=True)  # cents
    brands = db.Column(db.Text, nullable=True)  # comma-separated
    laptop_categories = db.Column(db.Text, nullable=True)  # gaming,business,ultrabook
    weight_price = db.Column(db.Float, default=0.3, nullable=False)
    weight_specs = db.Column(db.Float, default=0.4, nullable=False)
    weight_brand = db.Column(db.Float, default=0.3, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self) -> str:
        return f'<UserPreferences sync={self.sync_code}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert preferences to dictionary for API responses."""
        return {
            'sync_code': self.sync_code,
            'keywords': [k.strip() for k in (self.keywords or '').split(',') if k.strip()],
            'min_price': self.min_price / 100 if self.min_price else None,
            'max_price': self.max_price / 100 if self.max_price else None,
            'brands': [b.strip() for b in (self.brands or '').split(',') if b.strip()],
            'laptop_categories': [c.strip() for c in (self.laptop_categories or '').split(',') if c.strip()],
            'weights': {
                'price': self.weight_price,
                'specs': self.weight_specs,
                'brand': self.weight_brand,
            },
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class ItemAnalysis(db.Model):
    """
    Pre-computed recommendation scores for each listing per user.
    
    Stored per (listing_id, sync_code) pair so each user gets personalized scores.
    
    Attributes:
        listing_id: Foreign key to the analyzed listing.
        sync_code: User identifier for personalized scoring.
        keyword_score: Match score for keywords (0-100).
        price_score: Score based on price fit (0-100).
        brand_score: Match score for preferred brands (0-100).
        learned_bonus: Adjustment from ML learning (can be negative).
        total_score: Weighted final score (0-100).
        classification: Category: 'must_see', 'recommended', or 'browse'.
    """
    
    __tablename__ = 'items_analysis'
    
    id = db.Column(db.Integer, primary_key=True)
    listing_id = db.Column(db.Integer, db.ForeignKey('listings.id', ondelete='CASCADE'), nullable=False, index=True)
    sync_code = db.Column(db.String(8), nullable=False, index=True)
    keyword_score = db.Column(db.Float, default=0.0)
    price_score = db.Column(db.Float, default=0.0)
    brand_score = db.Column(db.Float, default=0.0)
    learned_bonus = db.Column(db.Float, default=0.0)
    total_score = db.Column(db.Float, default=0.0, index=True)
    classification = db.Column(db.String(20), index=True)  # must_see, recommended, browse
    analyzed_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('listing_id', 'sync_code', name='uq_item_analysis_listing_user'),
        db.Index('ix_items_analysis_score', 'sync_code', 'classification', 'total_score'),
    )
    
    # Relationship to listing
    listing = db.relationship('Listing', backref=db.backref('analyses', lazy='dynamic', cascade='all, delete-orphan'))
    
    def __repr__(self) -> str:
        return f'<ItemAnalysis listing={self.listing_id} score={self.total_score:.1f}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert analysis to dictionary for API responses."""
        return {
            'listing_id': self.listing_id,
            'keyword_score': round(self.keyword_score, 1),
            'price_score': round(self.price_score, 1),
            'brand_score': round(self.brand_score, 1),
            'learned_bonus': round(self.learned_bonus, 1),
            'total_score': round(self.total_score, 1),
            'classification': self.classification,
            'analyzed_at': self.analyzed_at.isoformat() if self.analyzed_at else None,
        }


class UserInteraction(db.Model):
    """
    Track user interactions for machine learning feedback loop.
    
    Records views, clicks, saves, dismisses, and contact actions
    to learn user preferences over time.
    
    Attributes:
        sync_code: User identifier.
        listing_id: The listing that was interacted with.
        action_type: Type of interaction (view, click, save, dismiss, contact).
        duration_seconds: Time spent viewing (for view actions).
    """
    
    __tablename__ = 'user_interactions'
    
    id = db.Column(db.Integer, primary_key=True)
    sync_code = db.Column(db.String(8), nullable=False, index=True)
    listing_id = db.Column(db.Integer, db.ForeignKey('listings.id', ondelete='CASCADE'), nullable=False, index=True)
    action_type = db.Column(db.String(20), nullable=False)  # view, click, save, dismiss, contact
    duration_seconds = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # Relationship to listing
    listing = db.relationship('Listing', backref=db.backref('interactions', lazy='dynamic'))
    
    def __repr__(self) -> str:
        return f'<UserInteraction {self.action_type} listing={self.listing_id}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert interaction to dictionary for API responses."""
        return {
            'id': self.id,
            'listing_id': self.listing_id,
            'action_type': self.action_type,
            'duration_seconds': self.duration_seconds,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class LearnedPreference(db.Model):
    """
    Machine-learned keyword weights adjusted from user behavior.
    
    Tracks how keyword relevance changes based on which items
    users save, dismiss, or spend time viewing.
    
    Attributes:
        sync_code: User identifier.
        keyword: The keyword being tracked.
        learned_weight: Adjustment factor (positive = more relevant, negative = less).
        interaction_count: Number of interactions that influenced this weight.
    """
    
    __tablename__ = 'learned_preferences'
    
    id = db.Column(db.Integer, primary_key=True)
    sync_code = db.Column(db.String(8), nullable=False, index=True)
    keyword = db.Column(db.String(100), nullable=False)
    learned_weight = db.Column(db.Float, default=0.0)
    interaction_count = db.Column(db.Integer, default=0)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('sync_code', 'keyword', name='uq_learned_pref_user_keyword'),
    )
    
    def __repr__(self) -> str:
        return f'<LearnedPreference {self.keyword}={self.learned_weight:.2f}>'


class BrandAffinity(db.Model):
    """
    Learned brand preferences from user behavior.
    
    Tracks which brands users prefer based on their interactions.
    
    Attributes:
        sync_code: User identifier.
        brand: Brand name.
        affinity_score: Score from -1.0 (dislike) to +1.0 (strong preference).
        interaction_count: Number of interactions that influenced this score.
    """
    
    __tablename__ = 'brand_affinity'
    
    id = db.Column(db.Integer, primary_key=True)
    sync_code = db.Column(db.String(8), nullable=False, index=True)
    brand = db.Column(db.String(50), nullable=False)
    affinity_score = db.Column(db.Float, default=0.0)
    interaction_count = db.Column(db.Integer, default=0)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('sync_code', 'brand', name='uq_brand_affinity_user_brand'),
    )
    
    def __repr__(self) -> str:
        return f'<BrandAffinity {self.brand}={self.affinity_score:.2f}>'

