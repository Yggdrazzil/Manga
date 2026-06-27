FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN pip install --upgrade pip setuptools wheel
COPY pyproject.toml ./
RUN pip install --no-build-isolation .

COPY . .

CMD ["python", "-m", "worker"]
