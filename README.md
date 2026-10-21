# InsightForge AI

### AI-Powered Business Analytics & Decision Intelligence Platform

InsightForge AI is a business analytics platform designed to help users understand datasets, assess data quality, execute analytical operations, visualize results, and interpret findings to support business decision-making.

Its workflow follows:

**Understand → Clean → Analyze → Visualize → Explain → Decide**

**Project Status:** MVP implemented, deployed, and tested across multiple datasets.

---

## Live Application

* **Live Application:** https://insightforge-ai-sigma.vercel.app/
* **Backend API:** https://insightforge-ai-r64p.onrender.com
* **API Documentation:** https://insightforge-ai-r64p.onrender.com/docs
* **GitHub Repository:** https://github.com/M-Shafeek06/insightforge-ai

---

## 1. Core Features

### Dataset Ingestion and Profiling

* Upload CSV and Excel datasets.
* Inspect dataset dimensions and column information.
* Review column data types, semantic roles, and missing values.
* Examine dataset profiling results.

### Data Quality Assessment

* Detect missing values and duplicate rows.
* Identify empty and constant columns.
* Detect date-like values stored as text.
* Identify invalid date values and high-cardinality columns.
* Evaluate data-quality issues using severity classifications.
* Display quality scores, findings, and recommended actions.

### Business Analysis Planner

* Submit a business objective for analysis planning.
* Evaluate the objective against available dataset information.
* Recommend relevant KPIs and analytical approaches.
* Identify suitable columns for supported analyses.
* Review data-quality warnings before proceeding.

Planner recommendations are distinct from executed analyses. The planner proposes analytical approaches; the corresponding analytical operations must be executed separately.

### Analytical Operations

* **KPI Analysis:** Perform aggregations and optional group-by analysis.
* **Descriptive Statistics:** Examine numerical distributions and summary statistics.
* **Trend Analysis:** Analyze measures across time periods.
* **Segment Comparison:** Compare aggregated measures across categories.
* **Measure Relationship:** Assess relationships between numerical variables using Pearson correlation.

### Visualizations and Business Insights

* Visualize analytical results using charts and tables.
* Generate findings from calculated results.
* Review interpretations supported by analytical evidence.
* Examine data-quality limitations and missing-value implications.
* Explore suggested follow-up business questions.

Business insights are based on calculated observations. They do not independently establish causation, statistical significance, or overall business performance.

---

## 2. Technology Stack

### Frontend

* Next.js 16
* React 19
* TypeScript
* Tailwind CSS 4
* Plotly
* Vitest

### Backend

* Python 3.12
* FastAPI
* Pydantic
* Pandas
* PyArrow
* DuckDB
* SQLAlchemy
* psycopg PostgreSQL driver

### Testing and Infrastructure

* pytest
* Vitest
* Next.js production build
* Docker Compose
* PostgreSQL integration infrastructure

### Deployment

* **Frontend:** Vercel
* **Backend:** Render

---

## 3. System Architecture

InsightForge AI separates the user interface from the analytical backend.

```text
                  User
                   |
                   v
          Next.js Frontend
         TypeScript + Plotly
                   |
                   v
       Next.js API Route Handlers
                   |
                   v
           FastAPI Backend
                   |
          +--------+--------+
          |                 |
          v                 v
   Dataset Profiling   Data Quality
          |                 |
          +--------+--------+
                   |
                   v
         Analytical Services
                   |
          +--------+--------+
          |                 |
          v                 v
    KPI Operations    Statistical Analysis
          |                 |
          +--------+--------+
                   |
                   v
         Results and Visualizations
                   |
                   v
        Business Insights and
        Analysis Recommendations
```

The platform uses deterministic data-processing and analytical operations for its implemented workflows. The analysis planner generates recommendations separately from analytical execution.

---

## 4. Project Structure

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
```

---

## 5. Local Development Setup

### Prerequisites

Install the following before running the project locally:

* Python 3.12
* Node.js and npm
* Git
* Docker Desktop, if using the provided PostgreSQL infrastructure

### Clone the Repository

```bash
git clone https://github.com/M-Shafeek06/insightforge-ai.git
cd insightforge-ai
```

### Backend Setup

Open a terminal in the repository root.

Create and activate a virtual environment:

```bash
cd backend
python -m venv .venv
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the backend dependencies:

```bash
python -m pip install -r requirements.txt
```

Configure any required environment variables according to the backend configuration.

Start the backend:

```bash
uvicorn app.main:app --reload
```

The backend API will normally be available at:

`http://127.0.0.1:8000`

API documentation:

`http://127.0.0.1:8000/docs`

### Frontend Setup

Open a second terminal in the repository root:

```bash
cd frontend
npm install
npm run dev
```

Use the local URL displayed by Next.js to access the application.

Configure the frontend's API routing and environment variables according to the existing project configuration.

### Database Infrastructure

If your local configuration requires PostgreSQL, start the configured services using Docker Compose from the repository root:

```bash
docker compose up -d
```

Use the environment variables and database configuration required by the backend. The database is not necessarily required for every individual analytical workflow, so consult the actual service configuration before assuming that every feature depends on it.

---

## 6. Testing

### Backend Tests

From the backend directory, with the project's virtual environment activated:

```bash
python -m pytest -q
```

### Frontend Tests

From the frontend directory:

```bash
npm test
```

### Production Build

From the frontend directory:

```bash
npm run build
```

These commands provide a starting point for reproducing the automated checks. Actual results depend on the current code, installed dependencies, environment configuration, and test execution.

The deployed application has also been manually exercised using multiple datasets to verify its major analytical workflows.

---

## 7. Data Handling and Analytical Limitations

* Data-quality findings are generated by deterministic rules.
* Missing values are distinguished from valid numerical values during supported analytical operations.
* Grouped aggregations report relevant row and value counts.
* Planner recommendations are not presented as completed calculations.
* Correlation indicates association, not causation.
* Small datasets can limit the reliability and interpretability of statistical analyses.
* Data-quality scores reflect the implemented quality rules rather than an absolute measure of business readiness.

Review data-quality warnings and validate important findings against relevant business context before making decisions.

---

## 8. Current Scope

The current MVP focuses on dataset ingestion, profiling, deterministic data-quality assessment, analytical execution, visualizations, business insights, and analysis planning.

The deployed application has been tested against multiple datasets, including small sample data and larger retail datasets.

Future improvements may include more advanced cleaning workflows, stronger statistical feasibility checks, persistent storage, and additional decision-support capabilities.

These are potential extensions rather than claims about functionality already implemented.

---

## 9. Project Objective

InsightForge AI aims to reduce the effort required to move from raw data to meaningful analytical results by combining dataset understanding, quality assessment, analytical execution, visualization, and business-oriented interpretation in a single application.

The objective is to make data analysis more accessible, structured, and explainable while keeping analytical calculations distinct from recommendations and interpretations.

---

**InsightForge AI — From raw data to clearer business decisions.**
