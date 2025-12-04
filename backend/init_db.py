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
from models import db


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
    print("Database initialization complete")
    sys.exit(0)


if __name__ == "__main__":
    main()
