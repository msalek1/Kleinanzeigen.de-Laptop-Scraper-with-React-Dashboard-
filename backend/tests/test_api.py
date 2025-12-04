"""
Tests for Flask API endpoints.
"""

import pytest
import json


class TestHealthEndpoint:
    """Tests for the health check endpoint."""
    
    def test_health_check_returns_200(self, client):
        """Health check should return 200 OK with status."""
        response = client.get('/api/health')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'healthy'
        assert 'timestamp' in data


class TestListingsEndpoint:
    """Tests for the listings API endpoints."""
    
    def test_get_listings_empty(self, client):
        """Should return empty list when no listings exist."""
        response = client.get('/api/v1/listings')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['data'] == []
        assert data['pagination']['total_items'] == 0
    
    def test_get_listings_with_data(self, client, sample_listing):
        """Should return listings when data exists."""
        response = client.get('/api/v1/listings')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data['data']) == 1
        assert data['data'][0]['title'] == 'Test Laptop - Dell XPS 15'
        assert data['data'][0]['price_eur'] == 750.0  # Converted from cents
    
    def test_get_listings_pagination(self, client, sample_listings):
        """Should paginate listings correctly."""
        # First page
        response = client.get('/api/v1/listings?page=1&per_page=10')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert len(data['data']) == 10
        assert data['pagination']['page'] == 1
        assert data['pagination']['total_items'] == 25
        assert data['pagination']['has_next'] == True
        
        # Second page
        response = client.get('/api/v1/listings?page=2&per_page=10')
        data = json.loads(response.data)
        
        assert len(data['data']) == 10
        assert data['pagination']['page'] == 2
    
    def test_get_listings_search(self, client, sample_listings):
        """Should filter listings by search query."""
        response = client.get('/api/v1/listings?q=Laptop%205')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        # Should match "Laptop 5" title
        assert len(data['data']) >= 1
    
    def test_get_listings_price_filter(self, client, sample_listings):
        """Should filter listings by price range."""
        response = client.get('/api/v1/listings?min_price=600&max_price=700')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        for listing in data['data']:
            assert listing['price_eur'] is None or (600 <= listing['price_eur'] <= 700)
    
    def test_get_listings_location_filter(self, client, sample_listings):
        """Should filter listings by location."""
        response = client.get('/api/v1/listings?location=Berlin')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        for listing in data['data']:
            assert 'Berlin' in listing['location']['city']
    
    def test_get_listings_sorting(self, client, sample_listings):
        """Should sort listings by specified field."""
        response = client.get('/api/v1/listings?sort=price&order=asc')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        prices = [l['price_eur'] for l in data['data'] if l['price_eur'] is not None]
        assert prices == sorted(prices)
    
    def test_get_single_listing(self, client, sample_listing):
        """Should return a single listing by ID."""
        response = client.get(f'/api/v1/listings/{sample_listing.id}')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['data']['external_id'] == '123456789'
    
    def test_get_single_listing_not_found(self, client):
        """Should return 404 for non-existent listing."""
        response = client.get('/api/v1/listings/99999')
        
        assert response.status_code == 404


class TestStatsEndpoint:
    """Tests for the statistics endpoint."""
    
    def test_get_stats_empty(self, client):
        """Should return zero stats when no listings exist."""
        response = client.get('/api/v1/stats')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['data']['total_listings'] == 0
        assert data['data']['average_price'] is None
    
    def test_get_stats_with_data(self, client, sample_listings):
        """Should return correct statistics."""
        response = client.get('/api/v1/stats')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['data']['total_listings'] == 25
        assert data['data']['average_price'] is not None
        assert data['data']['min_price'] is not None
        assert data['data']['max_price'] is not None
        assert len(data['data']['listings_by_city']) > 0


class TestScraperEndpoints:
    """Tests for scraper job management endpoints."""
    
    def test_get_scraper_jobs_empty(self, client):
        """Should return empty list when no jobs exist."""
        response = client.get('/api/v1/scraper/jobs')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['data'] == []
    
    def test_get_scraper_job_not_found(self, client):
        """Should return 404 for non-existent job."""
        response = client.get('/api/v1/scraper/jobs/99999')
        
        assert response.status_code == 404


class TestErrorHandling:
    """Tests for error handling."""
    
    def test_404_handler(self, client):
        """Should return JSON error for 404."""
        response = client.get('/api/v1/nonexistent')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert 'error' in data
