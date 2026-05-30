import os
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

sb_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

try:
    users_resp = sb_admin.auth.admin.list_users()
    if isinstance(users_resp, list) and len(users_resp) > 0:
        first_user = users_resp[0]
        uid = first_user.id
        print(f"Testing on User {uid}")
        
        # update metadata
        current_meta = first_user.user_metadata or {}
        current_meta["test_memory"] = "hello world"
        
        resp = sb_admin.auth.admin.update_user_by_id(uid, {"user_metadata": current_meta})
        print("Update successful:", resp.user.user_metadata.get("test_memory"))
    else:
        print("No users found.")
except Exception as e:
    import traceback
    traceback.print_exc()
