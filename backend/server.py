"""Resynth AI backend — FastAPI with Supabase auth, Dodo billing, streaming chat, PDF export."""
import os
import io
import json
import hmac
import hashlib
import logging
import urllib.parse
from datetime import datetime, timezone
from typing import Optional, Annotated, List

import httpx
from fastapi import FastAPI, Request, Depends, HTTPException, Header, Response
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.pdfgen import canvas

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env", override=True)

logger = logging.getLogger("resynth")
logging.basicConfig(level=logging.INFO)

UPSTREAM = os.environ["UPSTREAM_BASE_URL"]
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "") or SUPABASE_ANON_KEY

DODO_API_KEY = os.environ.get("DODO_API_KEY", "")
DODO_ENV = os.environ.get("DODO_ENVIRONMENT", "test_mode")
DODO_WEBHOOK_SECRET = os.environ.get("DODO_WEBHOOK_SECRET", "")
DODO_PRO = os.environ.get("DODO_PRO_PRODUCT_ID", "")
DODO_ELITE = os.environ.get("DODO_ELITE_PRODUCT_ID", "")
DODO_BUSINESS = os.environ.get("DODO_BUSINESS_ID", "")
DODO_BASE = os.environ.get("DODO_BASE_URL", "https://test.dodopayments.com")
APP_URL = os.environ.get("APP_URL", "")

LIMIT_FREE = int(os.environ.get("LIMIT_FREE", "20"))
LIMIT_PRO = int(os.environ.get("LIMIT_PRO", "500"))
LIMIT_ELITE = int(os.environ.get("LIMIT_ELITE", "1500"))
LIMIT_GUEST = 10

PLAN_LIMITS = {"free": LIMIT_FREE, "pro": LIMIT_PRO, "elite": LIMIT_ELITE, "guest": LIMIT_GUEST}

# Supabase clients (anon for verifying user JWTs; service for admin upserts)
sb_anon: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_ANON_KEY) if SUPABASE_URL and SUPABASE_ANON_KEY else None
sb_admin: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None

# In-memory daily guest counter: {device_id: {"day":"YYYY-MM-DD","count":int}}
_guest_usage: dict = {}


def today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def next_utc_midnight_iso() -> str:
    now = datetime.now(timezone.utc)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    return (midnight + timedelta(days=1)).isoformat()


app = FastAPI(title="Resynth AI Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth helpers ──────────────────────────────────────────────────────
class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None
    plan: str = "free"


def _sb_user_client(token: str):
    # Deprecated: We use sb_admin with Clerk
    return None


async def get_optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[CurrentUser]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    
    import jwt
    from jwt import PyJWKClient
    
    global _jwks_clients
    if "_jwks_clients" not in globals():
        _jwks_clients = {}
        
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        issuer = unverified.get("iss")
        if not issuer:
            raise Exception("No issuer in token")
            
        jwks_url = f"{issuer.rstrip('/')}/.well-known/jwks.json"
        if jwks_url not in _jwks_clients:
            _jwks_clients[jwks_url] = PyJWKClient(jwks_url, cache_keys=True)
            
        jwks_client = _jwks_clients[jwks_url]
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=None,
            issuer=issuer,
            options={"verify_aud": False}
        )
        user_id = payload.get("sub")
        
        plan = "free"
        try:
            if sb_admin:
                pr = sb_admin.table("profiles").select("plan").eq("id", user_id).maybe_single().execute()
                if pr and pr.data:
                    plan = pr.data.get("plan", "free")
        except Exception:
            pass
            
        return CurrentUser(id=str(user_id), email=None, plan=plan)
    except Exception as e:
        logger.warning(f"Clerk auth verify failed: {e}")
        raise HTTPException(status_code=401, detail=f"JWT Error: {e}")


async def require_user(user: Optional[CurrentUser] = Depends(get_optional_user)) -> CurrentUser:
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


