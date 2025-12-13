#!/usr/bin/env python
"""
Backfill script for laptop_category and tags.
Processes existing listings to add classification and hardware tags.
"""

import sys
from sqlalchemy import text
from app import create_app
from classifier import classify_laptop_category
from tag_extractor import extract_tags
from models import db, Listing, Tag


def get_or_create_tag(category: str, value: str) -> Tag:
    """Get existing tag or create new one."""
    tag = Tag.query.filter_by(category=category, value=value).first()
    if not tag:
        tag = Tag(category=category, value=value)
        db.session.add(tag)
    return tag


def backfill_laptop_categories(app, limit=5000):
    """Backfill laptop_category for existing laptop listings."""
    with app.app_context():
        missing = Listing.query.filter(
            Listing.item_type == 'laptop',
            (Listing.laptop_category.is_(None)) | (Listing.laptop_category == '')
        ).limit(limit).all()
        
        if not missing:
            print("No listings need laptop_category backfill")
            return 0
        
        print(f"Backfilling laptop_category for {len(missing)} listings...")
        count = 0
        for listing in missing:
            listing.laptop_category = classify_laptop_category(listing.title or '', listing.description)
            count += 1
            if count % 100 == 0:
                print(f"  Processed {count}/{len(missing)}...")
        
        db.session.commit()
        print(f"laptop_category backfill complete: {count} listings updated")
        return count


def backfill_tags(app, limit=1000):
    """Backfill hardware tags for existing laptop listings."""
    with app.app_context():
        # Get listings without tags
        listings = Listing.query.filter(
            Listing.item_type == 'laptop'
        ).outerjoin(
            Listing.tags
        ).group_by(Listing.id).having(
            db.func.count(Tag.id) == 0
        ).limit(limit).all()
        
        if not listings:
            print("No listings need tag backfill")
            return 0
        
        print(f"Backfilling tags for {len(listings)} listings...")
        total_tags = 0
        for i, listing in enumerate(listings):
            tags = extract_tags(listing.title or '', listing.description)
            for category, value in tags:
                tag = get_or_create_tag(category, value)
                if tag not in listing.tags:
                    listing.tags.append(tag)
                    total_tags += 1
            
            if (i + 1) % 100 == 0:
                db.session.commit()
                print(f"  Processed {i + 1}/{len(listings)} listings, {total_tags} tags added...")
        
        db.session.commit()
        print(f"Tag backfill complete: {total_tags} tags added to {len(listings)} listings")
        return total_tags


def main():
    print("Starting backfill...")
    app = create_app()
    
    cat_count = backfill_laptop_categories(app)
    tag_count = backfill_tags(app)
    
    print(f"\nBackfill complete!")
    print(f"  - laptop_category: {cat_count} listings updated")
    print(f"  - tags: {tag_count} total tags added")
    sys.exit(0)


if __name__ == "__main__":
    main()
