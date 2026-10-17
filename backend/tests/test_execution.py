import pytest
import warnings
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.execution import AnalyticsExecutionRequest
from app.services.analytics_executor import execute_grouped_kpi

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
    """Send an ungrouped KPI request to the API."""
    return client.post(
        f"/api/datasets/{dataset_id}/execute",
        json={
            "operation": "kpi",
            "column": column,
            "aggregation": aggregation,
        },
    )


def execute_grouped_kpi_api(
    dataset_id,
    column,
    aggregation,
    group_by,
):
    """Send a grouped KPI request to the API."""
    return client.post(
        f"/api/datasets/{dataset_id}/execute",
        json={
            "operation": "kpi",
            "column": column,
            "aggregation": aggregation,
            "group_by": group_by,
        },
    )


# ---------------------------------------------------------------------
# Ungrouped KPI execution API tests
# ---------------------------------------------------------------------


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


# ---------------------------------------------------------------------
# Grouped execution service tests
# ---------------------------------------------------------------------


def test_grouped_sum_by_region(tmp_path, monkeypatch):
    from app.services.settings import settings

    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        (
            "Region,Sales\n"
            "South,1200\n"
            "North,800\n"
            "South,NA\n"
            "West,650\n"
            "North,900\n"
        ),
    )

    request = AnalyticsExecutionRequest(
        operation="kpi",
        column="Sales",
        aggregation="sum",
        group_by="Region",
    )

    result = execute_grouped_kpi(
        path=settings.upload_dir / f"{dataset_id}.csv",
        dataset_id=dataset_id,
        request=request,
    )

    groups = {group.group: group for group in result.groups}

    assert result.group_by == "Region"
    assert groups["North"].value == 1700.0
    assert groups["South"].value == 1200.0
    assert groups["West"].value == 650.0

    assert groups["South"].row_count == 2
    assert groups["South"].valid_value_count == 1
    assert groups["South"].null_count == 1


def test_grouped_average_returns_none_for_all_null_group(
    tmp_path,
    monkeypatch,
):
    from app.services.settings import settings

    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        (
            "Region,Sales\n"
            "South,NA\n"
            "South,NA\n"
            "North,800\n"
        ),
    )

    request = AnalyticsExecutionRequest(
        operation="kpi",
        column="Sales",
        aggregation="average",
        group_by="Region",
    )

    result = execute_grouped_kpi(
        path=settings.upload_dir / f"{dataset_id}.csv",
        dataset_id=dataset_id,
        request=request,
    )

    groups = {group.group: group for group in result.groups}

    assert groups["South"].value is None
    assert groups["South"].row_count == 2
    assert groups["South"].valid_value_count == 0
    assert groups["South"].null_count == 2

    assert groups["North"].value == 800.0


def test_grouped_count_supports_text_columns(
    tmp_path,
    monkeypatch,
):
    from app.services.settings import settings

    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "regions.csv",
        (
            "Region,Category\n"
            "South,Electronics\n"
            "South,Furniture\n"
            "North,Electronics\n"
        ),
    )

    request = AnalyticsExecutionRequest(
        operation="kpi",
        column="Category",
        aggregation="count",
        group_by="Region",
    )

    result = execute_grouped_kpi(
        path=settings.upload_dir / f"{dataset_id}.csv",
        dataset_id=dataset_id,
        request=request,
    )

    groups = {group.group: group for group in result.groups}

    assert groups["South"].value == 2.0
    assert groups["North"].value == 1.0


def test_grouped_execution_rejects_missing_group_column(
    tmp_path,
    monkeypatch,
):
    from app.services.settings import settings

    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Region,Sales\nSouth,100\nNorth,200\n",
    )

    request = AnalyticsExecutionRequest(
        operation="kpi",
        column="Sales",
        aggregation="sum",
        group_by="Country",
    )

    with pytest.raises(
        ValueError,
        match="Grouping column 'Country' does not exist",
    ):
        execute_grouped_kpi(
            path=settings.upload_dir / f"{dataset_id}.csv",
            dataset_id=dataset_id,
            request=request,
        )


# ---------------------------------------------------------------------
# Grouped execution API tests
# ---------------------------------------------------------------------