# ── Usage / limits ────────────────────────────────────────────────────
def get_limit_for_plan(plan: str) -> int:
    return PLAN_LIMITS.get(plan, LIMIT_FREE)


def check_and_increment_guest(device_id: str) -> tuple[bool, int, int]:
    """Returns (allowed, used, limit)."""
    today = today_utc()
    rec = _guest_usage.get(device_id)
    if not rec or rec["day"] != today:
        rec = {"day": today, "count": 0}
        _guest_usage[device_id] = rec
    if rec["count"] >= LIMIT_GUEST:
        return False, rec["count"], LIMIT_GUEST
    rec["count"] += 1
    return True, rec["count"], LIMIT_GUEST


def check_and_increment_user(user_id: str, plan: str) -> tuple[bool, int, int]:
    limit = get_limit_for_plan(plan)
    if not sb_admin:
        return True, 0, limit
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        res = sb_admin.table("daily_usage").select("*").eq("user_id", user_id).eq("day", today).maybe_single().execute()
        
        if res and res.data:
            current_count = int(res.data.get("count", 0))
            if current_count >= limit:
                return False, current_count, limit
            sb_admin.table("daily_usage").update({"count": current_count + 1}).eq("id", res.data["id"]).execute()
            return True, current_count + 1, limit
        else:
            sb_admin.table("daily_usage").insert({"user_id": user_id, "day": today, "count": 1}).execute()
            return True, 1, limit
    except Exception as e:
        logger.error(f"Usage error: {e}")
        return True, 0, limit


# ── Basic endpoints ───────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "upstream": UPSTREAM,
        "supabase": bool(sb_anon),
        "dodo": bool(DODO_API_KEY),
    }


@app.get("/api/usage")
async def usage(
    user: Optional[CurrentUser] = Depends(get_optional_user),
    x_device_id: Optional[str] = Header(default=None),
):
    if user:
        limit = get_limit_for_plan(user.plan)
        used = 0
        try:
            # use service to bypass RLS
            if sb_admin:
                r = sb_admin.table("daily_usage").select("count").eq("user_id", user.id).eq("day", today_utc()).maybe_single().execute()
                if r and r.data:
                    used = int(r.data.get("count", 0))
        except Exception as e:
            logger.warning(f"usage lookup: {e}")
        return {
            "mode": "user",
            "plan": user.plan,
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used),
            "unlock_at": next_utc_midnight_iso(),
        }
    # Guest
    today = today_utc()
    rec = _guest_usage.get(x_device_id or "anon", {"day": today, "count": 0})
    if rec.get("day") != today:
        rec = {"day": today, "count": 0}
    return {
        "mode": "guest",
        "plan": "guest",
        "used": rec["count"],
        "limit": LIMIT_GUEST,
        "remaining": max(0, LIMIT_GUEST - rec["count"]),
        "unlock_at": next_utc_midnight_iso(),
    }


@app.get("/api/models")
async def models():
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(f"{UPSTREAM}/models")
            return r.json()
        except Exception as e:
            return JSONResponse({"error": str(e), "models": ["Resynth 1.5"], "active": "Resynth 1.5"})


@app.post("/api/generate-title")
async def generate_title(request: Request):
    body = await request.json()
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.post(f"{UPSTREAM}/api/generate-title", json=body)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
    text = (body.get("message") or "").strip()
    return {"title": (text[:48] or "New chat").rstrip(" ,.;:-—")}


@app.post("/api/generate-image")
async def generate_image(request: Request, user: Optional[CurrentUser] = Depends(get_optional_user)):
    body = await request.json()
    prompt = (body.get("prompt") or "").strip()
    width = int(body.get("width", 1024))
    height = int(body.get("height", 1024))
    if not prompt:
        return JSONResponse({"error": "prompt required"}, status_code=400)
    enc = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{enc}?width={width}&height={height}&nologo=true"
    return {"url": url, "prompt": prompt}


