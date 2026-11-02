# ==============================================================================
# SitePulse — ML Inference Service Dockerfile (FastAPI)
# Lightweight Python 3.10 container serving serialized ML artifacts
# ==============================================================================

FROM python:3.10-slim AS runner

WORKDIR /app

# Install system dependencies if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/ml_service/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy serialized models and service code
COPY model ./model
COPY backend/ml_service ./backend/ml_service

EXPOSE 8000

ENV PYTHONPATH=/app

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "backend.ml_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
