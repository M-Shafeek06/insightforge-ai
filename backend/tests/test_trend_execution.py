from fastapi.testclient import TestClient

from app.main import app
from app.services.settings import settings


client = TestClient(app)


def test_trend_monthly_sum(tmp_path, monkeypatch):
    upload_dir = tmp_path / "raw"
    upload_dir.mkdir()

    monkeypatch.setattr(
        settings,
        "upload_dir",
        upload_dir,
    )

    dataset_id = "trend_test"

    (upload_dir / f"{dataset_id}.csv").write_text(
        "Date,Sales\n"
        "2025-01-05,100\n"
        "2025-01-20,200\n"
        "2025-02-10,300\n",
        encoding="utf-8",
    )

    response = client.post(
        f"/api/datasets/{dataset_id}/execute",
        json={
            "operation": "trend",
            "column": "Sales",
            "aggregation": "sum",
            "date_column": "Date",
            "interval": "month",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["operation"] == "trend"
    assert data["aggregation"] == "sum"
    assert data["interval"] == "month"
    assert len(data["points"]) == 2

    assert data["points"][0]["value"] == 300.0
    assert data["points"][0]["row_count"] == 2

    assert data["points"][1]["value"] == 300.0
    assert data["points"][1]["row_count"] == 1


def test_trend_preserves_null_measure_counts(
    tmp_path,
    monkeypatch,
):
    upload_dir = tmp_path / "raw"
    upload_dir.mkdir()

    monkeypatch.setattr(
        settings,
        "upload_dir",
        upload_dir,
    )

    dataset_id = "trend_null_test"

    (upload_dir / f"{dataset_id}.csv").write_text(
        "Date,Sales\n"
        "2025-01-05,100\n"
        "2025-01-20,NA\n",
        encoding="utf-8",
    )

    response = client.post(
        f"/api/datasets/{dataset_id}/execute",
        json={
            "operation": "trend",
            "column": "Sales",
            "aggregation": "sum",
            "date_column": "Date",
            "interval": "month",
        },
    )

    assert response.status_code == 200

    point = response.json()["points"][0]

    assert point["value"] == 100.0
    assert point["row_count"] == 2
    assert point["valid_value_count"] == 1
    assert point["null_count"] == 1


def test_trend_rejects_missing_date_column(
    tmp_path,
    monkeypatch,
):
    upload_dir = tmp_path / "raw"
    upload_dir.mkdir()

    monkeypatch.setattr(
        settings,
        "upload_dir",
        upload_dir,
    )

    dataset_id = "trend_missing_date"

    (upload_dir / f"{dataset_id}.csv").write_text(
        "Sales\n100\n200\n",
        encoding="utf-8",
    )

    response = client.post(
        f"/api/datasets/{dataset_id}/execute",
        json={
            "operation": "trend",
            "column": "Sales",
            "aggregation": "sum",
            "date_column": "Date",
            "interval": "month",
        },
    )

    assert response.status_code == 422
    assert "does not exist" in response.json()["detail"]