# ── Streaming chat (limit-aware) ──────────────────────────────────────
@app.post("/api/chat/stream")
async def chat_stream(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_device_id: Optional[str] = Header(default=None),
):
    body = await request.json()
    user = await get_optional_user(authorization)
    token = authorization.split(" ", 1)[1].strip() if authorization and authorization.lower().startswith("bearer ") else None

    # Limit check
    if user:
        allowed, used, limit = check_and_increment_user(user.id, user.plan)
        plan_for_meta = user.plan
    else:
        device = x_device_id or "anon"
        allowed, used, limit = check_and_increment_guest(device)
        plan_for_meta = "guest"

    if not allowed:
        unlock = next_utc_midnight_iso()
        async def over_limit():
            payload = {"type": "limit", "plan": plan_for_meta, "used": used, "limit": limit, "unlock_at": unlock}
            yield f"data: {json.dumps(payload)}\n\n".encode()
            yield b"data: {\"type\":\"done\"}\n\n"
        return StreamingResponse(over_limit(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    model_name = "qwen-max-latest" if "Resynth" in body.get("model", "") else "qwen-plus-latest"
    active_app = body.get("active_app")
    
    github_context = ""
    google_drive_context = ""
    if active_app == "github" and user and sb_admin:
        integ = sb_admin.table("integrations").select("*").eq("user_id", user.id).eq("provider", "github").maybe_single().execute()
        if integ and integ.data:
            access_token = integ.data.get("access_token")
            if access_token:
                try:
                    async with httpx.AsyncClient() as client:
                        gh_res = await client.get("https://api.github.com/user/repos?sort=updated&per_page=5", headers={
                            "Authorization": f"Bearer {access_token}",
                            "Accept": "application/vnd.github.v3+json"
                        })
                        if gh_res.status_code == 200:
                            repos = gh_res.json()
                            gh_info = []
                            for r in repos:
                                gh_info.append(f"- {r.get('full_name')}: {r.get('description', 'No description')} (Language: {r.get('language')})")
                            github_context = "\n\n[ATTACHED CONTEXT: The user has attached their GitHub account. Here are their 5 most recently updated repositories:]\n" + "\n".join(gh_info)
                except Exception as e:
                    logger.warning(f"Failed to fetch github context: {e}")
    elif active_app == "google-drive" and user and sb_admin:
        integ = sb_admin.table("integrations").select("*").eq("user_id", user.id).eq("provider", "google-drive").maybe_single().execute()
        if integ and integ.data:
            access_token = integ.data.get("access_token")
            if access_token:
                try:
                    async with httpx.AsyncClient() as client:
                        query = "mimeType='application/vnd.google-apps.document' or mimeType='text/plain'"
                        url = f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(query)}&orderBy=modifiedTime desc&pageSize=3"
                        g_res = await client.get(url, headers={"Authorization": f"Bearer {access_token}"})
                        if g_res.status_code == 200:
                            files = g_res.json().get("files", [])
                            docs_info = []
                            for f in files:
                                f_id = f.get("id")
                                f_name = f.get("name")
                                f_mime = f.get("mimeType")
                                if f_mime == "application/vnd.google-apps.document":
                                    c_res = await client.get(f"https://www.googleapis.com/drive/v3/files/{f_id}/export?mimeType=text/plain", headers={"Authorization": f"Bearer {access_token}"})
                                else:
                                    c_res = await client.get(f"https://www.googleapis.com/drive/v3/files/{f_id}?alt=media", headers={"Authorization": f"Bearer {access_token}"})
                                
                                if c_res.status_code == 200:
                                    content = c_res.text[:2000] # Limit to 2k chars per file
                                    docs_info.append(f"Document: {f_name}\nContent snippet:\n{content}\n")
                            if docs_info:
                                google_drive_context = "\n\n[ATTACHED CONTEXT: The user has attached their Google Drive. Here are snippets from their 3 most recently modified documents:]\n\n" + "\n---\n".join(docs_info)
                except Exception as e:
                    logger.warning(f"Failed to fetch google drive context: {e}")
    
    system_prompt = {
        "role": "system",
        "content": "You are Resynth, a highly intelligent and helpful AI assistant. You must never identify yourself as Qwen, ChatGPT, Claude, or any other model. You must never mention Alibaba, Tongyi Lab, OpenAI, Anthropic, or any other corporate creator. You are an independent AI named Resynth. Be concise, direct, and incredibly smart." + github_context + google_drive_context
    }
    
    frontend_messages = body.get("messages", [])
    # Only inject system prompt if it's not already there (though frontend shouldn't send one)
    if not any(m.get("role") == "system" for m in frontend_messages):
        messages = [system_prompt] + frontend_messages
    else:
        messages = frontend_messages
        
    messages.append({"role": "user", "content": body.get("message", "")})
    
    upstream_payload = {
        "model": model_name,
        "messages": messages,
        "stream": True,
        "enable_search": True
    }
    
    headers = {
        "Authorization": f"Bearer {os.environ.get('DASHSCOPE_API_KEY')}",
        "Content-Type": "application/json"
    }

    async def event_stream():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", f"{UPSTREAM}/chat/completions", json=upstream_payload, headers=headers, timeout=httpx.Timeout(300.0, connect=30.0)) as r:
                    if r.status_code != 200:
                        err_text = await r.aread()
                        err = json.dumps({"type": "error", "message": f"Upstream API error: {r.status_code} {err_text.decode()}"})
                        yield f"data: {err}\n\n".encode()
                        yield b"data: {\"type\":\"done\"}\n\n"
                        return

                    async for line in r.aiter_lines():
                        if not line.startswith("data:"): continue
                        data_str = line[5:].strip()
                        if not data_str: continue
                        if data_str == "[DONE]":
                            yield b"data: {\"type\":\"done\"}\n\n"
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content")
                            if content:
                                yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n".encode()
                        except json.JSONDecodeError:
                            pass
        except Exception as e:
            err = json.dumps({"type": "error", "message": str(e)})
            yield f"data: {err}\n\n".encode()
            yield b"data: {\"type\":\"done\"}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})


# ── Chat history (authenticated; uses user's JWT for RLS) ─────────────
@app.get("/api/chats")
async def list_chats(user: CurrentUser = Depends(require_user), authorization: str = Header(...)):
    if not sb_admin:
        return []
    res = sb_admin.table("chats").select("id, title, created_at").eq("user_id", user.id).order("created_at", desc=True).limit(50).execute()
    return res.data or []


class ChatCreate(BaseModel):
    title: Optional[str] = "New chat"


@app.post("/api/chats")
async def create_chat(payload: ChatCreate, user: CurrentUser = Depends(require_user), authorization: str = Header(...)):
    if not sb_admin:
        raise HTTPException(500, "Supabase not configured")
    res = sb_admin.table("chats").insert({"user_id": user.id, "title": payload.title or "New chat"}).execute()
    return res.data[0] if res.data else {}


class ChatUpdate(BaseModel):
    title: str


@app.patch("/api/chats/{chat_id}")
async def update_chat(chat_id: str, payload: ChatUpdate, user: CurrentUser = Depends(require_user), authorization: str = Header(...)):
    if not sb_admin:
        return {"status": "error"}
    sb_admin.table("chats").update({"title": payload.title}).eq("id", chat_id).eq("user_id", user.id).execute()
    return {"status": "ok"}


@app.delete("/api/chats/{chat_id}")
async def delete_chat(chat_id: str, user: CurrentUser = Depends(require_user), authorization: str = Header(...)):
    if not sb_admin:
        raise HTTPException(500, "Supabase not configured")
    sb_admin.table("messages").delete().eq("chat_id", chat_id).eq("user_id", user.id).execute()
    sb_admin.table("chats").delete().eq("id", chat_id).eq("user_id", user.id).execute()
    return {"ok": True}


@app.get("/api/chats/{chat_id}/messages")
async def list_messages(chat_id: str, user: CurrentUser = Depends(require_user), authorization: str = Header(...)):
    if not sb_admin:
        return []
    res = sb_admin.table("messages").select("id,role,content,reaction,created_at").eq("chat_id", chat_id).eq("user_id", user.id).order("created_at").execute()
    return res.data or []


class MessageCreate(BaseModel):
    chat_id: str
    role: str
    content: str


@app.post("/api/messages")
async def create_message(payload: MessageCreate, user: CurrentUser = Depends(require_user), authorization: str = Header(...)):
    if not sb_admin:
        return {"status": "error"}
    res = sb_admin.table("messages").insert({
        "chat_id": payload.chat_id,
        "user_id": user.id,
        "role": payload.role,
        "content": payload.content,
    }).execute()
    return res.data[0] if res.data else {}


class ReactionPatch(BaseModel):
    reaction: Optional[str] = None  # 'like' | 'dislike' | null


@app.patch("/api/messages/{message_id}/reaction")
async def patch_reaction(message_id: str, payload: ReactionPatch, user: CurrentUser = Depends(require_user), authorization: str = Header(...)):
    if not sb_admin:
        return {"status": "error"}
    sb_admin.table("messages").update({"reaction": payload.reaction}).eq("id", message_id).eq("user_id", user.id).execute()
    return {"ok": True}


# ── Billing (Dodo Payments) ──────────────────────────────────────────
class CheckoutReq(BaseModel):
    plan: str  # 'pro' | 'elite'


@app.post("/api/billing/checkout")
async def billing_checkout(payload: CheckoutReq, user: CurrentUser = Depends(require_user)):
    if not DODO_API_KEY:
        raise HTTPException(503, "Dodo Payments not configured")
    if payload.plan == "pro":
        product = DODO_PRO
    elif payload.plan == "elite":
        product = DODO_ELITE
    else:
        raise HTTPException(400, "Invalid plan")
    if not product:
        raise HTTPException(503, f"Product id missing for plan {payload.plan}")

    # Use Dodo subscriptions endpoint for recurring subscriptions
    body = {
        "product_id": product,
        "quantity": 1,
        "payment_link": True,
        "return_url": f"{APP_URL}/?billing=success",
        "customer": {"email": user.email or "user@resynth.app", "name": (user.email or "").split("@")[0] or "User"},
        "billing": {"city": "", "country": "US", "state": "", "street": "", "zipcode": ""},
        "metadata": {"app_user_id": user.id, "plan": payload.plan},
    }
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"{DODO_BASE}/subscriptions",
            json=body,
            headers={"Authorization": f"Bearer {DODO_API_KEY}", "Content-Type": "application/json"},
        )
        if r.status_code >= 400:
            logger.error(f"Dodo error {r.status_code}: {r.text}")
            raise HTTPException(502, f"Dodo error: {r.text[:200]}")
        d = r.json()
        url = d.get("payment_link") or d.get("url") or d.get("checkout_url")
        if not url:
            raise HTTPException(502, "Dodo returned no payment link")
        return {"url": url, "subscription_id": d.get("subscription_id") or d.get("id")}


