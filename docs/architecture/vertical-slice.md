# Vertical Slice 01 — Dataset Profiling

CSV/XLSX upload is persisted to the raw layer. Pandas profiles the uploaded file and FastAPI returns a JSON profile. Next.js renders the profile without performing analytics itself.

The AI layer is intentionally absent from this slice: deterministic profiling comes first.
