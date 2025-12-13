"""
Kleinanzeigen notebook listings scraper module.

Uses Playwright for JavaScript rendering and BeautifulSoup for HTML parsing.
Implements rate limiting, robots.txt compliance, and polite backoff strategies.
"""

import hashlib
import logging
import random
import re
import time
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, Page, Browser

logger = logging.getLogger(__name__)

# Centralized CSS selectors for Kleinanzeigen listings
# Update these when site markup changes
SELECTORS = {
    'listing_item': 'article.aditem',
    'title': 'a.ellipsis',
    'price': '.aditem-main--middle--price-shipping--price',
    'location': '.aditem-main--top--left',
    'description': '.aditem-main--middle--description',
    'image': '.imagebox img, .galleryimage img',
    'posted_date': '.aditem-main--top--right',
    'condition': '.aditem-main--middle--tags .simpletag',
}

# Default User-Agent for scraping requests
DEFAULT_USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
)


class RobotsChecker:
    """
    Utility class to check robots.txt compliance.
    
    Verifies that scraping is allowed for the target URL before proceeding.
    """
    
    def __init__(self, base_url: str):
        """
        Initialize robots.txt checker for a base URL.
        
        Args:
            base_url: The base URL of the site to check.
        """
        self.base_url = base_url
        self.parsed = urlparse(base_url)
        self.robots_url = f"{self.parsed.scheme}://{self.parsed.netloc}/robots.txt"
        self._parser: Optional[RobotFileParser] = None
        self._fetched = False
    
    def fetch_robots(self, page: Page) -> None:
        """
        Fetch and parse robots.txt from the target site.
        
        Args:
            page: Playwright page instance to use for fetching.
        """
        try:
            response = page.goto(self.robots_url, wait_until='domcontentloaded', timeout=30000)
            if not response:
                logger.warning(f"Could not fetch robots.txt: No response from {self.robots_url}")
                self._fetched = False
                return

            if not response.ok:
                logger.warning(f"Could not fetch robots.txt: HTTP {response.status} from {self.robots_url}")
                self._fetched = False
                return

            robots_text = response.text()
            parser = RobotFileParser()
            parser.parse(robots_text.splitlines())
            self._parser = parser
            self._fetched = True
            logger.info(f"Successfully fetched robots.txt from {self.robots_url}")
        except Exception as e:
            logger.warning(f"Error fetching robots.txt: {e}")
            self._fetched = False
    
    def is_allowed(self, url_or_path: str) -> bool:
        """
        Check if scraping a specific path is allowed.
        
        Args:
            url_or_path: URL or path to check (e.g., '/s-notebooks/c278').
        
        Returns:
            bool: True if scraping is allowed, False otherwise.
        """
        if not self._fetched or not self._parser:
            logger.warning("robots.txt not fetched/parsed, assuming allowed")
            return True
        
        # RobotFileParser works on URLs; normalize if caller passed a path.
        if url_or_path.startswith('http://') or url_or_path.startswith('https://'):
            url = url_or_path
        else:
            url = f"{self.parsed.scheme}://{self.parsed.netloc}{url_or_path}"

        allowed = self._parser.can_fetch('*', url)
        if not allowed:
            logger.warning(f"Disallowed by robots.txt: {url_or_path}")
        return allowed


