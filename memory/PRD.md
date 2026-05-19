# Xynth AI — Product Requirements

## Problem Statement (Original)
> Recreate https://github.com/yasunthausa-cell/xynth-ai with full functions and existing themes (Resynth AI's emerald + dark futuristic look). Match a ChatGPT-style chat layout but don't copy word-for-word — add live glowing animations. Use ai.tetrific.com backend for streaming chats.

## User Choices
- Source repo cloned for reference (kept in /tmp/xynth_ref, not in /app)
- Backend streaming: proxy to https://ai.tetrific.com (guest mode)
- Auth: Supabase (UI ready, awaiting user-supplied SUPABASE_URL & SUPABASE_ANON_KEY)
- Features: streaming chat + history, Images generation, Apps directory, Deep Research mode
- Design: distinctive emerald-neon aesthetic with live glowing animations (NOT a ChatGPT clone)

## Architecture
- **Frontend**: React 18 + Tailwind + lucide-react + marked (Bricolage Grotesque + Inter + JetBrains Mono fonts). Single-page app at `/app/frontend/src/App.js`.
- **Backend**: FastAPI thin proxy at `/app/backend/server.py`. SSE pass-through for chat streaming.
- **Upstream**: ai.tetrific.com — guest mode, no API key required.
- **Storage (guest)**: localStorage (`xynth_chats_v1`, `xynth_images_v1`, `xynth_session`).
- **Storage (signed-in, future)**: Supabase (UI ready, real wiring pending keys).

## What's Implemented (2026-01)
- [x] FastAPI proxy: `/api/health`, `/api/models`, `/api/chat/stream` (SSE), `/api/generate-title`, `/api/generate-image`
- [x] Sidebar: glowing Xynth logo, gradient New Chat, nav (Search, Images, Apps, Deep Research), chat history with delete, Sign-in cell
- [x] Hero state: animated gradient headline, floating emerald orb, 4 suggestion chips
- [x] Streaming chat: token-by-token reveal, thinking dots, blinking caret, tool chips, auto-titles
- [x] Markdown rendering (marked + highlight.js) with code blocks, blockquotes, tables
- [x] Composer: auto-grow textarea, animated focus glow, Deep dive & Lit review mode pills, model selector
- [x] Images Studio: prompt-to-image (pollinations.ai), size selector, grid gallery, localStorage persistence
- [x] Apps directory: 6 specialised mode cards with animated glow
- [x] Search view: filter chats by title/content
- [x] Deep Research mode: alternate hero, deep_dive flag piped to backend
- [x] Auth modal: glassmorphic with email/password + sign-in/up tabs + guest fallback (placeholder until Supabase keys)
- [x] Ambient backdrop: grid pattern + dual aurora orbs (float + pulse)

## Tested (iteration 1) — 100% pass
- Backend: 6/6 pytest cases (health, models, chat/stream SSE, generate-title, generate-image)
- Frontend: 15/15 Playwright flows (hero, suggestion chips, streaming, sidebar nav, all 4 views, mode pills, auth modal, history persistence)

## Backlog
### P1 (high)
- Wire Supabase auth real flow (need user-provided `SUPABASE_URL` + `SUPABASE_ANON_KEY`)
- Sync chat history to Supabase for signed-in users
- Citation parsing for Deep Research mode (render sources block)

### P2 (medium)
- File / image attachment in composer (vision queries)
- Voice input (whisper transcribe endpoint)
- Per-chat rename + share link
- Settings panel: theme accent picker, font size

### P3 (nice-to-have)
- Mobile-optimized sidebar drawer
- Code splitting for App.js (~1230 LOC)
- Surface upstream HTTP errors (currently swallowed)

## Known Caveats
- Authentication UI is placeholder; clicking submit shows a friendly notice.
- Backend forwards upstream bytes verbatim — non-200 responses surface as silent empty streams (P3).
- Pollinations image URL is unauthenticated passthrough (fine for MVP).
