import os
import httpx
from dotenv import load_dotenv

load_dotenv("c:/Users/whuzf/Downloads/NonstopAnotherQuarks/NonstopAnotherQuarks/backend/.env")
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Test chats insert
chat_payload = {
    "user_id": "11111111-2222-3333-4444-555555555555",
    "title": "Test Chat"
}

res = httpx.post(f"{url}/rest/v1/chats", headers=headers, json=chat_payload)
print("Chats Response:", res.status_code, res.text)

# Test daily_usage insert
usage_payload = {
    "user_id": "11111111-2222-3333-4444-555555555555",
    "day": "2026-05-26",
    "count": 1
}

res2 = httpx.post(f"{url}/rest/v1/daily_usage", headers=headers, json=usage_payload)
print("Usage Response:", res2.status_code, res2.text)
