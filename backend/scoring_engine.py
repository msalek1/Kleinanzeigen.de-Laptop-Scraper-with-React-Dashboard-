"""
Adaptive Scoring Engine for laptop recommendations.

Calculates personalized match scores based on user preferences,
with support for machine learning adjustments from user behavior.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    from models import Listing, UserPreferences, LearnedPreference, BrandAffinity


class AdaptiveScoringEngine:
    """
    Calculate match scores for listings based on user preferences.
    
    Scoring components:
    - Keyword matching (specs, features in title/description)
    - Price evaluation (within budget range)
    - Brand matching (preferred brands)
    - Learned adjustments (from user interaction history)
    
    Classification thresholds:
    - must_see: score >= 75
    - recommended: score >= 50
    - browse: score < 50
    """
    
    MUST_SEE_THRESHOLD = 75
    RECOMMENDED_THRESHOLD = 50
    
    def calculate_score(
        self,
        listing: 'Listing',
        preferences: 'UserPreferences',
        learned_keywords: Optional[Dict[str, float]] = None,
        brand_affinities: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Calculate weighted score for a listing.
        
        Args:
            listing: The listing to score.
            preferences: User-defined preferences.
            learned_keywords: Dict of keyword -> learned_weight adjustments.
            brand_affinities: Dict of brand -> affinity_score (-1 to +1).
        
        Returns:
            Dict with keyword_score, price_score, brand_score, 
            learned_bonus, total_score, classification.
        """
        learned_keywords = learned_keywords or {}
        brand_affinities = brand_affinities or {}
        
        # Parse preferences
        pref_keywords = self._parse_csv(preferences.keywords)
        pref_brands = self._parse_csv(preferences.brands)
        
        # Calculate component scores (0-100)
        keyword_score = self._score_keywords(listing, pref_keywords)
        price_score = self._score_price(listing, preferences.min_price, preferences.max_price)
        brand_score = self._score_brand(listing, pref_brands)
        
        # Apply learned adjustments
        learned_bonus = self._calculate_learned_bonus(listing, learned_keywords)
        brand_adjustment = self._calculate_brand_adjustment(listing, brand_affinities)
        
        # Apply brand learning to brand score
        adjusted_brand_score = min(100, max(0, brand_score * (1 + brand_adjustment)))
        
        # Weighted total (ensure weights sum to 1.0)
        weights_sum = preferences.weight_specs + preferences.weight_price + preferences.weight_brand
        if weights_sum > 0:
            w_specs = preferences.weight_specs / weights_sum
            w_price = preferences.weight_price / weights_sum
            w_brand = preferences.weight_brand / weights_sum
        else:
            w_specs, w_price, w_brand = 0.4, 0.3, 0.3
        
        # Calculate total before learned bonus
        base_score = (
            keyword_score * w_specs +
            price_score * w_price +
            adjusted_brand_score * w_brand
        )
        
        # Apply learned bonus (capped at +/- 20 points)
        total_score = min(100, max(0, base_score + min(20, max(-20, learned_bonus))))
        
        # Classify
        if total_score >= self.MUST_SEE_THRESHOLD:
            classification = 'must_see'
        elif total_score >= self.RECOMMENDED_THRESHOLD:
            classification = 'recommended'
        else:
            classification = 'browse'
        
        return {
            'keyword_score': round(keyword_score, 1),
            'price_score': round(price_score, 1),
            'brand_score': round(adjusted_brand_score, 1),
            'learned_bonus': round(learned_bonus, 1),
            'total_score': round(total_score, 1),
            'classification': classification,
        }
    
    def _parse_csv(self, value: Optional[str]) -> List[str]:
        """Parse comma-separated values into list."""
        if not value:
            return []
        return [v.strip().lower() for v in value.split(',') if v.strip()]
    
    def _score_keywords(self, listing: 'Listing', keywords: List[str]) -> float:
        """
        Score based on keyword matches in title and description.
        
        Returns 0-100 score. Each matching keyword gets equal weight.
        """
        if not keywords:
            return 50.0  # Neutral if no keywords specified
        
        # Combine title and description for matching
        text = f"{listing.title} {listing.description or ''}".lower()
        
        # Also check tags
        tag_values = []
        if hasattr(listing, 'tags') and listing.tags:
            try:
                tag_values = [tag.value.lower() for tag in listing.tags.all()]
            except Exception:
                pass
        
        matches = 0
        for keyword in keywords:
            keyword_lower = keyword.lower()
            # Check in text
            if keyword_lower in text:
                matches += 1
            # Check in tags
            elif any(keyword_lower in tag for tag in tag_values):
                matches += 1
        
        # Score: percentage of keywords matched, scaled 0-100
        match_ratio = matches / len(keywords)
        return match_ratio * 100
    
    def _score_price(
        self,
        listing: 'Listing',
        min_price: Optional[int],
        max_price: Optional[int]
    ) -> float:
        """
        Score based on price fit within user's budget.
        
        Returns 0-100 score:
        - 100: Within budget
        - 50-99: Slightly over max (up to 20% over)
        - 0-49: Significantly over or no price
        """
        if listing.price_eur is None:
            return 30.0  # Unknown price gets low-mid score
        
        price_cents = listing.price_eur
        
        # If no budget specified, give neutral score
        if min_price is None and max_price is None:
            return 50.0
        
        # Check if within range
        above_min = min_price is None or price_cents >= min_price
        below_max = max_price is None or price_cents <= max_price
        
        if above_min and below_max:
            # Perfect fit
            return 100.0
        
        if not above_min:
            # Below minimum (could be suspicious - too cheap)
            ratio = price_cents / min_price if min_price else 1
            return max(20, ratio * 80)
        
        if not below_max and max_price:
            # Above maximum
            over_ratio = (price_cents - max_price) / max_price
            if over_ratio <= 0.1:
                return 80.0  # Up to 10% over
            elif over_ratio <= 0.2:
                return 60.0  # 10-20% over
            elif over_ratio <= 0.5:
                return 30.0  # 20-50% over
            else:
                return 10.0  # More than 50% over
        
        return 50.0
    
    def _score_brand(self, listing: 'Listing', brands: List[str]) -> float:
        """
        Score based on brand match.
        
        Returns 0-100 score:
        - 100: Matches preferred brand
        - 50: No brand preference or neutral
        - 0: (not used - neutral for non-matches)
        """
        if not brands:
            return 50.0  # Neutral if no brands specified
        
        # Check title for brand mentions
        title_lower = listing.title.lower()
        
        # Also check tags for brand
        listing_brand = None
        if hasattr(listing, 'tags') and listing.tags:
            try:
                for tag in listing.tags.all():
                    if tag.category == 'brand':
                        listing_brand = tag.value.lower()
                        break
            except Exception:
                pass
        
        for brand in brands:
            brand_lower = brand.lower()
            if brand_lower in title_lower:
                return 100.0
            if listing_brand and brand_lower in listing_brand:
                return 100.0
        
        # No match - return neutral
        return 50.0
    
    def _calculate_learned_bonus(
        self,
        listing: 'Listing',
        learned_keywords: Dict[str, float]
    ) -> float:
        """
        Calculate bonus/penalty from learned keyword weights.
        
        Returns adjustment in points (can be negative).
        """
        if not learned_keywords:
            return 0.0
        
        text = f"{listing.title} {listing.description or ''}".lower()
        bonus = 0.0
        
        for keyword, weight in learned_keywords.items():
            if keyword.lower() in text:
                bonus += weight * 10  # Each weight point = 10 score points
        
        return bonus
    
    def _calculate_brand_adjustment(
        self,
        listing: 'Listing',
        brand_affinities: Dict[str, float]
    ) -> float:
        """
        Calculate brand score adjustment from learned affinities.
        
        Returns multiplier adjustment (-0.5 to +0.5).
        """
        if not brand_affinities:
            return 0.0
        
        title_lower = listing.title.lower()
        
        for brand, affinity in brand_affinities.items():
            if brand.lower() in title_lower:
                return affinity * 0.5  # Max +/- 50% adjustment
        
        return 0.0
    
    def classify_score(self, score: float) -> str:
        """Classify a numeric score into a category."""
        if score >= self.MUST_SEE_THRESHOLD:
            return 'must_see'
        elif score >= self.RECOMMENDED_THRESHOLD:
            return 'recommended'
        return 'browse'


# Singleton instance
scoring_engine = AdaptiveScoringEngine()


def score_listing(
    listing: 'Listing',
    preferences: 'UserPreferences',
    learned_keywords: Optional[Dict[str, float]] = None,
    brand_affinities: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """Convenience function to score a single listing."""
    return scoring_engine.calculate_score(
        listing, preferences, learned_keywords, brand_affinities
    )


def score_listings_batch(
    listings: List['Listing'],
    preferences: 'UserPreferences',
    learned_keywords: Optional[Dict[str, float]] = None,
    brand_affinities: Optional[Dict[str, float]] = None,
) -> List[Tuple['Listing', Dict[str, Any]]]:
    """Score multiple listings and return sorted by total_score DESC."""
    results = []
    for listing in listings:
        score_data = scoring_engine.calculate_score(
            listing, preferences, learned_keywords, brand_affinities
        )
        results.append((listing, score_data))
    
    # Sort by total_score descending
    results.sort(key=lambda x: x[1]['total_score'], reverse=True)
    return results
