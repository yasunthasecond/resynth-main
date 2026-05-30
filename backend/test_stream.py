import asyncio
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)
try:
    response = client.post("/api/chat/stream", json={"message": "hi", "messages":[{"role":"user","content":"hi"}],"model":"qwen-plus-latest"})
    print(response.status_code)
    print(response.content)
except Exception as e:
    import traceback
    traceback.print_exc()
