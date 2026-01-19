"""Tests for migrate_enrichments.py"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from migrate_enrichments import transform_wine_to_enrichment, filter_and_transform


class TestTransformWineToEnrichment:
    """Tests for field mapping correctness."""

    def test_maps_all_tasting_notes(self):
        wine = {
            "id": "123",
            "tasting_notes": {
                "appearance": "Deep ruby",
                "nose": "Cherry and oak",
                "palate": "Full bodied",
                "finish": "Long",
                "overall": "Excellent"
            }
        }
        result = transform_wine_to_enrichment(wine)

        assert result["wine_id"] == "123"
        assert result["tasting_appearance"] == "Deep ruby"
        assert result["tasting_nose"] == "Cherry and oak"
        assert result["tasting_palate"] == "Full bodied"
        assert result["tasting_finish"] == "Long"
        assert result["tasting_overall"] == "Excellent"

    def test_maps_descriptors_as_arrays(self):
        wine = {
            "id": "123",
            "aroma_descriptors": ["Cherry", "Oak", "Vanilla"],
            "flavor_descriptors": ["Blackberry", "Spice"]
        }
        result = transform_wine_to_enrichment(wine)

        assert result["aroma_descriptors"] == ["Cherry", "Oak", "Vanilla"]
        assert result["flavor_descriptors"] == ["Blackberry", "Spice"]

    def test_maps_jsonb_fields(self):
        wine = {
            "id": "123",
            "food_pairings": [{"dish": "Steak", "reason": "Tannins"}],
            "characteristics": {"body": "Full", "acidity": "High"},
            "serving_suggestions": {"temperature": "18C"}
        }
        result = transform_wine_to_enrichment(wine)

        assert result["food_pairings"] == [{"dish": "Steak", "reason": "Tannins"}]
        assert result["characteristics"] == {"body": "Full", "acidity": "High"}
        assert result["serving_suggestions"] == {"temperature": "18C"}

    def test_maps_aging_fields(self):
        wine = {
            "id": "123",
            "aging_potential": "10-15 years",
            "drink_from_year": "2025",
            "drink_by_year": "2035"
        }
        result = transform_wine_to_enrichment(wine)

        assert result["aging_potential"] == "10-15 years"
        assert result["drink_from_year"] == "2025"
        assert result["drink_by_year"] == "2035"

    def test_maps_augmentation_status(self):
        wine = {"id": "123", "_augmentation_status": "completed"}
        result = transform_wine_to_enrichment(wine)
        assert result["enrichment_status"] == "completed"

    def test_defaults_status_to_pending(self):
        wine = {"id": "123"}
        result = transform_wine_to_enrichment(wine)
        assert result["enrichment_status"] == "pending"

    def test_parses_iso_timestamp(self):
        wine = {
            "id": "123",
            "_augmentation_timestamp": "2026-01-13T23:09:04.005821"
        }
        result = transform_wine_to_enrichment(wine)
        assert result["enriched_at"] is not None
        assert "2026-01-13" in result["enriched_at"]

    def test_handles_z_suffix_timestamp(self):
        wine = {
            "id": "123",
            "_augmentation_timestamp": "2026-01-13T23:09:04Z"
        }
        result = transform_wine_to_enrichment(wine)
        assert result["enriched_at"] is not None

    def test_handles_invalid_timestamp(self):
        wine = {"id": "123", "_augmentation_timestamp": "not-a-date"}
        result = transform_wine_to_enrichment(wine)
        assert result["enriched_at"] is None

    def test_handles_missing_tasting_notes(self):
        wine = {"id": "123"}
        result = transform_wine_to_enrichment(wine)

        assert result["tasting_appearance"] is None
        assert result["tasting_nose"] is None

    def test_handles_null_tasting_notes(self):
        wine = {"id": "123", "tasting_notes": None}
        result = transform_wine_to_enrichment(wine)

        assert result["tasting_appearance"] is None

    def test_defaults_descriptors_to_empty_list(self):
        wine = {"id": "123"}
        result = transform_wine_to_enrichment(wine)

        assert result["aroma_descriptors"] == []
        assert result["flavor_descriptors"] == []

    def test_sets_model_version(self):
        wine = {"id": "123"}
        result = transform_wine_to_enrichment(wine)
        assert result["model_version"] == "gemini-1.5-pro"


class TestFilterAndTransform:
    """Tests for ID validation logic."""

    def test_filters_invalid_ids(self):
        wines = [
            {"id": "valid1"},
            {"id": "invalid1"},
            {"id": "valid2"}
        ]
        valid_ids = {"valid1", "valid2"}

        enrichments, skipped = filter_and_transform(wines, valid_ids)

        assert len(enrichments) == 2
        assert len(skipped) == 1
        assert "invalid1" in skipped

    def test_returns_all_when_all_valid(self):
        wines = [{"id": "1"}, {"id": "2"}, {"id": "3"}]
        valid_ids = {"1", "2", "3"}

        enrichments, skipped = filter_and_transform(wines, valid_ids)

        assert len(enrichments) == 3
        assert len(skipped) == 0

    def test_skips_all_when_none_valid(self):
        wines = [{"id": "1"}, {"id": "2"}]
        valid_ids = {"999"}

        enrichments, skipped = filter_and_transform(wines, valid_ids)

        assert len(enrichments) == 0
        assert len(skipped) == 2

    def test_handles_empty_wines_list(self):
        enrichments, skipped = filter_and_transform([], {"1", "2"})

        assert len(enrichments) == 0
        assert len(skipped) == 0

    def test_handles_empty_valid_ids(self):
        wines = [{"id": "1"}]
        enrichments, skipped = filter_and_transform(wines, set())

        assert len(enrichments) == 0
        assert len(skipped) == 1

    def test_transforms_valid_wines(self):
        wines = [{"id": "123", "aging_potential": "10 years"}]
        valid_ids = {"123"}

        enrichments, _ = filter_and_transform(wines, valid_ids)

        assert enrichments[0]["wine_id"] == "123"
        assert enrichments[0]["aging_potential"] == "10 years"


class TestIdempotency:
    """Tests for idempotent behavior."""

    def test_same_input_same_output(self):
        wine = {
            "id": "123",
            "tasting_notes": {"appearance": "Ruby"},
            "_augmentation_status": "completed",
            "_augmentation_timestamp": "2026-01-13T12:00:00"
        }

        result1 = transform_wine_to_enrichment(wine)
        result2 = transform_wine_to_enrichment(wine)

        assert result1 == result2

    def test_filter_same_input_same_output(self):
        wines = [{"id": "1"}, {"id": "2"}, {"id": "3"}]
        valid_ids = {"1", "3"}

        e1, s1 = filter_and_transform(wines, valid_ids)
        e2, s2 = filter_and_transform(wines, valid_ids)

        assert e1 == e2
        assert s1 == s2
