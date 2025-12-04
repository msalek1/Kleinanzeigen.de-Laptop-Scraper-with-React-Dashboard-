"""
Tests for database models.
"""

import pytest
from datetime import datetime
from models import db, Listing, ScraperJob


class TestListingModel:
    """Tests for the Listing model."""
    
    def test_create_listing(self, app):
        """Should create a listing with all fields."""
        with app.app_context():
            listing = Listing(
                external_id='test123',
                url='https://example.com/listing',
                title='Test Laptop',
                price_eur=50000,
                price_negotiable=True,
                location_city='Berlin',
            )
            db.session.add(listing)
            db.session.commit()
            
            saved = Listing.query.filter_by(external_id='test123').first()
            assert saved is not None
            assert saved.title == 'Test Laptop'
            assert saved.price_eur == 50000
    
    def test_listing_to_dict(self, app):
        """Should convert listing to dictionary correctly."""
        with app.app_context():
            listing = Listing(
                external_id='dict123',
                url='https://example.com/listing',
                title='Test Laptop',
                price_eur=75000,  # 750.00 EUR
                price_negotiable=True,
                location_city='Munich',
                location_state='Bavaria',
            )
            db.session.add(listing)
            db.session.commit()
            
            data = listing.to_dict()
            
            assert data['external_id'] == 'dict123'
            assert data['price_eur'] == 750.0  # Converted from cents
            assert data['price_negotiable'] == True
            assert data['location']['city'] == 'Munich'
            assert data['location']['state'] == 'Bavaria'
    
    def test_listing_from_scraped_dict(self, app):
        """Should create listing from scraped data dictionary."""
        with app.app_context():
            scraped_data = {
                'external_id': 'scraped123',
                'url': 'https://example.com/scraped',
                'title': 'Scraped Laptop',
                'price': 899.99,
                'price_negotiable': False,
                'city': 'Hamburg',
                'state': None,
                'description': 'Great laptop',
                'condition': 'Neu',
                'posted_at': datetime(2024, 1, 15),
                'image_url': 'https://example.com/img.jpg',
                'seller_type': 'private',
            }
            
            listing = Listing.from_scraped_dict(scraped_data)
            db.session.add(listing)
            db.session.commit()
            
            assert listing.external_id == 'scraped123'
            assert listing.price_eur == 89999  # Converted to cents
            assert listing.location_city == 'Hamburg'
    
    def test_listing_unique_external_id(self, app):
        """Should enforce unique external_id constraint."""
        with app.app_context():
            listing1 = Listing(
                external_id='unique123',
                url='https://example.com/1',
                title='Laptop 1',
            )
            listing2 = Listing(
                external_id='unique123',  # Same ID
                url='https://example.com/2',
                title='Laptop 2',
            )
            
            db.session.add(listing1)
            db.session.commit()
            
            db.session.add(listing2)
            with pytest.raises(Exception):  # IntegrityError
                db.session.commit()


class TestScraperJobModel:
    """Tests for the ScraperJob model."""
    
    def test_create_scraper_job(self, app):
        """Should create a scraper job."""
        with app.app_context():
            job = ScraperJob(status='pending')
            db.session.add(job)
            db.session.commit()
            
            saved = ScraperJob.query.first()
            assert saved is not None
            assert saved.status == 'pending'
    
    def test_scraper_job_to_dict(self, app):
        """Should convert job to dictionary correctly."""
        with app.app_context():
            job = ScraperJob(
                status='completed',
                pages_scraped=5,
                listings_found=100,
                listings_new=80,
                listings_updated=20,
            )
            db.session.add(job)
            db.session.commit()
            
            data = job.to_dict()
            
            assert data['status'] == 'completed'
            assert data['pages_scraped'] == 5
            assert data['listings_found'] == 100
            assert data['listings_new'] == 80
            assert data['listings_updated'] == 20
    
    def test_scraper_job_timestamps(self, app):
        """Should track timestamps correctly."""
        with app.app_context():
            job = ScraperJob(status='running')
            job.started_at = datetime.utcnow()
            db.session.add(job)
            db.session.commit()
            
            assert job.created_at is not None
            assert job.started_at is not None
