"""
Pytest configuration and fixtures for backend tests.
"""

import pytest
from app import create_app
from models import db, Listing, ScraperJob
from config import TestingConfig


@pytest.fixture
def app():
    """Create application instance for testing."""
    app = create_app(TestingConfig())
    
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def sample_listing(app):
    """Create a sample listing for testing."""
    with app.app_context():
        listing = Listing(
            external_id='123456789',
            url='https://www.kleinanzeigen.de/s-anzeige/test-laptop/123456789',
            title='Test Laptop - Dell XPS 15',
            price_eur=75000,  # 750.00 EUR in cents
            price_negotiable=True,
            location_city='Berlin',
            location_state='Berlin',
            description='Great laptop in excellent condition',
            condition='Gebraucht',
            image_url='https://example.com/image.jpg',
        )
        db.session.add(listing)
        db.session.commit()
        
        # Re-query to get the ID
        listing = Listing.query.filter_by(external_id='123456789').first()
        yield listing


@pytest.fixture
def sample_listings(app):
    """Create multiple sample listings for pagination testing."""
    with app.app_context():
        listings = []
        for i in range(25):
            listing = Listing(
                external_id=f'10000000{i:02d}',
                url=f'https://www.kleinanzeigen.de/s-anzeige/laptop-{i}/10000000{i:02d}',
                title=f'Laptop {i} - Test Model',
                price_eur=50000 + (i * 1000),  # Varying prices
                price_negotiable=i % 2 == 0,
                location_city=['Berlin', 'Munich', 'Hamburg'][i % 3],
                description=f'Description for laptop {i}',
                condition='Neu' if i % 2 == 0 else 'Gebraucht',
            )
            listings.append(listing)
            db.session.add(listing)
        
        db.session.commit()
        yield listings


# Sample HTML fixtures for scraper tests
SAMPLE_LISTING_HTML = '''
<article class="aditem">
    <div class="aditem-main">
        <div class="aditem-main--top">
            <div class="aditem-main--top--left">12345 Berlin</div>
            <div class="aditem-main--top--right">Heute, 14:30</div>
        </div>
        <div class="aditem-main--middle">
            <h2>
                <a class="ellipsis" href="/s-anzeige/dell-xps-15-laptop/987654321-278">
                    Dell XPS 15 Laptop - 16GB RAM, 512GB SSD
                </a>
            </h2>
            <div class="aditem-main--middle--description">
                Excellent condition laptop, barely used. Comes with charger.
            </div>
            <div class="aditem-main--middle--price-shipping--price">850 € VB</div>
            <div class="aditem-main--middle--tags">
                <span class="simpletag">Gebraucht</span>
            </div>
        </div>
    </div>
    <div class="imagebox">
        <img src="https://example.com/laptop.jpg" alt="Dell XPS 15">
    </div>
</article>
'''

SAMPLE_PAGE_HTML = f'''
<!DOCTYPE html>
<html>
<head><title>Notebooks - Kleinanzeigen</title></head>
<body>
    <div class="l-container">
        {SAMPLE_LISTING_HTML}
        {SAMPLE_LISTING_HTML.replace('987654321', '123123123').replace('Dell XPS', 'MacBook Pro')}
    </div>
</body>
</html>
'''
