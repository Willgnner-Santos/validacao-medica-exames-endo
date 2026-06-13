# ── Stage 1: build React ──────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /frontend
COPY frontend/package.json .
RUN npm install
COPY frontend/ .
RUN npm run build

# ── Stage 2: FastAPI + arquivos estáticos ─────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app/ ./app/

# React build servido diretamente pelo FastAPI
COPY --from=frontend-build /frontend/dist ./static

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
