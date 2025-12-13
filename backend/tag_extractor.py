"""
Hardware tag extraction from German listing titles and descriptions.

Extracts structured hardware specifications like CPU, RAM, storage, GPU,
screen size, brand, refresh rate, and OS from listing text.

This module is designed to handle both German and English terminology
commonly found in Kleinanzeigen listings.
"""

from __future__ import annotations

import re
from typing import Callable, List, Optional, Tuple, Union

# Type for tag extractors: either a static string or a callable that processes the match
TagExtractor = Union[str, Callable[[re.Match], str]]

# ============================================================================
# Tag Extraction Patterns (German + English aware)
# ============================================================================

# CPU Brand patterns
_CPU_BRAND_PATTERNS: List[Tuple[str, TagExtractor]] = [
    (r'\b(intel)\b', 'Intel'),
    (r'\b(amd)\b', 'AMD'),
    (r'\b(apple)\s*m[1-4]', 'Apple Silicon'),
]

# CPU Model patterns - extract specific model numbers
_CPU_MODEL_PATTERNS: List[Tuple[str, TagExtractor]] = [
    # Intel Core with model number: i5-1235U, i7-12700H, i9 12900H
    (r'\b(i[3579])[-\s]?(\d{4,5}[a-z]{0,2})\b',
     lambda m: f"{m.group(1).upper()}-{m.group(2).upper()}"),
    # Intel Core without model: just "i5", "i7"
    (r'\b(i[3579])\b(?![-\s]?\d)',
     lambda m: m.group(1).upper()),
    # AMD Ryzen with model: Ryzen 5 5600H, Ryzen 7 7840HS
    (r'\b(ryzen)\s*([3579])\s*(\d{4}[a-z]{0,3})?\b',
     lambda m: f"Ryzen {m.group(2)}" + (f" {m.group(3).upper()}" if m.group(3) else "")),
    # Apple Silicon: M1, M2 Pro, M3 Max
    (r'\b(m[1-4])\s*(pro|max|ultra)?\b',
     lambda m: f"Apple {m.group(1).upper()}" + (f" {m.group(2).title()}" if m.group(2) else "")),
    # Intel Celeron/Pentium
    (r'\b(celeron|pentium)\s*(\w+)?\b',
     lambda m: m.group(1).title() + (f" {m.group(2).upper()}" if m.group(2) else "")),
]

# RAM patterns (German: Arbeitsspeicher)
_RAM_PATTERNS: List[Tuple[str, TagExtractor]] = [
    # Common RAM sizes with optional "RAM" or "Arbeitsspeicher" suffix
    (r'\b(4|8|12|16|24|32|48|64)\s*gb\s*(ram|arbeitsspeicher|ddr[45])?\b',
     lambda m: f"{m.group(1)}GB RAM"),
]

# Storage patterns (German: Festplatte, Speicher)
_STORAGE_PATTERNS: List[Tuple[str, TagExtractor]] = [
    # SSD/NVMe storage in GB
    (r'\b(128|256|480|500|512|1000|1024|2000)\s*gb\s*(ssd|nvme|m\.?2|pcie)\b',
     lambda m: f"{m.group(1)}GB SSD"),
    # TB storage
    (r'\b([12])\s*tb\s*(ssd|nvme|hdd)?\b',
     lambda m: f"{m.group(1)}TB" + (f" {m.group(2).upper()}" if m.group(2) else "")),
    # HDD storage
    (r'\b(320|500|750|1000)\s*gb\s*hdd\b',
     lambda m: f"{m.group(1)}GB HDD"),
]

# GPU patterns
_GPU_PATTERNS: List[Tuple[str, TagExtractor]] = [
    # NVIDIA RTX 20/30/40 series
    (r'\b(rtx)\s*(20[6-8]0|30[5-9]0|40[5-9]0)\s*(ti|super)?\b',
     lambda m: f"RTX {m.group(2)}" + (f" {m.group(3).upper()}" if m.group(3) else "")),
    # NVIDIA GTX 10/16 series
    (r'\b(gtx)\s*(10[5-8]0|16[5-8]0)\s*(ti)?\b',
     lambda m: f"GTX {m.group(2)}" + (f" {m.group(3).upper()}" if m.group(3) else "")),
    # NVIDIA MX series (laptop)
    (r'\b(mx)\s*(150|250|330|350|450|550)\b',
     lambda m: f"MX{m.group(2)}"),
    # AMD Radeon RX
    (r'\b(radeon|rx)\s*(\d{4}[xms]?)\b',
     lambda m: f"RX {m.group(2).upper()}"),
    # Intel integrated graphics
    (r'\b(intel\s*)?(iris\s*xe|uhd\s*\d+|iris\s*plus)\b',
     lambda m: f"Intel {m.group(2).replace('  ', ' ').title()}"),
    # AMD integrated (Vega, RDNA)
    (r'\b(radeon\s*)?(vega\s*\d+|rdna\s*\d*)\b',
     lambda m: f"AMD {m.group(2).title()}"),
]