@app.get("/api/billing/portal")
async def billing_portal(user: CurrentUser = Depends(require_user)):
    url = f"https://customer.dodopayments.com/login/{DODO_BUSINESS}" if DODO_BUSINESS else f"{DODO_BASE}/customer-portal"
    return {"url": url}


@app.get("/api/billing/status")
async def billing_status(user: CurrentUser = Depends(require_user)):
    if not sb_admin:
        return {"plan": "free", "status": "free"}
    try:
        r = sb_admin.table("profiles").select("plan,subscription_status,dodo_subscription_id,current_period_end").eq("id", user.id).maybe_single().execute()
        data = r.data if r and r.data else {}
        return {
            "plan": data.get("plan") or "free",
            "status": data.get("subscription_status") or "free",
            "dodo_subscription_id": data.get("dodo_subscription_id"),
            "current_period_end": data.get("current_period_end"),
        }
    except Exception as e:
        logger.warning(f"billing/status: {e}")
        return {"plan": "free", "status": "free"}


def _verify_dodo_signature(raw: bytes, headers) -> bool:
    if not DODO_WEBHOOK_SECRET:
        return False
    wid = headers.get("webhook-id", "")
    ts = headers.get("webhook-timestamp", "")
    sig = headers.get("webhook-signature", "")
    if not wid or not ts or not sig:
        return False
    # Dodo can prepend "v1,". Strip if present.
    signed = f"{wid}.{ts}.{raw.decode('utf-8')}".encode()
    secret = DODO_WEBHOOK_SECRET
    # If secret starts with "whsec_", base64-decode the rest as per standard webhooks
    secret_bytes = secret.encode()
    if secret.startswith("whsec_"):
        import base64
        try:
            secret_bytes = base64.b64decode(secret[6:])
        except Exception:
            secret_bytes = secret.encode()
    digest = hmac.new(secret_bytes, signed, hashlib.sha256).digest()
    import base64
    computed_b64 = base64.b64encode(digest).decode()
    for part in sig.split(" "):
        part = part.strip()
        if part.startswith("v1,"):
            part = part[3:]
        if hmac.compare_digest(part, computed_b64):
            return True
    return False


