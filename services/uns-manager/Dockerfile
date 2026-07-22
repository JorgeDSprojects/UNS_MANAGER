FROM node:20-alpine AS ui-build

WORKDIR /ui

COPY ui/package*.json ./
RUN npm ci

COPY ui ./
RUN npm run build


FROM python:3.12-slim

WORKDIR /app

RUN useradd --create-home --shell /bin/bash appuser

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=ui-build /ui/dist /app/ui/dist

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
