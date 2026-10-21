import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def create_dataset(tmp_path, monkeypatch, filename, content):
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


def execute_correlation_api(dataset_id, column, second_column, **extra):
    payload = {
        "operation": "correlation",
        "column": column,
        "second_column": second_column,
    }
    payload.update(extra)

    return client.post(
        f"/api/datasets/{dataset_id}/execute",
        json=payload,
    )


def test_correlation_perfect_positive(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "Sales,Profit\n1,10\n2,20\n3,30\n4,40\n",
    )

    response = execute_correlation_api(
        dataset_id,
        "Sales",
        "Profit",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["operation"] == "correlation"
    assert data["column"] == "Sales"
    assert data["second_column"] == "Profit"
    assert data["correlation"] == pytest.approx(1.0)
    assert data["observation_count"] == 4
    assert data["strength"] == "strong"
    assert data["direction"] == "positive"


def test_correlation_perfect_negative(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "X,Y\n1,40\n2,30\n3,20\n4,10\n",
    )

    response = execute_correlation_api(dataset_id, "X", "Y")

    assert response.status_code == 200
    assert response.json()["correlation"] == pytest.approx(-1.0)
    assert response.json()["direction"] == "negative"


def test_correlation_negligible_linear_relationship(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "X,Y\n-1,1\n0,0\n1,1\n",
    )

    response = execute_correlation_api(dataset_id, "X", "Y")

    assert response.status_code == 200
    assert response.json()["correlation"] == pytest.approx(0.0)
    assert response.json()["strength"] == "negligible"
    assert response.json()["direction"] == "none"


def test_correlation_excludes_incomplete_pairs(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "X,Y\n1,10\n2,20\n3,NA\nNA,40\n4,40\n",
    )

    response = execute_correlation_api(dataset_id, "X", "Y")

    assert response.status_code == 200
    assert response.json()["observation_count"] == 3
    assert response.json()["correlation"] == pytest.approx(1.0)


def test_correlation_rejects_same_column(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "X,Y\n1,10\n2,20\n3,30\n",
    )

    response = execute_correlation_api(dataset_id, "X", "X")

    assert response.status_code == 422
    assert "different columns" in response.json()["detail"]


def test_correlation_rejects_missing_column(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "X,Y\n1,10\n2,20\n3,30\n",
    )

    response = execute_correlation_api(
        dataset_id,
        "X",
        "Unknown",
    )

    assert response.status_code == 422
    assert "does not exist" in response.json()["detail"]


def test_correlation_rejects_nonnumeric_column(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "X,Category\n1,A\n2,B\n3,C\n",
    )

    response = execute_correlation_api(
        dataset_id,
        "X",
        "Category",
    )

    assert response.status_code == 422
    assert "numeric values" in response.json()["detail"]


def test_correlation_rejects_constant_column(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "X,Y\n1,10\n1,20\n1,30\n",
    )

    response = execute_correlation_api(dataset_id, "X", "Y")

    assert response.status_code == 422
    assert "constant" in response.json()["detail"]


def test_correlation_rejects_insufficient_pairs(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "X,Y\n1,10\n2,NA\nNA,30\n",
    )

    response = execute_correlation_api(dataset_id, "X", "Y")

    assert response.status_code == 422
    assert "at least two rows" in response.json()["detail"]


def test_correlation_requires_second_column(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "X,Y\n1,10\n2,20\n3,30\n",
    )

    response = client.post(
        f"/api/datasets/{dataset_id}/execute",
        json={
            "operation": "correlation",
            "column": "X",
        },
    )

    assert response.status_code == 422
    assert "second numeric column" in response.json()["detail"]


def test_correlation_rejects_aggregation_parameter(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "X,Y\n1,10\n2,20\n3,30\n",
    )

    response = execute_correlation_api(
        dataset_id,
        "X",
        "Y",
        aggregation="sum",
    )

    assert response.status_code == 422
    assert "does not support" in response.json()["detail"]


def test_correlation_returns_chart_points(tmp_path, monkeypatch):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "X,Y\n1,10\n2,20\n3,30\n",
    )

    response = execute_correlation_api(dataset_id, "X", "Y")

    assert response.status_code == 200

    data = response.json()

    assert data["points"] == [
        {"x": 1.0, "y": 10.0},
        {"x": 2.0, "y": 20.0},
        {"x": 3.0, "y": 30.0},
    ]
    assert data["sampled"] is False
    assert data["observation_count"] == len(data["points"])


def test_correlation_chart_points_exclude_incomplete_pairs(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "measures.csv",
        "X,Y\n1,10\n2,NA\n3,30\nNA,40\n4,40\n",
    )

    response = execute_correlation_api(dataset_id, "X", "Y")

    assert response.status_code == 200

    data = response.json()

    assert data["observation_count"] == 3
    assert data["points"] == [
        {"x": 1.0, "y": 10.0},
        {"x": 3.0, "y": 30.0},
        {"x": 4.0, "y": 40.0},
    ]
    assert data["sampled"] is False


def test_correlation_samples_large_chart_but_uses_all_observations(
    tmp_path,
    monkeypatch,
):
    observation_count = 1501
    csv_lines = ["X,Y"]
    csv_lines.extend(
        f"{index},{index * 3 + 7}"
        for index in range(observation_count)
    )

    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "large_measures.csv",
        "\n".join(csv_lines) + "\n",
    )

    response = execute_correlation_api(dataset_id, "X", "Y")

    assert response.status_code == 200

    data = response.json()

    assert data["observation_count"] == observation_count
    assert data["correlation"] == pytest.approx(1.0)
    assert data["sampled"] is True
    assert len(data["points"]) == 1000

    # Deterministic even-spacing sampling preserves both endpoints.
    assert data["points"][0] == {"x": 0.0, "y": 7.0}
    assert data["points"][-1] == {
        "x": float(observation_count - 1),
        "y": float((observation_count - 1) * 3 + 7),
    }

    # The returned chart points are a sample, not the full statistical input.
    assert len(data["points"]) < data["observation_count"]