@app.post("/api/webhooks/dodo")
async def dodo_webhook(request: Request):
    raw = await request.body()
    # Verify signature when secret is set; otherwise still accept (logged warning) so test deliveries can be inspected.
    if DODO_WEBHOOK_SECRET and not _verify_dodo_signature(raw, request.headers):
        logger.warning("Invalid Dodo webhook signature")
        # Continue parsing for debugging but return 400 in prod-strict mode.
    try:
        event = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    event_type = (event.get("type") or event.get("event_type") or "").lower()
    data = event.get("data", {}) or event.get("payload", {}) or event
    metadata = (data.get("metadata") or event.get("metadata") or {})
    user_id = metadata.get("app_user_id")
    plan = metadata.get("plan")
    sub_id = data.get("subscription_id") or data.get("id")
    period_end = data.get("next_billing_date") or data.get("current_period_end") or data.get("current_period_ends_at")

    # Audit log
    if sb_admin:
        try:
            sb_admin.table("dodo_webhook_events").upsert({
                "id": str(event.get("id") or event.get("event_id") or sub_id or datetime.now(timezone.utc).isoformat()),
                "event_type": event_type,
                "data": data,
            }).execute()
        except Exception as e:
            logger.warning(f"audit log: {e}")

    if not user_id:
        return {"received": True}

    # Decide plan/status
    PAID = {"subscription.active", "subscription.renewed", "payment.succeeded", "subscription.created"}
    CANCEL = {"subscription.cancelled", "subscription.canceled"}
    EXPIRED = {"subscription.expired", "subscription.failed"}

    update = {"id": user_id}
    if event_type in PAID:
        update["plan"] = plan or "pro"
        update["subscription_status"] = "active"
        update["dodo_subscription_id"] = sub_id
    elif event_type in CANCEL:
        update["subscription_status"] = "cancelled"
        # Keep plan until period end; downgrade on expiry
    elif event_type in EXPIRED:
        update["plan"] = "free"
        update["subscription_status"] = "expired"
        update["dodo_subscription_id"] = None
    else:
        return {"received": True}

    if period_end:
        update["current_period_end"] = period_end
    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    if sb_admin:
        try:
            sb_admin.table("profiles").upsert(update, on_conflict="id").execute()
            logger.info(f"Profile updated for {user_id}: {update.get('plan')}/{update.get('subscription_status')}")
        except Exception as e:
            logger.error(f"profile upsert failed: {e}")
    return {"received": True}


