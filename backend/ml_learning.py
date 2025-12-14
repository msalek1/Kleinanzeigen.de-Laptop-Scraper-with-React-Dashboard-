"""
Enhanced Machine Learning module for recommendation engine.

Provides sophisticated learning from user interactions including:
- Time decay (recent interactions count more)
- Confidence scoring (more interactions = more confident)
- Contextual learning (learn from similar items)
- Weight normalization and decay
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING
from collections import defaultdict

if TYPE_CHECKING:
    from models import Listing, UserInteraction, LearnedPreference, BrandAffinity


# =============================================================================
# Configuration
# =============================================================================

# Time decay half-life in days (after this time, weight contribution is halved)
TIME_DECAY_HALF_LIFE_DAYS = 7

# Minimum interactions needed for high confidence
MIN_INTERACTIONS_FOR_CONFIDENCE = 5

# Maximum weight magnitude (prevents runaway values)
MAX_WEIGHT_MAGNITUDE = 3.0

# Weight adjustments per action type
ACTION_WEIGHTS = {
    'view': 0.02,      # Slight positive for viewing
    'click': 0.08,     # Moderate positive for clicking through
    'save': 0.25,      # Strong positive for saving
    'dismiss': -0.15,  # Moderate negative for dismissing
    'contact': 0.40,   # Very strong positive for contacting seller
}

# Duration bonuses for view actions (seconds thresholds)
VIEW_DURATION_BONUSES = [
    (60, 0.05),    # 1+ minutes = extra 0.05
    (120, 0.10),   # 2+ minutes = extra 0.10
    (300, 0.15),   # 5+ minutes = extra 0.15
]


# =============================================================================
# Time Decay Functions
# =============================================================================

def calculate_time_decay(interaction_time: datetime, now: Optional[datetime] = None) -> float:
    """
    Calculate time decay factor using exponential decay.
    
    Returns a value between 0 and 1:
    - 1.0 for very recent interactions
    - 0.5 after TIME_DECAY_HALF_LIFE_DAYS
    - Approaches 0 for very old interactions
    
    Args:
        interaction_time: When the interaction occurred.
        now: Current time (defaults to utcnow).
    
    Returns:
        Decay factor between 0 and 1.
    """
    if now is None:
        now = datetime.utcnow()
    
    if interaction_time is None:
        return 0.5  # Default for missing timestamps
    
    age_days = (now - interaction_time).total_seconds() / 86400
    
    # Exponential decay: factor = 2^(-age/half_life)
    decay_factor = math.pow(2, -age_days / TIME_DECAY_HALF_LIFE_DAYS)
    
    return max(0.01, min(1.0, decay_factor))


def get_decayed_weight(base_weight: float, interaction_time: datetime) -> float:
    """
    Apply time decay to a weight adjustment.
    
    Args:
        base_weight: The original weight adjustment.
        interaction_time: When the interaction occurred.
    
    Returns:
        Time-decayed weight.
    """
    decay = calculate_time_decay(interaction_time)
    return base_weight * decay


# =============================================================================
# Confidence Scoring
# =============================================================================

def calculate_confidence(interaction_count: int) -> float:
    """
    Calculate confidence factor based on number of interactions.
    
    Uses logarithmic scaling to prevent overconfidence with many interactions.
    
    Args:
        interaction_count: Number of interactions for this preference.
    
    Returns:
        Confidence factor between 0 and 1.
    """
    if interaction_count <= 0:
        return 0.0
    
    # Logarithmic scaling: quickly ramps up, then levels off
    # Reaches ~0.7 at MIN_INTERACTIONS_FOR_CONFIDENCE
    # Reaches ~0.85 at 10 interactions
    # Reaches ~0.95 at 50 interactions
    confidence = math.log(interaction_count + 1) / math.log(MIN_INTERACTIONS_FOR_CONFIDENCE + 10)
    
    return min(1.0, confidence)


def get_confidence_adjusted_weight(
    learned_weight: float,
    interaction_count: int,
    max_adjustment: float = 20.0
) -> float:
    """
    Get the effective weight with confidence factored in.
    
    Lower confidence = weight has less impact on scoring.
    
    Args:
        learned_weight: The raw learned weight.
        interaction_count: Number of interactions.
        max_adjustment: Maximum score adjustment allowed.
    
    Returns:
        Confidence-adjusted weight capped at max_adjustment.
    """
    confidence = calculate_confidence(interaction_count)
    
    # Apply confidence to weight
    effective_weight = learned_weight * confidence
    
    # Apply maximum bounds
    return max(-max_adjustment, min(max_adjustment, effective_weight * 10))


# =============================================================================
# Enhanced Weight Calculation
# =============================================================================

def calculate_action_weight(
    action_type: str,
    duration_seconds: Optional[int] = None
) -> float:
    """
    Calculate the weight adjustment for an action.
    
    Includes duration bonuses for view actions.
    
    Args:
        action_type: Type of interaction (view, click, save, etc.).
        duration_seconds: Time spent (for view actions).
    
    Returns:
        Weight adjustment value.
    """
    base_weight = ACTION_WEIGHTS.get(action_type, 0.0)
    
    # Add duration bonus for views
    if action_type == 'view' and duration_seconds:
        for threshold, bonus in VIEW_DURATION_BONUSES:
            if duration_seconds >= threshold:
                base_weight += bonus
    
    return base_weight


def normalize_weight(weight: float) -> float:
    """
    Keep weights within reasonable bounds with soft clamping.
    
    Uses tanh to smoothly limit extreme values while preserving
    the sign and relative magnitude.
    
    Args:
        weight: Raw weight value.
    
    Returns:
        Normalized weight between -MAX_WEIGHT_MAGNITUDE and +MAX_WEIGHT_MAGNITUDE.
    """
    # Use tanh for soft clamping
    return MAX_WEIGHT_MAGNITUDE * math.tanh(weight / MAX_WEIGHT_MAGNITUDE)


def apply_weight_decay(current_weight: float, decay_rate: float = 0.99) -> float:
    """
    Gradually decay weights over time to prevent staleness.
    
    Should be called periodically (e.g., daily) on all weights.
    
    Args:
        current_weight: The current weight value.
        decay_rate: Multiplier per decay period (0.99 = 1% decay).
    
    Returns:
        Decayed weight.
    """
    return current_weight * decay_rate


# =============================================================================
# Learning Functions
# =============================================================================

def learn_from_interaction(
    interaction: 'UserInteraction',
    listing: 'Listing',
    db_session,
    LearnedPreferenceModel,
    BrandAffinityModel,
) -> Dict[str, Any]:
    """
    Update learned preferences based on a user interaction.
    
    This is the main learning function that should be called
    after logging an interaction.
    
    Args:
        interaction: The user interaction that occurred.
        listing: The listing that was interacted with.
        db_session: SQLAlchemy database session.
        LearnedPreferenceModel: The LearnedPreference model class.
        BrandAffinityModel: The BrandAffinity model class.
    
    Returns:
        Dict with updated preferences and their new values.
    """
    from tag_extractor import extract_tags
    
    sync_code = interaction.sync_code
    action_type = interaction.action_type
    duration = interaction.duration_seconds
    
    # Calculate base weight for this action
    base_weight = calculate_action_weight(action_type, duration)
    
    if base_weight == 0:
        return {'updated': []}
    
    # Extract tags/keywords from the listing
    tags = extract_tags(listing.title, listing.description)
    
    updated_prefs = []
    updated_brands = []
    
    for category, value in tags:
        # Update learned preference for this keyword
        learned = LearnedPreferenceModel.query.filter_by(
            sync_code=sync_code, keyword=value
        ).first()
        
        if not learned:
            learned = LearnedPreferenceModel(
                sync_code=sync_code,
                keyword=value,
                learned_weight=0.0,
                interaction_count=0
            )
            db_session.add(learned)
        
        # Apply weight with diminishing returns for repeated actions
        # Uses sqrt to reduce impact of repeated similar actions
        repetition_factor = 1.0 / math.sqrt(max(1, learned.interaction_count // 5 + 1))
        adjusted_weight = base_weight * repetition_factor
        
        # Update and normalize
        new_weight = normalize_weight((learned.learned_weight or 0.0) + adjusted_weight)
        learned.learned_weight = new_weight
        learned.interaction_count = (learned.interaction_count or 0) + 1
        learned.last_updated = datetime.utcnow()
        
        updated_prefs.append({
            'keyword': value,
            'weight': new_weight,
            'count': learned.interaction_count
        })
        
        # Update brand affinity if this is a brand tag
        if category == 'brand':
            affinity = BrandAffinityModel.query.filter_by(
                sync_code=sync_code, brand=value
            ).first()
            
            if not affinity:
                affinity = BrandAffinityModel(
                    sync_code=sync_code,
                    brand=value,
                    affinity_score=0.0,
                    interaction_count=0
                )
                db_session.add(affinity)
            
            # Brand affinity is clamped to [-1, 1]
            repetition_factor = 1.0 / math.sqrt(max(1, affinity.interaction_count // 3 + 1))
            brand_adjustment = base_weight * repetition_factor * 0.5  # Brands adjust slower
            
            new_affinity = max(-1.0, min(1.0, 
                (affinity.affinity_score or 0.0) + brand_adjustment
            ))
            affinity.affinity_score = new_affinity
            affinity.interaction_count = (affinity.interaction_count or 0) + 1
            affinity.last_updated = datetime.utcnow()
            
            updated_brands.append({
                'brand': value,
                'affinity': new_affinity,
                'count': affinity.interaction_count
            })
    
    return {
        'updated_keywords': updated_prefs,
        'updated_brands': updated_brands,
        'action_type': action_type,
        'base_weight': base_weight,
    }


def get_effective_learned_weights(
    sync_code: str,
    LearnedPreferenceModel,
    apply_decay: bool = True,
) -> Dict[str, float]:
    """
    Get learned keyword weights with confidence and time decay applied.
    
    Args:
        sync_code: User identifier.
        LearnedPreferenceModel: The model class.
        apply_decay: Whether to apply time decay.
    
    Returns:
        Dict of keyword -> effective weight.
    """
    learned_prefs = LearnedPreferenceModel.query.filter_by(sync_code=sync_code).all()
    
    weights = {}
    now = datetime.utcnow()
    
    for pref in learned_prefs:
        weight = pref.learned_weight or 0.0
        count = pref.interaction_count or 0
        
        # Apply confidence scaling
        effective = get_confidence_adjusted_weight(weight, count)
        
        # Apply time decay if enabled
        if apply_decay and pref.last_updated:
            decay = calculate_time_decay(pref.last_updated, now)
            effective *= decay
        
        if abs(effective) > 0.1:  # Only include meaningful weights
            weights[pref.keyword] = effective
    
    return weights


def get_effective_brand_affinities(
    sync_code: str,
    BrandAffinityModel,
    apply_decay: bool = True,
) -> Dict[str, float]:
    """
    Get brand affinities with confidence and time decay applied.
    
    Args:
        sync_code: User identifier.
        BrandAffinityModel: The model class.
        apply_decay: Whether to apply time decay.
    
    Returns:
        Dict of brand -> effective affinity.
    """
    affinities = BrandAffinityModel.query.filter_by(sync_code=sync_code).all()
    
    result = {}
    now = datetime.utcnow()
    
    for aff in affinities:
        score = aff.affinity_score or 0.0
        count = aff.interaction_count or 0
        
        # Apply confidence (affects magnitude, not sign)
        confidence = calculate_confidence(count)
        effective = score * confidence
        
        # Apply time decay
        if apply_decay and aff.last_updated:
            decay = calculate_time_decay(aff.last_updated, now)
            effective *= decay
        
        if abs(effective) > 0.05:  # Only include meaningful affinities
            result[aff.brand] = effective
    
    return result


# =============================================================================
# Batch Operations
# =============================================================================

def decay_all_weights(
    sync_code: str,
    db_session,
    LearnedPreferenceModel,
    BrandAffinityModel,
    decay_rate: float = 0.95,
) -> int:
    """
    Apply decay to all learned weights for a user.
    
    Should be called periodically (e.g., weekly) to prevent
    stale preferences from dominating.
    
    Args:
        sync_code: User identifier.
        db_session: Database session.
        LearnedPreferenceModel: The model class.
        BrandAffinityModel: The model class.
        decay_rate: Multiplier (0.95 = 5% decay).
    
    Returns:
        Number of records updated.
    """
    count = 0
    
    # Decay keyword weights
    for pref in LearnedPreferenceModel.query.filter_by(sync_code=sync_code).all():
        if pref.learned_weight:
            pref.learned_weight = apply_weight_decay(pref.learned_weight, decay_rate)
            count += 1
    
    # Decay brand affinities
    for aff in BrandAffinityModel.query.filter_by(sync_code=sync_code).all():
        if aff.affinity_score:
            aff.affinity_score = apply_weight_decay(aff.affinity_score, decay_rate)
            count += 1
    
    db_session.commit()
    return count


def analyze_interaction_patterns(
    sync_code: str,
    UserInteractionModel,
    days: int = 30,
) -> Dict[str, Any]:
    """
    Analyze user interaction patterns for insights.
    
    Args:
        sync_code: User identifier.
        UserInteractionModel: The model class.
        days: Number of days to analyze.
    
    Returns:
        Dict with interaction statistics.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    interactions = UserInteractionModel.query.filter(
        UserInteractionModel.sync_code == sync_code,
        UserInteractionModel.created_at >= cutoff
    ).all()
    
    if not interactions:
        return {
            'total_interactions': 0,
            'action_counts': {},
            'avg_view_duration': 0,
            'save_rate': 0,
            'dismiss_rate': 0,
        }
    
    action_counts = defaultdict(int)
    view_durations = []
    
    for i in interactions:
        action_counts[i.action_type] += 1
        if i.action_type == 'view' and i.duration_seconds:
            view_durations.append(i.duration_seconds)
    
    total = len(interactions)
    
    return {
        'total_interactions': total,
        'action_counts': dict(action_counts),
        'avg_view_duration': sum(view_durations) / len(view_durations) if view_durations else 0,
        'save_rate': action_counts.get('save', 0) / total if total else 0,
        'dismiss_rate': action_counts.get('dismiss', 0) / total if total else 0,
        'contact_rate': action_counts.get('contact', 0) / total if total else 0,
    }
