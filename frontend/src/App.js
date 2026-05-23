import React, { useEffect, useMemo, useRef, useState, useCallback, startTransition } from "react";
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
  Github,
  Slack,
  Database,
  FileText,
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
  Sparkles,
  Crown,
  AlertCircle,
  ExternalLink,
  Square,
  Brain,
  Folder,
  FolderPlus,
} from "lucide-react";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import katex from "katex";
import { useUser, useAuth, SignIn, SignUp, UserButton } from "@clerk/clerk-react";

marked.use({
  renderer: {
    code({ text, lang }) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      const highlighted = hljs.highlight(text, { language }).value;
      const encoded = encodeURIComponent(text);
      return `
        <div class="code-block rounded-xl overflow-hidden my-4 border border-white/[0.08] bg-[#0d1117]">
          <div class="flex items-center justify-between px-4 py-2 bg-white/[0.04] border-b border-white/[0.08]">
            <span class="text-[12px] font-mono text-textSecondary uppercase tracking-wider">${language}</span>
            <button class="copy-code-btn flex items-center gap-1.5 text-[11.5px] text-textSecondary hover:text-white transition-colors" data-code="${encoded}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span class="copy-text">Copy</span>
            </button>
          </div>
          <div class="p-4 overflow-x-auto text-[13.5px] leading-relaxed font-mono">
            <pre><code class="hljs language-${language}">${highlighted}</code></pre>
          </div>
        </div>
      `;
    }
  }
});

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

// Auth handled dynamically in App via Clerk

const INTEGRATIONS = [
  { name: "GitHub", slug: "github", color: "ffffff", desc: "Read code repositories and help debug issues." },
  { name: "Slack", slug: "slack", imgUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg", desc: "Summarize threads and respond to team messages.", comingSoon: true },
  { name: "Notion", slug: "notion", color: "ffffff", desc: "Read knowledge bases and save generated reports.", comingSoon: true },
  { name: "Google Drive", slug: "google-drive", imgUrl: "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg", desc: "Index your PDFs, Docs, and spreadsheets." },
];

// Guest mode: chats are kept in memory only (not persisted).

const BotAvatar = ({ streaming }) => (
  <div className="relative w-8 h-8 rounded-md bg-[#0a0c10] border border-white/[0.08] flex items-center justify-center overflow-hidden"
       style={{ boxShadow: streaming ? '0 0 15px rgba(59,130,246,0.3)' : '0 0 10px rgba(16,185,129,0.1)', transition: 'box-shadow 0.5s ease' }}>
    
    {/* Inner background glow */}
    <div className="absolute inset-0 bg-emerald-500/10 blur-[2px]" />

    {/* The Orb Container */}
    <div className={`relative w-[65%] h-[65%] flex items-center justify-center transition-transform duration-700 ${streaming ? 'scale-110' : 'scale-100'}`}>
      
      {/* Ambient glow behind orb */}
      <div className={`absolute inset-0 rounded-full blur-[4px] transition-opacity duration-700 ${streaming ? 'opacity-100 bg-blue-500/50' : 'opacity-50 bg-emerald-500/30'}`} />

      {/* Main Orb SVG */}
      <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 drop-shadow-md">
        <defs>
          <linearGradient id="orbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={streaming ? "#3b82f6" : "#34d399"}>
              {streaming && <animate attributeName="stop-color" values="#3b82f6;#8b5cf6;#ec4899;#3b82f6" dur="3s" repeatCount="indefinite" />}
            </stop>
            <stop offset="100%" stopColor={streaming ? "#8b5cf6" : "#059669"}>
              {streaming && <animate attributeName="stop-color" values="#8b5cf6;#ec4899;#3b82f6;#8b5cf6" dur="3s" repeatCount="indefinite" />}
            </stop>
          </linearGradient>

          <filter id="liquid" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency={streaming ? "0.02" : "0.015"} numOctaves="3" result="noise">
              {streaming && <animate attributeName="baseFrequency" values="0.02;0.035;0.02" dur="4s" repeatCount="indefinite" />}
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={streaming ? "12" : "3"} xChannelSelector="R" yChannelSelector="G">
              {streaming && <animate attributeName="scale" values="12;20;12" dur="2s" repeatCount="indefinite" />}
            </feDisplacementMap>
          </filter>
        </defs>

        {/* The morphing liquid base */}
        <circle cx="50" cy="50" r="34" fill="url(#orbGrad)" filter="url(#liquid)">
          {streaming && <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="8s" repeatCount="indefinite" />}
        </circle>
        
        {/* Core highlight for 3D sphere illusion (static over the morphing base) */}
        <circle cx="38" cy="38" r="14" fill="#ffffff" opacity="0.35" filter="blur(2.5px)" />
        <circle cx="42" cy="42" r="5" fill="#ffffff" opacity="0.8" filter="blur(1px)" />
      </svg>
    </div>
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-fadeUp">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-4 mx-auto" />
          <h2 className="text-xl font-bold font-display mb-2 text-white">Something went wrong</h2>
          <p className="text-sm text-textSecondary max-w-md mb-6 mx-auto">A rendering error occurred in this view. This is usually caused by malformed markdown or math syntax.</p>
          <button onClick={() => this.setState({ hasError: false })} className="px-4 py-2 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] rounded-lg text-sm font-medium transition-colors text-white mx-auto">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children; 
  }
}

