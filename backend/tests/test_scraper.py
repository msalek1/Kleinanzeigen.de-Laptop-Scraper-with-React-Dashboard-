"""
Tests for the scraper module.

These tests use saved HTML fixtures to verify selector accuracy
without making live requests to Kleinanzeigen.
"""

import pytest
from bs4 import BeautifulSoup
from scraper import KleinanzeigenScraper, SELECTORS
from tests.conftest import SAMPLE_LISTING_HTML, SAMPLE_PAGE_HTML


class TestPriceExtraction:
    """Tests for price parsing logic."""
    
    def test_extract_price_with_euro_symbol(self):
        """Should extract price with euro symbol."""
        scraper = KleinanzeigenScraper()
        
        price, negotiable = scraper._extract_price("450 €")
        assert price == 450.0
        assert negotiable == False
    
    def test_extract_price_with_vb(self):
        """Should detect negotiable prices (VB)."""
        scraper = KleinanzeigenScraper()
        
        price, negotiable = scraper._extract_price("850 € VB")
        assert price == 850.0
        assert negotiable == True
    
    def test_extract_price_vb_only(self):
        """Should handle VB without price."""
        scraper = KleinanzeigenScraper()
        
        price, negotiable = scraper._extract_price("VB")
        assert price is None
        assert negotiable == True
    
    def test_extract_price_german_format(self):
        """Should handle German number format (1.234,56)."""
        scraper = KleinanzeigenScraper()
        
        price, negotiable = scraper._extract_price("1.250 €")
        assert price == 1250.0
        assert negotiable == False
    
    def test_extract_price_empty(self):
        """Should handle empty price string."""
        scraper = KleinanzeigenScraper()
        
        price, negotiable = scraper._extract_price("")
        assert price is None
        assert negotiable == False
    
    def test_extract_price_none(self):
        """Should handle None price."""
        scraper = KleinanzeigenScraper()
        
        price, negotiable = scraper._extract_price(None)
        assert price is None
        assert negotiable == False


class TestLocationParsing:
    """Tests for location extraction."""
    
    def test_parse_location_with_postal_code(self):
        """Should extract city from location with postal code."""
        scraper = KleinanzeigenScraper()
        
        city, state = scraper._parse_location("12345 Berlin")
        assert city == "Berlin"
        assert state is None
    
    def test_parse_location_city_only(self):
        """Should handle city without postal code."""
        scraper = KleinanzeigenScraper()
        
        city, state = scraper._parse_location("München")
        assert city == "München"
        assert state is None
    
    def test_parse_location_with_state(self):
        """Should extract city and state when comma-separated."""
        scraper = KleinanzeigenScraper()
        
        city, state = scraper._parse_location("80331 München, Bayern")
        assert city == "München"
        assert state == "Bayern"
    
    def test_parse_location_empty(self):
        """Should handle empty location."""
        scraper = KleinanzeigenScraper()
        
        city, state = scraper._parse_location("")
        assert city is None
        assert state is None


class TestExternalIdExtraction:
    """Tests for listing ID extraction from URLs."""
    
    def test_extract_external_id_from_url(self):
        """Should extract listing ID from URL."""
        scraper = KleinanzeigenScraper()
        
        external_id = scraper._extract_external_id(
            "/s-anzeige/dell-laptop/987654321-278-1234"
        )
        assert external_id == "987654321"
    
    def test_extract_external_id_full_url(self):
        """Should handle full URLs."""
        scraper = KleinanzeigenScraper()
        
        external_id = scraper._extract_external_id(
            "https://www.kleinanzeigen.de/s-anzeige/laptop/123456789"
        )
        assert external_id == "123456789"


