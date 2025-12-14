"""
Flask application entrypoint for the Kleinanzeigen Notebook Scraper API.

Exposes REST endpoints for listing retrieval, filtering, and scraper management.
"""

import json
import logging
import queue
import time
from datetime import datetime
from functools import wraps
from threading import Thread, Lock
from typing import Any, Dict, Optional
from urllib.error import URLError
import urllib.request
from urllib.parse import quote_plus, urlparse, unquote

from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS
from sqlalchemy import or_

from config import get_config
from models import db, Listing, ScraperJob, ScraperConfig, PriceHistory, Tag, ArchivedListing, listing_tags
from classifier import classify_item_type, classify_laptop_category
from tag_extractor import extract_tags
from scraper import KleinanzeigenScraper, RobotsChecker
from sse import progress_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_app(config=None):
    """
    Application factory for creating Flask app instances.
    
    Args:
        config: Optional configuration object. If None, uses get_config().
    
    Returns:
        Flask: Configured Flask application instance.
    """
    app = Flask(__name__)
    
    # Load configuration
    if config is None:
        config = get_config()
    app.config.from_object(config)
    
    # Initialize extensions
    db.init_app(app)
    
    # Configure CORS
    CORS(app, origins=app.config.get('CORS_ORIGINS', ['http://localhost:5173']))
    
    # Register routes
    register_routes(app)
    
    return app


def init_db(app):
    """
    Initialize database tables safely with proper locking.
    
    Uses SQLAlchemy's create_all with checkfirst=True which is the default
    and handles the case where tables already exist.
    """
    with app.app_context():
        from sqlalchemy import text
        from sqlalchemy.exc import IntegrityError, ProgrammingError
        
        try:
            # First, check if our tables exist by querying them
            try:
                result = db.session.execute(text("SELECT 1 FROM listings LIMIT 1"))
                result.close()
                logger.info("Database tables already exist, skipping creation")
                return
            except Exception:
                # Table doesn't exist, we need to create it
                db.session.rollback()
            
            # Try to create tables - SQLAlchemy's create_all uses IF NOT EXISTS internally
            # for PostgreSQL, but sequences can still cause issues
            try:
                # Use metadata.create_all with checkfirst=True (default)
                db.metadata.create_all(db.engine, checkfirst=True)
                logger.info("Database tables created successfully")
            except (IntegrityError, ProgrammingError) as e:
                # Another process likely created the tables
                db.session.rollback()
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    logger.info("Tables were created by another process")
                else:
                    raise
                    
        except Exception as e:
            logger.error(f"Database initialization error: {e}")
            db.session.rollback()


