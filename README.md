# InsightForge AI

### AI-Powered Business Analytics & Decision Intelligence Platform

InsightForge AI is a business analytics platform designed to help users
understand datasets, assess data quality, execute analytical operations,
visualize results, and interpret findings for business decision-making.

The core workflow is:

**Understand → Clean → Analyze → Visualize → Explain → Decide**

> Project status: MVP development and final verification.

---

## 1. Core Features

### Dataset Ingestion and Profiling
- Upload CSV and Excel datasets.
- Inspect dataset dimensions and column information.
- Review column types, semantic information, and missing values.
- Examine dataset profiling results.

### Data Quality Assessment
- Detect missing values.
- Identify duplicate rows.
- Detect empty and constant columns.
- Identify date-like values stored as text.
- Detect invalid date values and high-cardinality columns.
- Review issue severity and data-quality recommendations.

### Business Analysis Planner
- Submit a business objective.
- Evaluate the objective against available dataset information.
- Recommend relevant analytical approaches and KPIs.
- Identify suitable columns for supported analyses.
- Review recommendations before executing an analysis.

Planner recommendations should be distinguished from analyses that have
actually been executed.

### Analytical Operations
- KPI calculations and aggregations.
- Descriptive statistics.
- Trend analysis.
- Segment comparison.
- Pearson correlation analysis.

### Visualizations and Business Insights
- View analytical results and charts.
- Review automatically generated business insights.
- Examine supporting evidence and limitations.
- Explore suggested follow-up questions.

---

## 2. Technology Stack

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Plotly
- Vitest

### Backend
- Python 3.12
- FastAPI
- Pydantic
- Pandas
- PyArrow
- DuckDB
- SQLAlchemy
- PostgreSQL driver using psycopg

### Testing and Infrastructure
- pytest
- Vitest
- Next.js production build
- Docker Compose for PostgreSQL

---

## 3. Project Structure

```text
insightforge-ai/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
├── data/
│   └── samples/
├── docker-compose.yml
└── README.md