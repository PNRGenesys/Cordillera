# Control-plane middleware image (FastAPI + uvicorn).
FROM python:3.12-slim AS base

# Keep Python output unbuffered and skip .pyc files inside the container.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# Copy metadata and source, then install the project (with its pinned deps).
# The source is required at build time because the project is packaged from ./app.
COPY pyproject.toml ./
COPY app ./app
RUN pip install --upgrade pip && pip install .

# ---- Test stage: the same image plus the test dependencies and the suite ----
# Built on demand (`npm run test:middleware`), never part of the runtime image. It sits
# before the runtime stage so the last stage stays the default target for compose builds.
FROM base AS test
COPY tests ./tests
RUN pip install ".[test]"
CMD ["pytest", "-q"]

# ---- Runtime stage ----
FROM base AS runtime

EXPOSE 8000

# Image-level healthcheck. Uses the Python interpreter already in the image so
# the slim base does not need curl/wget installed.
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://localhost:{os.environ.get(\"PORT\",\"8000\")}/health').read()" || exit 1

# Run the ASGI server. Honors the PORT env var so compose controls the port.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
