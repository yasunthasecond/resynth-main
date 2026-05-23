
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
            
            if sb_service:
                sb_service.table("integrations").upsert({
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

@app.get("/api/integrations")
async def get_integrations(user: CurrentUser = Depends(require_user)):
    if not sb_service:
        return []
    res = sb_service.table("integrations").select("*").eq("user_id", user.id).execute()
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
        
        if sb_service and user_id:
            # Upgrade user plan to pro
            sb_service.table("profiles").update({"plan": "pro"}).eq("id", user_id).execute()
            
    return {"status": "success"}

# ── End Restored Routes ──
