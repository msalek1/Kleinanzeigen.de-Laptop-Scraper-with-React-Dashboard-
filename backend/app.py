"""
Flask application entrypoint for the Kleinanzeigen Notebook Scraper API.

Exposes REST endpoints for listing retrieval, filtering, and scraper management.
"""

import logging
from datetime import datetime
from functools import wraps
from typing import Any, Dict, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import or_

from config import get_config
from models import db, Listing, ScraperJob, ScraperConfig
from scraper import KleinanzeigenScraper

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
        
        # Sorting
        sort_field = request.args.get('sort', 'scraped_at')
        sort_order = request.args.get('order', 'desc')
        
        sort_column = {
            'price': Listing.price_eur,
            'posted_at': Listing.posted_at,
            'scraped_at': Listing.scraped_at,
            'title': Listing.title,
        }.get(sort_field, Listing.scraped_at)
        
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
    
    # Scraper endpoints
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
        
        Note:
            In production, this should require admin authentication.
            The actual scraping runs synchronously for simplicity;
            consider using Celery for background processing.
        """
        data = request.get_json() or {}
        
        # Get admin config for scraper settings
        admin_config = ScraperConfig.get_config()
        
        page_limit = data.get('page_limit', admin_config.page_limit)
        
        # Parse keywords into list (each will be searched separately)
        keywords_raw = admin_config.keywords.strip() if admin_config.keywords else ''
        keywords_list = [k.strip() for k in keywords_raw.split(',') if k.strip()]
        
        # Get city and category settings
        city_slug = admin_config.city.strip() if admin_config.city else ''
        category = admin_config.categories.split(',')[0].strip() if admin_config.categories else 'c278'
        
        # Build base URL (without keywords)
        if city_slug:
            base_url_template = f"https://www.kleinanzeigen.de/s-notebooks/{city_slug}/{category}"
        else:
            base_url_template = f"https://www.kleinanzeigen.de/s-notebooks/{category}"
        
        # Create job record
        job = ScraperJob(status='running', started_at=datetime.utcnow())
        db.session.add(job)
        db.session.commit()
        
        try:
            # Track listings by external_id with their keywords
            listings_by_id = {}  # {external_id: {'data': listing_data, 'keywords': set()}}
            total_pages_scraped = 0
            keywords_processed = []
            
            # If no keywords, scrape base URL once
            if not keywords_list:
                keywords_list = ['']  # Empty string = no keyword filter
            
            for keyword in keywords_list:
                # Build URL for this keyword
                if keyword:
                    # URL encode the keyword (spaces become +)
                    keyword_encoded = keyword.replace(' ', '+')
                    scrape_url = f"{base_url_template}?keywords={keyword_encoded}"
                    keywords_processed.append(keyword)
                else:
                    scrape_url = base_url_template
                
                logger.info(f"Scraping keyword: '{keyword}' - URL: {scrape_url}")
                
                try:
                    # Initialize scraper for this keyword
                    scraper = KleinanzeigenScraper(
                        base_url=scrape_url,
                        delay_seconds=app.config['SCRAPER_DELAY_SECONDS'],
                        page_limit=page_limit,
                        browser_type=app.config['PLAYWRIGHT_BROWSER'],
                    )
                    
                    # Run scraper for this keyword
                    listings_data = scraper.scrape()
                    total_pages_scraped += page_limit
                    
                    # Track listings and their associated keywords
                    for listing in listings_data:
                        ext_id = listing.get('external_id')
                        if ext_id:
                            if ext_id not in listings_by_id:
                                # First time seeing this listing
                                listings_by_id[ext_id] = {
                                    'data': listing,
                                    'keywords': set()
                                }
                            # Add this keyword to the listing's keyword set
                            if keyword:
                                listings_by_id[ext_id]['keywords'].add(keyword)
                    
                    logger.info(f"Keyword '{keyword}': found {len(listings_data)} listings, {len(listings_by_id)} unique total")
                    
                except Exception as e:
                    logger.error(f"Error scraping keyword '{keyword}': {e}")
                    # Continue with next keyword instead of failing entire job
                    continue
            
            # Process all collected results (now unique by external_id)
            new_count = 0
            updated_count = 0
            
            for ext_id, listing_info in listings_by_id.items():
                listing_data = listing_info['data']
                keywords_set = listing_info['keywords']
                keywords_str = ','.join(sorted(keywords_set)) if keywords_set else ''
                
                existing = Listing.query.filter_by(
                    external_id=ext_id
                ).first()
                
                if existing:
                    # Update existing listing
                    existing.title = listing_data['title']
                    existing.price_eur = int(listing_data['price'] * 100) if listing_data['price'] else None
                    existing.price_negotiable = listing_data['price_negotiable']
                    existing.location_city = listing_data['city']
                    existing.location_state = listing_data['state']
                    existing.description = listing_data['description']
                    existing.condition = listing_data['condition']
                    existing.image_url = listing_data['image_url']
                    existing.updated_at = datetime.utcnow()
                    # Merge keywords: add new keywords to existing ones
                    if existing.search_keywords:
                        existing_keywords = set(k.strip() for k in existing.search_keywords.split(',') if k.strip())
                        merged_keywords = existing_keywords | keywords_set
                        existing.search_keywords = ','.join(sorted(merged_keywords))
                    else:
                        existing.search_keywords = keywords_str
                    updated_count += 1
                else:
                    # Create new listing with keywords
                    new_listing = Listing.from_scraped_dict(listing_data)
                    new_listing.search_keywords = keywords_str
                    db.session.add(new_listing)
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
            
            keywords_summary = ', '.join(keywords_processed) if keywords_processed else 'all'
            logger.info(f"Scraper job {job.id} completed: {new_count} new, {updated_count} updated (keywords: {keywords_summary})")
            
            return jsonify({
                'data': job.to_dict(),
                'message': f'Scraping completed for {len(keywords_processed)} keyword(s). {new_count} new listings, {updated_count} updated.',
                'keywords_processed': keywords_processed
            }), 201
            
        except Exception as e:
            logger.error(f"Scraper job {job.id} failed: {e}")
            job.status = 'failed'
            job.completed_at = datetime.utcnow()
            job.error_message = str(e)
            db.session.commit()
            
            return jsonify({
                'data': job.to_dict(),
                'error': str(e)
            }), 500
    
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
        # Predefined categories relevant to notebook scraping
        categories = [
            {'code': 'c278', 'name': 'Notebooks', 'description': 'Notebook/Laptop computers'},
            {'code': 'c225', 'name': 'PCs', 'description': 'Desktop computers'},
            {'code': 'c285', 'name': 'Tablets & Reader', 'description': 'Tablets and E-Readers'},
            {'code': 'c161', 'name': 'Elektronik', 'description': 'All electronics'},
            {'code': 'c228', 'name': 'PC Zubehör & Software', 'description': 'PC accessories and software'},
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