class KleinanzeigenScraper:
    """
    Scraper for Kleinanzeigen notebook listings.
    
    Uses Playwright for rendering JavaScript-heavy pages and BeautifulSoup
    for parsing the HTML. Implements polite scraping with rate limiting
    and robots.txt compliance.
    
    Attributes:
        base_url: Base URL for notebook listings.
        delay_seconds: Delay between page requests.
        page_limit: Maximum pages to scrape per run.
        browser_type: Playwright browser to use (chromium, firefox, webkit).
    """
    
    def __init__(
        self,
        base_url: str = 'https://www.kleinanzeigen.de/s-notebooks/c278',
        delay_seconds: float = 3.0,
        page_limit: int = 5,
        browser_type: str = 'chromium',
        proxy: Optional[Dict[str, str]] = None,
    ):
        """
        Initialize the scraper with configuration.
        
        Args:
            base_url: Base URL for notebook category listings.
            delay_seconds: Minimum delay between page requests (2-5 recommended).
            page_limit: Maximum number of pages to scrape per run.
            browser_type: Playwright browser type ('chromium', 'firefox', 'webkit').
            proxy: Optional proxy configuration dict with 'server', 'username', 'password'.
        """
        self.base_url = base_url
        self.delay_seconds = max(delay_seconds, 2.0)  # Enforce minimum delay
        self.page_limit = page_limit
        self.browser_type = browser_type
        self.proxy = proxy
        self._browser: Optional[Browser] = None
        self._robots_checker: Optional[RobotsChecker] = None

    @staticmethod
    def build_page_url(base_url: str, page_num: int) -> str:
        """
        Build the correct pagination URL for Kleinanzeigen.

        Supports base URLs with query params by inserting the page segment
        before the query string.
        """
        if page_num <= 1:
            return base_url

        if '?' in base_url:
            base_part, query_part = base_url.split('?', 1)
            base_part = base_part.rstrip('/')
            return f"{base_part}/seite:{page_num}/?{query_part}"

        base_part = base_url.rstrip('/')
        return f"{base_part}/seite:{page_num}/"

    @contextmanager
    def open_page(self) -> Page:
        """Open a single Playwright page (browser+context) for reuse across many scrapes."""
        with sync_playwright() as p:
            browser_launcher = getattr(p, self.browser_type)
            launch_options = {'headless': True}
            if self.proxy:
                launch_options['proxy'] = self.proxy

            browser = browser_launcher.launch(**launch_options)
            context = browser.new_context(
                user_agent=DEFAULT_USER_AGENT,
                viewport={'width': 1920, 'height': 1080},
                locale='de-DE',
                timezone_id='Europe/Berlin',
                extra_http_headers={
                    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
                },
            )
            page = context.new_page()
            page.set_default_timeout(30000)

            try:
                yield page
            finally:
                browser.close()
    
    def _extract_price(self, price_text: Optional[str]) -> tuple[Optional[float], bool]:
        """
        Extract numeric price and negotiable flag from price text.
        
        Args:
            price_text: Raw price text (e.g., "450 € VB", "1.200 €", "VB").
        
        Returns:
            Tuple of (price_in_euros, is_negotiable).
            Price is None if not specified or "VB" only.
        """
        if not price_text:
            return None, False
        
        text = price_text.strip()
        upper = text.upper()
        is_negotiable = bool(re.search(r'\bVB\b', upper)) or 'VERHANDLUNGSBASIS' in upper

        # Common non-numeric price labels
        if 'ZU VERSCHENKEN' in upper or 'VERSCHENKE' in upper:
            return 0.0, is_negotiable

        # Extract first number-like token and normalize German formatting.
        match = re.search(r'(\d[\d\.\,\s]*)', upper)
        if not match:
            return None, is_negotiable

        numeric = match.group(1)
        numeric = numeric.replace(' ', '').replace('.', '').replace(',', '.')
        try:
            return float(numeric), is_negotiable
        except ValueError:
            return None, is_negotiable
    
    def _extract_external_id(self, url: str) -> str:
        """
        Extract Kleinanzeigen listing ID from URL.
        
        Args:
            url: Full or partial listing URL.
        
        Returns:
            str: External listing ID.
        """
        # URLs like /s-anzeige/laptop-dell-xps/1234567890-278-1234
        match = re.search(r'/(\d{9,})(?:-[\d-]+)?(?:/|$|\?)', url)
        if match:
            return match.group(1)
        # Fallback: deterministic ID from the URL (stable across runs)
        return hashlib.sha256(url.encode('utf-8')).hexdigest()[:32]
    
    def _parse_listing(self, article: BeautifulSoup, base_url: str) -> Optional[Dict[str, Any]]:
        """
        Parse a single listing article element into a dictionary.
        
        Args:
            article: BeautifulSoup element for the listing article.
            base_url: Base URL for resolving relative links.
        
        Returns:
            Dict with listing data, or None if parsing failed.
        """
        try:
            # Extract title and URL
            title_elem = article.select_one(SELECTORS['title'])
            if not title_elem:
                logger.warning("Could not find title element")
                return None
            
            title = title_elem.get_text(strip=True)
            href = title_elem.get('href', '')
            url = urljoin(base_url, href) if href else ''
            
            if not url:
                logger.warning("Could not extract listing URL")
                return None
            
            # Extract external ID
            external_id = self._extract_external_id(url)
            
            # Extract price
            price_elem = article.select_one(SELECTORS['price'])
            price_text = price_elem.get_text(strip=True) if price_elem else ''
            price, price_negotiable = self._extract_price(price_text)
            
            # Extract location
            location_elem = article.select_one(SELECTORS['location'])
            location_text = location_elem.get_text(strip=True) if location_elem else ''
            city, state = self._parse_location(location_text)
            
            # Extract description
            desc_elem = article.select_one(SELECTORS['description'])
            description = desc_elem.get_text(strip=True) if desc_elem else None
            
            # Extract image URL
            img_elem = article.select_one(SELECTORS['image'])
            image_url = None
            if img_elem:
                image_url = img_elem.get('src') or img_elem.get('data-src')
            
            # Extract posted date
            date_elem = article.select_one(SELECTORS['posted_date'])
            posted_at = self._parse_date(date_elem.get_text(strip=True) if date_elem else '')
            
            # Extract condition tags
            condition = None
            tag_elems = article.select(SELECTORS['condition'])
            for tag in tag_elems:
                tag_text = tag.get_text(strip=True).lower()
                if 'neu' in tag_text or 'gebraucht' in tag_text:
                    condition = tag.get_text(strip=True)
                    break
            
            return {
                'external_id': external_id,
                'url': url,
                'title': title,
                'price': price,
                'price_negotiable': price_negotiable,
                'city': city,
                'state': state,
                'description': description,
                'condition': condition,
                'posted_at': posted_at,
                'image_url': image_url,
                'seller_type': None,  # Would need detail page for this
            }
            
        except Exception as e:
            logger.error(f"Error parsing listing: {e}")
            return None
    
    def _parse_location(self, location_text: str) -> tuple[Optional[str], Optional[str]]:
        """
        Parse location string into city and state.
        
        Args:
            location_text: Raw location text (e.g., "12345 Berlin", "München").
        
        Returns:
            Tuple of (city, state). Either may be None.
        """
        if not location_text:
            return None, None
        
        # Remove postal code if present
        cleaned = re.sub(r'^\d{5}\s*', '', location_text.strip())
        
        # Try to split city and state (often separated by comma or dash)
        parts = re.split(r'[,\-]', cleaned, maxsplit=1)
        city = parts[0].strip() if parts else None
        state = parts[1].strip() if len(parts) > 1 else None
        
        return city, state
    
    def _parse_date(self, date_text: str) -> Optional[datetime]:
        """
        Parse German date string into datetime.
        
        Args:
            date_text: Date text like "Heute, 14:30" or "01.12.2024".
        
        Returns:
            datetime object or None if parsing failed.
        """
        if not date_text:
            return None
        
        text = date_text.strip().lower()
        now = datetime.now()

        # Extract optional time (e.g., "Heute, 14:30")
        time_match = re.search(r'(\d{1,2}):(\d{2})', text)
        hour = int(time_match.group(1)) if time_match else None
        minute = int(time_match.group(2)) if time_match else None
        
        # Handle relative dates
        if 'heute' in text:
            if hour is not None and minute is not None:
                return datetime(now.year, now.month, now.day, hour, minute)
            return now
        if 'gestern' in text:
            yesterday = now - timedelta(days=1)
            if hour is not None and minute is not None:
                return datetime(yesterday.year, yesterday.month, yesterday.day, hour, minute)
            return datetime(yesterday.year, yesterday.month, yesterday.day)
        
        # Try parsing absolute date (DD.MM.YYYY)
        match = re.search(r'(\d{2})\.(\d{2})\.(\d{4})', text)
        if match:
            day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
            try:
                return datetime(year, month, day)
            except ValueError:
                pass

        # Try parsing short date without year (DD.MM.)
        match = re.search(r'(\d{2})\.(\d{2})\.', text)
        if match:
            day, month = int(match.group(1)), int(match.group(2))
            try:
                return datetime(now.year, month, day)
            except ValueError:
                pass
        
        return None

    def _looks_like_blocked_page(self, html: str) -> bool:
        """
        Heuristic detection for access blocks / challenge pages.

        This does not attempt to bypass access controls; it just helps fail fast
        and apply backoff when the site presents a block page.
        """
        lower = html.lower()
        markers = (
            'captcha',
            'robot',
            'zugriff verweigert',
            'access denied',
            'unusual traffic',
            'bot detection',
        )
        return any(m in lower for m in markers)
    
    def scrape_page(self, page: Page, url: str, retry_count: int = 0) -> List[Dict[str, Any]]:
        """
        Scrape a single page of listings with retry logic.
        
        Args:
            page: Playwright page instance.
            url: URL of the page to scrape.
            retry_count: Current retry attempt (for internal use).
        
        Returns:
            List of parsed listing dictionaries.
        """
        MAX_RETRIES = 3
        logger.info(f"Scraping page: {url}" + (f" (retry {retry_count})" if retry_count > 0 else ""))
        
        try:
            # Navigate to page with timeout
            response = page.goto(url, wait_until='domcontentloaded', timeout=60000)
            
            if not response:
                logger.error(f"No response from {url}")
                if retry_count < MAX_RETRIES:
                    time.sleep(self.delay_seconds * 2)
                    return self.scrape_page(page, url, retry_count + 1)
                return []
            
            # Handle rate limiting with exponential backoff
            if response.status == 429:
                backoff_time = self.delay_seconds * (2 ** (retry_count + 1))
                logger.warning(f"Rate limited (429). Backing off for {backoff_time}s...")
                time.sleep(backoff_time)
                if retry_count < MAX_RETRIES:
                    return self.scrape_page(page, url, retry_count + 1)
                return []
            
            # Handle server errors with retry
            if response.status >= 500:
                logger.error(f"Server error HTTP {response.status} for {url}")
                if retry_count < MAX_RETRIES:
                    time.sleep(self.delay_seconds * 2)
                    return self.scrape_page(page, url, retry_count + 1)
                return []
            
            # Handle client errors (don't retry)
            if response.status >= 400:
                logger.error(f"Client error HTTP {response.status} for {url}")
                return []
            
            # Wait for page to stabilize
            page.wait_for_load_state('domcontentloaded')
            time.sleep(1.5 + random.random() * 1.5)  # Allow dynamic content to load (+ jitter)
            
            # Try to wait for listings, but don't fail if not found
            try:
                page.wait_for_selector(SELECTORS['listing_item'], timeout=10000)
            except Exception:
                logger.warning(f"Listing selector not found on page, trying to parse anyway")
            
            # Get page content and parse
            html = page.content()
            if self._looks_like_blocked_page(html):
                logger.warning(f"Page content looks like an access block/challenge: {url}")
                if retry_count < MAX_RETRIES:
                    time.sleep(self.delay_seconds * (2 ** (retry_count + 1)))
                    return self.scrape_page(page, url, retry_count + 1)
                return []
            soup = BeautifulSoup(html, 'html.parser')
            
            listings = []
            articles = soup.select(SELECTORS['listing_item'])
            logger.info(f"Found {len(articles)} listings on page")
            
            # If no listings found, might be a page issue - try once more
            if len(articles) == 0 and retry_count < 1:
                logger.warning(f"No listings found, retrying page...")
                time.sleep(self.delay_seconds)
                return self.scrape_page(page, url, retry_count + 1)
            
            for article in articles:
                try:
                    listing = self._parse_listing(article, url)
                    if listing:
                        listings.append(listing)
                except Exception as e:
                    logger.warning(f"Failed to parse individual listing: {e}")
                    continue  # Skip bad listings, continue with others
            
            return listings
            
        except Exception as e:
            logger.error(f"Error scraping page {url}: {e}")
            if retry_count < MAX_RETRIES:
                time.sleep(self.delay_seconds * 2)
                return self.scrape_page(page, url, retry_count + 1)
            return []
    
    def scrape(self, start_page: int = 1) -> List[Dict[str, Any]]:
        """
        Scrape multiple pages of notebook listings.
        
        This is the main entry point for scraping. It handles browser
        initialization, robots.txt checking, pagination, and rate limiting.
        
        Args:
            start_page: Page number to start from (1-indexed).
        
        Returns:
            List of all scraped listing dictionaries.
        
        Raises:
            Exception: If scraping is not allowed by robots.txt.
        """
        all_listings = []

        with self.open_page() as page:
            # Check robots.txt compliance
            self._robots_checker = RobotsChecker(self.base_url)
            self._robots_checker.fetch_robots(page)

            parsed_url = urlparse(self.base_url)
            if not self._robots_checker.is_allowed(parsed_url.path):
                raise Exception(f"Scraping not allowed by robots.txt for {parsed_url.path}")

            # Scrape pages
            for page_num in range(start_page, start_page + self.page_limit):
                url = self.build_page_url(self.base_url, page_num)

                listings = self.scrape_page(page, url)
                all_listings.extend(listings)

                logger.info(f"Total listings so far: {len(all_listings)}")

                # Polite delay between pages
                if page_num < start_page + self.page_limit - 1:
                    logger.debug(f"Waiting {self.delay_seconds}s before next page...")
                    time.sleep(self.delay_seconds)
        
        logger.info(f"Scraping complete. Total listings: {len(all_listings)}")
        return all_listings
