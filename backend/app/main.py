from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.upload import router as upload_router
from app.api.profiling import router as profiling_router
from app.api.quality import router as quality_router
from app.api.analysis import router as analysis_router
from app.api.execution import router as execution_router

app = FastAPI(
    title="InsightForge AI API",
    version="0.1.0",
    description="AI Business Analytics & Decision Intelligence Platform API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
app.include_router(profiling_router, prefix="/api")
app.include_router(quality_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(execution_router, prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "InsightForge AI API", "status": "running"}