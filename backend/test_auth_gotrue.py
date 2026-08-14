import httpx
from app.core.config import settings
key = settings.supabase_anon_key or ""
print(f"anon_key_configured={bool(key)} length={len(key)}")