# Screen size patterns (German: Zoll, Bildschirm)
_SCREEN_SIZE_PATTERNS: List[Tuple[str, TagExtractor]] = [
    # Common laptop screen sizes with optional "Zoll" or inch symbol
    (r'\b(10|11|12|13|13\.3|14|15|15\.6|16|17|17\.3)\s*["\']?\s*(zoll|inch|")?\b',
     lambda m: f'{m.group(1)}"'),
]

# Refresh rate patterns
_REFRESH_RATE_PATTERNS: List[Tuple[str, TagExtractor]] = [
    (r'\b(60|90|120|144|165|240|300|360)\s*hz\b',
     lambda m: f"{m.group(1)}Hz"),
]

# Brand patterns
_BRAND_PATTERNS: List[Tuple[str, TagExtractor]] = [
    (r'\b(lenovo)\b', 'Lenovo'),
    (r'\b(dell)\b', 'Dell'),
    (r'\b(hp|hewlett[\s-]?packard)\b', 'HP'),
    (r'\b(asus)\b', 'ASUS'),
    (r'\b(acer)\b', 'Acer'),
    (r'\b(msi)\b', 'MSI'),
    (r'\b(apple|macbook)\b', 'Apple'),
    (r'\b(huawei)\b', 'Huawei'),
    (r'\b(samsung)\b', 'Samsung'),
    (r'\b(microsoft|surface)\b', 'Microsoft'),
    (r'\b(razer)\b', 'Razer'),
    (r'\b(gigabyte|aorus)\b', 'Gigabyte'),
    (r'\b(medion)\b', 'Medion'),
    (r'\b(toshiba|dynabook)\b', 'Toshiba'),
    (r'\b(fujitsu)\b', 'Fujitsu'),
    (r'\b(lg)\b', 'LG'),
    (r'\b(xiaomi)\b', 'Xiaomi'),
    (r'\b(schenker|xmg)\b', 'Schenker'),
    (r'\b(clevo)\b', 'Clevo'),
]

# OS patterns
_OS_PATTERNS: List[Tuple[str, TagExtractor]] = [
    (r'\b(windows)\s*(10|11)\b', lambda m: f"Windows {m.group(2)}"),
    (r'\b(windows)\b(?!\s*(10|11))', 'Windows'),
    (r'\b(macos|mac\s*os|osx)\b', 'macOS'),
    (r'\b(linux|ubuntu|fedora|debian)\b', 'Linux'),
    (r'\b(chrome\s*os|chromeos|chromebook)\b', 'ChromeOS'),
    (r'\b(freedos|free\s*dos)\b', 'FreeDOS'),
]

# All pattern categories for extraction
TAG_PATTERNS = {
    'cpu_brand': _CPU_BRAND_PATTERNS,
    'cpu_model': _CPU_MODEL_PATTERNS,
    'ram': _RAM_PATTERNS,
    'storage': _STORAGE_PATTERNS,
    'gpu': _GPU_PATTERNS,
    'screen_size': _SCREEN_SIZE_PATTERNS,
    'refresh_rate': _REFRESH_RATE_PATTERNS,
    'brand': _BRAND_PATTERNS,
    'os': _OS_PATTERNS,
}


def extract_tags(title: str, description: Optional[str] = None) -> List[Tuple[str, str]]:
    """
    Extract hardware tags from title and description.
    
    Scans the text for hardware specifications and returns structured tags.
    Each tag consists of a category and a normalized value.
    
    Args:
        title: Listing title text.
        description: Optional description text.
    
    Returns:
        List of (category, value) tuples, e.g.:
        [('brand', 'ASUS'), ('cpu_model', 'i7-12700H'), ('ram', '16GB RAM'), ('gpu', 'RTX 4060')]
    """
    text = f"{title.lower()}\n{(description or '').lower()}"
    tags: List[Tuple[str, str]] = []
    seen: set = set()
    
    for category, patterns in TAG_PATTERNS.items():
        for pattern, extractor in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                # Apply extractor to get the normalized value
                if callable(extractor):
                    try:
                        value = extractor(match)
                    except (IndexError, AttributeError):
                        continue
                else:
                    value = extractor
                
                # Skip if we've already seen this exact tag
                key = (category, value)
                if key not in seen:
                    seen.add(key)
                    tags.append(key)
                    # For most categories, one match is enough
                    # Exception: storage can have multiple (SSD + HDD)
                    if category != 'storage':
                        break
    
    return tags


def extract_tags_dict(title: str, description: Optional[str] = None) -> dict:
    """
    Extract hardware tags and return as a dictionary grouped by category.
    
    Args:
        title: Listing title text.
        description: Optional description text.
    
    Returns:
        Dict with categories as keys and lists of values, e.g.:
        {'brand': ['ASUS'], 'cpu_model': ['i7-12700H'], 'ram': ['16GB RAM']}
    """
    tags = extract_tags(title, description)
    result: dict = {}
    
    for category, value in tags:
        if category not in result:
            result[category] = []
        result[category].append(value)
    
    return result
