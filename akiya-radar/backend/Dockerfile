FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for psycopg / geoalchemy build are covered by binary wheels;
# keep the image slim.
RUN pip install --upgrade pip setuptools wheel
COPY pyproject.toml ./
RUN pip install --no-build-isolation .

COPY . .

EXPOSE 8000

CMD ["./docker-entrypoint.sh"]
