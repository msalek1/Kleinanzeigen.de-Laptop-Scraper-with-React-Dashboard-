"""
Lightweight listing classification helpers.

This module intentionally avoids Playwright/BS4 imports so it can be used in
startup/migration code and anywhere else that only needs heuristic text rules.
"""

from __future__ import annotations

import re
from typing import Optional


_LAPTOP_WORD_PATTERNS = (
    r"\bnotebook\b",
    r"\blaptop\b",
    r"\bmacbook\b",
    r"\bultrabook\b",
    r"\bchromebook\b",
)

_LAPTOP_MODEL_PATTERNS = (
    # Common laptop product lines (helps when titles omit "laptop/notebook")
    r"\bthinkpad\b",
    r"\blatitude\b",
    r"\bxps\b",
    r"\belitebook\b",
    r"\bspectre\b",
    r"\bpavilion\b",
    r"\bideapad\b",
    r"\bzenbook\b",
    r"\bvivobook\b",
    r"\baspire\b",
    r"\bswift\b",
    r"\bpredator\b",
    r"\btuf\b",
    r"\brog\b",
    r"\blegion\b",
    r"\blg\s*gram\b",
    r"\bmacbook\s+(air|pro)\b",
)

_HARDWARE_PATTERNS = (
    # CPU / platform
    r"\b(i[3579])[-\s]?\d{3,5}[a-z]{0,3}\b",  # i5-1235U, i7 8650u, i9-12900h
    r"\bryzen\s?[3579]\b",
    r"\bapple\s?m[1-4]\b",
    r"\bm[1-4]\b",  # M1/M2/M3
    # Memory / storage
    r"\b\d{1,2}\s*gb\s*ram\b",
    r"\b\d{3,4}\s*gb\s*(ssd|hdd)\b",
    r"\b\d\s*tb\s*(ssd|hdd)\b",
    # OS / GPU hints
    r"\bwindows\s?(10|11)\b",
    r"\bmacos\b",
    r"\b(geforce|rtx|gtx|radeon)\b",
)

_STRONG_ACCESSORY_PATTERNS = (
    r"\btasche\b",
    r"\bsleeve\b",
    r"\bh[üu]lle\b",
    r"\bcase\b",
    r"\bcover\b",
    r"\bschutzfolie\b",
    r"\bfolie\b",
    r"\bst[äa]nder\b",
    r"\bhalter(ung)?\b",
    r"\bdock(ing)?\b",
    r"\btastatur\b",
    r"\bkeyboard\b",
    r"\bmaus\b",
    r"\bmouse\b",
    r"\btrackpad\b",
    r"\bstift\b",
    r"\bstylus\b",
    r"\bersatzteil(e)?\b",
    r"\bdefekt\b.*\bersatzteil\b",
)

_COMMON_ACCESSORY_PATTERNS = (
    r"\bakku\b",
    r"\bbattery\b",
    r"\bnetzteil\b",
    r"\bladeg(er[aä]t|eraet)\b",
    r"\bcharger\b",
    r"\bkabel\b",
    r"\badapter\b",
    r"\bhub\b",
)

_TABLET_PATTERNS = (
    r"\btablet\b",
    r"\bipad\b",
    r"\bgalaxy\s*tab\b",
    r"\bkindle\b",
    r"\be-?reader\b",
)


def classify_item_type(title: str, description: Optional[str] = None) -> str:
    """
    Classify a listing as 'laptop', 'accessory', or 'other' using heuristics.

    This does not attempt to be perfect; it is tuned for UI filtering and can
    be overridden by selecting "All" in the UI.
    """
    title_text = title.lower()
    text = f"{title_text}\n{(description or '').lower()}"

    has_hardware = any(re.search(p, text) for p in _HARDWARE_PATTERNS)
    has_laptop_word = any(re.search(p, text) for p in _LAPTOP_WORD_PATTERNS)
    has_laptop_model = any(re.search(p, text) for p in _LAPTOP_MODEL_PATTERNS)
    has_strong_accessory = any(re.search(p, title_text) for p in _STRONG_ACCESSORY_PATTERNS)
    has_common_accessory = any(re.search(p, title_text) for p in _COMMON_ACCESSORY_PATTERNS)
    has_tablet = any(re.search(p, text) for p in _TABLET_PATTERNS)

    # If it looks like a real device (CPU/RAM/screen size), treat it as a laptop.
    if has_hardware:
        return 'laptop'

    # Strong accessory terms in the title usually mean it is not a laptop device.
    if has_strong_accessory:
        return 'accessory'

    if has_laptop_word or has_laptop_model:
        return 'laptop'

    if has_common_accessory:
        return 'accessory'

    if has_tablet:
        return 'other'

    return 'other'
