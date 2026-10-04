from pathlib import Path

import pandas as pd

SUPPORTED_EXTENSIONS = {".csv", ".xlsx"}

class UnsupportedFileTypeError(ValueError):
    pass


def load_tabular_file(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path)
    if suffix == ".xlsx":
        return pd.read_excel(path)
    raise UnsupportedFileTypeError(f"Unsupported file type: {suffix}")