class TestDateParsing:
    """Tests for date parsing logic."""
    
    def test_parse_date_heute(self):
        """Should parse 'Heute' as today."""
        scraper = KleinanzeigenScraper()
        
        date = scraper._parse_date("Heute, 14:30")
        assert date is not None
    
    def test_parse_date_gestern(self):
        """Should parse 'Gestern' as yesterday."""
        scraper = KleinanzeigenScraper()
        
        date = scraper._parse_date("Gestern, 10:00")
        assert date is not None
    
    def test_parse_date_absolute(self):
        """Should parse absolute dates."""
        scraper = KleinanzeigenScraper()
        
        date = scraper._parse_date("01.12.2024")
        assert date is not None
        assert date.day == 1
        assert date.month == 12
        assert date.year == 2024
    
    def test_parse_date_empty(self):
        """Should handle empty date string."""
        scraper = KleinanzeigenScraper()
        
        date = scraper._parse_date("")
        assert date is None


class TestListingParsing:
    """Tests for full listing HTML parsing."""
    
    def test_parse_listing_from_html(self):
        """Should correctly parse a listing from HTML fixture."""
        scraper = KleinanzeigenScraper()
        soup = BeautifulSoup(SAMPLE_LISTING_HTML, 'html.parser')
        article = soup.find('article', class_='aditem')
        
        listing = scraper._parse_listing(article, 'https://www.kleinanzeigen.de')
        
        assert listing is not None
        assert listing['external_id'] == '987654321'
        assert 'Dell XPS 15' in listing['title']
        assert listing['price'] == 850.0
        assert listing['price_negotiable'] == True
        assert listing['city'] == 'Berlin'
        assert 'Excellent condition' in listing['description']
        assert listing['condition'] == 'Gebraucht'
    
    def test_parse_listing_extracts_url(self):
        """Should extract full URL from listing."""
        scraper = KleinanzeigenScraper()
        soup = BeautifulSoup(SAMPLE_LISTING_HTML, 'html.parser')
        article = soup.find('article', class_='aditem')
        
        listing = scraper._parse_listing(article, 'https://www.kleinanzeigen.de')
        
        assert listing['url'].startswith('https://www.kleinanzeigen.de')
        assert '987654321' in listing['url']


class TestSelectors:
    """Tests to verify CSS selectors work with expected HTML structure."""
    
    def test_listing_item_selector(self):
        """Listing item selector should find articles."""
        soup = BeautifulSoup(SAMPLE_PAGE_HTML, 'html.parser')
        items = soup.select(SELECTORS['listing_item'])
        
        assert len(items) == 2
    
    def test_title_selector(self):
        """Title selector should find title links."""
        soup = BeautifulSoup(SAMPLE_LISTING_HTML, 'html.parser')
        title = soup.select_one(SELECTORS['title'])
        
        assert title is not None
        assert 'Dell XPS 15' in title.get_text()
    
    def test_price_selector(self):
        """Price selector should find price element."""
        soup = BeautifulSoup(SAMPLE_LISTING_HTML, 'html.parser')
        price = soup.select_one(SELECTORS['price'])
        
        assert price is not None
        assert '850' in price.get_text()


class TestScraperConfiguration:
    """Tests for scraper configuration and initialization."""
    
    def test_default_configuration(self):
        """Should use default configuration values."""
        scraper = KleinanzeigenScraper()
        
        assert scraper.delay_seconds >= 2.0  # Minimum enforced
        assert scraper.page_limit == 5
        assert scraper.browser_type == 'chromium'
    
    def test_custom_configuration(self):
        """Should accept custom configuration."""
        scraper = KleinanzeigenScraper(
            base_url='https://example.com',
            delay_seconds=5.0,
            page_limit=10,
            browser_type='firefox',
        )
        
        assert scraper.base_url == 'https://example.com'
        assert scraper.delay_seconds == 5.0
        assert scraper.page_limit == 10
        assert scraper.browser_type == 'firefox'
    
    def test_minimum_delay_enforced(self):
        """Should enforce minimum delay of 2 seconds."""
        scraper = KleinanzeigenScraper(delay_seconds=0.5)
        
        assert scraper.delay_seconds >= 2.0
