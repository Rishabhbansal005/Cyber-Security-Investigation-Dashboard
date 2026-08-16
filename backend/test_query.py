import os
import requests

url = "https://nikwmicqzoxmpuwfovve.supabase.co/rest/v1/cases?select=*"
anon_key = os.getenv("SUPABASE_ANON_KEY", "your_supabase_anon_key")

headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Content-Type": "application/json"
}

res = requests.get(url, headers=headers)
print(res.status_code)
print(res.text)