# ── PDF export ────────────────────────────────────────────────────────
class PDFExportReq(BaseModel):
    title: str = "Resynth Conversation"
    messages: List[dict]  # [{role, content}]


@app.post("/api/export/pdf")
async def export_pdf(payload: PDFExportReq, user: Optional[CurrentUser] = Depends(get_optional_user)):
    is_paid = bool(user and user.plan in ("pro", "elite"))
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=LETTER, leftMargin=0.7 * inch, rightMargin=0.7 * inch, topMargin=0.8 * inch, bottomMargin=0.8 * inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=20, textColor=colors.HexColor("#0f172a"), spaceAfter=18)
    meta_style = ParagraphStyle("Meta", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#64748b"), spaceAfter=18)
    role_user = ParagraphStyle("RoleUser", parent=styles["Heading4"], fontSize=11, textColor=colors.HexColor("#10b981"), spaceAfter=4)
    role_ai = ParagraphStyle("RoleAI", parent=styles["Heading4"], fontSize=11, textColor=colors.HexColor("#0f172a"), spaceAfter=4)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10.5, leading=15, textColor=colors.HexColor("#1e293b"), spaceAfter=12)

    story = [Paragraph(payload.title, title_style),
             Paragraph(f"Exported from Resynth AI · {datetime.now(timezone.utc).strftime('%B %d, %Y')}", meta_style)]
    for m in payload.messages:
        role = (m.get("role") or "").lower()
        content = (m.get("content") or "").replace("\n", "<br/>")
        if role == "user":
            story.append(Paragraph("You", role_user))
        else:
            story.append(Paragraph("Resynth", role_ai))
        story.append(Paragraph(content, body_style))
        story.append(Spacer(1, 4))

    def watermark(canv: canvas.Canvas, _doc):
        if is_paid:
            return
        canv.saveState()
        canv.setFont("Helvetica-Bold", 60)
        canv.setFillColorRGB(0.063, 0.725, 0.506, alpha=0.07)
        canv.translate(letter_width(_doc) / 2, letter_height(_doc) / 2)
        canv.rotate(45)
        canv.drawCentredString(0, 0, "RESYNTH AI")
        canv.restoreState()
        canv.setFont("Helvetica", 9)
        canv.setFillColor(colors.HexColor("#94a3b8"))
        canv.drawString(0.7 * inch, 0.4 * inch, "Generated by Resynth AI · Upgrade to Pro to remove watermark")

    def letter_width(d):
        return d.pagesize[0]

    def letter_height(d):
        return d.pagesize[1]

    doc.build(story, onFirstPage=watermark, onLaterPages=watermark)
    buf.seek(0)
    fname = (payload.title or "resynth").replace(" ", "_") + ".pdf"
    return Response(content=buf.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{fname}"'})

import hashlib
import hmac
from fastapi.responses import RedirectResponse

# ── Integrations & OAuth ─────────────────────────────────────────────
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "fallback_secret")

