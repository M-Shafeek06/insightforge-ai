from io import BytesIO

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_csv_upload_and_profile(tmp_path, monkeypatch):
    from app.services import settings as settings_module

    upload_dir = tmp_path / "raw"
    upload_dir.mkdir()

    monkeypatch.setattr(
        settings_module.settings,
        "upload_dir",
        upload_dir,
    )

    content = (
        b"Region,Sales,Orders\n"
        b"South,1200,10\n"
        b"North,800,8\n"
        b"South,,12\n"
    )

    response = client.post(
        "/api/datasets/upload",
        files={
            "file": (
                "sales.csv",
                BytesIO(content),
                "text/csv",
            )
        },
    )

    assert response.status_code == 201

    dataset_id = response.json()["dataset_id"]

    profile = client.get(
        f"/api/datasets/{dataset_id}/profile"
    )

    assert profile.status_code == 200

    data = profile.json()

    assert data["rows"] == 3
    assert data["columns"] == 3
    assert data["missing_values"] == 1
    assert data["duplicate_rows"] == 0

    assert {
        column["name"]
        for column in data["columns_profile"]
    } == {"Region", "Sales", "Orders"}


def test_analysis_plan_success(tmp_path, monkeypatch):
    from app.services import settings as settings_module

    upload_dir = tmp_path / "raw"
    upload_dir.mkdir()

    dataset_id = "test-sales-dataset"

    dataset_path = upload_dir / f"{dataset_id}.csv"

    dataset_path.write_text(
        "OrderDate,Region,Sales,Profit,Orders\n"
        "2026-01-01,South,1200,300,10\n"
        "2026-02-01,North,800,150,8\n"
        "2026-03-01,South,,200,12\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(
        settings_module.settings,
        "upload_dir",
        upload_dir,
    )

    response = client.post(
        f"/api/datasets/{dataset_id}/analysis-plan",
        json={
            "business_objective": (
                "Analyze monthly sales and profit performance"
            ),
            "business_questions": [
                "Which regions generate the most sales?",
                "How do sales change over time?",
            ],
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["dataset_id"] == dataset_id
    assert (
        data["business_objective"]
        == "Analyze monthly sales and profit performance"
    )

    assert data["feasibility_status"] in {
        "feasible",
        "partially_feasible",
        "not_feasible",
    }

    assert isinstance(data["feasibility_reason"], str)
    assert isinstance(data["recommended_kpis"], list)
    assert isinstance(data["recommended_analyses"], list)
    assert isinstance(data["available_columns"], list)
    assert isinstance(data["missing_required_columns"], list)
    assert isinstance(data["quality_warnings"], list)

    assert set(data["available_columns"]) == {
        "OrderDate",
        "Region",
        "Sales",
        "Profit",
        "Orders",
    }


def test_analysis_plan_missing_dataset_returns_404(
    tmp_path,
    monkeypatch,
):
    from app.services import settings as settings_module

    upload_dir = tmp_path / "raw"
    upload_dir.mkdir()

    monkeypatch.setattr(
        settings_module.settings,
        "upload_dir",
        upload_dir,
    )

    response = client.post(
        "/api/datasets/nonexistent-dataset/analysis-plan",
        json={
            "business_objective": "Analyze sales performance",
            "business_questions": [],
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Dataset not found."


def test_analysis_plan_invalid_request_returns_422(
    tmp_path,
    monkeypatch,
):
    from app.services import settings as settings_module

    upload_dir = tmp_path / "raw"
    upload_dir.mkdir()

    monkeypatch.setattr(
        settings_module.settings,
        "upload_dir",
        upload_dir,
    )

    response = client.post(
        "/api/datasets/test-dataset/analysis-plan",
        json={
            "business_objective": "Bad",
            "business_questions": [],
        },
    )

    assert response.status_code == 422


def test_analysis_plan_includes_quality_warnings(
    tmp_path,
    monkeypatch,
):
    from app.services import settings as settings_module

    upload_dir = tmp_path / "raw"
    upload_dir.mkdir()

    dataset_id = "quality-warning-dataset"

    dataset_path = upload_dir / f"{dataset_id}.csv"

    dataset_path.write_text(
        "OrderDate,Region,Sales,Profit\n"
        "2026-01-01,South,1200,300\n"
        "2026-02-01,North,,150\n"
        "2026-03-01,South,900,200\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(
        settings_module.settings,
        "upload_dir",
        upload_dir,
    )

    response = client.post(
        f"/api/datasets/{dataset_id}/analysis-plan",
        json={
            "business_objective": (
                "Analyze sales and profit performance"
            ),
            "business_questions": [],
        },
    )

    assert response.status_code == 200

    data = response.json()
    warnings = data["quality_warnings"]

    assert isinstance(warnings, list)
    assert warnings

    assert all(
        {
            "issue_type",
            "severity",
            "column",
            "message",
            "recommendation",
        }.issubset(warning.keys())
        for warning in warnings
    )

    assert any(
        warning["column"] == "Sales"
        and "missing" in (
            warning["issue_type"] + " " + warning["message"]
        ).lower()
        for warning in warnings
    )

    assert any(
        warning["column"] == "OrderDate"
        and "date" in (
            warning["issue_type"] + " " + warning["message"]
        ).lower()
        for warning in warnings
    )
