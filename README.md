# InsightForge AI

AI-Powered Business Analytics & Decision Intelligence Platform.

## Current vertical slice

**CSV/XLSX upload → FastAPI → Pandas profiling → Next.js profile display**

### Run locally

Backend:

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

API docs: `http://localhost:8000/docs`.