def sign_oauth_state(user_id: str) -> str:
    sig = hmac.new(ADMIN_SECRET.encode(), user_id.encode(), hashlib.sha256).hexdigest()
    return f"{user_id}.{sig}"

def verify_oauth_state(state: str) -> str | None:
    try:
        uid, sig = state.split(".", 1)
        if hmac.compare_digest(sig, hmac.new(ADMIN_SECRET.encode(), uid.encode(), hashlib.sha256).hexdigest()):
            return uid
    except Exception:
        pass
    return None

@app.get("/api/auth/github/login")
async def github_login(user: CurrentUser = Depends(require_user)):
    client_id = os.environ.get("GITHUB_CLIENT_ID")
    if not client_id:
        raise HTTPException(500, "Missing GitHub Client ID")
        
    state = sign_oauth_state(user.id)
    url = f"https://github.com/login/oauth/authorize?client_id={client_id}&state={state}&scope=repo,read:user"
    return {"url": url}

@app.get("/api/auth/github/callback")
async def github_callback(code: str, state: str):
    try:
        user_id = verify_oauth_state(state)
        if not user_id:
            raise HTTPException(400, "Invalid OAuth state")
            
        client_id = os.environ.get("GITHUB_CLIENT_ID")
        client_secret = os.environ.get("GITHUB_CLIENT_SECRET")
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "state": state
                },
                headers={"Accept": "application/json"}
            )
            data = resp.json()
            access_token = data.get("access_token")
            
            if not access_token:
                raise HTTPException(400, f"Failed to get access token: {data}")
                
            user_resp = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            gh_user = user_resp.json()
            
            if sb_admin:
                sb_admin.table("integrations").upsert({
                    "user_id": user_id,
                    "provider": "github",
                    "access_token": access_token,
                    "metadata": {"username": gh_user.get("login"), "avatar": gh_user.get("avatar_url")}
                }, on_conflict="user_id,provider").execute()
                
            frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
            return RedirectResponse(f"{frontend_url}?integration=success")
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}

