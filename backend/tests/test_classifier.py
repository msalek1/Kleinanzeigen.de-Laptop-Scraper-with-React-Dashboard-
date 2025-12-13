"""
Tests for lightweight listing classification heuristics.
"""

from classifier import classify_item_type


def test_classify_laptop_by_hardware_signals():
    assert classify_item_type("Dell XPS 15", "16GB RAM, 512GB SSD") == "laptop"


def test_classify_accessory_bag():
    assert classify_item_type("Laptop Tasche 15 Zoll") == "accessory"


def test_classify_accessory_docking_station():
    assert classify_item_type("ThinkPad Docking Station USB-C") == "accessory"


def test_classify_other_tablet():
    assert classify_item_type("iPad 9. Generation 64GB") == "other"

