# InsightForge AI
### Business Analytics & Decision Intelligence Platform

<p align="center">
  <strong>Explore Data. Assess Quality. Perform Analysis. Understand Results.</strong>
</p>

<p align="center">
  <a href="https://insightforge-ai-sigma.vercel.app/">Live Application</a> •
  <a href="https://insightforge-ai-r64p.onrender.com/docs">API Documentation</a> •
  <a href="https://github.com/M-Shafeek06/insightforge-ai">Source Code</a>
</p>

---

## Overview

**InsightForge AI** is a web-based business analytics platform for exploring tabular datasets, assessing data quality, carrying out supported analytical operations, and presenting results through visualizations and business-oriented interpretations.

The application brings together dataset upload, profiling, deterministic data-quality checks, analysis planning, analytical execution, and result visualization in one workflow.

**Project workflow:**

**Understand → Assess → Plan → Analyze → Visualize → Interpret**

The platform is designed to make common data-analysis tasks more structured and easier to explore. Analytical calculations are performed by the application's data-processing logic; analysis recommendations and interpretations should be reviewed in the context of the dataset and business question.

**Project status:** MVP deployed.

---

## Live Application

| Component | Link |
|---|---|
| Web application | [Open InsightForge AI](https://insightforge-ai-sigma.vercel.app/) |
| Backend API | [API endpoint](https://insightforge-ai-r64p.onrender.com) |
| API documentation | [FastAPI Swagger UI](https://insightforge-ai-r64p.onrender.com/docs) |
| Source code | [GitHub repository](https://github.com/M-Shafeek06/insightforge-ai) |

---

## Application Screenshots

The screenshots are stored in the **repository root**. The image references below intentionally use root-level relative paths, so there is no need to move them into a screenshots folder.

### Application Landing Page

![InsightForge AI landing page](Landing_Page_IFAI.png)

### Dataset Overview

![Dataset overview](Data_Set_Overview_IFAI.png)

### Data Quality Assessment

![Data quality assessment](Data_Quality_IFAI.png)

### Column Intelligence

![Column intelligence](Column_Intelligence_1_IFAI.png)

### Business Analysis Planner

![Business analysis planner](Business_Planner_1_IFAI.png)

### Analytical Results

![Analytical results](Analysis_IFAI.png)

### Business Insights

![Business insights](Business_Insight_IFAI.png)

---

## Core Features

### 1. Dataset Upload and Profiling

- Upload tabular datasets in CSV and Excel formats.
- Inspect dataset dimensions and column information.
- Review detected column data types and semantic information.
- Examine missing-value information and profiling results.

### 2. Data Quality Assessment

The application runs deterministic checks to identify potential data-quality issues, including:

- Missing values.
- Duplicate rows.
- Empty columns.
- Constant columns.
- Date-like values stored as text.
- Invalid date values.
- High-cardinality columns.

Findings are grouped by severity and accompanied by information intended to help users assess potential issues before analysis.

**Scope note:** Data-quality assessment and recommendations are not the same as an automated data-cleaning pipeline. This README does not claim that the application automatically transforms and saves a cleaned dataset.

### 3. Business Analysis Planner

The planner helps translate a stated business objective into a suggested analytical approach using the available dataset information.

It can help identify relevant columns, propose KPIs or analytical operations, and surface relevant data-quality considerations.

Planner recommendations are separate from analytical execution. A recommendation is not evidence that a calculation has already been run.

### 4. Analytical Operations

The backend includes services for the following supported operations:

| Operation | Purpose |
|---|---|
| KPI / aggregation analysis | Calculate measures, including optional grouping. |
| Descriptive statistics | Summarize numerical data. |
| Trend analysis | Examine a measure across time periods. |
| Segment comparison | Compare aggregated measures across categories. |
| Correlation analysis | Calculate Pearson correlation for supported numerical variables. |

The available inputs and validation rules depend on the selected operation and dataset.

### 5. Visualizations

The frontend presents analytical outputs through charts and tables, including views for trends, segment comparisons, and numerical relationships.

### 6. Business-Oriented Interpretations

The application presents interpretations based on analytical outputs and dataset observations. These are intended to help users explore results and consider follow-up questions.

Interpretations are not guarantees of business outcomes. Correlation does not establish causation, and statistical outputs should be assessed with appropriate context and data limitations in mind.

---

## Technology

The following technologies are reflected in the application's main frontend and backend implementation.

### Frontend

- **Next.js** — application framework and routing.
- **React** — user interface components.
- **TypeScript** — typed frontend development.
- **Tailwind CSS** — interface styling.
- **Plotly** — data visualization.
- **Vitest** — frontend test runner.

### Backend

- **Python** — backend application and analytical logic.
- **FastAPI** — REST API.
- **Pydantic / Pydantic Settings** — request validation and settings.
- **Pandas** — tabular data processing and analysis.
- **NumPy** — numerical operations.
- **Uvicorn** — ASGI server.

### Supporting configuration and libraries

The repository also includes configuration or dependencies for tools such as DuckDB, PyArrow, SQLAlchemy, PostgreSQL and psycopg. Their presence in dependency or configuration files should not be interpreted as proof that every application workflow uses them. The primary analytical services documented above use Pandas-based processing.

---

## Application Architecture

The application separates the web interface from the Python API.

```text
User
 |
 v
Next.js Frontend
 |
 v
Next.js API Route Handler
 |
 v
FastAPI Backend
 |
 +--------------------+
 |                    |
 v                    v
Dataset Upload    Dataset Profiling
 |                    |
 +----------+---------+
            |
            v
     Data Quality Checks
            |
            v
    Business Analysis Planner
            |
            v
     Analytical Execution
            |
            v
   Results and Visualizations
            |
            v
 Business-Oriented Interpretation
```

The planner proposes analytical approaches, while the execution services perform the corresponding supported calculations. These are distinct stages.

---

## Repository Structure

The main application directories and root-level screenshots are organized as follows:

```text
insightforge-ai/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── data/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── db.py
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── pytest.ini
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   └── package-lock.json
│
├── data/
│   └── samples/
│
├── docs/
│   └── architecture/
│
├── scripts/
│
├── Analysis_IFAI.png
├── Business_Insight_IFAI.png
├── Business_Planner_1_IFAI.png
├── Column_Intelligence_1_IFAI.png
├── Data_Quality_IFAI.png
├── Data_Set_Overview_IFAI.png
├── Landing_Page_IFAI.png
│
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

Additional screenshots and project files may also be present in the repository.

---

## Run Locally

### Prerequisites

- Python 3.12
- Node.js and npm
- Git

Docker Desktop is only needed if you intend to start the PostgreSQL service defined in the Compose configuration.

### 1. Clone the repository

```bash
git clone https://github.com/M-Shafeek06/insightforge-ai.git
cd insightforge-ai
```

### 2. Configure environment variables

Review `.env.example` and configure the variables required by the backend and frontend deployment setup.

The Next.js API route handler reads `BACKEND_URL` to forward API requests to the FastAPI service. For local development, its default backend address is `http://127.0.0.1:8000`.

Do not commit real credentials, passwords, private keys, or populated `.env` files.

### 3. Set up the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux:**

```bash
source .venv/bin/activate
```

Install the backend requirements:

```bash
python -m pip install -r requirements.txt
```

Start the API:

```bash
uvicorn app.main:app --reload
```

The API is available locally at:

```text
http://127.0.0.1:8000
```

Interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

### 4. Set up the frontend

Open a second terminal from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open the local address printed by the Next.js development server.

For local API requests, ensure the Next.js server can reach the FastAPI backend through `BACKEND_URL`.

### 5. Optional PostgreSQL service

The repository includes a Docker Compose configuration for PostgreSQL. If you need to run that service locally, start it from the repository root:

```bash
docker compose up -d
```

The presence of this service configuration does not mean every current application workflow requires PostgreSQL.

---

## Tests and Build Commands

### Backend tests

From the `backend` directory, with the virtual environment activated:

```bash
python -m pytest -q
```

### Frontend tests

From the `frontend` directory:

```bash
npm test
```

### Frontend production build

From the `frontend` directory:

```bash
npm run build
```

These are the repository's test and build commands. Results should be confirmed in the environment where they are run; this README does not imply that a test or build has passed on every machine.

---

## Data and Analytical Limitations

- Data-quality findings are produced by implemented deterministic checks.
- Planner recommendations are suggestions, not completed analytical results.
- Correlation describes statistical association and does not prove causation.
- Results depend on the quality, size, and suitability of the uploaded dataset.
- A quality score reflects the application's configured checks; it is not a universal certification of dataset quality.
- Business interpretations should be reviewed against domain knowledge before being used for decisions.

---

## Project Scope

The current project focuses on dataset upload and profiling, data-quality assessment, business analysis planning, supported analytical calculations, visualizations, and result interpretation.

Potential future work may include expanded data transformation capabilities, additional analytical methods, and broader persistence or decision-support functionality. These are future possibilities, not claims about features currently delivered.

---

## Author

**M. Shafeek**  
B.Tech – Artificial Intelligence & Data Science  
Dhaanish Ahmed Institute of Technology

**Areas of interest:** Data Analytics | Business Intelligence | Data-Driven Decision Making

- **Portfolio:** [m-shafeek06.github.io](https://m-shafeek06.github.io/)
- **GitHub:** [M-Shafeek06](https://github.com/M-Shafeek06)
- **LinkedIn:** [M Shafeek](https://www.linkedin.com/in/m-shafeek)
- **Email:** [shafeekm529@gmail.com](mailto:shafeekm529@gmail.com)

---

<p align="center">
  <strong>InsightForge AI</strong><br>
  Explore data. Understand results. Support better decisions.
</p>