export default function App() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const isAuthed = isSignedIn;

  const authHeaders = useCallback(async () => {
    if (!isSignedIn) return {};
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [isSignedIn, getToken]);

  const abortControllerRef = useRef(null);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const [profile, setProfile] = useState({ plan: "free" });
  const [view, setView] = useState("chat");
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loadingChatId, setLoadingChatId] = useState(null);
  const [messages, setMessages] = useState([]); // active chat messages
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [billingStatus, setBillingStatus] = useState(null);
  const [limitInfo, setLimitInfo] = useState(null); // {plan, used, limit, unlock_at} when over
  
  const [activeIntegrations, setActiveIntegrations] = useState([]);
  const [activeApp, setActiveApp] = useState(null);

  const fetchIntegrations = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/integrations`, { headers });
      if (res.ok) {
        const data = await res.json();
        setActiveIntegrations(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [isAuthed, authHeaders]);

  const [folders, setFolders] = useState([]);
  const [chatFolders, setChatFolders] = useState({});

  const createFolder = async () => {
    if (!isAuthed) return alert("Must be signed in!");
    const name = window.prompt("Folder name:");
    if (!name) return;
    const headers = await authHeaders();
    const res = await fetch(`${API}/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name })
    });
    const newFolder = await res.json();
    setFolders([...folders, newFolder]);
  };

  const moveChat = async (chatId) => {
    if (folders.length === 0) return alert("Create a folder first!");
    const opts = folders.map((f, i) => `${i + 1}. ${f.name}`).join("\n");
    const num = window.prompt(`Move to folder (enter number) or 0 to remove:\n0. Uncategorized\n${opts}`);
    if (num === null) return;
    
    let folder_id = null;
    if (num !== "0") {
      const idx = parseInt(num, 10) - 1;
      if (folders[idx]) folder_id = folders[idx].id;
    }
    
    if (isAuthed) {
      const headers = await authHeaders();
      await fetch(`${API}/chats/${chatId}/folder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ folder_id })
      });
    }
    setChatFolders(prev => ({ ...prev, [chatId]: folder_id }));
  };

  const deviceId = useMemo(getDeviceId, []);

  // Fetch profile + chats + folders + billing when signed in
  useEffect(() => {
    if (!isAuthed) {
      setChats([]);
      setFolders([]);
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
      // folders
      fetch(`${API}/folders`, { headers })
        .then((r) => r.json())
        .then((arr) => setFolders(Array.isArray(arr) ? arr : []))
        .catch(() => {});
        
      fetchIntegrations();

      // chats list
      fetch(`${API}/chats`, { headers })
        .then((r) => r.json())
        .then((arr) => {
          if (Array.isArray(arr)) {
            setChats(arr);
            const cf = {};
            arr.forEach(c => { if (c.folder_id) cf[c.id] = c.folder_id; });
            setChatFolders(cf);
          } else setChats([]);
        })
        .catch(() => setChats([]));
    })();
  }, [isAuthed, authHeaders]);

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
    setLoadingChatId(chatId);
    try {
      const headers = await authHeaders();
      const r = await fetch(`${API}/chats/${chatId}/messages`, { headers });
      const arr = await r.json();
      startTransition(() => {
        setMessages(Array.isArray(arr) ? arr.map((m) => ({ ...m })) : []);
      });
    } finally {
      setLoadingChatId(null);
    }
  };

  const deleteChat = async (chatId) => {
    const headers = await authHeaders();
    await fetch(`${API}/chats/${chatId}`, { method: "DELETE", headers });
    setChats((cs) => cs.filter((c) => c.id !== chatId));
    if (activeId === chatId) { setActiveId(null); setMessages([]); }
  };

  // Send a message (with optional image base64 + mode flags)
  const sendMessage = async (text, { imageBase64 = null, pdfBase64 = null, pdfName = null, deepDive = false, litReview = false, regenerateOf = null } = {}) => {
    if ((!text || !text.trim()) && !imageBase64 && !pdfBase64) return;
    if (streaming) return;

    // Create chat in DB if signed in and no active
    let chat_id = activeId;
    if (isAuthed && !chat_id) {
      // Optimistically set a temp id so UI updates instantly
      chat_id = uid();
      setActiveId(chat_id);
      setChats((cs) => [{ id: chat_id, title: text.slice(0, 48) || "New chat" }, ...cs]);
      // Create in DB in background, then swap the real id in
      (async () => {
        try {
          const headers = await authHeaders();
          const r = await fetch(`${API}/chats`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ title: text.slice(0, 48) || "New chat" }) });
          const d = await r.json();
          if (d.id) {
            // Swap temp id for real DB id
            setActiveId(d.id);
            setChats((cs) => cs.map((c) => c.id === chat_id ? { ...c, id: d.id } : c));
            chat_id = d.id;
            // Save user message now that we have a real chat_id
            if (!regenerateOf) {
              fetch(`${API}/messages`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: d.id, role: "user", content: text || (imageBase64 ? "[image]" : "") }) }).catch(() => {});
            }
            // Generate better title async
            fetch(`${API}/generate-title`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ message: text }) })
              .then((r) => r.json())
              .then((dd) => {
                if (dd?.title) {
                  setChats((cs) => cs.map((c) => (c.id === d.id ? { ...c, title: dd.title } : c)));
                  fetch(`${API}/chats/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ title: dd.title }) });
                }
              })
              .catch(() => {});
          }
        } catch (e) { console.error(e); }
      })();
    }

    const userMsg = { id: uid(), role: "user", content: text || (imageBase64 ? "[image]" : ""), image: imageBase64 ? `data:image/jpeg;base64,${imageBase64.slice(0, 40)}…` : null };
    const aiMsg = { id: uid(), role: "assistant", content: "", streaming: true, startTime: Date.now() };

    // If regenerate, replace last AI message instead of appending
    let nextMessages;
    if (regenerateOf) {
      nextMessages = messages.slice(0, messages.findIndex((m) => m.id === regenerateOf));
      nextMessages.push({ ...messages.find((m) => m.id === regenerateOf), id: uid(), content: "", streaming: true, startTime: Date.now() });
      setMessages(nextMessages);
    } else {
      nextMessages = [...messages, userMsg, aiMsg];
      setMessages(nextMessages);
    }

    // Persist user message to DB — only for existing chats (new chats handled in background above)
    if (isAuthed && activeId && !regenerateOf) {
      try {
        const headers = await authHeaders();
        fetch(`${API}/messages`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: activeId, role: "user", content: userMsg.content }) });
      } catch {}
    }

    setStreaming(true);
    setLimitInfo(null);
    try {
      const headers = await authHeaders();
      // Prepare history to send to backend (exclude the empty AI message we just added)
      const historyToSend = nextMessages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content || ""
      }));

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const resp = await fetch(`${API}/chat/stream`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "X-Device-Id": deviceId, ...headers },
        body: JSON.stringify({
          session_id: deviceId,
          message: text || "describe this attachment",
          messages: historyToSend,
          chat_id: chat_id || "",
          deep_dive: !!deepDive,
          lit_review: !!litReview,
          image_data: imageBase64 || undefined,
          pdf_data: pdfBase64 || undefined,
          pdf_name: pdfName || undefined,
          user_memory: localStorage.getItem("re_memory") || undefined,
          active_app: activeApp || undefined,
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
              if (evt.type === "token" && (evt.text || evt.content)) { accText += (evt.text || evt.content); updateAI({ content: accText, status: null }); }
              else if (evt.type === "text" && evt.content) { accText = evt.content; updateAI({ content: accText, status: null }); }
              else if (evt.type === "status") { updateAI({ status: evt.message }); }
              else if (evt.type === "sources") { updateAI({ sources: evt }); }
              else if (evt.type === "image_url") { updateAI({ imageUrl: evt.url }); }
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

      // Calculate elapsed time
      let workedSecs = null;
      setMessages(cur => {
        const lastMsg = cur[cur.length - 1];
        if (lastMsg && lastMsg.startTime) workedSecs = ((Date.now() - lastMsg.startTime) / 1000).toFixed(1);
        return cur;
      });

      // Parse FOLLOW_UP questions and strip from displayed text
      const followUpMatch = accText.match(/\nFOLLOW_UP:\s*(.+)$/m);
      let finalText = accText;
      let followUps = [];
      if (followUpMatch) {
        followUps = followUpMatch[1].split("|").map(q => q.trim()).filter(Boolean).slice(0, 3);
        finalText = accText.slice(0, followUpMatch.index).trim();
      }
      updateAI({ content: finalText, followUps, streaming: false, status: null, workedSecs });

      // Persist final AI message (use finalText without follow-up lines)
      if (isAuthed && chat_id && finalText) {
        const headers2 = await authHeaders();
        try {
          const r = await fetch(`${API}/messages`, { method: "POST", headers: { ...headers2, "Content-Type": "application/json" }, body: JSON.stringify({ chat_id, role: "assistant", content: finalText }) });
          const saved = await r.json();
          if (saved?.id) {
            setMessages((cur) => cur.map((m, i, arr) => (i === arr.length - 1 ? { ...m, id: saved.id } : m)));
          }
        } catch {}
      }
      refreshUsage();
    } catch (err) {
      if (err.name === "AbortError") {
        setMessages((cur) => cur.map((m, i, arr) => (i === arr.length - 1 ? { ...m, streaming: false } : m)));
        return;
      }
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

  const signOut = () => { newChat(); };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-textPrimary font-body">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        chats={chats}
        folders={folders}
        chatFolders={chatFolders}
        onCreateFolder={createFolder}
        onMoveChat={moveChat}
        activeId={activeId}
        loadingChatId={loadingChatId}
        view={view}
        onSelectView={(v) => { setView(v); if (v === "chat") newChat(); }}
        onNewChat={newChat}
        onOpenChat={openChat}
        onDeleteChat={deleteChat}
        isAuthed={isAuthed}
        profile={profile}
        onShowAuth={() => setShowAuth(true)}
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
          <ErrorBoundary><ImagesView authHeaders={authHeaders} /></ErrorBoundary>
        ) : view === "integrations" ? (
          <ErrorBoundary><IntegrationsView isAuthed={isAuthed} authHeaders={authHeaders} onRequireAuth={() => setShowAuth(true)} activeIntegrations={activeIntegrations} fetchIntegrations={fetchIntegrations} /></ErrorBoundary>
        ) : view === "memory" ? (
          <ErrorBoundary><MemoryView isAuthed={isAuthed} authHeaders={authHeaders} /></ErrorBoundary>
        ) : view === "search" ? (
          <ErrorBoundary><SearchView chats={chats} onOpen={openChat} /></ErrorBoundary>
        ) : (
          <ErrorBoundary>
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
              onStop={stopGeneration}
              activeApp={activeApp}
              setActiveApp={setActiveApp}
              activeIntegrations={activeIntegrations}
              setView={setView}
            />
          </ErrorBoundary>
        )}
      </main>

      {showAuth && <AuthPage onClose={() => setShowAuth(false)} />}
      {showPricing && (
        <PricingModal
          onClose={() => setShowPricing(false)}
          isAuthed={isAuthed}
          authHeaders={authHeaders}
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
function Sidebar({ open, onToggle, chats, folders, chatFolders, onCreateFolder, onMoveChat, activeId, loadingChatId, view, onSelectView, onNewChat, onOpenChat, onDeleteChat, isAuthed, profile, onShowAuth, onShowPricing, usage }) {
  const [openFolders, setOpenFolders] = useState({});
  const toggleFolder = (id) => setOpenFolders(o => ({ ...o, [id]: !o[id] }));

  const renderChatItem = (c) => (
    <div key={c.id} className="group relative">
      <button
        data-testid={`chat-item-${c.id}`}
        onClick={() => onOpenChat(c.id)}
        className={`w-full text-left pl-3 pr-14 py-2 rounded-lg text-[13px] truncate transition-colors ${activeId === c.id && view === "chat" ? "bg-white/[0.05] text-white" : "text-textSecondary hover:text-white hover:bg-white/[0.03]"}`}
      >
        <div className="flex items-center gap-2">
          {loadingChatId === c.id && <Loader2 className="w-3 h-3 animate-spin text-emerald-400 shrink-0" />}
          <span className="truncate">{c.title}</span>
        </div>
      </button>
      <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onMoveChat(c.id); }} className="p-1 rounded text-textSecondary hover:text-emerald-400 hover:bg-white/[0.05]">
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDeleteChat(c.id); }} className="p-1 rounded text-textSecondary hover:text-rose-400 hover:bg-white/[0.05]">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const items = [
    { id: "search", label: "Search", icon: Search },
    { id: "integrations", label: "Integrations", icon: LayoutGrid },
    { id: "memory", label: "Memory", icon: Brain },
  ];

  return (
    <>
      {open && (
        <div 
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden animate-fadeUp" 
          onClick={onToggle}
        />
      )}
      <aside data-testid="sidebar" className={`absolute md:relative z-40 h-full shrink-0 border-r border-white/[0.06] bg-[#0A0C10] flex flex-col transition-all duration-300 ${open ? "w-[272px] translate-x-0" : "w-0 -translate-x-full md:translate-x-0"}`}>
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

        <div className="px-4 pt-5 pb-1.5 flex justify-between items-center text-[10px] font-bold tracking-[0.14em] text-textSecondary/70 uppercase">
          <span>Recent</span>
          <button onClick={onCreateFolder} className="hover:text-white p-1 -mr-1"><Plus className="w-3.5 h-3.5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5" data-testid="chat-history-list">
          {!isAuthed && (
            <div className="px-3 py-4 text-[12px] text-textSecondary/70 leading-relaxed">
              Sign in to save and revisit your chats.
            </div>
          )}
          {isAuthed && chats.length === 0 && (
            <div className="px-3 py-4 text-[12px] text-textSecondary/60">No chats yet.</div>
          )}
          {folders.map(f => {
            const fChats = chats.filter(c => chatFolders[c.id] === f.id);
            return (
              <div key={f.id} className="mb-1">
                <button onClick={() => toggleFolder(f.id)} className="w-full text-left px-3 py-1.5 flex items-center justify-between text-[12px] text-textSecondary hover:text-white bg-white/[0.02] rounded-lg">
                  <span className="flex items-center gap-2"><Folder className="w-3.5 h-3.5" /> {f.name}</span>
                  <span className="text-[10px] opacity-50">{fChats.length}</span>
                </button>
                {openFolders[f.id] && <div className="pl-3 border-l border-white/[0.04] ml-4 mt-0.5 flex flex-col gap-0.5">{fChats.map(renderChatItem)}</div>}
              </div>
            );
          })}
          {chats.filter(c => !chatFolders[c.id]).map(renderChatItem)}
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
                <div className="flex-1 min-w-0">
                  {usage && (
                    <div className="text-[11px] text-textSecondary">{usage.used}/{usage.limit} today</div>
                  )}
                </div>
                <div className="p-1.5 flex items-center justify-center">
                  <UserButton 
                    appearance={{
                      elements: {
                        userButtonAvatarBox: "w-7 h-7"
                      }
                    }}
                  />
                </div>
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

      </aside>
    </>
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
function ChatPanel({ messages, onSend, streaming, isResearchMode, onRegenerate, onReact, onDownloadPDF, plan, limitInfo, onUpgrade, onStop, activeApp, setActiveApp, activeIntegrations, setView }) {
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
                onSend={onSend}
                streaming={streaming}
              />
            ))}
            {limitInfo && (
              <QuotaCard info={limitInfo} plan={plan} onUpgrade={onUpgrade} />
            )}
          </div>
        )}
      </div>
      <Composer onSend={onSend} streaming={streaming} isResearchMode={isResearchMode} onStop={onStop} activeApp={activeApp} setActiveApp={setActiveApp} activeIntegrations={activeIntegrations} setView={setView} />
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
      <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
        <img src="/logo.png" alt="Resynth" className="w-10 h-10 rounded-lg" />
      </div>
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

