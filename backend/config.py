"""
Flask application configuration module.

Provides environment-driven configuration for the Flask app including
database connections, scraper settings, and security parameters.
"""

import os
from pathlib import Path


class Config:
    """Base configuration class with default settings."""
    
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = False
    TESTING = False
    
    # Database settings
    DATABASE_URL = os.environ.get(
        'DATABASE_URL',
        'sqlite:///kleinanzeigen.db'
    )
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Scraper settings
    SCRAPER_BASE_URL = os.environ.get(
        'SCRAPER_BASE_URL',
        'https://www.kleinanzeigen.de/s-notebooks/c278'
    )
    SCRAPER_PAGE_LIMIT = int(os.environ.get('SCRAPER_PAGE_LIMIT', '5'))
    SCRAPER_DELAY_SECONDS = float(os.environ.get('SCRAPER_DELAY_SECONDS', '3.0'))
    PLAYWRIGHT_BROWSER = os.environ.get('PLAYWRIGHT_BROWSER', 'chromium')
    
    # Proxy settings (optional)
    HTTP_PROXY = os.environ.get('HTTP_PROXY')
    HTTPS_PROXY = os.environ.get('HTTPS_PROXY')
    
    # Rate limiting
    RATELIMIT_DEFAULT = os.environ.get('RATELIMIT_DEFAULT', '100 per hour')
    
    # CORS settings
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:5173').split(',')
    
    # Pagination
    DEFAULT_PAGE_SIZE = 20
    MAX_PAGE_SIZE = 100


class DevelopmentConfig(Config):
    """Development configuration with debug enabled."""
    
    DEBUG = True
    SQLALCHEMY_ECHO = True


class ProductionConfig(Config):
    """Production configuration with security hardening."""
    
    DEBUG = False
    SQLALCHEMY_ECHO = False
    
    # In production, SECRET_KEY must be set via environment variable
    @property
    def SECRET_KEY(self):
        key = os.environ.get('SECRET_KEY')
        if not key:
            raise ValueError('SECRET_KEY environment variable must be set in production')
        return key


class TestingConfig(Config):
    """Testing configuration with in-memory database."""
    
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False


def get_config():
    """
    Return the appropriate configuration based on FLASK_ENV.
    
    Returns:
        Config: Configuration class instance for the current environment.
    """
    env = os.environ.get('FLASK_ENV', 'development')
    configs = {
        'development': DevelopmentConfig,
        'production': ProductionConfig,
        'testing': TestingConfig,
    }
    return configs.get(env, DevelopmentConfig)()
