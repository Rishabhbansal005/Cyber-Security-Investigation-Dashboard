import os
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""

    # JWT
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # App
    environment: str = "development"
    log_level: str = "debug"

    # Storage
    storage_bucket: str = "forensic_uploads"
    max_file_size_mb: int = 500

    # Forensic Tools (future integration)
    volatility_path: str = "/usr/local/bin/vol"
    wireshark_path: str = "/usr/bin/wireshark"
    autopsy_api_url: str = "http://localhost:9999/api"
    ftk_api_url: str = "http://localhost:8888/api"

    # ── Email / SMTP ─────────────────────────────────────────────────────────
    # Store these in backend/.env — NEVER expose to the frontend.
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""            # e.g. your-gmail@gmail.com
    smtp_password: str = ""        # Gmail App Password (not login password)
    notify_email: str = ""         # Destination address for notifications
    smtp_from_name: str = "CCID Platform"

    # ── Contact Form Rate Limiting ────────────────────────────────────────────
    rate_limit_contact: str = "5/minute"

    # OSINT & AI Integration
    alienvault_otx_key: str = ""
    threatfox_auth_key: str = ""
    urlhaus_auth_key: str = ""
    anthropic_api_key: str = ""
    shodan_api_key: str = ""
    gnews_api_key: str = ""

    # AI Integration Governance & Safety Settings
    ai_mode: str = "disabled"  # "disabled" | "local_only" | "cloud_approved"
    ai_provider: str = "local"  # "local" | "cloud"
    ai_base_url: str = "http://localhost:11434/v1"
    ai_api_key: str = ""
    ai_model_name: str = "llama3"
    cloud_approved_for_real_data: bool = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
