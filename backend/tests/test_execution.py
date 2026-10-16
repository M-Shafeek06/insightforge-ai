from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def create_dataset(tmp_path, monkeypatch, filename, content):
    """Create a temporary dataset and configure the upload directory."""
    from app.services import settings as settings_module

    upload_dir = tmp_path / "raw"
    upload_dir.mkdir(exist_ok=True)

    dataset_path = upload_dir / filename
    dataset_path.write_text(content, encoding="utf-8")

    monkeypatch.setattr(
        settings_module.settings,
        "upload_dir",
        upload_dir,
    )

    return filename.rsplit(".", 1)[0]


def execute_kpi(dataset_id, column, aggregation):
    return client.post(
        f"/api/datasets/{dataset_id}/execute",
        json={
            "operation": "kpi",
            "column": column,
            "aggregation": aggregation,
        },
    )


def test_kpi_sum_success(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Sales,Region\n100,South\n200,North\n300,South\n",
    )

    response = execute_kpi(dataset_id, "Sales", "sum")

    assert response.status_code == 200

    data = response.json()

    assert data["dataset_id"] == dataset_id
    assert data["operation"] == "kpi"
    assert data["column"] == "Sales"
    assert data["aggregation"] == "sum"
    assert data["value"] == 600.0
    assert data["row_count"] == 3
    assert data["valid_value_count"] == 3
    assert data["null_count"] == 0


def test_kpi_average_excludes_null_values(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Sales\n100\n200\nNA\n",
    )

    response = execute_kpi(dataset_id, "Sales", "average")

    assert response.status_code == 200

    data = response.json()

    assert data["value"] == 150.0
    assert data["row_count"] == 3
    assert data["valid_value_count"] == 2
    assert data["null_count"] == 1


def test_kpi_count_numeric_column(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Sales\n100\nNA\n300\n",
    )

    response = execute_kpi(dataset_id, "Sales", "count")

    assert response.status_code == 200
    assert response.json()["value"] == 2.0
    assert response.json()["null_count"] == 1


def test_kpi_count_text_column(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "regions.csv",
        "Region\nSouth\nNorth\n\n",
    )

    response = execute_kpi(dataset_id, "Region", "count")

    assert response.status_code == 200
    assert response.json()["value"] == 2.0


def test_missing_dataset_returns_404(tmp_path, monkeypatch):
    from app.services import settings as settings_module

    upload_dir = tmp_path / "raw"
    upload_dir.mkdir()

    monkeypatch.setattr(
        settings_module.settings,
        "upload_dir",
        upload_dir,
    )

    response = execute_kpi(
        "missing-dataset",
        "Sales",
        "sum",
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Dataset not found."


def test_missing_column_returns_422(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Sales\n100\n200\n",
    )

    response = execute_kpi(
        dataset_id,
        "Profit",
        "sum",
    )

    assert response.status_code == 422
    assert "does not exist" in response.json()["detail"]


def test_sum_rejects_text_column(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "regions.csv",
        "Region\nSouth\nNorth\n",
    )

    response = execute_kpi(
        dataset_id,
        "Region",
        "sum",
    )

    assert response.status_code == 422
    assert "requires a numeric column" in response.json()["detail"]


def test_average_rejects_text_column(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "regions.csv",
        "Region\nSouth\nNorth\n",
    )

    response = execute_kpi(
        dataset_id,
        "Region",
        "average",
    )

    assert response.status_code == 422
    assert "requires a numeric column" in response.json()["detail"]


def test_unsupported_aggregation_returns_422(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Sales\n100\n200\n",
    )

    response = execute_kpi(
        dataset_id,
        "Sales",
        "median",
    )

    assert response.status_code == 422


def test_unsupported_operation_returns_422(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Sales\n100\n200\n",
    )

    response = client.post(
        f"/api/datasets/{dataset_id}/execute",
        json={
            "operation": "arbitrary_code",
            "column": "Sales",
            "aggregation": "sum",
        },
    )

    assert response.status_code == 422


def test_all_null_numeric_column_returns_422(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Sales\nNA\nNA\n",
    )

    response = execute_kpi(
        dataset_id,
        "Sales",
        "sum",
    )

    assert response.status_code == 422
    assert "no valid values" in response.json()["detail"]


def test_empty_dataset_returns_422(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Sales\n",
    )

    response = execute_kpi(
        dataset_id,
        "Sales",
        "sum",
    )

    assert response.status_code == 422


def test_extra_request_fields_are_rejected(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Sales\n100\n200\n",
    )

    response = client.post(
        f"/api/datasets/{dataset_id}/execute",
        json={
            "operation": "kpi",
            "column": "Sales",
            "aggregation": "sum",
            "expression": "__import__('os').system('whoami')",
        },
    )

    assert response.status_code == 422


def test_invalid_dataset_identifier_returns_422():
    response = execute_kpi(
        "bad.id",
        "Sales",
        "sum",
    )

    assert response.status_code == 422