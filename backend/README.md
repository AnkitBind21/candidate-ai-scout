# Backend (FastAPI + PostgreSQL)

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env          # then edit .env with your Postgres credentials
```

## Run

```bash
uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Project structure

```
backend/
 ├── app/
 │   ├── main.py          # FastAPI app instance, CORS, router registration
 │   ├── database.py       # SQLAlchemy engine, session, Base, get_db dependency
 │   ├── config.py          # Settings loaded from environment variables (.env)
 │   ├── models/            # SQLAlchemy ORM models (empty, ready for use)
 │   ├── schemas/           # Pydantic v2 schemas (health.py included)
 │   ├── api/                # FastAPI routers (health.py + router.py aggregator)
 │   └── services/          # Business logic (health_service.py included)
 ├── requirements.txt
 ├── .env.example
 └── .gitignore
```

## Notes

- Database URL is built from individual `POSTGRES_*` env vars, or you can set `DATABASE_URL` directly to override.
- `GET /health` checks both the API and a live PostgreSQL connection (`SELECT 1`).
- No authentication is included yet, as requested — add it under `app/api/` and `app/services/` when ready.
- `models/` and `schemas/` are empty aside from health, ready for your next resources (add SQLAlchemy models to `models/`, then create matching Pydantic schemas in `schemas/`).
