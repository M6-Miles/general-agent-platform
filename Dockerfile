FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple
ARG PYTORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
WORKDIR /app
ENV PIP_DEFAULT_TIMEOUT=120 PIP_RETRIES=5
COPY pyproject.toml ./
COPY app/__init__.py ./app/__init__.py
RUN pip install --no-cache-dir --disable-pip-version-check \
      --index-url ${PYTORCH_INDEX_URL} torch==2.6.0 && \
    pip install --no-cache-dir --disable-pip-version-check \
      --index-url ${PIP_INDEX_URL} .
COPY app ./app
COPY migrations ./migrations
COPY scripts ./scripts
COPY alembic.ini ./
RUN mkdir -p /app/data && \
    useradd --create-home --uid 10001 appuser && \
    chown -R appuser:appuser /app/data
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