def test_grouped_sum_api_returns_results_by_region(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        (
            "Region,Sales\n"
            "South,1200\n"
            "North,800\n"
            "South,NA\n"
            "West,650\n"
            "North,900\n"
        ),
    )

    response = execute_grouped_kpi_api(
        dataset_id,
        "Sales",
        "sum",
        "Region",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["dataset_id"] == dataset_id
    assert data["operation"] == "kpi"
    assert data["column"] == "Sales"
    assert data["aggregation"] == "sum"
    assert data["group_by"] == "Region"

    groups = {item["group"]: item for item in data["groups"]}

    assert groups["North"]["value"] == 1700.0
    assert groups["South"]["value"] == 1200.0
    assert groups["West"]["value"] == 650.0

    assert groups["South"]["row_count"] == 2
    assert groups["South"]["valid_value_count"] == 1
    assert groups["South"]["null_count"] == 1


def test_grouped_count_api_supports_text_columns(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        (
            "Region,Category\n"
            "South,Electronics\n"
            "South,Furniture\n"
            "North,Electronics\n"
        ),
    )

    response = execute_grouped_kpi_api(
        dataset_id,
        "Category",
        "count",
        "Region",
    )

    assert response.status_code == 200

    groups = {
        item["group"]: item
        for item in response.json()["groups"]
    }

    assert groups["South"]["value"] == 2.0
    assert groups["North"]["value"] == 1.0


def test_grouped_api_rejects_missing_group_column(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Region,Sales\nSouth,100\nNorth,200\n",
    )

    response = execute_grouped_kpi_api(
        dataset_id,
        "Sales",
        "sum",
        "Country",
    )

    assert response.status_code == 422
    assert "Grouping column 'Country' does not exist" in (
        response.json()["detail"]
    )


def test_grouped_api_preserves_null_group_values(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        (
            "Region,Sales\n"
            "South,100\n"
            ",50\n"
            "North,200\n"
        ),
    )

    response = execute_grouped_kpi_api(
        dataset_id,
        "Sales",
        "sum",
        "Region",
    )

    assert response.status_code == 200

    data = response.json()
    groups = {
        item["group"]: item
        for item in data["groups"]
    }

    # Missing grouping values must remain a dedicated null group.
    assert None in groups
    assert groups[None]["value"] == 50.0
    assert groups[None]["row_count"] == 1
    assert groups[None]["valid_value_count"] == 1
    assert groups[None]["null_count"] == 0

    # Normal groups must remain intact.
    assert groups["South"]["value"] == 100.0
    assert groups["North"]["value"] == 200.0


def test_grouped_execution_rejects_infinite_numeric_group_values(
    tmp_path,
    monkeypatch,
):
    from app.services.settings import settings

    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "numeric_groups.csv",
        (
            "Group,Sales\n"
            "1,100\n"
            "inf,200\n"
        ),
    )

    request = AnalyticsExecutionRequest(
        operation="kpi",
        column="Sales",
        aggregation="sum",
        group_by="Group",
    )

    with pytest.raises(
        ValueError,
        match="The grouping column contains non-finite numeric values.",
    ):
        execute_grouped_kpi(
            path=settings.upload_dir / f"{dataset_id}.csv",
            dataset_id=dataset_id,
            request=request,
        )


def test_grouped_execution_excludes_unobserved_categories(
    tmp_path,
    monkeypatch,
):
    import pandas as pd

    from app.services.analytics_executor import execute_grouped_kpi

    df = pd.DataFrame(
        {
            "Region": pd.Categorical(
                ["North", "South"],
                categories=["North", "South", "Unused"],
            ),
            "Sales": [100, 200],
        }
    )

    monkeypatch.setattr(
        "app.services.analytics_executor.load_tabular_file",
        lambda path: df,
    )

    request = AnalyticsExecutionRequest(
        operation="kpi",
        column="Sales",
        aggregation="sum",
        group_by="Region",
    )

    result = execute_grouped_kpi(
        path=tmp_path / "unused.csv",
        dataset_id="test_dataset",
        request=request,
    )

    actual_groups = {group.group for group in result.groups}

    assert actual_groups == {"North", "South"}
    assert "Unused" not in actual_groups


# ---------------------------------------------------------------------
# Stage 13A: Analytics execution edge-case regression tests
# ---------------------------------------------------------------------


def test_kpi_sum_overflow_returns_422(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Sales\n1e308\n1e308\n",
    )

    # The overflow is intentional: verify the API rejects the result
    # without emitting an expected NumPy runtime warning in this test.
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="overflow encountered in reduce",
            category=RuntimeWarning,
        )
        response = execute_kpi(
            dataset_id,
            "Sales",
            "sum",
        )

    assert response.status_code == 422
    assert (
        response.json()["detail"]
        == "The aggregation produced a non-finite result."
    )


def test_grouped_sum_overflow_returns_422(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        (
            "Region,Sales\n"
            "South,1e308\n"
            "South,1e308\n"
            "North,100\n"
        ),
    )

    # Suppress only the expected overflow warning for this test case.
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="overflow encountered in reduce",
            category=RuntimeWarning,
        )
        response = execute_grouped_kpi_api(
            dataset_id,
            "Sales",
            "sum",
            "Region",
        )

    assert response.status_code == 422
    assert (
        response.json()["detail"]
        == "The aggregation produced a non-finite result."
    )


def test_kpi_handles_negative_and_zero_values(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        "Sales\n-100\n0\n300\n",
    )

    sum_response = execute_kpi(
        dataset_id,
        "Sales",
        "sum",
    )

    average_response = execute_kpi(
        dataset_id,
        "Sales",
        "average",
    )

    assert sum_response.status_code == 200
    assert sum_response.json()["value"] == 200.0

    assert average_response.status_code == 200
    assert average_response.json()["value"] == pytest.approx(
        66.6666666667
    )


def test_grouped_kpi_handles_negative_and_zero_values(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        (
            "Region,Sales\n"
            "North,-100\n"
            "North,0\n"
            "South,300\n"
        ),
    )

    response = execute_grouped_kpi_api(
        dataset_id,
        "Sales",
        "sum",
        "Region",
    )

    assert response.status_code == 200

    groups = {
        item["group"]: item
        for item in response.json()["groups"]
    }

    assert groups["North"]["value"] == -100.0
    assert groups["South"]["value"] == 300.0


def test_grouped_results_have_deterministic_order_for_equal_values(
    tmp_path,
    monkeypatch,
):
    dataset_id = create_dataset(
        tmp_path,
        monkeypatch,
        "sales.csv",
        (
            "Region,Sales\n"
            "West,100\n"
            "North,200\n"
            "South,200\n"
            "East,100\n"
        ),
    )

    response = execute_grouped_kpi_api(
        dataset_id,
        "Sales",
        "sum",
        "Region",
    )

    assert response.status_code == 200

    groups = response.json()["groups"]

    assert [item["group"] for item in groups] == [
        "East",
        "North",
        "South",
        "West",
    ]

    assert [item["value"] for item in groups] == [
        100.0,
        200.0,
        200.0,
        100.0,
    ]