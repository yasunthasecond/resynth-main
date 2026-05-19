import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Image as ImageIcon,
  LayoutGrid,
  Send,
  Trash2,
  ChevronLeft,
  Telescope,
  X,
  Loader2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Download,
  Paperclip,
  BookOpen,
  LogOut,
  User as UserIcon,
  CreditCard,
  Sparkles,
  Crown,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { marked } from "marked";
import katex from "katex";
import { supabase } from "./lib/supabase";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BACKEND_URL}/api`;

// ── helpers ──────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function getDeviceId() {
  let d = localStorage.getItem("re_device_id");
  if (!d) { d = uid(); localStorage.setItem("re_device_id", d); }
  return d;
}

// Render markdown with KaTeX math substitution.
function renderMarkdownMath(src) {
  if (!src) return "";
  const blocks = [];
  let s = src;
  // Display math $$...$$
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    try {
      const html = katex.renderToString(expr, { displayMode: true, throwOnError: false });
      blocks.push(html);
      return `@@KMATH${blocks.length - 1}@@`;
    } catch { return _; }
  });
  // Inline math $...$
  s = s.replace(/(^|[^\\])\$([^\n$]+?)\$/g, (_, pre, expr) => {
    try {
      const html = katex.renderToString(expr, { displayMode: false, throwOnError: false });
      blocks.push(html);
      return `${pre}@@KMATH${blocks.length - 1}@@`;
    } catch { return _; }
  });
  let html = marked.parse(s, { breaks: true, gfm: true });
  html = html.replace(/@@KMATH(\d+)@@/g, (_, i) => blocks[Number(i)] || "");
  return html;
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const t = data?.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// Local guest chats helpers — but per spec: guest mode doesn't save chats. We only keep current session in memory.
const LOCAL_RECENT_KEY = "re_user_chats_cache";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState({ plan: "free" });
  const [view, setView] = useState("chat");
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]); // active chat messages (in-memory always; persisted if signed-in)
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [billingStatus, setBillingStatus] = useState(null);
  const [limitInfo, setLimitInfo] = useState(null); // {plan, used, limit, unlock_at} when over

  const deviceId = useMemo(getDeviceId, []);

  // ── Auth ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAuthed = !!session;

  // Fetch profile + chats + billing when signed in
  useEffect(() => {
    if (!isAuthed) {
      setChats([]);
      setProfile({ plan: "free" });
      setBillingStatus(null);
      return;
    }
    (async () => {
      const headers = await authHeaders();
      // billing status
      fetch(`${API}/billing/status`, { headers })
        .then((r) => r.json())
        .then((d) => {
          setBillingStatus(d);
          setProfile((p) => ({ ...p, plan: d?.plan || "free" }));
        })
        .catch(() => {});
      // chats list
      fetch(`${API}/chats`, { headers })
        .then((r) => r.json())
        .then((arr) => Array.isArray(arr) ? setChats(arr) : setChats([]))
        .catch(() => setChats([]));
    })();
  }, [isAuthed]);

  // Fetch usage on session/plan change & periodically
  const refreshUsage = useCallback(async () => {
    const headers = await authHeaders();
    fetch(`${API}/usage`, { headers: { ...headers, "X-Device-Id": deviceId } })
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => {});
  }, [deviceId]);

  useEffect(() => { refreshUsage(); }, [refreshUsage, isAuthed, profile.plan]);

  // ── Chat actions ────────────────────────────────────────────────────
  const newChat = () => {
    setActiveId(null);
    setMessages([]);
    setView("chat");
    setLimitInfo(null);
  };

  const openChat = async (chatId) => {
    setActiveId(chatId);
    setView("chat");
    setLimitInfo(null);
    if (!isAuthed) return;
    const headers = await authHeaders();
    const r = await fetch(`${API}/chats/${chatId}/messages`, { headers });
    const arr = await r.json();
    setMessages(Array.isArray(arr) ? arr.map((m) => ({ ...m })) : []);
  };

  const deleteChat = async (chatId) => {
    const headers = await authHeaders();
    await fetch(`${API}/chats/${chatId}`, { method: "DELETE", headers });
    setChats((cs) => cs.filter((c) => c.id !== chatId));
    if (activeId === chatId) { setActiveId(null); setMessages([]); }
  };

  // Send a message (with optional image base64 + mode flags)
  const sendMessage = async (text, opts = {}) => {
    const { imageBase64 = null, deepDive = false, litReview = false, regenerateOf = null } = opts;
    if ((!text || !text.trim()) && !imageBase64) return;
    if (streaming) return;

    // Create chat in DB if signed in and no active
    let chat_id = activeId;
    if (isAuthed && !chat_id) {
      try {
        const headers = await authHeaders();
        const r = await fetch(`${API}/chats`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ title: text.slice(0, 48) || "New chat" }) });
        const d = await r.json();
        chat_id = d.id;
        setActiveId(chat_id);
        setChats((cs) => [{ id: chat_id, title: d.title }, ...cs]);
        // Title generation async
        fetch(`${API}/generate-title`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ message: text }) })
          .then((r) => r.json())
          .then((dd) => {
            if (dd?.title) {
              setChats((cs) => cs.map((c) => (c.id === chat_id ? { ...c, title: dd.title } : c)));
              fetch(`${API}/chats/${chat_id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ title: dd.title }) });
            }
          })
          .catch(() => {});
      } catch (e) { console.error(e); }
    }

    const userMsg = { id: uid(), role: "user", content: text || (imageBase64 ? "[image]" : ""), image: imageBase64 ? `data:image/jpeg;base64,${imageBase64.slice(0, 40)}…` : null };
    const aiMsg = { id: uid(), role: "assistant", content: "", streaming: true };

    // If regenerate, replace last AI message instead of appending
    let nextMessages;
    if (regenerateOf) {
      nextMessages = messages.slice(0, messages.findIndex((m) => m.id === regenerateOf));
      nextMessages.push({ ...messages.find((m) => m.id === regenerateOf), id: uid(), content: "", streaming: true });
      setMessages(nextMessages);
    } else {
      nextMessages = [...messages, userMsg, aiMsg];
      setMessages(nextMessages);
    }

    // Persist user message to DB
    if (isAuthed && chat_id && !regenerateOf) {
      try {
        const headers = await authHeaders();
        fetch(`${API}/messages`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ chat_id, role: "user", content: userMsg.content }) });
      } catch {}
    }

    setStreaming(true);
    setLimitInfo(null);
    try {
      const headers = await authHeaders();
      const resp = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": deviceId, ...headers },
        body: JSON.stringify({
          session_id: deviceId,
          message: text || "describe this image",
          chat_id: chat_id || "",
          deep_dive: !!deepDive,
          lit_review: !!litReview,
          image_data: imageBase64 || undefined,
        }),
      });
      if (!resp.body) throw new Error("No response stream");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accText = "";
      const updateAI = (patch) => {
        setMessages((cur) => cur.map((m, i, arr) => (i === arr.length - 1 ? { ...m, ...patch } : m)));
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of raw.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const evt = JSON.parse(payload);
              if (evt.type === "token" && evt.text) { accText += evt.text; updateAI({ content: accText }); }
              else if (evt.type === "text" && evt.content) { accText = evt.content; updateAI({ content: accText }); }
              else if (evt.type === "limit") {
                setLimitInfo(evt);
                updateAI({ content: "", streaming: false });
              } else if (evt.type === "error") {
                accText += `\n\n⚠️ ${evt.message || "Stream error"}`;
                updateAI({ content: accText });
              } else if (evt.type === "done") {
                updateAI({ streaming: false });
              }
            } catch {}
          }
        }
      }
      updateAI({ streaming: false });

      // Persist final AI message
      if (isAuthed && chat_id && accText) {
        const headers2 = await authHeaders();
        try {
          const r = await fetch(`${API}/messages`, { method: "POST", headers: { ...headers2, "Content-Type": "application/json" }, body: JSON.stringify({ chat_id, role: "assistant", content: accText }) });
          const saved = await r.json();
          if (saved?.id) {
            setMessages((cur) => cur.map((m, i, arr) => (i === arr.length - 1 ? { ...m, id: saved.id } : m)));
          }
        } catch {}
      }
      refreshUsage();
    } catch (err) {
      setMessages((cur) => cur.map((m, i, arr) => (i === arr.length - 1 ? { ...m, content: `⚠️ ${err.message || "Failed to reach Resynth"}`, streaming: false } : m)));
    } finally {
      setStreaming(false);
    }
  };

  // Regenerate last AI response
  const regenerateLast = async () => {
    // Find last user message
    let lastUser = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { lastUser = messages[i]; break; }
    }
    if (!lastUser) return;
    // Remove last assistant
    const lastAi = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAi) {
      setMessages((cur) => cur.slice(0, cur.indexOf(lastAi)).concat([{ id: uid(), role: "assistant", content: "", streaming: true }]));
      await sendMessage(lastUser.content, { regenerateOf: lastAi.id });
    }
  };

  const setReaction = async (messageId, reaction) => {
    setMessages((cur) => cur.map((m) => (m.id === messageId ? { ...m, reaction: m.reaction === reaction ? null : reaction } : m)));
    if (isAuthed) {
      const headers = await authHeaders();
      const next = messages.find((m) => m.id === messageId)?.reaction === reaction ? null : reaction;
      fetch(`${API}/messages/${messageId}/reaction`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ reaction: next }) }).catch(() => {});
    }
  };

  const downloadPDF = async () => {
    if (messages.length === 0) return;
    const headers = await authHeaders();
    const r = await fetch(`${API}/export/pdf`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: chats.find((c) => c.id === activeId)?.title || "Resynth Conversation",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resynth.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  const signOut = async () => { await supabase.auth.signOut(); newChat(); };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-textPrimary font-body">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        chats={chats}
        activeId={activeId}
        view={view}
        onSelectView={(v) => { setView(v); if (v === "chat") newChat(); }}
        onNewChat={newChat}
        onOpenChat={openChat}
        onDeleteChat={deleteChat}
        isAuthed={isAuthed}
        profile={profile}
        session={session}
        onShowAuth={() => setShowAuth(true)}
        onSignOut={signOut}
        onShowPricing={() => setShowPricing(true)}
        usage={usage}
      />

      <main className="flex-1 flex flex-col min-w-0 relative">
        <TopBar
          plan={profile.plan}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
          isAuthed={isAuthed}
          onShowAuth={() => setShowAuth(true)}
          onShowPricing={() => setShowPricing(true)}
          messages={messages}
          onDownloadPDF={downloadPDF}
        />

        {!isAuthed && <GuestBanner usage={usage} onSignIn={() => setShowAuth(true)} />}

        {view === "images" ? (
          <ImagesView />
        ) : view === "apps" ? (
          <AppsView />
        ) : view === "search" ? (
          <SearchView chats={chats} onOpen={openChat} />
        ) : (
          <ChatPanel
            messages={messages}
            onSend={sendMessage}
            streaming={streaming}
            isResearchMode={view === "research"}
            onRegenerate={regenerateLast}
            onReact={setReaction}
            onDownloadPDF={downloadPDF}
            plan={profile.plan}
            limitInfo={limitInfo}
            onUpgrade={() => setShowPricing(true)}
          />
        )}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showPricing && (
        <PricingModal
          onClose={() => setShowPricing(false)}
          isAuthed={isAuthed}
          billing={billingStatus}
          onRequireAuth={() => { setShowPricing(false); setShowAuth(true); }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sidebar
// ────────────────────────────────────────────────────────────────────────────
function Sidebar({ open, onToggle, chats, activeId, view, onSelectView, onNewChat, onOpenChat, onDeleteChat, isAuthed, profile, session, onShowAuth, onSignOut, onShowPricing, usage }) {
  const items = [
    { id: "search", label: "Search", icon: Search },
    { id: "images", label: "Images", icon: ImageIcon },
    { id: "apps", label: "Apps", icon: LayoutGrid },
    { id: "research", label: "Deep research", icon: Telescope },
  ];

  return (
    <aside data-testid="sidebar" className={`relative z-20 h-full shrink-0 border-r border-white/[0.06] bg-[#0A0C10] flex flex-col transition-all duration-300 ${open ? "w-[272px]" : "w-0"}`}>
      <div className={`overflow-hidden h-full flex flex-col ${open ? "w-[272px]" : "w-0"}`}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <img src="/logo.png" alt="Resynth" className="h-8 w-8 rounded-md object-cover" />
          <button data-testid="sidebar-collapse-btn" onClick={onToggle} className="w-8 h-8 grid place-items-center rounded-md text-textSecondary hover:text-textPrimary hover:bg-white/[0.05]">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 mt-2">
          <button
            data-testid="sidebar-new-chat"
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] transition-colors"
          >
            <Plus className="w-4 h-4 text-textSecondary" /> New chat
          </button>
        </div>

        <nav className="px-2 mt-2 flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                data-testid={`sidebar-nav-${item.id}`}
                onClick={() => onSelectView(item.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "text-white bg-white/[0.05]" : "text-textSecondary hover:text-white hover:bg-white/[0.03]"}`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-4 pt-5 pb-1.5 text-[10px] font-bold tracking-[0.14em] text-textSecondary/70 uppercase">Recent</div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5" data-testid="chat-history-list">
          {!isAuthed && (
            <div className="px-3 py-4 text-[12px] text-textSecondary/70 leading-relaxed">
              Sign in to save and revisit your chats.
            </div>
          )}
          {isAuthed && chats.length === 0 && (
            <div className="px-3 py-4 text-[12px] text-textSecondary/60">No chats yet.</div>
          )}
          {chats.map((c) => (
            <div key={c.id} className="group relative">
              <button
                data-testid={`chat-item-${c.id}`}
                onClick={() => onOpenChat(c.id)}
                className={`w-full text-left pl-3 pr-8 py-2 rounded-lg text-[13px] truncate transition-colors ${activeId === c.id && view === "chat" ? "bg-white/[0.05] text-white" : "text-textSecondary hover:text-white hover:bg-white/[0.03]"}`}
              >
                {c.title}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteChat(c.id); }}
                className="absolute right-1.5 top-1.5 p-1 rounded opacity-0 group-hover:opacity-100 text-textSecondary hover:text-rose-400 hover:bg-white/[0.05] transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.06] p-3 flex flex-col gap-2">
          {isAuthed ? (
            <>
              <button
                data-testid="sidebar-upgrade"
                onClick={onShowPricing}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-white bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] transition-colors"
              >
                <Crown className="w-3.5 h-3.5 text-emerald-400" />
                {profile.plan === "free" ? "Upgrade plan" : "Manage subscription"}
                <span className="ml-auto text-[10px] uppercase tracking-wider text-textSecondary">{profile.plan}</span>
              </button>
              <div className="flex items-center gap-3 px-2 py-1.5">
                <div className="w-7 h-7 rounded-full bg-white/[0.06] grid place-items-center text-[11px] font-bold">
                  {(session?.user?.email || "U").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white truncate">{session?.user?.email}</div>
                  {usage && (
                    <div className="text-[11px] text-textSecondary">{usage.used}/{usage.limit} today</div>
                  )}
                </div>
                <button
                  data-testid="sidebar-signout"
                  onClick={onSignOut}
                  className="p-1.5 rounded text-textSecondary hover:text-white hover:bg-white/[0.05]"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <button
              data-testid="sidebar-signin"
              onClick={onShowAuth}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] font-medium bg-white text-[#0A0C10] hover:bg-white/90 transition-colors"
            >
              Sign in / Create account
            </button>
          )}
        </div>
      </div>

      {!open && (
        <button onClick={onToggle} className="absolute top-4 left-2 w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.07] grid place-items-center text-textSecondary hover:text-white">
          <ChevronLeft className="w-4 h-4 rotate-180" />
        </button>
      )}
    </aside>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Top bar
// ────────────────────────────────────────────────────────────────────────────
function TopBar({ plan, onToggleSidebar, sidebarOpen, isAuthed, onShowAuth, onShowPricing, messages, onDownloadPDF }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <button onClick={onToggleSidebar} className="w-9 h-9 grid place-items-center rounded-lg bg-white/[0.04] border border-white/[0.07] text-textSecondary hover:text-white">
            <ChevronLeft className="w-4 h-4 rotate-180" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Resynth" className="h-7 w-7 rounded-md" />
          <span className="hidden sm:inline text-[13px] text-textSecondary">
            {plan === "elite" ? "Elite" : plan === "pro" ? "Pro" : "Free"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {messages?.length > 0 && (
          <button
            data-testid="topbar-pdf-btn"
            onClick={onDownloadPDF}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-textSecondary hover:text-white border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02] transition-colors"
            title="Download as PDF"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        )}
        {isAuthed ? (
          plan === "free" && (
            <button data-testid="topbar-upgrade" onClick={onShowPricing} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-[#0A0C10] hover:bg-emerald-400 transition-colors">
              Upgrade
            </button>
          )
        ) : (
          <button data-testid="topbar-signin" onClick={onShowAuth} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#0A0C10] hover:bg-white/90 transition-colors">
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Guest banner
// ────────────────────────────────────────────────────────────────────────────
function GuestBanner({ usage, onSignIn }) {
  return (
    <div data-testid="guest-banner" className="px-4 py-2 bg-white/[0.02] border-b border-white/[0.04] flex items-center justify-center gap-3 text-[12.5px]">
      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span className="text-textSecondary">
        You're in guest mode — chats won't be saved.{" "}
        {usage && <span className="text-white">{usage.used}/{usage.limit} messages today.</span>}
      </span>
      <button onClick={onSignIn} className="text-emerald-400 hover:text-emerald-300 font-medium underline-offset-2 hover:underline">
        Sign in to save chats →
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Chat panel
// ────────────────────────────────────────────────────────────────────────────
function ChatPanel({ messages, onSend, streaming, isResearchMode, onRegenerate, onReact, onDownloadPDF, plan, limitInfo, onUpgrade }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const empty = messages.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto" data-testid="chat-scroll">
        {empty ? (
          <Hero onPick={(t) => onSend(t)} isResearchMode={isResearchMode} />
        ) : (
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pt-8 pb-44 flex flex-col gap-5">
            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                m={m}
                isLast={i === messages.length - 1}
                onRegenerate={onRegenerate}
                onReact={onReact}
                streaming={streaming}
              />
            ))}
            {limitInfo && (
              <QuotaCard info={limitInfo} plan={plan} onUpgrade={onUpgrade} />
            )}
          </div>
        )}
      </div>
      <Composer onSend={onSend} streaming={streaming} isResearchMode={isResearchMode} />
    </div>
  );
}

function Hero({ onPick, isResearchMode }) {
  const SUGGESTIONS = [
    "Explain how the Riemann hypothesis matters",
    "Solve: ∫ x² sin(x) dx step by step",
    "Compare React Server Components vs Islands",
    "Draft a one-page business plan for a coffee cart",
  ];
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-12 animate-fadeUp">
      <h1 className="font-display text-[28px] sm:text-[36px] font-bold tracking-tight text-center mb-2">
        {isResearchMode ? "Deep " : "What "}<span className="gradient-text">{isResearchMode ? "Research" : "are you exploring"}</span>{isResearchMode ? " Lab" : " today?"}
      </h1>
      <p className="text-sm sm:text-base text-textSecondary text-center max-w-md mb-8">
        {isResearchMode ? "Multi-step research with citations." : "Ask anything. Resynth streams answers live."}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl w-full">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            data-testid={`suggestion-${i}`}
            onClick={() => onPick(s)}
            className="text-left px-4 py-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-colors text-[13.5px] text-textSecondary hover:text-white"
            style={{ animation: `fadeUp 0.4s ${i * 0.06}s both` }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ m, isLast, onRegenerate, onReact, streaming }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(m.content || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (m.role === "user") {
    return (
      <div className="self-end max-w-[85%] animate-fadeUp" data-testid="msg-user">
        <div className="rounded-2xl rounded-tr-md px-4 py-3 bg-white/[0.06] border border-white/[0.06] text-[14.5px] leading-relaxed whitespace-pre-wrap">
          {m.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3.5 animate-fadeUp" data-testid="msg-ai">
      <div className="shrink-0 mt-0.5">
        <img src="/logo.png" alt="Resynth" className="w-8 h-8 rounded-md" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`md text-[14.5px] ${m.streaming && !m.content ? "" : ""} ${m.streaming ? "caret" : ""}`}>
          {(!m.content && m.streaming) ? (
            <span className="inline-flex gap-1 items-center text-textSecondary">
              <span className="w-1.5 h-1.5 rounded-full bg-textSecondary animate-thinkingDot" style={{ animationDelay: "0s" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-textSecondary animate-thinkingDot" style={{ animationDelay: "0.2s" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-textSecondary animate-thinkingDot" style={{ animationDelay: "0.4s" }} />
            </span>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdownMath(m.content || "_(no response)_") }} />
          )}
        </div>
        {!m.streaming && m.content && (
          <div className="mt-2 flex items-center gap-1">
            <ActionBtn testid="copy-btn" onClick={copy} active={copied} Icon={copied ? Check : Copy} label={copied ? "Copied" : "Copy"} />
            <ActionBtn testid="like-btn" onClick={() => onReact(m.id, "like")} active={m.reaction === "like"} Icon={ThumbsUp} label="Good" />
            <ActionBtn testid="dislike-btn" onClick={() => onReact(m.id, "dislike")} active={m.reaction === "dislike"} Icon={ThumbsDown} label="Bad" />
            {isLast && !streaming && (
              <ActionBtn testid="regen-btn" onClick={onRegenerate} active={false} Icon={RotateCcw} label="Regenerate" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ onClick, Icon, label, active, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] transition-colors ${active ? "text-emerald-400 bg-white/[0.04]" : "text-textSecondary hover:text-white hover:bg-white/[0.04]"}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function QuotaCard({ info, plan, onUpgrade }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const tick = () => {
      const target = new Date(info.unlock_at).getTime();
      const diff = Math.max(0, target - Date.now());
      const h = Math.floor(diff / 3.6e6).toString().padStart(2, "0");
      const m = Math.floor((diff % 3.6e6) / 6e4).toString().padStart(2, "0");
      const s = Math.floor((diff % 6e4) / 1000).toString().padStart(2, "0");
      setRemaining(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [info]);

  return (
    <div data-testid="quota-card" className="self-start max-w-md w-full rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
      <div className="flex items-center gap-2 text-amber-300 mb-1.5">
        <AlertCircle className="w-4 h-4" />
        <div className="text-[14px] font-semibold">Daily quota reached</div>
      </div>
      <p className="text-[13px] text-textSecondary leading-relaxed mb-3">
        You've used all {info.limit} messages on the <span className="text-white capitalize">{info.plan}</span> plan today.
        Come back when the timer hits zero.
      </p>
      <div className="font-mono text-[28px] tracking-tight text-white tabular-nums mb-3" data-testid="quota-countdown">{remaining}</div>
      {plan !== "elite" && (
        <button onClick={onUpgrade} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold bg-emerald-500 text-[#0A0C10] hover:bg-emerald-400">
          <Crown className="w-3.5 h-3.5" /> Upgrade for higher limits
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Composer with file attach + mode pills inside
// ────────────────────────────────────────────────────────────────────────────
function Composer({ onSend, streaming, isResearchMode }) {
  const [text, setText] = useState("");
  const [deepDive, setDeepDive] = useState(false);
  const [litReview, setLitReview] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const taRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [text]);

  const submit = () => {
    if (streaming) return;
    if (!text.trim() && !imageData) return;
    onSend(text, { imageBase64: imageData, deepDive: deepDive || isResearchMode, litReview });
    setText(""); setImageData(null); setImagePreview(null);
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { alert("Only images supported"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // data:image/...;base64,XXX
      const b64 = String(result).split(",")[1];
      setImageData(b64);
      setImagePreview(String(result));
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 pt-10 bg-gradient-to-t from-[#0A0C10] via-[#0A0C10]/95 to-transparent pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto">
        {imagePreview && (
          <div className="mb-2 inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5">
            <img src={imagePreview} alt="" className="w-10 h-10 rounded object-cover" />
            <span className="text-[12px] text-textSecondary">Image attached</span>
            <button onClick={() => { setImageData(null); setImagePreview(null); }} className="p-1 rounded hover:bg-white/[0.06]">
              <X className="w-3.5 h-3.5 text-textSecondary" />
            </button>
          </div>
        )}
        <div className="relative rounded-2xl bg-[#12151C] border border-white/[0.08] focus-within:border-white/[0.16] transition-colors shadow-2xl shadow-black/40">
          <textarea
            ref={taRef}
            data-testid="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={1}
            placeholder={isResearchMode ? "Research anything…" : "Ask Resynth anything…"}
            className="w-full bg-transparent text-[15px] placeholder:text-textSecondary/70 outline-none resize-none px-4 pt-3.5 pb-1 max-h-[200px]"
          />
          <div className="flex items-center justify-between gap-2 px-2.5 pb-2 pt-1">
            <div className="flex items-center gap-1 flex-wrap">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} data-testid="file-input" />
              <button
                data-testid="attach-btn"
                onClick={() => fileRef.current?.click()}
                className="w-8 h-8 grid place-items-center rounded-lg text-textSecondary hover:text-white hover:bg-white/[0.05]"
                title="Attach image"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              {!isResearchMode && (
                <>
                  <ModePill testId="mode-deep-dive" active={deepDive} onClick={() => setDeepDive((v) => !v)} icon={Telescope} label="Deep dive" />
                  <ModePill testId="mode-lit-review" active={litReview} onClick={() => setLitReview((v) => !v)} icon={BookOpen} label="Lit review" />
                </>
              )}
            </div>
            <button
              data-testid="chat-submit-btn"
              onClick={submit}
              disabled={(!text.trim() && !imageData) || streaming}
              className={`w-9 h-9 grid place-items-center rounded-lg transition-colors ${(text.trim() || imageData) && !streaming ? "bg-white text-[#0A0C10] hover:bg-white/90" : "bg-white/[0.05] text-textSecondary cursor-not-allowed"}`}
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="text-[11px] text-textSecondary/50 text-center mt-2">
          Resynth can make mistakes. Verify important info.
        </div>
      </div>
    </div>
  );
}

function ModePill({ active, onClick, icon: Icon, label, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors border ${active ? "bg-white/[0.06] border-white/[0.12] text-white" : "bg-transparent border-white/[0.06] text-textSecondary hover:text-white hover:border-white/[0.12]"}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Images view
// ────────────────────────────────────────────────────────────────────────────
function ImagesView() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(() => { try { return JSON.parse(localStorage.getItem("re_images") || "[]"); } catch { return []; } });
  useEffect(() => { localStorage.setItem("re_images", JSON.stringify(results.slice(0, 30))); }, [results]);

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    const [w, h] = size.split("x").map(Number);
    try {
      const headers = await authHeaders();
      const r = await fetch(`${API}/generate-image`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ prompt, width: w, height: h }) });
      const d = await r.json();
      if (d.url) { setResults((rs) => [{ id: uid(), url: d.url, prompt }, ...rs]); setPrompt(""); }
    } finally { setBusy(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8" data-testid="images-view">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-2xl font-bold mb-1">Image Studio</h1>
        <p className="text-textSecondary text-sm mb-5">Describe anything. Resynth conjures it.</p>
        <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-3 mb-6">
          <textarea
            value={prompt}
            data-testid="image-prompt"
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(); } }}
            placeholder="A cyberpunk neon city at golden hour, cinematic lighting…"
            rows={2}
            className="w-full bg-transparent text-[15px] placeholder:text-textSecondary/70 outline-none resize-none px-2 pt-1 pb-2"
          />
          <div className="flex items-center justify-between px-1">
            <select data-testid="image-size" value={size} onChange={(e) => setSize(e.target.value)} className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-textSecondary outline-none">
              <option value="1024x1024">Square 1024</option>
              <option value="1280x720">Landscape 1280×720</option>
              <option value="768x1280">Portrait 768×1280</option>
            </select>
            <button
              data-testid="image-generate-btn"
              onClick={generate}
              disabled={!prompt.trim() || busy}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 ${prompt.trim() && !busy ? "bg-white text-[#0A0C10] hover:bg-white/90" : "bg-white/[0.05] text-textSecondary cursor-not-allowed"}`}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? "Generating" : "Generate"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {results.map((r) => (
            <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-white/[0.06] hover:border-white/[0.12]">
              <img src={r.url} alt={r.prompt} className="w-full aspect-square object-cover" />
            </a>
          ))}
          {results.length === 0 && <div className="col-span-full text-center py-16 text-textSecondary text-sm">No images yet.</div>}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Apps view
// ────────────────────────────────────────────────────────────────────────────
function AppsView() {
  const apps = [
    { id: "code", title: "Code Companion", desc: "Pair-program with Resynth on any stack." },
    { id: "writer", title: "Long-form Writer", desc: "Essays, emails, scripts with citations." },
    { id: "research", title: "Research Lab", desc: "Multi-step web research with sources." },
    { id: "translate", title: "Polyglot", desc: "Translate to 90+ languages instantly." },
    { id: "study", title: "Study Buddy", desc: "Flashcards, summaries, and quizzes." },
    { id: "math", title: "Math Solver", desc: "Step-by-step with LaTeX rendering." },
  ];
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8" data-testid="apps-view">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-2xl font-bold mb-1">Apps</h1>
        <p className="text-textSecondary text-sm mb-5">Specialised modes for specific jobs.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {apps.map((a) => (
            <button key={a.id} data-testid={`app-${a.id}`} className="text-left p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-colors">
              <div className="font-display text-base font-semibold mb-1">{a.title}</div>
              <div className="text-[12.5px] text-textSecondary leading-relaxed">{a.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Search view
// ────────────────────────────────────────────────────────────────────────────
function SearchView({ chats, onOpen }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return chats;
    return chats.filter((c) => (c.title || "").toLowerCase().includes(t));
  }, [q, chats]);
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8" data-testid="search-view">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-2xl font-bold mb-5">Search chats</h1>
        <div className="rounded-xl bg-[#12151C] border border-white/[0.08] flex items-center gap-2 px-4 py-3 mb-6">
          <Search className="w-4 h-4 text-textSecondary" />
          <input autoFocus data-testid="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title…" className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-textSecondary/70" />
        </div>
        <div className="flex flex-col gap-1.5">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => onOpen(c.id)} className="text-left px-4 py-3 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]">
              <div className="text-[14px] font-medium text-white truncate">{c.title}</div>
            </button>
          ))}
          {filtered.length === 0 && <div className="text-center py-12 text-textSecondary text-sm">No chats found.</div>}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Auth modal (email/password + Google)
// ────────────────────────────────────────────────────────────────────────────
function AuthModal({ onClose }) {
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      if (tab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.user && !data?.session) {
          setNotice("Check your inbox for a confirmation link, then sign in.");
        } else {
          onClose();
        }
      }
    } catch (err) {
      setError(err.message || "Auth failed");
    } finally { setBusy(false); }
  };

  const google = async () => {
    setBusy(true); setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || "Google sign-in unavailable. Enable it in Supabase first.");
      setBusy(false);
    }
  };

  return (
    <div data-testid="auth-modal" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 animate-fadeUp" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#10131A] p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-md text-textSecondary hover:text-white">
          <X className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center mb-5">
          <img src="/logo.png" alt="Resynth" className="h-12 w-12 rounded-lg mb-3" />
          <div className="font-display text-xl font-bold">Welcome to Resynth</div>
          <p className="text-textSecondary text-[13px] mt-1">
            {tab === "signin" ? "Sign in to save chats and unlock 20/day." : "Create an account to get started."}
          </p>
        </div>
        <div className="flex p-1 bg-white/[0.03] border border-white/[0.06] rounded-lg mb-4">
          {["signin", "signup"].map((t) => (
            <button key={t} data-testid={`auth-tab-${t}`} onClick={() => { setTab(t); setError(""); setNotice(""); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === t ? "bg-white/[0.06] text-white" : "text-textSecondary hover:text-white"}`}>
              {t === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
        <button
          data-testid="auth-google-btn"
          onClick={google}
          disabled={busy}
          className="w-full mb-3 py-2.5 rounded-lg text-sm font-medium bg-white text-[#0A0C10] hover:bg-white/90 flex items-center justify-center gap-2 transition-colors"
        >
          <GoogleIcon /> Continue with Google
        </button>
        <div className="flex items-center gap-3 my-3">
          <div className="flex-1 h-px bg-white/[0.06]" /><span className="text-[11px] text-textSecondary/70">or</span><div className="flex-1 h-px bg-white/[0.06]" />
        </div>
        <form onSubmit={submit} className="space-y-2.5">
          <input data-testid="auth-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@domain.com" className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm outline-none focus:border-white/[0.18]" />
          <input data-testid="auth-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (6+ chars)" className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm outline-none focus:border-white/[0.18]" />
          {error && <div className="text-[12px] text-rose-300">{error}</div>}
          {notice && <div className="text-[12px] text-emerald-300">{notice}</div>}
          <button data-testid="auth-submit-btn" type="submit" disabled={busy} className="w-full mt-1 py-2.5 rounded-lg text-sm font-semibold bg-emerald-500 text-[#0A0C10] hover:bg-emerald-400 disabled:opacity-60 transition-colors">
            {busy ? "…" : tab === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 14-5.4l-6.5-5.5c-2 1.4-4.6 2.3-7.5 2.3-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.5 5.5C42.6 35.5 44 30.1 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Pricing modal
// ────────────────────────────────────────────────────────────────────────────
function PricingModal({ onClose, isAuthed, billing, onRequireAuth }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const subscribe = async (plan) => {
    if (!isAuthed) { onRequireAuth(); return; }
    setBusy(plan); setError("");
    try {
      const headers = await authHeaders();
      const r = await fetch(`${API}/billing/checkout`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Checkout failed");
      if (d.url) window.location.href = d.url;
    } catch (e) {
      setError(e.message);
    } finally { setBusy(null); }
  };

  const openPortal = async () => {
    const headers = await authHeaders();
    const r = await fetch(`${API}/billing/portal`, { headers });
    const d = await r.json();
    if (d.url) window.open(d.url, "_blank");
  };

  const currentPlan = billing?.plan || "free";

  const plans = [
    { id: "free", name: "Free", price: "$0", per: "forever", limit: "20 messages / day", features: ["Streaming chat", "Image generation", "Chat history"] },
    { id: "pro", name: "Pro", price: "$12", per: "month", limit: "500 messages / day", features: ["Everything in Free", "PDF without watermark", "Deep dive & lit review", "Priority models"] },
    { id: "elite", name: "Elite", price: "$49", per: "month", limit: "1500 messages / day", features: ["Everything in Pro", "Highest daily limits", "Earliest access to new models", "Priority support"] },
  ];

  return (
    <div data-testid="pricing-modal" className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl border border-white/[0.08] bg-[#10131A] p-7 shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-2xl font-bold">Choose your plan</h2>
            <p className="text-textSecondary text-[13px] mt-1">Cancel anytime via the customer portal.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-md text-textSecondary hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {plans.map((p) => {
            const isCurrent = currentPlan === p.id;
            const isUpgrade = p.id !== "free";
            return (
              <div key={p.id} className={`rounded-2xl border p-5 flex flex-col ${p.id === "pro" ? "border-emerald-500/30 bg-emerald-500/[0.03]" : "border-white/[0.08] bg-white/[0.02]"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="font-display text-lg font-bold flex items-center gap-2">
                    {p.id === "pro" && <Crown className="w-4 h-4 text-emerald-400" />}
                    {p.id === "elite" && <Sparkles className="w-4 h-4 text-amber-300" />}
                    {p.name}
                  </div>
                  {p.id === "pro" && <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Popular</span>}
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold">{p.price}</span>
                  <span className="text-textSecondary text-[12px]">/ {p.per}</span>
                </div>
                <div className="text-[12px] text-textSecondary mb-4">{p.limit}</div>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-textSecondary">
                      <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="space-y-1.5">
                    <div className="w-full text-center py-2.5 rounded-lg text-[13px] font-semibold bg-white/[0.04] border border-white/[0.07] text-white">Current plan</div>
                    {isUpgrade && (
                      <button data-testid={`manage-${p.id}`} onClick={openPortal} className="w-full py-2.5 rounded-lg text-[13px] font-medium bg-transparent text-textSecondary hover:text-white border border-white/[0.07] hover:border-white/[0.14] flex items-center justify-center gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5" /> Manage subscription
                      </button>
                    )}
                  </div>
                ) : isUpgrade ? (
                  <button
                    data-testid={`subscribe-${p.id}`}
                    onClick={() => subscribe(p.id)}
                    disabled={busy === p.id}
                    className={`w-full py-2.5 rounded-lg text-[13px] font-semibold transition-colors ${p.id === "pro" ? "bg-emerald-500 text-[#0A0C10] hover:bg-emerald-400" : "bg-white text-[#0A0C10] hover:bg-white/90"}`}
                  >
                    {busy === p.id ? "…" : `Subscribe to ${p.name}`}
                  </button>
                ) : (
                  <div className="w-full text-center py-2.5 rounded-lg text-[13px] text-textSecondary border border-white/[0.06]">Default</div>
                )}
              </div>
            );
          })}
        </div>
        {error && <div className="text-[12px] text-rose-300 mt-2">{error}</div>}
        {billing?.subscription_status === "cancelled" && (
          <div className="text-[12.5px] text-amber-300 bg-amber-500/[0.05] border border-amber-500/15 rounded-lg p-3 mt-3">
            Your {billing.plan} subscription is cancelled. You'll keep access until {billing.current_period_end ? new Date(billing.current_period_end).toLocaleDateString() : "the end of period"}.
          </div>
        )}
      </div>
    </div>
  );
}
