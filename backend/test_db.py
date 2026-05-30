import os
from dotenv import load_dotenv
load_dotenv('c:/Users/whuzf/Downloads/NonstopAnotherQuarks/NonstopAnotherQuarks/.env')
from supabase import create_client
sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
try:
    print(sb.table('chats').insert({"user_id": "00000000-0000-0000-0000-000000000000", "title": "test"}).execute())
except Exception as e:
    print(f"Error: {e}")
