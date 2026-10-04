from pathlib import Path


def connect_read_only(parquet_path: Path):
    """Create a read-only DuckDB connection for analytical datasets.

    The dependency is imported lazily so the API/profile slice can run without
    starting the analytical engine. Later analysis services should use this
    adapter instead of giving an LLM direct database access.
    """
    import duckdb

    connection = duckdb.connect(database=":memory:", read_only=False)
    connection.execute("CREATE OR REPLACE VIEW dataset AS SELECT * FROM read_parquet(?)", [str(parquet_path)])
    return connection
