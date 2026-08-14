import os
import requests

base = os.getenv("SUPABASE_URL", "https://your-project-ref.supabase.co").rstrip("/")
url = f"{base}/rest/v1/cases?select=*"
anon_key = os.getenv("SUPABASE_ANON_KEY", "your_supabase_anon_key")

headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Content-Type": "application/json"
}

res = requests.get(url, headers=headers)
print(res.status_code)
print(res.text)
