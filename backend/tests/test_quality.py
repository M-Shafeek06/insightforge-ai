from pathlib import Path

import pandas as pd

from app.services.quality import assess_dataset_quality


def test_quality_detects_missing_values_and_date_as_text(tmp_path):
    dataset = pd.DataFrame(
        {
            "OrderDate": [
                "2026-01-01",
                "2026-01-02",
                "2026-01-03",
                "2026-01-04",
                "2026-01-05",
            ],
            "Region": [
                "South",
                "North",
                "South",
                "West",
                "East",
            ],
            "Sales": [
                100.0,
                None,
                250.0,
                300.0,
                150.0,
            ],
        }
    )

    path = Path(tmp_path) / "quality_sample.csv"
    dataset.to_csv(path, index=False)

    result = assess_dataset_quality(
        path=path,
        dataset_id="test-quality-dataset",
    )

    assert result["dataset_id"] == "test-quality-dataset"
    assert result["overall_score"] == 82
    assert result["quality_status"] == "Good"

    assert result["summary"]["total_issues"] == 2
    assert result["summary"]["critical"] == 0
    assert result["summary"]["high"] == 1
    assert result["summary"]["medium"] == 0
    assert result["summary"]["low"] == 1

    issue_types = {issue["issue_type"] for issue in result["issues"]}

    assert "missing_values" in issue_types
    assert "date_as_text" in issue_types