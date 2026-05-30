import os
from dotenv import load_dotenv

load_dotenv("c:/Users/whuzf/Downloads/NonstopAnotherQuarks/NonstopAnotherQuarks/backend/.env")
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

from supabase import create_client
sb = create_client(url, key)

try:
    res = sb.auth.admin.create_user({
        "id": "11111111-2222-3333-4444-555555555555",
        "email": "test111@test.com",
        "email_confirm": True,
        "password": "password123"
    })
    print("Created user:", res.user.id)
except Exception as e:
    print("Error:", e)
