from fastapi import APIRouter

from app.api import analysis, auth, candidates, health, jobs, matching, resume

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(jobs.router)
api_router.include_router(candidates.router)
api_router.include_router(resume.router)
api_router.include_router(matching.router)
api_router.include_router(analysis.router)