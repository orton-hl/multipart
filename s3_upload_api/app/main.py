from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import uploads
from app.middleware.auth import AuthMiddleware
from app.middleware.logging import LoggingMiddleware
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: validate AWS credentials, warm boto3 session
    from app.services.s3 import s3_service
    await s3_service.validate_credentials()
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="S3 Multipart Presigned Upload API",
    description="Secure, scalable large-file upload via presigned S3 multipart URLs",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# --- Middleware (order matters: outermost = first to run) ---
app.add_middleware(LoggingMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# --- Routers ---
app.include_router(uploads.router, prefix="/uploads", tags=["uploads"])


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "version": "1.0.0"}
