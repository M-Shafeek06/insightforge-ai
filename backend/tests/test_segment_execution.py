from fastapi.testclient import TestClient

from app.main import app
from app.services.settings import settings


client = TestClient(app)


def create_segment_dataset(tmp_path, monkeypatch, content):
    upload_dir = tmp_path / "raw"
    upload_dir.mkdir()

    dataset_id = "segment_test"
    (upload_dir / f"{dataset_id}.csv").write_text(
        content,
        encoding="utf-8",
    )

    monkeypatch.setattr(settings, "upload_dir", upload_dir)
    return dataset_id


def execute_segment(dataset_id, column, aggregation, segment_by):
    return client.post(
        f"/api/datasets/{dataset_id}/execute",
        json={
            "operation": "segment_comparison",
            "column": column,
            "aggregation": aggregation,
            "group_by": segment_by,
        },
    )


def test_segment_sum(tmp_path, monkeypatch):
    dataset_id = create_segment_dataset(
        tmp_path,
        monkeypatch,
        "Region,Sales\nNorth,100\nSouth,200\nNorth,300\n",
    )

    response = execute_segment(dataset_id, "Sales", "sum", "Region")

    assert response.status_code == 200
    data = response.json()

    assert data["operation"] == "segment_comparison"
    assert data["segment_by"] == "Region"
    assert [
        (item["group"], item["value"], item["row_count"])
        for item in data["segments"]
    ] == [
        ("North", 400.0, 2),
        ("South", 200.0, 1),
    ]


def test_segment_average_excludes_null_values(tmp_path, monkeypatch):
    dataset_id = create_segment_dataset(
        tmp_path,
        monkeypatch,
        "Region,Sales\nNorth,100\nNorth,NA\nSouth,300\n",
    )

    response = execute_segment(
        dataset_id,
        "Sales",
        "average",
        "Region",
    )

    assert response.status_code == 200
    segments = response.json()["segments"]

    assert segments[0]["group"] == "North"
    assert segments[0]["value"] == 100.0
    assert segments[0]["valid_value_count"] == 1
    assert segments[0]["null_count"] == 1


def test_segment_count_supports_text_measure(tmp_path, monkeypatch):
    dataset_id = create_segment_dataset(
        tmp_path,
        monkeypatch,
        "Region,Product\nNorth,Tea\nNorth,Coffee\nSouth,NA\n",
    )

    response = execute_segment(
        dataset_id,
        "Product",
        "count",
        "Region",
    )

    assert response.status_code == 200
    segments = response.json()["segments"]

    assert segments[0]["group"] == "North"
    assert segments[0]["value"] == 2.0
    assert segments[1]["group"] == "South"
    assert segments[1]["value"] == 0.0


def test_segment_missing_values_form_a_separate_segment(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_segment_dataset(
        tmp_path,
        monkeypatch,
        "Region,Sales\nNorth,100\n,200\n",
    )

    response = execute_segment(
        dataset_id,
        "Sales",
        "sum",
        "Region",
    )

    assert response.status_code == 200
    segments = response.json()["segments"]

    assert len(segments) == 2
    assert segments[0]["group"] == "North"
    assert segments[1]["group"] is None
    assert segments[1]["value"] == 200.0


def test_segment_rejects_missing_segment_column(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_segment_dataset(
        tmp_path,
        monkeypatch,
        "Sales\n100\n200\n",
    )

    response = execute_segment(
        dataset_id,
        "Sales",
        "sum",
        "Region",
    )

    assert response.status_code == 422
    assert "does not exist" in response.json()["detail"]


def test_segment_rejects_trend_parameters(tmp_path, monkeypatch):
    dataset_id = create_segment_dataset(
        tmp_path,
        monkeypatch,
        "Date,Region,Sales\n2025-01-01,North,100\n",
    )

    response = client.post(
        f"/api/datasets/{dataset_id}/execute",
        json={
            "operation": "segment_comparison",
            "column": "Sales",
            "aggregation": "sum",
            "group_by": "Region",
            "date_column": "Date",
            "interval": "month",
        },
    )

    assert response.status_code == 422
    assert "trend parameters" in response.json()["detail"]