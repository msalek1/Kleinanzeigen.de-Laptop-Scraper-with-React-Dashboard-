#!/usr/bin/env python
"""
Database initialization script.

Run this before starting gunicorn to ensure tables exist.
Handles race conditions by using advisory locks.
"""

import sys
import time
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, ProgrammingError, OperationalError

from app import create_app
from models import db, ScraperConfig


def wait_for_db(app, max_retries=30, delay=1):
    """Wait for database to be ready."""
    with app.app_context():
        for i in range(max_retries):
            try:
                db.session.execute(text("SELECT 1"))
                db.session.close()
                print(f"Database is ready")
                return True
            except OperationalError as e:
                print(f"Waiting for database... ({i+1}/{max_retries})")
                time.sleep(delay)
        return False


def seed_default_config(app):
    """Seed default scraper configuration if not exists."""
    with app.app_context():
        try:
            config = ScraperConfig.query.get(1)
            if not config:
                print("Creating default scraper configuration...")
                config = ScraperConfig(
                    id=1,
                    keywords='notebook,laptop',
                    city='',
                    categories='c278',
                    update_interval_minutes=60,
                    page_limit=5,
                    is_active=False
                )
                db.session.add(config)
                db.session.commit()
                print("Default scraper configuration created")
            else:
                print("Scraper configuration already exists")
        except Exception as e:
            print(f"Note: Could not seed config (may already exist): {e}")
            db.session.rollback()


def apply_migrations(app):
    """Apply any pending schema migrations."""
    with app.app_context():
        try:
            # Migration 1: Add search_keywords column to listings if it doesn't exist
            result = db.session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'listings' AND column_name = 'search_keywords'
                )
            """))
            has_search_keywords = result.scalar()
            
            if not has_search_keywords:
                print("Adding search_keywords column to listings table...")
                db.session.execute(text("ALTER TABLE listings ADD COLUMN search_keywords TEXT"))
                db.session.commit()
                print("search_keywords column added successfully")
            
            # Migration 2: Create price_history table if it doesn't exist
            result = db.session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'price_history'
                )
            """))
            has_price_history = result.scalar()
            
            if not has_price_history:
                print("Creating price_history table...")
                db.session.execute(text("""
                    CREATE TABLE price_history (
                        id SERIAL PRIMARY KEY,
                        listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
                        price INTEGER,
                        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                    )
                """))
                db.session.execute(text("CREATE INDEX idx_price_history_listing ON price_history(listing_id)"))
                db.session.commit()
                print("price_history table created successfully")
            
        except Exception as e:
            print(f"Note: Could not apply migrations (may be SQLite or column exists): {e}")
            db.session.rollback()


def init_database(app):
    """Initialize database tables with advisory lock to prevent race conditions."""
    with app.app_context():
        try:
            # Acquire advisory lock (PostgreSQL specific)
            # Lock ID 12345 is arbitrary - just needs to be consistent
            db.session.execute(text("SELECT pg_advisory_lock(12345)"))
            
            try:
                # Check if tables exist
                result = db.session.execute(
                    text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'listings')")
                )
                tables_exist = result.scalar()
                
                if not tables_exist:
                    print("Creating database tables...")
                    db.create_all()
                    print("Database tables created successfully")
                else:
                    print("Database tables already exist")
                    
                db.session.commit()
                
            finally:
                # Release advisory lock
                db.session.execute(text("SELECT pg_advisory_unlock(12345)"))
                db.session.commit()
                
        except Exception as e:
            print(f"Error during database initialization: {e}")
            db.session.rollback()
            # Try simple create_all as fallback (for SQLite)
            try:
                db.create_all()
                print("Tables created with fallback method")
            except Exception:
                pass


def main():
    print("Starting database initialization...")
    app = create_app()
    
    if not wait_for_db(app):
        print("ERROR: Could not connect to database")
        sys.exit(1)
    
    init_database(app)
    apply_migrations(app)
    seed_default_config(app)
    print("Database initialization complete")
    sys.exit(0)


if __name__ == "__main__":
    main()
