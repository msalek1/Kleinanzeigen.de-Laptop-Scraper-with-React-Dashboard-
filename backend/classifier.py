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

# ============================================================================
# Laptop Category Classification Patterns (German + English aware)
# ============================================================================

_GAMING_LAPTOP_PATTERNS = (
    # Gaming series/brands
    r"\brog\b",                    # ASUS ROG (Republic of Gamers)
    r"\bstrix\b",                  # ASUS Strix
    r"\btuf\s*gaming\b",           # ASUS TUF Gaming
    r"\bzephyrus\b",               # ASUS Zephyrus
    r"\bg14\b|\bg15\b|\bg16\b",    # ASUS Zephyrus G series
    r"\bpredator\b",               # Acer Predator
    r"\bnitro\s*(5|7)?\b",         # Acer Nitro
    r"\blegion\b",                 # Lenovo Legion
    r"\bloq\b",                    # Lenovo LOQ
    r"\bkatana\b",                 # MSI Katana
    r"\braider\b",                 # MSI Raider
    r"\bstealth\b",                # MSI Stealth
    r"\bvector\b",                 # MSI Vector
    r"\bomen\b",                   # HP Omen
    r"\bvictus\b",                 # HP Victus
    r"\balienware\b",              # Dell Alienware
    r"\brazer\s*(blade)?\b",       # Razer Blade
    r"\baorus\b",                  # Gigabyte Aorus
    
    # Gaming keywords (German + English)
    r"\bgaming\s*(notebook|laptop)?\b",
    r"\bgamer\s*(notebook|laptop)?\b",
    r"\bspiele?\s*(notebook|laptop)\b",   # German: gaming/games notebook
    r"\bzocken\b",                         # German: gaming/playing
    r"\bzock\w*\b",                        # German: gaming variations
    
    # High-end gaming GPUs (strong indicator)
    r"\brtx\s*(30[5-9]0|40[5-9]0)\b",      # RTX 3050-3090, 4050-4090
    r"\bgtx\s*16[5-8]0\b",                 # GTX 1650-1680
    r"\brx\s*(6[6-9]|7[0-9])\d{2}\b",      # RX 6600+, 7000 series
    
    # High refresh rate displays (gaming indicator)
    r"\b(144|165|240|360)\s*hz\b",
)

_BUSINESS_LAPTOP_PATTERNS = (
    # Business laptop lines
    r"\bthinkpad\b",              # Lenovo ThinkPad
    r"\belitebook\b",             # HP EliteBook
    r"\bprobook\b",               # HP ProBook
    r"\bzbook\b",                 # HP ZBook
    r"\blatitude\b",              # Dell Latitude
    r"\bprecision\b",             # Dell Precision (can overlap with workstation)
    r"\bvostro\b",                # Dell Vostro
    r"\btravelmate\b",            # Acer TravelMate
    r"\btoughbook\b",             # Panasonic Toughbook
    
    # Business features/keywords (German + English)
    r"\bvpro\b",                   # Intel vPro
    r"\bbusiness\b",
    r"\bgeschäft\w*\b",            # German: business
    r"\bbüro\b",                   # German: office
    r"\boffice\b",
    r"\bprofessional\b",
    r"\bprofi\b",                  # German: professional
    r"\benterprise\b",
    r"\bunternehmen\b",            # German: enterprise/company
)

_ULTRABOOK_PATTERNS = (
    # Ultrabook/thin-and-light lines
    r"\bultrabook\b",
    r"\bzenbook\b",               # ASUS ZenBook
    r"\bspectre\b",               # HP Spectre
    r"\benvy\b",                  # HP Envy
    r"\bxps\s*(13|15)\b",         # Dell XPS 13/15
    r"\blg\s*gram\b",             # LG Gram
    r"\bswift\b",                 # Acer Swift
    r"\bmacbook\s*air\b",         # MacBook Air
    r"\bsurface\s*(laptop|pro)\b", # Microsoft Surface
    r"\byoga\s*(slim)?\b",        # Lenovo Yoga
    r"\bmatebook\b",              # Huawei MateBook
    r"\bgalaxybook\b",            # Samsung Galaxy Book
    
    # Ultrabook characteristics (German + English)
    r"\bdünn\w*\b",               # German: thin
    r"\bthin\b",
    r"\bleicht\w*\b",             # German: light/lightweight
    r"\blight\s*weight\b",
    r"\bslim\b",
    r"\bschlank\b",               # German: slim
    r"\bkompakt\b",               # German: compact
    r"\bportable?\b",             # portable
    r"\btragbar\b",               # German: portable
)

_WORKSTATION_PATTERNS = (
    # Workstation laptop lines
    r"\bthinkpad\s*(p|w)\d+\b",    # Lenovo ThinkPad P/W series
    r"\bzbook\b",                  # HP ZBook
    r"\bprecision\b",              # Dell Precision
    r"\bproart\b",                 # ASUS ProArt
    
    # Workstation keywords (German + English)
    r"\bworkstation\b",
    r"\barbeitstation\b",          # German: workstation
    r"\bcad\b",
    r"\b3d\s*(modell|render)\w*\b", # 3D modeling/rendering
    r"\bquadro\b",                 # NVIDIA Quadro
    r"\bfirepro\b",                # AMD FirePro
    r"\becc\s*ram\b",              # ECC memory
    r"\bxeon\b",                   # Intel Xeon
)

_2IN1_PATTERNS = (
    # 2-in-1 / Convertible laptops
    r"\b2[\s-]?in[\s-]?1\b",
    r"\bconvertible\b",
    r"\bkonvertierbar\b",          # German: convertible
    r"\bflip\b",                   # ASUS Flip
    r"\byoga\b",                   # Lenovo Yoga
    r"\bflex\b",                   # Lenovo Flex
    r"\bpavilion\s*x360\b",        # HP Pavilion x360
    r"\bspectre\s*x360\b",         # HP Spectre x360
    r"\bsurface\s*(pro|go)\b",     # Microsoft Surface Pro/Go
    r"\bx360\b",                   # HP x360 series
    r"\btablet\s*modus\b",         # German: tablet mode
    r"\btouch\s*screen\b",
    r"\btouchscreen\b",
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


def classify_laptop_category(title: str, description: Optional[str] = None) -> Optional[str]:
    """
    Classify a laptop into subcategories: gaming, business, ultrabook, workstation, 2in1.
    
    This function should only be called when item_type is already 'laptop'.
    Returns None if no specific category can be determined.
    
    Priority order (if multiple patterns match):
    1. gaming - strongest visual/marketing signals
    2. workstation - specific professional use
    3. 2in1 - form factor specific
    4. business - enterprise features
    5. ultrabook - thin-and-light characteristics
    
    Args:
        title: Listing title text.
        description: Optional description text.
    
    Returns:
        One of: 'gaming', 'business', 'ultrabook', 'workstation', '2in1', or None.
    """
    text = f"{title.lower()}\n{(description or '').lower()}"
    
    # Check patterns in priority order
    if any(re.search(p, text) for p in _GAMING_LAPTOP_PATTERNS):
        return 'gaming'
    
    if any(re.search(p, text) for p in _WORKSTATION_PATTERNS):
        return 'workstation'
    
    if any(re.search(p, text) for p in _2IN1_PATTERNS):
        return '2in1'
    
    if any(re.search(p, text) for p in _BUSINESS_LAPTOP_PATTERNS):
        return 'business'
    
    if any(re.search(p, text) for p in _ULTRABOOK_PATTERNS):
        return 'ultrabook'
    
    # No specific category detected
    return None