function MessageBubble({ m, isLast, onRegenerate, onReact, onSend, streaming }) {
  const [copied, setCopied] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const bubbleRef = useRef(null);

  useEffect(() => {
    if (!bubbleRef.current) return;
    const btns = bubbleRef.current.querySelectorAll('.copy-code-btn');
    const handleClick = (e) => {
      const btn = e.currentTarget;
      const text = decodeURIComponent(btn.getAttribute('data-code') || "");
      navigator.clipboard.writeText(text);
      const span = btn.querySelector('.copy-text');
      if (span) {
        span.textContent = "Copied!";
        setTimeout(() => { span.textContent = "Copy"; }, 2000);
      }
    };
    btns.forEach(b => b.addEventListener('click', handleClick));
    return () => btns.forEach(b => b.removeEventListener('click', handleClick));
  }, [m.content, m.streaming]);

  const copy = () => { navigator.clipboard.writeText(m.content || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (m.role === "user") {
    return (
      <div className="self-end max-w-[85%] animate-fadeUp" data-testid="msg-user">
        <div className="rounded-2xl rounded-tr-md px-4 py-3 bg-white/[0.06] border border-white/[0.06] text-[14.5px] leading-relaxed whitespace-pre-wrap flex flex-col items-end">
          {m.image && (
            <div className="mb-2 rounded-lg border border-white/[0.08] overflow-hidden self-end">
              <img src={m.image} alt="Upload" className="max-w-[200px] max-h-[200px] object-cover" />
            </div>
          )}
          {m.pdf && (
            <div className="mb-2 inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <span className="text-[13px] text-textPrimary font-medium truncate max-w-[200px]">{m.pdf}</span>
            </div>
          )}
          {!(m.content === "[image]" || m.content === "[pdf]") && (
            <div className="text-right">{m.content}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3.5 animate-fadeUp" data-testid="msg-ai">
      <div className="shrink-0 mt-0.5">
        <BotAvatar streaming={m.streaming} />
      </div>
      <div className="flex-1 min-w-0" ref={bubbleRef}>
        {/* Topic image */}
        {m.imageUrl && !m.streaming && (
          <div className="mb-3 rounded-xl overflow-hidden border border-white/[0.06]">
            <img
              src={m.imageUrl}
              alt="Topic visual"
              className="w-full h-44 object-cover"
              loading="lazy"
              onError={(e) => { e.target.parentElement.style.display = 'none'; }}
            />
          </div>
        )}
        <div className="md text-[14.5px]">
          {(!m.content && m.streaming) ? (
            <div className="inline-flex items-center gap-2 text-[12.5px] text-white/70 font-medium">
              <span className="w-3.5 h-3.5 border-[2px] border-white/20 border-t-white/70 rounded-full animate-spin" />
              {m.status || "Connecting..."}
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdownMath(m.content || "_(no response)_") }} />
          )}
        </div>
        {!m.streaming && m.content && (
          <>
            {/* Sources panel */}
            {m.sources?.count > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setSourcesOpen(o => !o)}
                  className="flex items-center gap-1.5 text-[12px] text-textSecondary hover:text-emerald-400 transition-colors"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {m.sources.count} source{m.sources.count !== 1 ? 's' : ''} gathered
                  <span className="text-[10px] opacity-60">{sourcesOpen ? '▲' : '▼'}</span>
                </button>
                {sourcesOpen && (
                  <div className="mt-2 flex flex-col gap-1.5 pl-3 border-l border-white/[0.08]">
                    {m.sources.links?.map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] text-emerald-400 hover:text-emerald-300 truncate max-w-full block"
                        title={s.title}
                      >
                        {s.title || s.url}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Action buttons */}
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              <ActionBtn testid="copy-btn" onClick={copy} active={copied} Icon={copied ? Check : Copy} label={copied ? "Copied" : "Copy"} />
              <ActionBtn testid="like-btn" onClick={() => onReact(m.id, "like")} active={m.reaction === "like"} Icon={ThumbsUp} label="Good" />
              <ActionBtn testid="dislike-btn" onClick={() => onReact(m.id, "dislike")} active={m.reaction === "dislike"} Icon={ThumbsDown} label="Bad" />
              {isLast && !streaming && (
                <ActionBtn testid="regen-btn" onClick={onRegenerate} active={false} Icon={RotateCcw} label="Regenerate" />
              )}
              {m.workedSecs && (
                <span className="ml-2 text-[11.5px] text-textSecondary/60 font-mono">
                  Worked for {m.workedSecs}s
                </span>
              )}
            </div>

            {/* Follow-up question chips */}
            {m.followUps?.length > 0 && (
              <div className="mt-4 flex flex-col gap-2 pl-2">
                {m.followUps.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => onSend && onSend(q)}
                    className="flex items-start text-left gap-2 text-[13.5px] text-white/70 hover:text-white transition-colors group"
                  >
                    <span className="opacity-50 mt-[3px] text-[10px] group-hover:text-emerald-400 group-hover:opacity-100 transition-all">▶</span>
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            )}
          </>
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
function Composer({ onSend, streaming, isResearchMode, onStop, activeApp, setActiveApp, activeIntegrations, setView }) {
  const [text, setText] = useState("");
  const [deepDive, setDeepDive] = useState(false);
  const [litReview, setLitReview] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [pdfName, setPdfName] = useState(null);
  const taRef = useRef(null);
  const fileRef = useRef(null);
  
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  useEffect(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [text]);

  const submit = () => {
    if (streaming) return;
    if (!text.trim() && !imageData && !pdfData) return;
    onSend(text, { imageBase64: imageData, pdfBase64: pdfData, pdfName, deepDive: deepDive || isResearchMode, litReview });
    setText(""); setImageData(null); setImagePreview(null); setPdfData(null); setPdfName(null); setActiveApp(null);
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const b64 = String(result).split(",")[1];
      if (f.type === "application/pdf") {
        setPdfData(b64);
        setPdfName(f.name);
        setImageData(null); setImagePreview(null);
      } else if (f.type.startsWith("image/")) {
        setImageData(b64);
        setImagePreview(String(result));
        setPdfData(null); setPdfName(null);
      } else {
        alert("Only images and PDFs are supported");
      }
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 pt-10 bg-gradient-to-t from-[#0A0C10] via-[#0A0C10]/95 to-transparent pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto">
        {imagePreview && (
          <div className="mb-2 inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 animate-fadeUp">
            <img src={imagePreview} alt="" className="w-10 h-10 rounded object-cover" />
            <span className="text-[12px] text-textSecondary">Image attached</span>
            <button onClick={() => { setImageData(null); setImagePreview(null); }} className="p-1 rounded hover:bg-white/[0.06]">
              <X className="w-3.5 h-3.5 text-textSecondary" />
            </button>
          </div>
        )}
        {pdfName && (
          <div className="mb-2 inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 animate-fadeUp">
            <FileText className="w-5 h-5 text-emerald-400" />
            <span className="text-[12.5px] text-textPrimary truncate max-w-[200px]">{pdfName}</span>
            <button onClick={() => { setPdfData(null); setPdfName(null); }} className="p-1 ml-1 rounded hover:bg-white/[0.06]">
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
          <div className="flex items-center justify-between gap-2 px-2.5 pb-2 pt-1 relative">
            <div className="flex items-center gap-1 flex-wrap">
              <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={handleFile} data-testid="file-input" />
              
              <div className="relative">
                <button
                  data-testid="attach-btn"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className={`w-8 h-8 grid place-items-center rounded-lg text-textSecondary hover:text-white transition-colors ${showAttachMenu || activeApp ? "bg-white/[0.08] text-white" : "hover:bg-white/[0.05]"}`}
                  title="Attach context"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                
                {showAttachMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#18181b] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50 animate-fadeUp origin-bottom-left">
                    <div className="p-1">
                      <button 
                        onClick={() => { setShowAttachMenu(false); fileRef.current?.click(); }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.04] text-[13px] text-white flex items-center gap-2.5 transition-colors"
                      >
                        <ImageIcon className="w-4 h-4 text-emerald-400" />
                        Upload Media
                      </button>
                    </div>
                    
                    <div className="px-3 py-1.5 text-[11px] font-bold text-textSecondary uppercase tracking-wider bg-white/[0.02] border-y border-white/[0.04]">
                      Integrations
                    </div>
                    
                    <div className="p-1">
                      {INTEGRATIONS.map(app => {
                        const isConnected = activeIntegrations.some(a => a.provider === app.slug);
                        return (
                          <button 
                            key={app.slug}
                            onClick={() => {
                              setShowAttachMenu(false);
                              if (isConnected) {
                                setActiveApp(activeApp === app.slug ? null : app.slug);
                              } else {
                                setView("integrations");
                              }
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.04] flex items-center gap-2.5 transition-colors group"
                          >
                            <img src={app.imgUrl || `https://cdn.simpleicons.org/${app.slug}/${app.color}`} alt={app.name} className={`w-4 h-4 ${!isConnected && 'opacity-50 grayscale'}`} />
                            <span className={`text-[13px] flex-1 ${!isConnected ? 'text-textSecondary' : 'text-white'} group-hover:text-white`}>
                              {app.name}
                            </span>
                            {activeApp === app.slug && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            {!isConnected && <span className="text-[10px] bg-white/[0.05] text-textSecondary px-1.5 py-0.5 rounded">Connect</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {!isResearchMode && (
                <>
                  <ModePill testId="mode-deep-dive" active={deepDive} onClick={() => setDeepDive((v) => !v)} icon={Telescope} label="Deep dive" />
                  <ModePill testId="mode-lit-review" active={litReview} onClick={() => setLitReview((v) => !v)} icon={BookOpen} label="Lit review" />
                </>
              )}
            </div>
            <button
              data-testid="chat-submit-btn"
              onClick={streaming ? onStop : submit}
              disabled={(!text.trim() && !imageData && !pdfData) && !streaming}
              className={`w-9 h-9 grid place-items-center rounded-lg transition-colors ${streaming ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : (text.trim() || imageData || pdfData) ? "bg-white text-[#0A0C10] hover:bg-white/90" : "bg-white/[0.05] text-textSecondary cursor-not-allowed"}`}
            >
              {streaming ? <Square className="w-3.5 h-3.5 fill-current" /> : <Send className="w-4 h-4" />}
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
function ImagesView({ authHeaders }) {
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
// ────────────────────────────────────────────────────────────────────────────
// Auth page (Clerk Split Layout)
// ────────────────────────────────────────────────────────────────────────────
function AuthPage({ onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex bg-[#0A0C10] animate-fadeIn overflow-hidden">
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 relative overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 left-6 p-2 text-textSecondary hover:text-white transition-colors bg-white/[0.03] rounded-lg hover:bg-white/[0.08]">
          <X className="w-5 h-5" />
        </button>
        <div className="w-full max-w-md animate-fadeUp">
          <div className="mb-10 text-center">
            <img src="/logo.png" alt="Resynth" className="w-14 h-14 rounded-2xl mx-auto mb-5 shadow-2xl shadow-emerald-500/20" />
            <h2 className="text-3xl font-display font-bold text-white mb-2">Welcome back</h2>
            <p className="text-textSecondary text-[15px]">Sign in to access your intelligence tools.</p>
          </div>
          <SignIn routing="hash" />
        </div>
      </div>
      <div className="hidden lg:block lg:w-1/2 relative bg-[#111111] border-l border-white/[0.04]">
        <TestimonialBanner />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Animated Testimonial Component
// ────────────────────────────────────────────────────────────────────────────
function TestimonialBanner() {
  return (
    <div className="absolute inset-0 w-full h-full bg-[#111111] flex flex-col items-center justify-center relative overflow-hidden">
      <div className="flex items-center justify-center gap-12 w-full max-w-4xl px-8 relative mt-8">
        {/* Avatar Oval */}
        <div className="w-[240px] h-[320px] rounded-[50%] bg-[#ffe600] flex items-end justify-center overflow-hidden animate-float shadow-2xl relative flex-shrink-0 border-4 border-[#ffe600]">
          <img src="/avatar.jpg" alt="Mohammed Yusuf" className="w-[115%] h-[115%] object-cover object-top absolute top-2" />
        </div>

        {/* Quote Box */}
        <div className="relative border-[3px] border-solid border-[#ffe600] animate-glow-border p-10 max-w-[420px]">
          {/* Quote mark SVG */}
          <div className="absolute -left-6 top-8 bg-[#111111] py-2 px-1">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="#ffe600" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 9C10 7.34315 8.65685 6 7 6C5.34315 6 4 7.34315 4 9C4 10.6569 5.34315 12 7 12C7.5147 12 7.99912 11.8705 8.4116 11.6444C8.01639 14.1539 5.86435 16 3 16V18C6.86599 18 10 14.866 10 11V9ZM20 9C20 7.34315 18.6569 6 17 6C15.3431 6 14 7.34315 14 9C14 10.6569 15.3431 12 17 12C17.5147 12 17.9991 11.8705 18.4116 11.6444C18.0164 14.1539 15.8644 16 13 16V18C16.866 18 20 14.866 20 11V9Z" />
            </svg>
          </div>
          <p className="text-white text-[16px] leading-relaxed font-medium animate-type-fade mb-6 opacity-0" style={{ animationDelay: '0.3s' }}>
            What I love about Resynth AI is that it doesn't just summarize stuff for you-it actually helps you understand the connection between studies.
          </p>
          <div className="text-right text-[13px] text-white/80 animate-type-fade opacity-0 font-medium" style={{ animationDelay: '1.2s' }}>
            -Mohammed Yusuf
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Pricing modal
// ────────────────────────────────────────────────────────────────────────────
function PricingModal({ onClose, isAuthed, authHeaders, billing, onRequireAuth }) {
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

// ────────────────────────────────────────────────────────────────────────────
// Integrations View
// ────────────────────────────────────────────────────────────────────────────
function IntegrationsView({ isAuthed, authHeaders, onRequireAuth, activeIntegrations, fetchIntegrations }) {
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(null);

  const handleConnect = async (slug) => {
    if (!isAuthed) return onRequireAuth();
    
    setConnecting(slug);
    try {
      const headers = await authHeaders();
      const providerAuth = slug === "google-drive" ? "google" : slug;
      const res = await fetch(`${API}/auth/${providerAuth}/login`, { headers });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(`Error: ${data.detail || "Failed to connect"}`);
      }
    } catch (e) {
      console.error("Connect failed", e);
      alert("Network error. Is the backend running?");
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (slug) => {
    try {
      const headers = await authHeaders();
      await fetch(`${API}/integrations/${slug}`, { method: "DELETE", headers });
      fetchIntegrations();
    } catch (e) {
      console.error("Disconnect failed", e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10 animate-fadeUp">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold font-display tracking-tight mb-2">Integrations</h2>
        <p className="text-textSecondary mb-10">Connect your favorite apps to give Resynth access to your private data and workflows.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {INTEGRATIONS.map((app, i) => {
            const connected = activeIntegrations.find(a => a.provider === app.slug);
            return (
              <div key={i} className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col h-full transition-colors hover:bg-white/[0.04]">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center p-2.5 overflow-hidden">
                    <img 
                      src={connected?.metadata?.avatar || app.imgUrl || `https://cdn.simpleicons.org/${app.slug}/${app.color}`} 
                      alt={app.name} 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold font-display tracking-tight text-white text-[16px]">{app.name}</h3>
                      {app.comingSoon && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Coming Soon</span>
                      )}
                    </div>
                    <p className="text-sm text-textSecondary line-clamp-2">{app.desc}</p>
                  </div>
                </div>
                
                <div className="mt-auto ml-16 flex items-center justify-between">
                  {connected ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                        Connected as {connected.metadata?.username}
                      </div>
                      <button onClick={() => handleDisconnect(app.slug)} className="text-xs text-textSecondary hover:text-rose-400 transition-colors">
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleConnect(app.slug)} 
                      disabled={app.comingSoon || connecting === app.slug} 
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-[80px] ${app.comingSoon ? "bg-white/[0.05] text-white/30 cursor-not-allowed" : "bg-white text-black hover:bg-white/90"}`}
                    >
                      {connecting === app.slug ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Memory View
// ────────────────────────────────────────────────────────────────────────────
function MemoryView() {
  const [memory, setMemory] = useState(() => localStorage.getItem("re_memory") || "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem("re_memory", memory);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10 animate-fadeUp">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold font-display tracking-tight mb-2">Memory</h2>
        <p className="text-textSecondary mb-10">What should Resynth know about you to provide better, more personalized answers?</p>

        <div className="flex flex-col gap-4 max-w-2xl">
          <textarea
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
            placeholder="e.g. I am a React developer. Always write code in TypeScript. Keep answers concise."
            className="w-full h-48 bg-[#12151C] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl p-4 text-[14px] text-textPrimary placeholder:text-textSecondary/50 resize-none outline-none transition-colors"
          />
          <button
            onClick={save}
            className="self-end px-6 py-2 bg-white text-black rounded-lg text-[13px] font-medium hover:bg-white/90 transition-colors flex items-center gap-2"
          >
            {saved ? <><Check className="w-4 h-4" /> Saved</> : "Save Memory"}
          </button>
        </div>
      </div>
    </div>
  );
}
