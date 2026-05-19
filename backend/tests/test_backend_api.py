"""Backend API tests for Xynth AI FastAPI proxy."""
import os
import json
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://34e51b21-c5b4-4d0e-9f0a-65fd105d5b54.preview.emergentagent.com").rstrip("/")


# Health check endpoint
class TestHealth:
    def test_health_ok(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("status") == "ok"
        assert d.get("upstream") == "https://ai.tetrific.com"


# Models endpoint
class TestModels:
    def test_models_list(self):
        r = requests.get(f"{BASE_URL}/api/models", timeout=20)
        assert r.status_code == 200
        d = r.json()
        models = d.get("models", [])
        assert isinstance(models, list)
        assert any("Resynth 1.5" in str(m) for m in models)


# Title generation
class TestTitle:
    def test_generate_title(self):
        r = requests.post(
            f"{BASE_URL}/api/generate-title",
            json={"message": "help me write a cover letter"},
            timeout=20,
        )
        assert r.status_code == 200
        d = r.json()
        assert "title" in d
        assert isinstance(d["title"], str)
        assert len(d["title"]) > 0


# Image generation
class TestImage:
    def test_generate_image(self):
        r = requests.post(
            f"{BASE_URL}/api/generate-image",
            json={"prompt": "a neon cat"},
            timeout=20,
        )
        assert r.status_code == 200
        d = r.json()
        assert "url" in d
        assert isinstance(d["url"], str)
        assert d["url"].startswith("http")

    def test_generate_image_no_prompt(self):
        r = requests.post(
            f"{BASE_URL}/api/generate-image", json={"prompt": ""}, timeout=15
        )
        assert r.status_code == 400


# Chat stream SSE
class TestChatStream:
    def test_chat_stream_sse(self):
        payload = {"session_id": "test-sess-001", "message": "Say hello in one short sentence"}
        with requests.post(
            f"{BASE_URL}/api/chat/stream",
            json=payload,
            stream=True,
            timeout=60,
            headers={"Accept": "text/event-stream"},
        ) as r:
            assert r.status_code == 200
            ct = r.headers.get("Content-Type", "")
            assert "text/event-stream" in ct, f"Unexpected content-type: {ct}"

            saw_token_or_text = False
            saw_done = False
            start = time.time()
            data_lines = 0
            for line in r.iter_lines(decode_unicode=True):
                if line is None:
                    continue
                if not line:
                    continue
                if line.startswith("data:"):
                    data_lines += 1
                    payload_str = line[5:].strip()
                    try:
                        evt = json.loads(payload_str)
                    except Exception:
                        continue
                    t = evt.get("type")
                    if t in ("token", "text"):
                        saw_token_or_text = True
                    elif t == "done":
                        saw_done = True
                        break
                if time.time() - start > 50:
                    break

            assert data_lines > 0, "No SSE data lines received"
            assert saw_token_or_text, "No 'token' or 'text' event observed"
            # done is preferred but may sometimes time out — assert when seen
            assert saw_done, "No 'done' event observed"
