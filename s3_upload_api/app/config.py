from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # AWS
    AWS_REGION: str = "eu-west-1"
    AWS_ACCESS_KEY_ID: Optional[str] = None    # for LocalStack / explicit creds
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_ENDPOINT_URL: Optional[str] = None     # for LocalStack (e.g. http://localhost:4566)
    AWS_ROLE_ARN: Optional[str] = None         # IAM role for upload service (prod)
    S3_BUCKET: str                             # e.g. co-uploads-prod
    S3_PREFIX: str = "multipart"               # bucket key prefix
    KMS_KEY_ID: str = ""                       # empty = SSE-S3 default
    PRESIGN_TTL_SECONDS: int = 900             # 15 min
    UPLOAD_MAX_BYTES: int = 10 * 1024**3       # 10 GB
    UPLOAD_MIN_PART_BYTES: int = 5 * 1024**2   # 5 MB (S3 minimum)
    UPLOAD_MAX_PARTS: int = 10_000             # S3 hard limit
    STALE_UPLOAD_HOURS: int = 24

    # Auth
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    API_KEYS: List[str] = []                   # static API keys for partners

    # App
    ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: List[str] = ["*"]

    # Content-type allowlist
    ALLOWED_CONTENT_TYPES: List[str] = [
        "application/zip",
        "application/octet-stream",
        "application/gzip",
        "text/csv",
        "application/json",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
