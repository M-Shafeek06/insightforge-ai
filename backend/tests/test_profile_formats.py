from io import BytesIO

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_xlsx_upload_and_profile(tmp_path, monkeypatch):
    from app.services import settings as settings_module

    upload_dir = tmp_path / "raw"
    upload_dir.mkdir()
    monkeypatch.setattr(settings_module.settings, "upload_dir", upload_dir)

    workbook = BytesIO()
    pd.DataFrame(
        {"OrderDate": ["2026-01-01", "2026-01-02"], "Sales": [100.0, None], "Region": ["South", "North"]}
    ).to_excel(workbook, index=False)
    workbook.seek(0)

    response = client.post(
        "/api/datasets/upload",
        files={"file": ("sales.xlsx", workbook, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert response.status_code == 201
    dataset_id = response.json()["dataset_id"]

    profile = client.get(f"/api/datasets/{dataset_id}/profile")
    assert profile.status_code == 200
    data = profile.json()
    assert data["filename"] == "sales.xlsx"
    assert data["rows"] == 2
    assert data["missing_values"] == 1
    assert {c["semantic_role"] for c in data["columns_profile"]} == {"time", "measure", "dimension"}
