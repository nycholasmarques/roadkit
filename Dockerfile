FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN useradd --system --uid 10001 --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app
COPY --chown=app:app index.html ./
COPY --chown=app:app src ./src
COPY --chown=app:app schema ./schema
COPY --chown=app:app tools ./tools
COPY --chown=app:app examples ./examples
# personal roadmaps are NOT baked into the image: compose mounts ./roadmaps here
# data/ holds the saved progress (compose mounts a volume there, so it survives rebuilds)
# manifest.json is regenerated at startup and on every load, so /app must stay writable by the app user
RUN mkdir roadmaps data && chown app:app /app roadmaps data

USER app
EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8765/manifest.json', timeout=3)"]

CMD ["python", "tools/roadkit.py", "serve", "--host", "0.0.0.0", "--port", "8765"]
