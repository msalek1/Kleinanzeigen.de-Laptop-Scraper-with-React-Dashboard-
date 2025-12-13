#!/usr/bin/env python
"""
Database initialization script.

Run this before starting gunicorn to ensure tables exist.
Handles race conditions by using advisory locks.
"""

import sys
import time
from sqlalchemy import text, inspect
from sqlalchemy.exc import IntegrityError, ProgrammingError, OperationalError

from app import create_app
from classifier import classify_item_type, classify_laptop_category
from models import db, ScraperConfig, Listing, PriceHistory, Tag, listing_tags, ArchivedListing


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
            inspector = inspect(db.engine)
            added_item_type = False

            def has_table(table_name: str) -> bool:
                try:
                    return table_name in inspector.get_table_names()
                except Exception:
                    return False

            def has_column(table_name: str, column_name: str) -> bool:
                try:
                    return any(c.get('name') == column_name for c in inspector.get_columns(table_name))
                except Exception:
                    return False

            # Migration 1: Add search_keywords column to listings if it doesn't exist
            if has_table('listings') and not has_column('listings', 'search_keywords'):
                print("Adding search_keywords column to listings table...")
                db.session.execute(text("ALTER TABLE listings ADD COLUMN search_keywords TEXT"))
                db.session.commit()
                print("search_keywords column added successfully")

            # Migration 2: Add item_type column to listings if it doesn't exist
            if has_table('listings') and not has_column('listings', 'item_type'):
                print("Adding item_type column to listings table...")
                db.session.execute(text("ALTER TABLE listings ADD COLUMN item_type VARCHAR(20)"))
                db.session.commit()
                print("item_type column added successfully")
                added_item_type = True

                # Optional index for faster filtering
                try:
                    db.session.execute(text("CREATE INDEX IF NOT EXISTS idx_listings_item_type ON listings(item_type)"))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

            # Migration 3: Create price_history table if it doesn't exist
            if not has_table('price_history'):
                print("Creating price_history table...")
                db.metadata.create_all(db.engine, tables=[PriceHistory.__table__], checkfirst=True)
                db.session.commit()
                print("price_history table created successfully")

            # Migration 4: Add progress_json column to scraper_jobs if it doesn't exist
            if has_table('scraper_jobs') and not has_column('scraper_jobs', 'progress_json'):
                print("Adding progress_json column to scraper_jobs table...")
                db.session.execute(text("ALTER TABLE scraper_jobs ADD COLUMN progress_json TEXT"))
                db.session.commit()
                print("progress_json column added successfully")

            # Migration 5: Create tags table if it doesn't exist
            if not has_table('tags'):
                print("Creating tags table...")
                db.metadata.create_all(db.engine, tables=[Tag.__table__], checkfirst=True)
                db.session.commit()
                print("tags table created successfully")

            # Migration 6: Create listing_tags association table if it doesn't exist
            if not has_table('listing_tags'):
                print("Creating listing_tags table...")
                db.metadata.create_all(db.engine, tables=[listing_tags], checkfirst=True)
                db.session.commit()
                print("listing_tags table created successfully")

            # Migration 7: Create archived_listings table if it doesn't exist
            if not has_table('archived_listings'):
                print("Creating archived_listings table...")
                db.metadata.create_all(db.engine, tables=[ArchivedListing.__table__], checkfirst=True)
                db.session.commit()
                print("archived_listings table created successfully")

            # Migration 8: Add laptop_category column to listings if it doesn't exist
            added_laptop_category = False
            if has_table('listings') and not has_column('listings', 'laptop_category'):
                print("Adding laptop_category column to listings table...")
                db.session.execute(text("ALTER TABLE listings ADD COLUMN laptop_category VARCHAR(30)"))
                db.session.commit()
                print("laptop_category column added successfully")
                added_laptop_category = True

                # Add index for faster filtering
                try:
                    db.session.execute(text("CREATE INDEX IF NOT EXISTS idx_listings_laptop_category ON listings(laptop_category)"))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

            # Data migration: backfill item_type for existing rows
            if has_table('listings') and (added_item_type or has_column('listings', 'item_type')):
                try:
                    # Refresh inspector cache (important after ALTER TABLE on some backends)
                    inspector = inspect(db.engine)
                    missing = Listing.query.filter(
                        (Listing.item_type.is_(None)) | (Listing.item_type == '')
                    ).limit(5000).all()
                    if missing:
                        print(f"Backfilling item_type for {len(missing)} listings...")
                        for listing in missing:
                            listing.item_type = classify_item_type(listing.title or '', listing.description)
                        db.session.commit()
                        print("item_type backfill complete")
                except Exception as e:
                    print(f"Note: Could not backfill item_type: {e}")
                    db.session.rollback()

            # Data migration: backfill laptop_category for existing laptop listings
            if has_table('listings') and (added_laptop_category or has_column('listings', 'laptop_category')):
                try:
                    inspector = inspect(db.engine)
                    missing = Listing.query.filter(
                        Listing.item_type == 'laptop',
                        (Listing.laptop_category.is_(None)) | (Listing.laptop_category == '')
                    ).limit(5000).all()
                    if missing:
                        print(f"Backfilling laptop_category for {len(missing)} listings...")
                        for listing in missing:
                            listing.laptop_category = classify_laptop_category(listing.title or '', listing.description)
                        db.session.commit()
                        print("laptop_category backfill complete")
                except Exception as e:
                    print(f"Note: Could not backfill laptop_category: {e}")
                    db.session.rollback()
            
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
