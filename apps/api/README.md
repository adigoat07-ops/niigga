# LAB SAATHI OCR API

FastAPI microservice for OCR and structured extraction from uploaded lab reports.

## Run locally

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- GET /health
- POST /ocr