def register_routes(app: Flask):
    """Register all API routes on the Flask app."""
    
    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        """
        Health check endpoint.
        
        Returns:
            JSON response with status and timestamp.
        """
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
        })
    
    # Listings endpoints
    @app.route('/api/v1/listings', methods=['GET'])
    @app.route('/api/v1/listings/', methods=['GET'])
    def get_listings():
        """
        Get paginated list of notebook listings with filtering.
        
        Query Parameters:
            page (int): Page number (default: 1).
            per_page (int): Items per page (default: 20, max: 100).
            q (str): Search query for title/description.
            min_price (float): Minimum price in EUR.
            max_price (float): Maximum price in EUR.
            location (str): Filter by city name.
            condition (str): Filter by condition.
            keyword (str): Filter by search keyword tag.
            sort (str): Sort field (price, posted_at, scraped_at).
            order (str): Sort order (asc, desc).
        
        Returns:
            JSON response with listings array and pagination metadata.
        """
        # Parse pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(
            request.args.get('per_page', app.config['DEFAULT_PAGE_SIZE'], type=int),
            app.config['MAX_PAGE_SIZE']
        )
        
        # Build query
        query = Listing.query
        
        # Text search
        search_query = request.args.get('q', '').strip()
        if search_query:
            search_pattern = f'%{search_query}%'
            query = query.filter(
                or_(
                    Listing.title.ilike(search_pattern),
                    Listing.description.ilike(search_pattern)
                )
            )
        
        # Price filters (convert EUR to cents for comparison)
        min_price = request.args.get('min_price', type=float)
        if min_price is not None:
            query = query.filter(Listing.price_eur >= int(min_price * 100))
        
        max_price = request.args.get('max_price', type=float)
        if max_price is not None:
            query = query.filter(Listing.price_eur <= int(max_price * 100))
        
        # Location filter
        location = request.args.get('location', '').strip()
        if location:
            query = query.filter(Listing.location_city.ilike(f'%{location}%'))
        
        # Condition filter
        condition = request.args.get('condition', '').strip()
        if condition:
            query = query.filter(Listing.condition.ilike(f'%{condition}%'))
        
        # Keyword filter (filter by search keyword tag)
        keyword = request.args.get('keyword', '').strip()
        if keyword:
            query = query.filter(Listing.search_keywords.ilike(f'%{keyword}%'))

        # Item type filter (laptop/accessory/other)
        item_type = request.args.get('item_type', '').strip().lower()
        if item_type and item_type != 'all':
            if item_type == 'laptop':
                # Backwards compatible: treat unclassified rows as laptop so existing DBs still show results.
                query = query.filter(or_(Listing.item_type == 'laptop', Listing.item_type.is_(None), Listing.item_type == ''))
            else:
                query = query.filter(Listing.item_type == item_type)
        
        # Laptop category filter (gaming/business/ultrabook/workstation/2in1)
        laptop_category = request.args.get('laptop_category', '').strip().lower()
        if laptop_category and laptop_category != 'all':
            query = query.filter(Listing.laptop_category == laptop_category)
        
        # Tags filter (comma-separated tag values)
        tags_param = request.args.get('tags', '').strip()
        if tags_param:
            tag_values = [t.strip() for t in tags_param.split(',') if t.strip()]
            if tag_values:
                # Filter listings that have ALL specified tags
                for tag_value in tag_values:
                    query = query.filter(
                        Listing.tags.any(Tag.value.ilike(f'%{tag_value}%'))
                    )
        
        # Brand filter (shorthand for brand tags)
        brand = request.args.get('brand', '').strip()
        if brand:
            brand_values = [b.strip() for b in brand.split(',') if b.strip()]
            if brand_values:
                from sqlalchemy import or_ as sql_or
                brand_filters = [Listing.tags.any(Tag.category == 'brand', Tag.value.ilike(f'%{b}%')) for b in brand_values]
                query = query.filter(sql_or(*brand_filters))
        
        # Exclude archived listings (requires sync_code header)
        exclude_archived = request.args.get('exclude_archived', '').strip().lower() == 'true'
        sync_code = request.headers.get('X-Sync-Code', '').strip()
        if exclude_archived and sync_code:
            # Get IDs of archived listings for this sync code
            archived_ids = db.session.query(ArchivedListing.listing_id).filter_by(sync_code=sync_code).subquery()
            query = query.filter(~Listing.id.in_(archived_ids))
        
        # Date period filter (quick presets: today, week, month, 3months, year)
        from datetime import datetime, timedelta
        date_period = request.args.get('date_period', '').strip().lower()
        if date_period:
            now = datetime.utcnow()
            period_map = {
                'today': timedelta(days=1),
                '2days': timedelta(days=2),
                '3days': timedelta(days=3),
                'week': timedelta(days=7),
                '2weeks': timedelta(days=14),
                'month': timedelta(days=30),
                '3months': timedelta(days=90),
                'year': timedelta(days=365),
            }
            if date_period in period_map:
                cutoff_date = now - period_map[date_period]
                query = query.filter(Listing.posted_at >= cutoff_date)
        
        # Custom date range filters (ISO format: YYYY-MM-DD)
        date_from = request.args.get('date_from', '').strip()
        if date_from:
            try:
                from_date = datetime.strptime(date_from, '%Y-%m-%d')
                query = query.filter(Listing.posted_at >= from_date)
            except ValueError:
                pass  # Invalid date format, ignore
        
        date_to = request.args.get('date_to', '').strip()
        if date_to:
            try:
                to_date = datetime.strptime(date_to, '%Y-%m-%d')
                # Include the entire end day
                to_date = to_date + timedelta(days=1)
                query = query.filter(Listing.posted_at < to_date)
            except ValueError:
                pass  # Invalid date format, ignore
        
        # Fresh listings filter (default: show only last 48 hours if no date filter specified)
        include_stale = request.args.get('include_stale', '').strip().lower()
        if include_stale != 'true' and not date_period and not date_from and not date_to:
            cutoff = datetime.utcnow() - timedelta(days=2)
            query = query.filter(Listing.posted_at >= cutoff)
        
        # Sorting
        sort_field = request.args.get('sort', 'posted_at')
        sort_order = request.args.get('order', 'desc')
        
        sort_column = {
            'price': Listing.price_eur,
            'posted_at': Listing.posted_at,
            'scraped_at': Listing.scraped_at,
            'title': Listing.title,
        }.get(sort_field, Listing.posted_at)
        
        if sort_order == 'asc':
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())
        
        # Execute paginated query
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'data': [listing.to_dict() for listing in pagination.items],
            'pagination': {
                'page': pagination.page,
                'per_page': pagination.per_page,
                'total_pages': pagination.pages,
                'total_items': pagination.total,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev,
            }
        })
    
    @app.route('/api/v1/listings/<int:listing_id>', methods=['GET'])
    def get_listing(listing_id: int):
        """
        Get a single listing by ID.
        
        Args:
            listing_id: Internal listing ID.
        
        Returns:
            JSON response with listing data or 404 error.
        """
        listing = Listing.query.get_or_404(listing_id)
        return jsonify({'data': listing.to_dict()})
    
    # Keywords endpoint
    @app.route('/api/v1/keywords', methods=['GET'])
    @app.route('/api/v1/keywords/', methods=['GET'])
    def get_keywords():
        """
        Get all unique search keywords from listings.
        
        Returns:
            JSON response with array of unique keywords and their counts.
        """
        # Get all search_keywords from listings
        listings_with_keywords = Listing.query.filter(
            Listing.search_keywords.isnot(None),
            Listing.search_keywords != ''
        ).all()
        
        # Count occurrences of each keyword
        keyword_counts = {}
        for listing in listings_with_keywords:
            keywords = listing.search_keywords.split(',')
            for kw in keywords:
                kw = kw.strip()
                if kw:
                    keyword_counts[kw] = keyword_counts.get(kw, 0) + 1
        
        # Sort by count descending
        sorted_keywords = sorted(
            keyword_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        return jsonify({
            'data': [
                {'keyword': kw, 'count': count}
                for kw, count in sorted_keywords
            ]
        })
    
    # Statistics endpoint
    @app.route('/api/v1/stats', methods=['GET'])
    @app.route('/api/v1/stats/', methods=['GET'])
    def get_stats():
        """
        Get aggregate statistics for listings.
        
        Returns:
            JSON response with statistics including:
            - total_listings: Total number of listings.
            - average_price: Average price in EUR.
            - min_price: Minimum price in EUR.
            - max_price: Maximum price in EUR.
            - listings_by_city: Count per city (top 10).
        """
        from sqlalchemy import func
        
        total = Listing.query.count()
        
        # Price statistics (exclude None prices)
        price_stats = db.session.query(
            func.avg(Listing.price_eur).label('avg'),
            func.min(Listing.price_eur).label('min'),
            func.max(Listing.price_eur).label('max'),
        ).filter(Listing.price_eur.isnot(None)).first()
        
        # Top cities
        city_counts = db.session.query(
            Listing.location_city,
            func.count(Listing.id).label('count')
        ).filter(
            Listing.location_city.isnot(None)
        ).group_by(
            Listing.location_city
        ).order_by(
            func.count(Listing.id).desc()
        ).limit(10).all()
        
        return jsonify({
            'data': {
                'total_listings': total,
                'average_price': price_stats.avg / 100 if price_stats.avg else None,
                'min_price': price_stats.min / 100 if price_stats.min else None,
                'max_price': price_stats.max / 100 if price_stats.max else None,
                'listings_by_city': [
                    {'city': city, 'count': count}
                    for city, count in city_counts
                ],
            }
        })
    
    # =========================================================================
    # Tags endpoints
    # =========================================================================
    
    @app.route('/api/v1/tags', methods=['GET'])
    @app.route('/api/v1/tags/', methods=['GET'])
    def get_tags():
        """
        Get all tags with optional category filter.
        
        Query Parameters:
            category (str): Filter by tag category (cpu_model, ram, gpu, brand, etc.)
        
        Returns:
            JSON response with array of tags and their listing counts.
        """
        from sqlalchemy import func
        
        category = request.args.get('category', '').strip()
        
        query = db.session.query(
            Tag.id,
            Tag.category,
            Tag.value,
            Tag.display_name,
            func.count(listing_tags.c.listing_id).label('count')
        ).outerjoin(
            listing_tags, Tag.id == listing_tags.c.tag_id
        ).group_by(
            Tag.id, Tag.category, Tag.value, Tag.display_name
        )
        
        if category:
            query = query.filter(Tag.category == category)
        
        query = query.order_by(func.count(listing_tags.c.listing_id).desc())
        results = query.all()
        
        return jsonify({
            'data': [
                {
                    'id': tag_id,
                    'category': cat,
                    'value': val,
                    'display_name': display or val,
                    'count': count
                }
                for tag_id, cat, val, display, count in results
            ]
        })
    
    @app.route('/api/v1/tags/popular', methods=['GET'])
    @app.route('/api/v1/tags/popular/', methods=['GET'])
    def get_popular_tags():
        """
        Get top N most popular tags for quick filters.
        
        Query Parameters:
            limit (int): Number of tags to return (default: 20, max: 50)
        
        Returns:
            JSON response with array of popular tags.
        """
        from sqlalchemy import func
        
        limit = min(request.args.get('limit', 20, type=int), 50)
        
        results = db.session.query(
            Tag.id,
            Tag.category,
            Tag.value,
            Tag.display_name,
            func.count(listing_tags.c.listing_id).label('count')
        ).join(
            listing_tags, Tag.id == listing_tags.c.tag_id
        ).group_by(
            Tag.id, Tag.category, Tag.value, Tag.display_name
        ).order_by(
            func.count(listing_tags.c.listing_id).desc()
        ).limit(limit).all()
        
        return jsonify({
            'data': [
                {
                    'id': tag_id,
                    'category': cat,
                    'value': val,
                    'display_name': display or val,
                    'count': count
                }
                for tag_id, cat, val, display, count in results
            ]
        })
    
    @app.route('/api/v1/tags/categories', methods=['GET'])
    @app.route('/api/v1/tags/categories/', methods=['GET'])
    def get_tag_categories():
        """
        Get list of available tag categories with counts.
        
        Returns:
            JSON response with array of categories.
        """
        from sqlalchemy import func, distinct
        
        results = db.session.query(
            Tag.category,
            func.count(distinct(Tag.id)).label('tag_count'),
            func.count(listing_tags.c.listing_id).label('usage_count')
        ).outerjoin(
            listing_tags, Tag.id == listing_tags.c.tag_id
        ).group_by(
            Tag.category
        ).order_by(
            func.count(listing_tags.c.listing_id).desc()
        ).all()
        
        return jsonify({
            'data': [
                {
                    'category': cat,
                    'tag_count': tag_count,
                    'usage_count': usage_count
                }
                for cat, tag_count, usage_count in results
            ]
        })
    
    # =========================================================================
    # Archive endpoints (sync code based)
    # =========================================================================
    
    @app.route('/api/v1/archive/generate-code', methods=['POST'])
    def generate_sync_code():
        """
        Generate a new sync code for archive management.
        
        Returns:
            JSON response with the generated sync code.
        """
        # Generate a unique sync code
        max_attempts = 10
        for _ in range(max_attempts):
            code = ArchivedListing.generate_sync_code()
            # Check if code already exists
            existing = ArchivedListing.query.filter_by(sync_code=code).first()
            if not existing:
                return jsonify({
                    'data': {'sync_code': code}
                })
        
        # Fallback: return a code anyway (collision is very unlikely)
        return jsonify({
            'data': {'sync_code': ArchivedListing.generate_sync_code()}
        })
    
    @app.route('/api/v1/archive', methods=['GET'])
    @app.route('/api/v1/archive/', methods=['GET'])
    def get_archived_listings():
        """
        Get all archived listing IDs for a sync code.
        
        Headers:
            X-Sync-Code: The sync code to get archives for.
        
        Returns:
            JSON response with array of archived listing IDs.
        """
        sync_code = request.headers.get('X-Sync-Code', '').strip()
        if not sync_code:
            return jsonify({'error': 'X-Sync-Code header is required'}), 400
        
        archived = ArchivedListing.query.filter_by(sync_code=sync_code).all()
        
        return jsonify({
            'data': {
                'sync_code': sync_code,
                'listing_ids': [a.listing_id for a in archived],
                'count': len(archived)
            }
        })
    
    @app.route('/api/v1/listings/<int:listing_id>/archive', methods=['POST'])
    def archive_listing(listing_id: int):
        """
        Archive a listing for a sync code.
        
        Headers:
            X-Sync-Code: The sync code to archive under.
        
        Returns:
            JSON response confirming the archive.
        """
        sync_code = request.headers.get('X-Sync-Code', '').strip()
        if not sync_code:
            return jsonify({'error': 'X-Sync-Code header is required'}), 400
        
        # Check if listing exists
        listing = Listing.query.get_or_404(listing_id)
        
        # Check if already archived
        existing = ArchivedListing.query.filter_by(
            listing_id=listing_id,
            sync_code=sync_code
        ).first()
        
        if existing:
            return jsonify({
                'data': existing.to_dict(),
                'message': 'Listing was already archived'
            })
        
        # Create archive entry
        archived = ArchivedListing(
            listing_id=listing_id,
            sync_code=sync_code
        )
        db.session.add(archived)
        db.session.commit()
        
        return jsonify({
            'data': archived.to_dict(),
            'message': 'Listing archived successfully'
        }), 201
    
    @app.route('/api/v1/listings/<int:listing_id>/archive', methods=['DELETE'])
    def unarchive_listing(listing_id: int):
        """
        Remove a listing from archive.
        
        Headers:
            X-Sync-Code: The sync code to unarchive from.
        
        Returns:
            JSON response confirming the unarchive.
        """
        sync_code = request.headers.get('X-Sync-Code', '').strip()
        if not sync_code:
            return jsonify({'error': 'X-Sync-Code header is required'}), 400
        
        archived = ArchivedListing.query.filter_by(
            listing_id=listing_id,
            sync_code=sync_code
        ).first()
        
        if not archived:
            return jsonify({'error': 'Listing not found in archive'}), 404
        
        db.session.delete(archived)
        db.session.commit()
        
        return jsonify({
            'message': 'Listing unarchived successfully'
        })
    
    @app.route('/api/v1/archive/bulk', methods=['POST'])
    def bulk_archive_listings():
        """
        Archive multiple listings at once.
        
        Headers:
            X-Sync-Code: The sync code to archive under.
        
        Request Body (JSON):
            listing_ids (array): Array of listing IDs to archive.
        
        Returns:
            JSON response with count of archived listings.
        """
        sync_code = request.headers.get('X-Sync-Code', '').strip()
        if not sync_code:
            return jsonify({'error': 'X-Sync-Code header is required'}), 400
        
        data = request.get_json() or {}
        listing_ids = data.get('listing_ids', [])
        
        if not listing_ids or not isinstance(listing_ids, list):
            return jsonify({'error': 'listing_ids array is required'}), 400
        
        archived_count = 0
        for listing_id in listing_ids:
            try:
                # Check if already archived
                existing = ArchivedListing.query.filter_by(
                    listing_id=listing_id,
                    sync_code=sync_code
                ).first()
                
                if not existing:
                    archived = ArchivedListing(
                        listing_id=listing_id,
                        sync_code=sync_code
                    )
                    db.session.add(archived)
                    archived_count += 1
            except Exception:
                continue
        
        db.session.commit()
        
        return jsonify({
            'data': {
                'archived_count': archived_count,
                'total_requested': len(listing_ids)
            },
            'message': f'Archived {archived_count} listings'
        }), 201
    
    @app.route('/api/v1/archive/clear', methods=['DELETE'])
    def clear_archive():
        """
        Clear all archived listings for a sync code.
        
        Headers:
            X-Sync-Code: The sync code to clear.
        
        Returns:
            JSON response with count of cleared listings.
        """
        sync_code = request.headers.get('X-Sync-Code', '').strip()
        if not sync_code:
            return jsonify({'error': 'X-Sync-Code header is required'}), 400
        
        count = ArchivedListing.query.filter_by(sync_code=sync_code).delete()
        db.session.commit()
        
        return jsonify({
            'data': {'cleared_count': count},
            'message': f'Cleared {count} archived listings'
        })
    
    # =========================================================================
    # Laptop categories endpoint
    # =========================================================================
    
    @app.route('/api/v1/laptop-categories', methods=['GET'])
    @app.route('/api/v1/laptop-categories/', methods=['GET'])
    def get_laptop_categories():
        """
        Get list of laptop categories with counts.
        
        Returns:
            JSON response with array of categories and their listing counts.
        """
        from sqlalchemy import func
        
        results = db.session.query(
            Listing.laptop_category,
            func.count(Listing.id).label('count')
        ).filter(
            Listing.item_type == 'laptop',
            Listing.laptop_category.isnot(None)
        ).group_by(
            Listing.laptop_category
        ).order_by(
            func.count(Listing.id).desc()
        ).all()
        
        # Also get count of uncategorized laptops
        uncategorized = Listing.query.filter(
            Listing.item_type == 'laptop',
            or_(Listing.laptop_category.is_(None), Listing.laptop_category == '')
        ).count()
        
        return jsonify({
            'data': [
                {'category': cat or 'other', 'count': count}
                for cat, count in results
            ] + ([{'category': 'other', 'count': uncategorized}] if uncategorized > 0 else [])
        })
    
    # Scraper endpoints

    CATEGORY_DEFINITIONS = {
        'c278': {'slug': 'notebooks', 'name': 'Notebooks', 'description': 'Notebook/Laptop computers'},
        'c225': {'slug': 'pcs', 'name': 'PCs', 'description': 'Desktop computers'},
        'c285': {'slug': 'tablets', 'name': 'Tablets & Reader', 'description': 'Tablets and E-Readers'},
        'c161': {'slug': 'elektronik', 'name': 'Elektronik', 'description': 'All electronics'},
        'c228': {'slug': 'pc-zubehoer-software', 'name': 'PC Zubehör & Software', 'description': 'PC accessories and software'},
    }

    def _parse_playwright_proxy(proxy_url: str) -> Optional[Dict[str, str]]:
        """
        Parse a proxy URL into a Playwright proxy dict.

        Supports URLs like: http://user:pass@host:port
        """
        proxy_url = (proxy_url or '').strip()
        if not proxy_url:
            return None

        parsed = urlparse(proxy_url)
        if not parsed.scheme or not parsed.netloc:
            return {'server': proxy_url}

        if not parsed.hostname:
            return {'server': proxy_url}

        server = f"{parsed.scheme}://{parsed.hostname}"
        if parsed.port:
            server = f"{server}:{parsed.port}"

        proxy: Dict[str, str] = {'server': server}
        if parsed.username:
            proxy['username'] = unquote(parsed.username)
        if parsed.password:
            proxy['password'] = unquote(parsed.password)
        return proxy

    def _fetch_proxy_list(url: str) -> list[str]:
        """Fetch a newline-delimited proxy list from a URL (best-effort)."""
        url = (url or '').strip()
        if not url:
            return []

        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Klienz/1.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = resp.read()
            text = raw.decode('utf-8', errors='ignore')
            return [
                line.strip()
                for line in text.splitlines()
                if line.strip() and not line.strip().startswith('#')
            ]
        except URLError as e:
            logger.warning(f"Could not fetch proxy list from {url}: {e}")
            return []
        except Exception as e:
            logger.warning(f"Could not fetch proxy list from {url}: {e}")
            return []

    def _get_playwright_proxy_pool() -> list[Dict[str, str]]:
        """
        Build a list of Playwright proxy dicts.

        Priority:
          1) SCRAPER_PROXY_URLS (comma-separated)
          2) SCRAPER_PROXY_LIST_URL (newline-delimited response)
          3) HTTPS_PROXY / HTTP_PROXY
        """
        urls: list[str] = []

        urls_raw = (app.config.get('SCRAPER_PROXY_URLS') or '').strip()
        if urls_raw:
            urls.extend([u.strip() for u in urls_raw.split(',') if u.strip()])

        list_url = (app.config.get('SCRAPER_PROXY_LIST_URL') or '').strip()
        if list_url:
            urls.extend(_fetch_proxy_list(list_url))

        if not urls:
            single = app.config.get('HTTPS_PROXY') or app.config.get('HTTP_PROXY')
            if single:
                urls = [single]

        proxies: list[Dict[str, str]] = []
        seen: set[str] = set()
        for url in urls:
            if url in seen:
                continue
            seen.add(url)
            parsed = _parse_playwright_proxy(url)
            if parsed:
                proxies.append(parsed)
        return proxies

    def _save_job_progress(job: ScraperJob, progress: Dict[str, Any], *, completed: bool = False) -> None:
        """Persist and publish progress for SSE consumers."""
        payload = dict(progress)
        payload['timestamp'] = datetime.utcnow().isoformat()
        if completed:
            payload['completed'] = True

        job.progress_json = json.dumps(payload, ensure_ascii=False)
        db.session.commit()

        if completed:
            progress_manager.complete(job.id, payload)
        else:
            progress_manager.publish(job.id, payload)

    def _run_scraper_job(
        job_id: int,
        page_limit_override: Optional[int] = None,
        concurrency_override: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Execute a scraper job and persist results.

        Returns a small summary dict for API responses.
        """
        job = ScraperJob.query.get(job_id)
        if not job:
            logger.error(f"Scraper job {job_id} not found")
            return {}

        # Get admin config for scraper settings
        admin_config = ScraperConfig.get_config()

        page_limit = page_limit_override if page_limit_override is not None else admin_config.page_limit
        page_limit = int(page_limit)
        if page_limit < 1 or page_limit > 50:
            raise ValueError('Page limit must be between 1 and 50')

        concurrency = concurrency_override if concurrency_override is not None else app.config.get('SCRAPER_CONCURRENCY', 1)
        try:
            concurrency = int(concurrency)
        except (TypeError, ValueError):
            concurrency = 1
        concurrency = max(1, min(concurrency, 4))

        # Parse keywords into list (each will be searched separately)
        keywords_raw = admin_config.keywords.strip() if admin_config.keywords else ''
        keywords_list = [k.strip() for k in keywords_raw.split(',') if k.strip()]

        # If no keywords, scrape base URL once
        if not keywords_list:
            keywords_list = ['']  # Empty string = no keyword filter

        # Parse categories into list (scrape each category)
        categories_raw = admin_config.categories.strip() if admin_config.categories else ''
        categories_list = [c.strip() for c in categories_raw.split(',') if c.strip()] or ['c278']

        # Get city setting
        city_slug = admin_config.city.strip() if admin_config.city else ''

        # Cross-product: category x keyword
        tasks = [(category, keyword) for category in categories_list for keyword in keywords_list]
        total_tasks = len(tasks) or 1

        proxy_pool = _get_playwright_proxy_pool()

        def _proxy_for_worker(worker_id: int) -> Optional[Dict[str, str]]:
            if not proxy_pool:
                return None
            return proxy_pool[worker_id % len(proxy_pool)]

        # Track start time for progress
        start_time = time.time()

        # Track listings by external_id with their keywords
        listings_by_id: Dict[str, Dict[str, Any]] = {}  # {external_id: {'data': dict, 'keywords': set[str]}}
        total_pages_scraped = 0
        keywords_processed: set[str] = set()

        scraper_kwargs = {
            'delay_seconds': app.config['SCRAPER_DELAY_SECONDS'],
            'page_limit': page_limit,
            'browser_type': app.config['PLAYWRIGHT_BROWSER'],
        }

        seen_external_ids: set[str] = set()
        seen_lock = Lock()

        def _display_for_task(category: str, keyword: str) -> str:
            label = keyword or 'all'
            return f"{label} ({category})" if len(categories_list) > 1 else label

        def _build_scrape_url(category: str, keyword: str) -> str:
            category_slug = CATEGORY_DEFINITIONS.get(category, {'slug': 'notebooks'}).get('slug', 'notebooks')
            if city_slug:
                base_url_template = f"https://www.kleinanzeigen.de/s-{category_slug}/{city_slug}/{category}"
            else:
                base_url_template = f"https://www.kleinanzeigen.de/s-{category_slug}/{category}"
            if keyword:
                return f"{base_url_template}?keywords={quote_plus(keyword)}"
            return base_url_template

        def _scrape_task(
            page,
            scraper: KleinanzeigenScraper,
            robots_checker: RobotsChecker,
            category: str,
            keyword: str,
        ) -> tuple[list[dict[str, Any]], int]:
            scrape_url = _build_scrape_url(category, keyword)

            logger.info(f"Scraping category={category} keyword='{keyword}' url={scrape_url}")

            if not robots_checker.is_allowed(urlparse(scrape_url).path):
                logger.warning(f"Skipping disallowed path by robots.txt: {scrape_url}")
                return [], 0

            listings_data: list[dict[str, Any]] = []
            no_new_pages = 0
            pages_scraped_local = 0

            for page_num in range(1, page_limit + 1):
                page_url = scraper.build_page_url(scrape_url, page_num)
                page_listings = scraper.scrape_page(page, page_url)
                pages_scraped_local += 1
                listings_data.extend(page_listings)

                ext_ids = [l.get('external_id') for l in page_listings if l.get('external_id')]
                if ext_ids:
                    with seen_lock:
                        before = len(seen_external_ids)
                        seen_external_ids.update(ext_ids)
                        after = len(seen_external_ids)
                    new_count = after - before
                else:
                    new_count = 0

                if new_count == 0:
                    no_new_pages += 1
                else:
                    no_new_pages = 0

                # Stop early if we keep seeing only duplicates / empty pages.
                if not page_listings or no_new_pages >= 2:
                    break

                # Polite delay between pages
                if page_num < page_limit:
                    time.sleep(scraper.delay_seconds)

            return listings_data, pages_scraped_local

        def _merge_task_results(category: str, keyword: str, task_listings: list[dict[str, Any]]):
            for listing in task_listings:
                ext_id = listing.get('external_id')
                if not ext_id:
                    continue

                if ext_id not in listings_by_id:
                    listings_by_id[ext_id] = {
                        'data': listing,
                        'keywords': set(),
                    }
                else:
                    # Keep latest parsed fields (title/price/desc might change)
                    listings_by_id[ext_id]['data'] = listing

                if keyword:
                    listings_by_id[ext_id]['keywords'].add(keyword)

        # Single-worker mode: reuse one browser/page for the entire job (fastest + simplest)
        if concurrency <= 1 or total_tasks <= 1:
            robots_checker = RobotsChecker('https://www.kleinanzeigen.de/s-notebooks/c278')

            primary_proxy = _proxy_for_worker(0)
            proxy_attempts: list[Optional[Dict[str, str]]] = []
            if primary_proxy:
                proxy_attempts.append(primary_proxy)
                for candidate in proxy_pool:
                    if candidate is not primary_proxy:
                        proxy_attempts.append(candidate)
            proxy_attempts.append(None)  # Always allow fallback to direct.

            last_open_error: Optional[Exception] = None
            for attempt_proxy in proxy_attempts:
                scraper = KleinanzeigenScraper(**scraper_kwargs, proxy=attempt_proxy)
                try:
                    with scraper.open_page() as page:
                        robots_checker.fetch_robots(page)

                        for idx, (category, keyword) in enumerate(tasks):
                            elapsed = time.time() - start_time
                            current_display = _display_for_task(category, keyword)
                            if keyword:
                                keywords_processed.add(keyword)

                            _save_job_progress(job, {
                                'status': 'running',
                                'current_keyword': current_display,
                                'keyword_index': idx,
                                'total_keywords': total_tasks,
                                'listings_found': len(listings_by_id),
                                'elapsed_seconds': int(elapsed),
                                'message': f"Scraping: {current_display}",
                                'concurrency': 1,
                            })

                            try:
                                task_listings, pages_scraped_local = _scrape_task(
                                    page, scraper, robots_checker, category, keyword
                                )
                                total_pages_scraped += pages_scraped_local
                                _merge_task_results(category, keyword, task_listings)

                                logger.info(
                                    f"Task {idx + 1}/{total_tasks}: {len(task_listings)} listings, {len(listings_by_id)} unique total"
                                )
                            except Exception as e:
                                logger.error(f"Error scraping category={category} keyword='{keyword}': {e}")
                                continue

                    last_open_error = None
                    break
                except Exception as e:
                    last_open_error = e
                    proxy_label = attempt_proxy.get('server') if attempt_proxy else 'direct'
                    logger.warning(f"Playwright launch/navigation failed via proxy={proxy_label}: {e}")
                    continue

            if last_open_error is not None:
                raise last_open_error
        else:
            # Multi-worker mode: run tasks in parallel using N isolated Playwright instances.
            task_queue: queue.Queue = queue.Queue()
            result_queue: queue.Queue = queue.Queue()
            workers: list[Thread] = []

            for idx, (category, keyword) in enumerate(tasks):
                task_queue.put((idx, category, keyword))

            for _ in range(concurrency):
                task_queue.put(None)

            def worker(worker_id: int) -> None:
                assigned_proxy = _proxy_for_worker(worker_id)
                proxy_attempts: list[Optional[Dict[str, str]]] = []
                if assigned_proxy:
                    proxy_attempts.append(assigned_proxy)
                    for candidate in proxy_pool:
                        if candidate is not assigned_proxy:
                            proxy_attempts.append(candidate)
                proxy_attempts.append(None)  # Always allow fallback to direct.

                last_error: Optional[Exception] = None
                try:
                    for attempt_proxy in proxy_attempts:
                        worker_scraper = KleinanzeigenScraper(**scraper_kwargs, proxy=attempt_proxy)
                        proxy_label = attempt_proxy.get('server') if attempt_proxy else 'direct'
                        try:
                            with worker_scraper.open_page() as page:
                                worker_robots = RobotsChecker('https://www.kleinanzeigen.de/s-notebooks/c278')
                                worker_robots.fetch_robots(page)

                                while True:
                                    task = task_queue.get()
                                    if task is None:
                                        break
                                    idx, category, keyword = task
                                    result_queue.put({
                                        'event': 'task_started',
                                        'idx': idx,
                                        'category': category,
                                        'keyword': keyword,
                                        'worker_id': worker_id,
                                        'proxy': proxy_label,
                                    })
                                    try:
                                        task_listings, pages_scraped_local = _scrape_task(
                                            page, worker_scraper, worker_robots, category, keyword
                                        )
                                        result_queue.put({
                                            'event': 'task_completed',
                                            'idx': idx,
                                            'category': category,
                                            'keyword': keyword,
                                            'pages_scraped': pages_scraped_local,
                                            'listings': task_listings,
                                            'worker_id': worker_id,
                                            'proxy': proxy_label,
                                        })
                                    except Exception as e:
                                        result_queue.put({
                                            'event': 'task_error',
                                            'idx': idx,
                                            'category': category,
                                            'keyword': keyword,
                                            'error': str(e),
                                            'worker_id': worker_id,
                                            'proxy': proxy_label,
                                        })

                            last_error = None
                            break
                        except Exception as e:
                            last_error = e
                            result_queue.put({
                                'event': 'worker_proxy_failed',
                                'worker_id': worker_id,
                                'proxy': proxy_label,
                                'error': str(e),
                            })
                            continue

                    if last_error is not None:
                        result_queue.put({'event': 'worker_error', 'worker_id': worker_id, 'error': str(last_error)})
                finally:
                    result_queue.put({'event': 'worker_done', 'worker_id': worker_id})

            for worker_id in range(concurrency):
                t = Thread(target=worker, args=(worker_id,), daemon=True)
                t.start()
                workers.append(t)

            tasks_done = 0
            workers_done = 0

            while workers_done < concurrency:
                msg = result_queue.get()
                event = msg.get('event')

                if event == 'worker_done':
                    workers_done += 1
                    continue

                if event == 'worker_error':
                    logger.error(f"Worker {msg.get('worker_id')} failed: {msg.get('error')}")
                    continue

                if event == 'task_started':
                    elapsed = time.time() - start_time
                    current_display = _display_for_task(msg['category'], msg['keyword'])
                    if msg.get('keyword'):
                        keywords_processed.add(msg['keyword'])
                    _save_job_progress(job, {
                        'status': 'running',
                        'current_keyword': current_display,
                        'keyword_index': tasks_done,
                        'total_keywords': total_tasks,
                        'listings_found': len(listings_by_id),
                        'elapsed_seconds': int(elapsed),
                        'message': f"Scraping: {current_display}",
                        'concurrency': concurrency,
                    })
                    continue

                if event == 'task_error':
                    tasks_done += 1
                    logger.error(
                        f"Error scraping category={msg.get('category')} keyword='{msg.get('keyword')}': {msg.get('error')}"
                    )
                    elapsed = time.time() - start_time
                    _save_job_progress(job, {
                        'status': 'running',
                        'current_keyword': _display_for_task(msg['category'], msg['keyword']),
                        'keyword_index': tasks_done,
                        'total_keywords': total_tasks,
                        'listings_found': len(listings_by_id),
                        'elapsed_seconds': int(elapsed),
                        'message': f"Task failed: {_display_for_task(msg['category'], msg['keyword'])}",
                        'concurrency': concurrency,
                    })
                    continue

                if event == 'task_completed':
                    tasks_done += 1
                    total_pages_scraped += int(msg.get('pages_scraped') or 0)
                    _merge_task_results(msg['category'], msg['keyword'], msg.get('listings') or [])

                    elapsed = time.time() - start_time
                    _save_job_progress(job, {
                        'status': 'running',
                        'current_keyword': _display_for_task(msg['category'], msg['keyword']),
                        'keyword_index': tasks_done,
                        'total_keywords': total_tasks,
                        'listings_found': len(listings_by_id),
                        'elapsed_seconds': int(elapsed),
                        'message': f"Completed {tasks_done}/{total_tasks} tasks",
                        'concurrency': concurrency,
                    })

            for t in workers:
                t.join(timeout=1)

        # Process all collected results (unique by external_id)
        new_count = 0
        updated_count = 0

        # Helper function to get or create tags
        def get_or_create_tags(title: str, description: str) -> list:
            """Extract tags from listing text and return Tag objects."""
            extracted = extract_tags(title, description)
            tag_objects = []
            for category, value in extracted:
                # Try to find existing tag
                tag = Tag.query.filter_by(category=category, value=value).first()
                if not tag:
                    tag = Tag(category=category, value=value)
                    db.session.add(tag)
                    db.session.flush()  # Get tag ID
                tag_objects.append(tag)
            return tag_objects

        for ext_id, listing_info in listings_by_id.items():
            listing_data = listing_info['data']
            keywords_set = listing_info['keywords']
            keywords_str = ','.join(sorted(keywords_set)) if keywords_set else ''
            new_price_cents = int(listing_data['price'] * 100) if listing_data.get('price') else None
            
            title = listing_data.get('title', '')
            description = listing_data.get('description', '')
            
            # Classify item type and laptop category
            item_type = classify_item_type(title, description)
            laptop_category = None
            if item_type == 'laptop':
                laptop_category = classify_laptop_category(title, description)
            
            # Extract hardware tags
            tags = get_or_create_tags(title, description)

            existing = Listing.query.filter_by(external_id=ext_id).first()
            if existing:
                # Track price history if price changed
                if existing.price_eur != new_price_cents:
                    db.session.add(PriceHistory(listing_id=existing.id, price=new_price_cents))

                existing.title = listing_data['title']
                existing.price_eur = new_price_cents
                existing.price_negotiable = listing_data['price_negotiable']
                existing.location_city = listing_data['city']
                existing.location_state = listing_data['state']
                existing.description = listing_data['description']
                existing.condition = listing_data['condition']
                existing.image_url = listing_data['image_url']
                existing.item_type = item_type
                existing.laptop_category = laptop_category
                existing.updated_at = datetime.utcnow()

                # Merge keywords
                if existing.search_keywords:
                    existing_keywords = {k.strip() for k in existing.search_keywords.split(',') if k.strip()}
                    merged_keywords = existing_keywords | keywords_set
                    existing.search_keywords = ','.join(sorted(merged_keywords))
                else:
                    existing.search_keywords = keywords_str
                
                # Update tags (replace with new extractions)
                existing.tags = []
                for tag in tags:
                    if tag not in existing.tags.all():
                        existing.tags.append(tag)

                updated_count += 1
            else:
                listing_data['item_type'] = item_type
                listing_data['laptop_category'] = laptop_category
                new_listing = Listing.from_scraped_dict(listing_data)
                new_listing.search_keywords = keywords_str
                db.session.add(new_listing)
                db.session.flush()  # Get the ID
                
                # Associate tags with new listing
                for tag in tags:
                    new_listing.tags.append(tag)

                # Add initial price to history
                if new_price_cents is not None:
                    db.session.add(PriceHistory(listing_id=new_listing.id, price=new_price_cents))

                new_count += 1

        db.session.commit()

        # Update job status
        job.status = 'completed'
        job.completed_at = datetime.utcnow()
        job.pages_scraped = total_pages_scraped
        job.listings_found = len(listings_by_id)
        job.listings_new = new_count
        job.listings_updated = updated_count
        db.session.commit()

        elapsed = time.time() - start_time
        _save_job_progress(job, {
            'status': 'completed',
            'current_keyword': 'done',
            'keyword_index': total_tasks,
            'total_keywords': total_tasks,
            'listings_found': len(listings_by_id),
            'elapsed_seconds': int(elapsed),
            'message': f'Completed! {new_count} new, {updated_count} updated.',
            'new_count': new_count,
            'updated_count': updated_count,
        }, completed=True)

        keywords_summary = ', '.join(sorted(keywords_processed)) if keywords_processed else 'all'
        logger.info(
            f"Scraper job {job.id} completed: {new_count} new, {updated_count} updated (keywords: {keywords_summary})"
        )

        return {
            'job': job.to_dict(),
            'keywords_processed': sorted(keywords_processed),
            'message': f'Scraping completed for {len(keywords_processed) or 1} keyword(s). {new_count} new listings, {updated_count} updated.',
        }
    @app.route('/api/v1/scraper/jobs', methods=['GET'])
    @app.route('/api/v1/scraper/jobs/', methods=['GET'])
    def get_scraper_jobs():
        """
        Get list of scraper jobs with status.
        
        Query Parameters:
            page (int): Page number.
            per_page (int): Items per page.
            status (str): Filter by status.
        
        Returns:
            JSON response with jobs array and pagination.
        """
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status', '').strip()
        
        query = ScraperJob.query
        if status:
            query = query.filter(ScraperJob.status == status)
        
        query = query.order_by(ScraperJob.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'data': [job.to_dict() for job in pagination.items],
            'pagination': {
                'page': pagination.page,
                'per_page': pagination.per_page,
                'total_pages': pagination.pages,
                'total_items': pagination.total,
            }
        })
    
    @app.route('/api/v1/scraper/jobs', methods=['POST'])
    @app.route('/api/v1/scraper/jobs/', methods=['POST'])
    def trigger_scraper():
        """
        Trigger a new scraper job.
        
        Iterates through each configured keyword separately to ensure
        accurate search results. Deduplicates listings found across
        multiple keyword searches.
        
        Request Body (JSON):
            page_limit (int): Maximum pages to scrape per keyword (default: from admin config).
        
        Returns:
            JSON response with job ID and status.
        
        Optional streaming mode:
            If request includes {"stream": true}, the job runs in a background thread
            and this endpoint returns immediately with HTTP 202. Progress can be
            observed via the SSE endpoint: /api/v1/scraper/jobs/{id}/progress

        Note:
            In production, this should require admin authentication.
        """
        data = request.get_json() or {}
        stream = bool(data.get('stream', False))

        # Get admin config for default settings
        admin_config = ScraperConfig.get_config()
        page_limit_raw = data.get('page_limit', admin_config.page_limit)
        concurrency_raw = data.get('concurrency', app.config.get('SCRAPER_CONCURRENCY', 1))

        try:
            page_limit = int(page_limit_raw)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid page_limit'}), 400

        if page_limit < 1 or page_limit > 50:
            return jsonify({'error': 'Page limit must be between 1 and 50'}), 400

        try:
            concurrency = int(concurrency_raw)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid concurrency'}), 400

        if concurrency < 1 or concurrency > 4:
            return jsonify({'error': 'Concurrency must be between 1 and 4'}), 400

        # Create job record
        job = ScraperJob(status='running', started_at=datetime.utcnow())
        db.session.add(job)
        db.session.commit()

        # Initial progress (so SSE has something immediately)
        _save_job_progress(job, {
            'status': 'running',
            'current_keyword': '',
            'keyword_index': 0,
            'total_keywords': 0,
            'listings_found': 0,
            'elapsed_seconds': 0,
            'message': 'Starting scraper...',
            'concurrency': concurrency,
        })

        def runner():
            with app.app_context():
                try:
                    _run_scraper_job(job.id, page_limit_override=page_limit, concurrency_override=concurrency)
                except Exception as e:
                    logger.error(f"Scraper job {job.id} failed: {e}")
                    failed_job = ScraperJob.query.get(job.id)
                    if not failed_job:
                        return
                    failed_job.status = 'failed'
                    failed_job.completed_at = datetime.utcnow()
                    failed_job.error_message = str(e)
                    db.session.commit()
                    _save_job_progress(failed_job, {
                        'status': 'failed',
                        'current_keyword': '',
                        'keyword_index': 0,
                        'total_keywords': 0,
                        'listings_found': failed_job.listings_found or 0,
                        'elapsed_seconds': 0,
                        'message': f'Failed: {str(e)}',
                        'error': str(e),
                    }, completed=True)

        if stream:
            Thread(target=runner, daemon=True).start()
            return jsonify({
                'data': job.to_dict(),
                'message': 'Scraper job started',
            }), 202

        # Synchronous mode (blocks until completion)
        try:
            result = _run_scraper_job(job.id, page_limit_override=page_limit, concurrency_override=concurrency)
            return jsonify({
                'data': result.get('job', job.to_dict()),
                'message': result.get('message', 'Scraping completed'),
                'keywords_processed': result.get('keywords_processed', []),
            }), 201
        except Exception as e:
            logger.error(f"Scraper job {job.id} failed: {e}")
            job.status = 'failed'
            job.completed_at = datetime.utcnow()
            job.error_message = str(e)
            db.session.commit()
            _save_job_progress(job, {
                'status': 'failed',
                'current_keyword': '',
                'keyword_index': 0,
                'total_keywords': 0,
                'listings_found': job.listings_found or 0,
                'elapsed_seconds': 0,
                'message': f'Failed: {str(e)}',
                'error': str(e),
            }, completed=True)
            return jsonify({'data': job.to_dict(), 'error': str(e)}), 500
    
    @app.route('/api/v1/scraper/jobs/<int:job_id>', methods=['GET'])
    def get_scraper_job(job_id: int):
        """
        Get status of a specific scraper job.
        
        Args:
            job_id: Job ID to retrieve.
        
        Returns:
            JSON response with job data or 404 error.
        """
        job = ScraperJob.query.get_or_404(job_id)
        return jsonify({'data': job.to_dict()})
    
    @app.route('/api/v1/scraper/jobs/<int:job_id>/progress', methods=['GET'])
    def get_scraper_progress(job_id: int):
        """
        Server-Sent Events endpoint for real-time scraper progress.
        
        Args:
            job_id: Job ID to stream progress for.
        
        Returns:
            SSE stream with progress updates.
        """
        ScraperJob.query.get_or_404(job_id)

        def generate():
            yield f"event: connected\ndata: {json.dumps({'job_id': job_id})}\n\n"

            last_payload: Optional[str] = None
            last_activity = time.time()

            while True:
                # Ensure we see the latest committed progress from any worker/thread.
                db.session.remove()
                job = ScraperJob.query.get(job_id)
                if not job:
                    yield f"event: error\ndata: {json.dumps({'error': 'Job not found'})}\n\n"
                    break

                progress = None
                if job.progress_json:
                    try:
                        progress = json.loads(job.progress_json)
                    except Exception:
                        progress = None

                if not progress:
                    progress = {
                        'status': job.status,
                        'current_keyword': '',
                        'keyword_index': 0,
                        'total_keywords': 0,
                        'listings_found': job.listings_found or 0,
                        'elapsed_seconds': 0,
                        'message': 'Waiting for progress...',
                        'timestamp': datetime.utcnow().isoformat(),
                    }

                completed = bool(progress.get('completed')) or job.status in ('completed', 'failed')
                if completed:
                    progress['completed'] = True
                    progress.setdefault('new_count', job.listings_new)
                    progress.setdefault('updated_count', job.listings_updated)
                    if job.status == 'failed':
                        progress.setdefault('error', job.error_message or 'Failed')

                payload = json.dumps(progress, ensure_ascii=False)
                if payload != last_payload:
                    event_type = 'complete' if completed else 'progress'
                    yield f"event: {event_type}\ndata: {payload}\n\n"
                    last_payload = payload
                    last_activity = time.time()
                    if completed:
                        break
                elif time.time() - last_activity >= 30:
                    yield f"event: ping\ndata: {json.dumps({'timestamp': datetime.utcnow().isoformat()})}\n\n"
                    last_activity = time.time()

                time.sleep(1)

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        )
    
    # Admin config endpoints
    @app.route('/api/v1/admin/config', methods=['GET'])
    @app.route('/api/v1/admin/config/', methods=['GET'])
    def get_admin_config():
        """
        Get current scraper configuration.
        
        Returns:
            JSON response with scraper configuration settings.
        """
        config = ScraperConfig.get_config()
        return jsonify({'data': config.to_dict()})
    
    @app.route('/api/v1/admin/config', methods=['PUT'])
    @app.route('/api/v1/admin/config/', methods=['PUT'])
    def update_admin_config():
        """
        Update scraper configuration.
        
        Request Body (JSON):
            keywords (str): Comma-separated search keywords.
            city (str): Target city filter.
            categories (str): Comma-separated category codes.
            update_interval_minutes (int): Auto-update interval (0 = disabled).
            page_limit (int): Max pages to scrape per run.
            is_active (bool): Enable/disable auto-scraping.
        
        Returns:
            JSON response with updated configuration.
        
        Note:
            In production, this endpoint should require admin authentication.
        """
        data = request.get_json() or {}
        config = ScraperConfig.get_config()
        
        # Update fields if provided
        if 'keywords' in data:
            config.keywords = data['keywords'].strip()
        if 'city' in data:
            config.city = data['city'].strip()
        if 'categories' in data:
            config.categories = data['categories'].strip()
        if 'update_interval_minutes' in data:
            interval = int(data['update_interval_minutes'])
            if interval < 0:
                return jsonify({'error': 'Invalid interval'}), 400
            config.update_interval_minutes = interval
        if 'page_limit' in data:
            limit = int(data['page_limit'])
            if limit < 1 or limit > 50:
                return jsonify({'error': 'Page limit must be between 1 and 50'}), 400
            config.page_limit = limit
        if 'is_active' in data:
            config.is_active = bool(data['is_active'])
        
        db.session.commit()
        logger.info(f"Admin config updated: {config.to_dict()}")
        
        return jsonify({
            'data': config.to_dict(),
            'message': 'Configuration updated successfully'
        })
    
    @app.route('/api/v1/admin/categories', methods=['GET'])
    @app.route('/api/v1/admin/categories/', methods=['GET'])
    def get_available_categories():
        """
        Get list of available Kleinanzeigen categories for notebooks/electronics.
        
        Returns:
            JSON response with predefined category options.
        """
        categories = [
            {'code': code, 'slug': meta['slug'], 'name': meta['name'], 'description': meta['description']}
            for code, meta in CATEGORY_DEFINITIONS.items()
        ]
        return jsonify({'data': categories})
    
    @app.route('/api/v1/admin/cities', methods=['GET'])
    @app.route('/api/v1/admin/cities/', methods=['GET'])
    def get_available_cities():
        """
        Get list of major German cities for location filtering.
        
        Returns:
            JSON response with predefined city options.
        """
        # Major German cities for filtering
        cities = [
            {'slug': '', 'name': 'Alle (Deutschland-weit)', 'region': ''},
            {'slug': 'berlin', 'name': 'Berlin', 'region': 'Berlin'},
            {'slug': 'hamburg', 'name': 'Hamburg', 'region': 'Hamburg'},
            {'slug': 'muenchen', 'name': 'München', 'region': 'Bayern'},
            {'slug': 'koeln', 'name': 'Köln', 'region': 'Nordrhein-Westfalen'},
            {'slug': 'frankfurt-am-main', 'name': 'Frankfurt am Main', 'region': 'Hessen'},
            {'slug': 'stuttgart', 'name': 'Stuttgart', 'region': 'Baden-Württemberg'},
            {'slug': 'duesseldorf', 'name': 'Düsseldorf', 'region': 'Nordrhein-Westfalen'},
            {'slug': 'leipzig', 'name': 'Leipzig', 'region': 'Sachsen'},
            {'slug': 'dortmund', 'name': 'Dortmund', 'region': 'Nordrhein-Westfalen'},
            {'slug': 'essen', 'name': 'Essen', 'region': 'Nordrhein-Westfalen'},
            {'slug': 'bremen', 'name': 'Bremen', 'region': 'Bremen'},
            {'slug': 'dresden', 'name': 'Dresden', 'region': 'Sachsen'},
            {'slug': 'hannover', 'name': 'Hannover', 'region': 'Niedersachsen'},
            {'slug': 'nuernberg', 'name': 'Nürnberg', 'region': 'Bayern'},
        ]
        return jsonify({'data': cities})
    
    # =========================================================================
    # AI Recommendation Engine Endpoints
    # =========================================================================
    
    @app.route('/api/v1/preferences', methods=['GET'])
    def get_preferences():
        """
        Get user preferences for recommendations.
        
        Headers:
            X-Sync-Code: User's sync code.
        
        Returns:
            JSON response with user preferences or empty defaults.
        """
        from models import UserPreferences
        
        sync_code = request.headers.get('X-Sync-Code', '').strip()
        if not sync_code:
            return jsonify({'error': 'X-Sync-Code header is required'}), 400
        
        prefs = UserPreferences.query.filter_by(sync_code=sync_code).first()
        if prefs:
            return jsonify({'data': prefs.to_dict()})
        
        # Return defaults for new users
        return jsonify({
            'data': {
                'sync_code': sync_code,
                'keywords': [],
                'min_price': None,
                'max_price': None,
                'brands': [],
                'laptop_categories': [],
                'weights': {'price': 0.3, 'specs': 0.4, 'brand': 0.3},
                'created_at': None,
                'updated_at': None,
            }
        })
    
    @app.route('/api/v1/preferences', methods=['POST', 'PUT'])
    def save_preferences():
        """
        Save user preferences for recommendations.
        
        Headers:
            X-Sync-Code: User's sync code.
        
        Request Body (JSON):
            keywords (array): Keywords to prioritize.
            min_price (float): Minimum price in EUR.
            max_price (float): Maximum price in EUR.
            brands (array): Preferred brands.
            laptop_categories (array): Preferred categories.
            weights (object): {price, specs, brand} weights (0-1).
        
        Returns:
            JSON response with saved preferences.
        """
        from models import UserPreferences
        
        sync_code = request.headers.get('X-Sync-Code', '').strip()
        if not sync_code:
            return jsonify({'error': 'X-Sync-Code header is required'}), 400
        
        data = request.get_json() or {}
        
        # Get or create preferences
        prefs = UserPreferences.query.filter_by(sync_code=sync_code).first()
        if not prefs:
            prefs = UserPreferences(sync_code=sync_code)
            db.session.add(prefs)
        
        # Update fields
        if 'keywords' in data:
            keywords = data['keywords']
            if isinstance(keywords, list):
                prefs.keywords = ','.join(keywords)
            else:
                prefs.keywords = str(keywords)
        
        if 'min_price' in data:
            prefs.min_price = int(data['min_price'] * 100) if data['min_price'] else None
        
        if 'max_price' in data:
            prefs.max_price = int(data['max_price'] * 100) if data['max_price'] else None
        
        if 'brands' in data:
            brands = data['brands']
            if isinstance(brands, list):
                prefs.brands = ','.join(brands)
            else:
                prefs.brands = str(brands)
        
        if 'laptop_categories' in data:
            cats = data['laptop_categories']
            if isinstance(cats, list):
                prefs.laptop_categories = ','.join(cats)
            else:
                prefs.laptop_categories = str(cats)
        
        if 'weights' in data:
            weights = data['weights']
            if 'price' in weights:
                prefs.weight_price = float(weights['price'])
            if 'specs' in weights:
                prefs.weight_specs = float(weights['specs'])
            if 'brand' in weights:
                prefs.weight_brand = float(weights['brand'])
        
        db.session.commit()
        
        return jsonify({
            'data': prefs.to_dict(),
            'message': 'Preferences saved successfully'
        })
    
    @app.route('/api/v1/items/must-see', methods=['GET'])
    @app.route('/api/v1/items/must-see/', methods=['GET'])
    def get_must_see_items():
        """
        Get high-value items with score >= 75%.
        
        Headers:
            X-Sync-Code: User's sync code.
        
        Query Parameters:
            limit (int): Max items to return (default: 20).
        
        Returns:
            JSON response with must-see listings and their scores.
        """
        from models import UserPreferences, ItemAnalysis, LearnedPreference, BrandAffinity
        from scoring_engine import score_listing
        
        sync_code = request.headers.get('X-Sync-Code', '').strip()
        if not sync_code:
            return jsonify({'error': 'X-Sync-Code header is required'}), 400
        
        limit = request.args.get('limit', 20, type=int)
        
        # Get user preferences
        prefs = UserPreferences.query.filter_by(sync_code=sync_code).first()
        if not prefs:
            return jsonify({
                'data': [],
                'message': 'No preferences set. Configure preferences first.'
            })
        
        # Get effective learned weights with time decay and confidence
        from ml_learning import get_effective_learned_weights, get_effective_brand_affinities
        learned_keywords = get_effective_learned_weights(sync_code, LearnedPreference, apply_decay=True)
        brand_affinities = get_effective_brand_affinities(sync_code, BrandAffinity, apply_decay=True)
        
        # Check for cached analyses
        cached = ItemAnalysis.query.filter_by(
            sync_code=sync_code,
            classification='must_see'
        ).order_by(ItemAnalysis.total_score.desc()).limit(limit).all()
        
        if cached:
            # Return cached results with listings
            results = []
            for analysis in cached:
                if analysis.listing:
                    listing_dict = analysis.listing.to_dict()
                    listing_dict['match_score'] = analysis.to_dict()
                    results.append(listing_dict)
            return jsonify({'data': results})
        
        # Calculate scores on-the-fly
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=2)
        listings = Listing.query.filter(Listing.posted_at >= cutoff).all()
        
        results = []
        for listing in listings:
            score_data = score_listing(listing, prefs, learned_keywords, brand_affinities)
            if score_data['classification'] == 'must_see':
                # Cache the score
                analysis = ItemAnalysis.query.filter_by(
                    listing_id=listing.id, sync_code=sync_code
                ).first()
                if not analysis:
                    analysis = ItemAnalysis(listing_id=listing.id, sync_code=sync_code)
                    db.session.add(analysis)
                
                analysis.keyword_score = score_data['keyword_score']
                analysis.price_score = score_data['price_score']
                analysis.brand_score = score_data['brand_score']
                analysis.learned_bonus = score_data['learned_bonus']
                analysis.total_score = score_data['total_score']
                analysis.classification = score_data['classification']
                analysis.analyzed_at = datetime.utcnow()
                
                listing_dict = listing.to_dict()
                listing_dict['match_score'] = score_data
                results.append(listing_dict)
        
        db.session.commit()
        
        # Sort by score and limit
        results.sort(key=lambda x: x['match_score']['total_score'], reverse=True)
        return jsonify({'data': results[:limit]})
    
    @app.route('/api/v1/items/recommended', methods=['GET'])
    @app.route('/api/v1/items/recommended/', methods=['GET'])
    def get_recommended_items():
        """
        Get recommended items with score 50-74%.
        
        Headers:
            X-Sync-Code: User's sync code.
        
        Query Parameters:
            limit (int): Max items to return (default: 20).
        
        Returns:
            JSON response with recommended listings and their scores.
        """
        from models import UserPreferences, ItemAnalysis, LearnedPreference, BrandAffinity
        from scoring_engine import score_listing
        
        sync_code = request.headers.get('X-Sync-Code', '').strip()
        if not sync_code:
            return jsonify({'error': 'X-Sync-Code header is required'}), 400
        
        limit = request.args.get('limit', 20, type=int)
        
        prefs = UserPreferences.query.filter_by(sync_code=sync_code).first()
        if not prefs:
            return jsonify({
                'data': [],
                'message': 'No preferences set. Configure preferences first.'
            })
        
        # Get effective learned weights with time decay and confidence
        from ml_learning import get_effective_learned_weights, get_effective_brand_affinities
        learned_keywords = get_effective_learned_weights(sync_code, LearnedPreference, apply_decay=True)
        brand_affinities = get_effective_brand_affinities(sync_code, BrandAffinity, apply_decay=True)
        
        # Check for cached analyses
        cached = ItemAnalysis.query.filter_by(
            sync_code=sync_code,
            classification='recommended'
        ).order_by(ItemAnalysis.total_score.desc()).limit(limit).all()
        
        if cached:
            results = []
            for analysis in cached:
                if analysis.listing:
                    listing_dict = analysis.listing.to_dict()
                    listing_dict['match_score'] = analysis.to_dict()
                    results.append(listing_dict)
            return jsonify({'data': results})
        
        # Calculate scores on-the-fly
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=2)
        listings = Listing.query.filter(Listing.posted_at >= cutoff).all()
        
        results = []
        for listing in listings:
            score_data = score_listing(listing, prefs, learned_keywords, brand_affinities)
            if score_data['classification'] == 'recommended':
                # Cache the score
                analysis = ItemAnalysis.query.filter_by(
                    listing_id=listing.id, sync_code=sync_code
                ).first()
                if not analysis:
                    analysis = ItemAnalysis(listing_id=listing.id, sync_code=sync_code)
                    db.session.add(analysis)
                
                analysis.keyword_score = score_data['keyword_score']
                analysis.price_score = score_data['price_score']
                analysis.brand_score = score_data['brand_score']
                analysis.learned_bonus = score_data['learned_bonus']
                analysis.total_score = score_data['total_score']
                analysis.classification = score_data['classification']
                analysis.analyzed_at = datetime.utcnow()
                
                listing_dict = listing.to_dict()
                listing_dict['match_score'] = score_data
                results.append(listing_dict)
        
        db.session.commit()
        
        results.sort(key=lambda x: x['match_score']['total_score'], reverse=True)
        return jsonify({'data': results[:limit]})
    
    @app.route('/api/v1/interactions', methods=['POST'])
    def log_interaction():
        """
        Log a user interaction for ML learning.
        
        Headers:
            X-Sync-Code: User's sync code.
        
        Request Body (JSON):
            listing_id (int): ID of the listing.
            action_type (str): 'view', 'click', 'save', 'dismiss', 'contact'.
            duration_seconds (int): Optional time spent (for views).
        
        Returns:
            JSON response confirming the interaction.
        """
        from models import UserInteraction, LearnedPreference, BrandAffinity
        
        sync_code = request.headers.get('X-Sync-Code', '').strip()
        if not sync_code:
            return jsonify({'error': 'X-Sync-Code header is required'}), 400
        
        data = request.get_json() or {}
        listing_id = data.get('listing_id')
        action_type = data.get('action_type', '').strip().lower()
        duration_seconds = data.get('duration_seconds')
        
        if not listing_id:
            return jsonify({'error': 'listing_id is required'}), 400
        
        valid_actions = {'view', 'click', 'save', 'dismiss', 'contact'}
        if action_type not in valid_actions:
            return jsonify({'error': f'action_type must be one of: {valid_actions}'}), 400
        
        # Check listing exists
        listing = Listing.query.get(listing_id)
        if not listing:
            return jsonify({'error': 'Listing not found'}), 404
        
        # Log interaction
        interaction = UserInteraction(
            sync_code=sync_code,
            listing_id=listing_id,
            action_type=action_type,
            duration_seconds=duration_seconds
        )
        db.session.add(interaction)
        
        # Use enhanced ML learning
        from ml_learning import learn_from_interaction
        learning_result = learn_from_interaction(
            interaction=interaction,
            listing=listing,
            db_session=db.session,
            LearnedPreferenceModel=LearnedPreference,
            BrandAffinityModel=BrandAffinity,
        )
        
        db.session.commit()
        
        return jsonify({
            'data': interaction.to_dict(),
            'learning': {
                'keywords_updated': len(learning_result.get('updated_keywords', [])),
                'brands_updated': len(learning_result.get('updated_brands', [])),
                'base_weight': learning_result.get('base_weight', 0),
            },
            'message': 'Interaction logged and learning applied'
        }), 201
    
    @app.route('/api/v1/learned-profile', methods=['GET'])
    def get_learned_profile():
        """
        Get the user's learned preferences (ML-adjusted weights).
        
        Headers:
            X-Sync-Code: User's sync code.
        
        Query Parameters:
            include_stats (bool): Include interaction statistics.
        
        Returns:
            JSON response with learned keyword weights, brand affinities,
            and optionally interaction statistics.
        """
        from models import LearnedPreference, BrandAffinity, UserInteraction
        from ml_learning import (
            get_effective_learned_weights,
            get_effective_brand_affinities,
            calculate_confidence,
            analyze_interaction_patterns,
        )
        
        sync_code = request.headers.get('X-Sync-Code', '').strip()
        if not sync_code:
            return jsonify({'error': 'X-Sync-Code header is required'}), 400
        
        include_stats = request.args.get('include_stats', 'false').lower() == 'true'
        
        # Get raw learned preferences
        learned_prefs = LearnedPreference.query.filter_by(sync_code=sync_code).order_by(
            LearnedPreference.learned_weight.desc()
        ).limit(50).all()
        
        brand_affs = BrandAffinity.query.filter_by(sync_code=sync_code).order_by(
            BrandAffinity.affinity_score.desc()
        ).all()
        
        # Get effective weights with time decay and confidence
        effective_keywords = get_effective_learned_weights(
            sync_code, LearnedPreference, apply_decay=True
        )
        effective_brands = get_effective_brand_affinities(
            sync_code, BrandAffinity, apply_decay=True
        )
        
        response_data = {
            'learned_keywords': [
                {
                    'keyword': lp.keyword,
                    'raw_weight': round(lp.learned_weight or 0, 3),
                    'effective_weight': round(effective_keywords.get(lp.keyword, 0), 3),
                    'confidence': round(calculate_confidence(lp.interaction_count or 0), 2),
                    'interactions': lp.interaction_count or 0,
                    'last_updated': lp.last_updated.isoformat() if lp.last_updated else None,
                }
                for lp in learned_prefs
            ],
            'brand_affinities': [
                {
                    'brand': ba.brand,
                    'raw_affinity': round(ba.affinity_score or 0, 3),
                    'effective_affinity': round(effective_brands.get(ba.brand, 0), 3),
                    'confidence': round(calculate_confidence(ba.interaction_count or 0), 2),
                    'interactions': ba.interaction_count or 0,
                    'last_updated': ba.last_updated.isoformat() if ba.last_updated else None,
                }
                for ba in brand_affs
            ]
        }
        
        # Add statistics if requested
        if include_stats:
            response_data['statistics'] = analyze_interaction_patterns(
                sync_code, UserInteraction, days=30
            )
        
        return jsonify({'data': response_data})
    
    # Error handlers
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': 'Bad request', 'message': str(error)}), 400
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found', 'message': 'Resource not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error', 'message': 'An unexpected error occurred'}), 500


# Create application instance
app = create_app()

# Don't auto-init DB here - use init_db.py script instead


if __name__ == '__main__':
    # Only init DB when running directly for development
    init_db(app)
    app.run(debug=True, port=5000)