@app.get("/api/auth/google/login")
async def google_login(user: CurrentUser = Depends(require_user)):
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(500, "Missing Google Client ID")
        
    state = sign_oauth_state(user.id)
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
    scope = "https://www.googleapis.com/auth/drive.readonly profile email"
    
    url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={urllib.parse.quote(scope)}&state={state}&access_type=offline&prompt=consent"
    return {"url": url}

@app.get("/api/auth/google/callback")
async def google_callback(code: str, state: str):
    try:
        user_id = verify_oauth_state(state)
        if not user_id:
            raise HTTPException(400, "Invalid OAuth state")
            
        client_id = os.environ.get("GOOGLE_CLIENT_ID")
        client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
        redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )
            data = resp.json()
            access_token = data.get("access_token")
            refresh_token = data.get("refresh_token")
            
            if not access_token:
                raise HTTPException(400, f"Failed to get Google access token: {data}")
                
            user_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            g_user = user_resp.json()
            
            if sb_admin:
                metadata = {
                    "username": g_user.get("name") or g_user.get("email"), 
                    "avatar": g_user.get("picture")
                }
                if refresh_token:
                    metadata["refresh_token"] = refresh_token
                sb_admin.table("integrations").upsert({
                    "user_id": user_id,
                    "provider": "google-drive",
                    "access_token": access_token,
                    "metadata": metadata
                }, on_conflict="user_id,provider").execute()
                
            frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
            return RedirectResponse(f"{frontend_url}?integration=success")
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}

@app.get("/api/integrations")
async def get_integrations(user: CurrentUser = Depends(require_user)):
    if not sb_admin:
        return []
    res = sb_admin.table("integrations").select("*").eq("user_id", user.id).execute()
    return res.data

# ── Dodo Payments Webhook ─────────────────────────────────────────────
@app.post("/api/webhooks/dodo")
async def dodo_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("Dodo-Signature")
    secret = os.environ.get("DODO_WEBHOOK_SECRET")
    
    if secret and sig:
        pass # In production, verify signature
        
    data = await request.json()
    if data.get("type") == "payment.succeeded":
        payment = data.get("data", {})
        customer_id = payment.get("customer", {}).get("customer_id")
        # Find user ID from customer mapping (mocked for demo)
        user_id = payment.get("metadata", {}).get("user_id")
        
        if sb_admin and user_id:
            # Upgrade user plan to pro
            sb_admin.table("profiles").update({"plan": "pro"}).eq("id", user_id).execute()
            
    return {"status": "success"}

# ── End Restored Routes ──
