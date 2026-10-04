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
    monkeypatch.setattr(settings_module.settings, "upload_dir", upload_dir)

    content = b"Region,Sales,Orders\nSouth,1200,10\nNorth,800,8\nSouth,,12\n"
    response = client.post(
        "/api/datasets/upload",
        files={"file": ("sales.csv", BytesIO(content), "text/csv")},
    )
    assert response.status_code == 201
    dataset_id = response.json()["dataset_id"]

    profile = client.get(f"/api/datasets/{dataset_id}/profile")
    assert profile.status_code == 200
    data = profile.json()
    assert data["rows"] == 3
    assert data["columns"] == 3
    assert data["missing_values"] == 1
    assert data["duplicate_rows"] == 0
    assert {c["name"] for c in data["columns_profile"]} == {"Region", "Sales", "Orders"}
