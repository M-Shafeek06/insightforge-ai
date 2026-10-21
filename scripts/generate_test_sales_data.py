from pathlib import Path
import numpy as np
import pandas as pd

# ---------------------------------------------------------
# InsightForge AI - Final Testing Dataset Generator
# Reproducible data; original sample_sales.csv is untouched.
# ---------------------------------------------------------

SEED = 20261021
ROW_COUNT = 5000

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "data" / "samples"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

REFERENCE_PATH = OUTPUT_DIR / "final_testing_sales_clean_reference.csv"
TEST_PATH = OUTPUT_DIR / "final_testing_sales.csv"

rng = np.random.default_rng(SEED)

# Business dimensions
regions = ["North", "South", "East", "West", "Central"]
categories = [
    "Electronics",
    "Furniture",
    "Office Supplies",
    "Accessories",
    "Appliances",
]

products_by_category = {
    "Electronics": ["Laptop", "Monitor", "Keyboard", "Headphones"],
    "Furniture": ["Office Chair", "Desk", "Bookshelf", "Cabinet"],
    "Office Supplies": ["Notebook", "Printer Paper", "Pens", "Folders"],
    "Accessories": ["Mouse", "USB Hub", "Webcam", "Laptop Stand"],
    "Appliances": ["Coffee Maker", "Air Purifier", "Desk Fan", "Heater"],
}

sales_channels = ["Online", "Retail Store", "Marketplace", "Direct Sales"]
customer_segments = ["Consumer", "Small Business", "Corporate", "Enterprise"]

# Generate transaction dimensions.
dates = (
    pd.Timestamp("2025-01-01")
    + pd.to_timedelta(
        rng.integers(
            0,
            (pd.Timestamp("2026-10-01") - pd.Timestamp("2025-01-01")).days,
            size=ROW_COUNT,
        ),
        unit="D",
    )
)

region_values = rng.choice(
    regions, size=ROW_COUNT, p=[0.24, 0.25, 0.17, 0.19, 0.15]
)

category_values = rng.choice(
    categories, size=ROW_COUNT, p=[0.25, 0.20, 0.22, 0.18, 0.15]
)

products = [
    rng.choice(products_by_category[category])
    for category in category_values
]

quantity = rng.integers(1, 16, size=ROW_COUNT)
unit_price = np.round(rng.uniform(15, 1800, size=ROW_COUNT), 2)
discount = rng.choice(
    [0, 5, 10, 15, 20, 25],
    size=ROW_COUNT,
    p=[0.20, 0.20, 0.25, 0.18, 0.12, 0.05],
)

gross_sales = quantity * unit_price
sales = np.round(gross_sales * (1 - discount / 100), 2)

cost_rates = rng.uniform(0.48, 0.84, size=ROW_COUNT)
cost = np.round(sales * cost_rates, 2)
profit = np.round(sales - cost, 2)

# Exactly 13 analytical columns in the clean reference dataset.
clean_reference = pd.DataFrame({
    "OrderID": [f"ORD-{i:06d}" for i in range(1, ROW_COUNT + 1)],
    "OrderDate": dates.strftime("%Y-%m-%d"),
    "Region": region_values,
    "Category": category_values,
    "Product": products,
    "SalesChannel": rng.choice(sales_channels, size=ROW_COUNT),
    "Quantity": quantity,
    "UnitPrice": unit_price,
    "DiscountPercent": discount,
    "Sales": sales,
    "Cost": cost,
    "Profit": profit,
    "CustomerSegment": rng.choice(customer_segments, size=ROW_COUNT),
})

# Save a clean reference before introducing data-quality issues.
clean_reference.to_csv(REFERENCE_PATH, index=False)

# Add two intentional data-quality columns.
test_data = clean_reference.copy()
test_data["ConstantFlag"] = "TEST"
test_data["EmptyColumn"] = ""

# Introduce exactly 50 missing Sales values.
# These are separate from the rows used for duplicate injection.
test_data.loc[0:49, "Sales"] = np.nan

# Replace the final 25 rows with copies of earlier rows.
# This produces exactly 25 duplicate rows while preserving 5,000 rows.
test_data.iloc[-25:] = test_data.iloc[100:125].to_numpy()

# Write missing values as empty CSV cells.
test_data.to_csv(TEST_PATH, index=False, na_rep="")

# ---------------------------------------------------------
# Independent validation
# ---------------------------------------------------------

reloaded_reference = pd.read_csv(REFERENCE_PATH)
reloaded_test = pd.read_csv(TEST_PATH)

assert reloaded_reference.shape == (5000, 13)
assert reloaded_test.shape == (5000, 15)
assert reloaded_reference["OrderID"].is_unique
assert int(reloaded_test.duplicated().sum()) == 25
assert int(reloaded_test["Sales"].isna().sum()) == 50
assert reloaded_test["EmptyColumn"].isna().all()
assert reloaded_test["ConstantFlag"].nunique(dropna=False) == 1
assert reloaded_reference.isna().sum().sum() == 0

print("\nDATASET GENERATION SUCCESSFUL")
print("-" * 55)

print(f"Project root: {PROJECT_ROOT}")
print(f"Reference file: {REFERENCE_PATH}")
print(f"Testing file:   {TEST_PATH}")

print("\nCLEAN REFERENCE")
print(f"Rows: {reloaded_reference.shape[0]}")
print(f"Columns: {reloaded_reference.shape[1]}")
print(f"Missing cells: {int(reloaded_reference.isna().sum().sum())}")
print(f"Unique OrderIDs: {reloaded_reference['OrderID'].nunique()}")

print("\nMAIN TESTING DATASET")
print(f"Rows: {reloaded_test.shape[0]}")
print(f"Columns: {reloaded_test.shape[1]}")
print(f"Duplicate rows: {int(reloaded_test.duplicated().sum())}")
print(f"Missing Sales values: {int(reloaded_test['Sales'].isna().sum())}")
print(f"EmptyColumn entirely empty: {reloaded_test['EmptyColumn'].isna().all()}")
print(f"ConstantFlag distinct values: {reloaded_test['ConstantFlag'].nunique(dropna=False)}")

print("\nMAIN DATASET COLUMNS")
for column in reloaded_test.columns:
    print(f"- {column}")

print("\nREFERENCE BUSINESS METRICS")
print(f"Total Sales: {reloaded_reference['Sales'].sum():,.2f}")
print(f"Total Cost: {reloaded_reference['Cost'].sum():,.2f}")
print(f"Total Profit: {reloaded_reference['Profit'].sum():,.2f}")
print(f"Total Quantity: {reloaded_reference['Quantity'].sum():,}")
print(f"Average Order Sales: {reloaded_reference['Sales'].mean():,.2f}")

print("\nAll dataset assertions passed.")
