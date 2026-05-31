import React, { useEffect, useMemo, useRef, useState, useCallback, startTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Upload,
  Headphones,
  ArrowLeft,
  ChevronRight,
  GraduationCap,
  FileQuestion,
  Mic,
  Menu,
  Bell,
  PenSquare,
  User,
  Home,
  History,
  Trophy,
} from "lucide-react";
import Spline from '@splinetool/react-spline';
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import katex from "katex";
import { useUser, useAuth, SignIn, SignUp, UserButton, UserProfile } from "@clerk/clerk-react";

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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://resynth-main-production.up.railway.app";
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

  useEffect(() => {
    if (user) {
      let cloud = user.unsafeMetadata?.re_memory || [];
      let local = [];
      try {
        const raw = localStorage.getItem("re_memory");
        local = raw && !raw.startsWith("[") ? [{id: Date.now().toString(), text: raw}] : (raw ? JSON.parse(raw) : []);
      } catch {}
      const merged = [...cloud];
      for (const lm of local) {
        if (!merged.some(cm => cm.text === lm.text)) merged.push(lm);
      }
      if (merged.length > cloud.length) {
        user.update({ unsafeMetadata: { ...user.unsafeMetadata, re_memory: merged } }).catch(console.error);
      }
      localStorage.setItem("re_memory", JSON.stringify(merged));
    }
  }, [user]);
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
  const [view, setView] = useState("home");
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loadingChatId, setLoadingChatId] = useState(null);
  const [messages, setMessages] = useState([]); // active chat messages
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
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

  const [modal, setModal] = useState(null);
  const showAlert = (message) => new Promise(res => setModal({ type: 'alert', message, onConfirm: () => { setModal(null); res(); } }));
  const showPrompt = (message, defaultValue = "") => new Promise(res => setModal({ type: 'prompt', message, defaultValue, onConfirm: (val) => { setModal(null); res(val); }, onCancel: () => { setModal(null); res(null); } }));

  const createFolder = async () => {
    if (!isAuthed) { showAlert("Must be signed in!"); return; }
    const name = await showPrompt("Folder name:");
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
    if (folders.length === 0) { showAlert("Create a folder first!"); return; }
    const opts = folders.map((f, i) => `${i + 1}. ${f.name}`).join("\n");
    const num = await showPrompt(`Move to folder (enter number) or 0 to remove:\n0. Uncategorized\n${opts}`);
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
      // folders (not implemented in backend yet)
      // fetch(`${API}/folders`, { headers })
      //   .then((r) => r.json())
      //   .then((arr) => setFolders(Array.isArray(arr) ? arr : []))
      //   .catch(() => {});
        
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
            const temp_id = chat_id;
            setChats((cs) => cs.map((c) => c.id === temp_id ? { ...c, id: d.id } : c));
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
              if (evt.type === "token" && (evt.text || evt.content)) { 
                accText += (evt.text || evt.content); 
                
                const memoryMatch = accText.match(/<SAVE_MEMORY>([\s\S]*?)<\/SAVE_MEMORY>/);
                if (memoryMatch) {
                    const newFact = memoryMatch[1].trim();
                    if (newFact) {
                        try {
                            const raw = localStorage.getItem("re_memory");
                            let arr = [];
                            if (raw && !raw.startsWith("[")) { arr = [{id: Date.now().toString(), text: raw}]; }
                            else { arr = raw ? JSON.parse(raw) : []; }
                            if (!arr.some(m => m.text === newFact)) {
                                arr.push({id: Date.now().toString(), text: newFact});
                                localStorage.setItem("re_memory", JSON.stringify(arr));
                                if (user) user.update({ unsafeMetadata: { ...user.unsafeMetadata, re_memory: arr } }).catch(console.error);
                            }
                        } catch {}
                    }
                    accText = accText.replace(/<SAVE_MEMORY>[\s\S]*?<\/SAVE_MEMORY>/g, "");
                }
                const displayContent = accText.replace(/<SAVE_MEMORY>[\s\S]*/g, "");
                updateAI({ content: displayContent, status: null }); 
              }
              else if (evt.type === "text" && evt.content) { 
                  accText = evt.content; 
                  const displayContent = accText.replace(/<SAVE_MEMORY>[\s\S]*?<\/SAVE_MEMORY>/g, "").replace(/<SAVE_MEMORY>[\s\S]*/g, "");
                  updateAI({ content: displayContent, status: null }); 
              }
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

  const exportChat = async (format) => {
    if (messages.length === 0) return;
    const headers = await authHeaders();
    const r = await fetch(`${API}/export/${format}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: chats.find((c) => c.id === activeId)?.title || "Resynth Conversation",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resynth.${format}`;
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
        onShowPricing={() => setView("pricing")}
        usage={usage}
      />

      <main className="flex-1 flex flex-col min-w-0 relative pb-[64px] md:pb-0">
        <TopBar
          plan={profile.plan}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
          isAuthed={isAuthed}
          onShowAuth={() => setShowAuth(true)}
          onShowPricing={() => setView("pricing")}
          messages={messages}
          onExportChat={exportChat}
        />

        {!isAuthed && <GuestBanner usage={usage} onSignIn={() => setShowAuth(true)} />}

        {view === "pricing" ? (
          <ErrorBoundary><PricingView isAuthed={isAuthed} authHeaders={authHeaders} billing={billingStatus} onRequireAuth={() => setShowAuth(true)} /></ErrorBoundary>
        ) : view === "images" ? (
          <ErrorBoundary><ImagesView authHeaders={authHeaders} /></ErrorBoundary>
        ) : view === "integrations" ? (
          <ErrorBoundary><IntegrationsView isAuthed={isAuthed} authHeaders={authHeaders} onRequireAuth={() => setShowAuth(true)} activeIntegrations={activeIntegrations} fetchIntegrations={fetchIntegrations} showAlert={showAlert} /></ErrorBoundary>
        ) : view === "memory" ? (
          <ErrorBoundary><MemoryView isAuthed={isAuthed} authHeaders={authHeaders} /></ErrorBoundary>
        ) : view === "notebooks" ? (
          <ErrorBoundary><NotebookView isAuthed={isAuthed} authHeaders={authHeaders} onRequireAuth={() => setShowAuth(true)} API={API} sendMessage={sendMessage} streaming={streaming} onStop={stopGeneration} showPrompt={showPrompt} showAlert={showAlert} /></ErrorBoundary>
        ) : view === "search" ? (
          <ErrorBoundary><SearchView chats={chats} onOpen={openChat} /></ErrorBoundary>
        ) : view === "home" ? (
          <ErrorBoundary><HomeDashboard user={profile} setView={setView} newChat={newChat} chats={chats} openChat={openChat} /></ErrorBoundary>
        ) : view === "profile" ? (
          <ErrorBoundary><ProfileView isAuthed={isAuthed} authHeaders={authHeaders} onRequireAuth={() => setShowAuth(true)} activeIntegrations={activeIntegrations} fetchIntegrations={fetchIntegrations} showAlert={showAlert} /></ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <ChatPanel
              messages={messages}
              onSend={sendMessage}
              streaming={streaming}
              isResearchMode={view === "research"}
              onRegenerate={regenerateLast}
              onReact={setReaction}
              onExportChat={exportChat}
              plan={profile.plan}
              limitInfo={limitInfo}
              onUpgrade={() => setView("pricing")}
              onStop={stopGeneration}
              activeApp={activeApp}
              setActiveApp={setActiveApp}
              activeIntegrations={activeIntegrations}
              setView={setView}
              loadingChatId={loadingChatId}
              showAlert={showAlert}
            />
          </ErrorBoundary>
        )}
      </main>

      {/* Mobile Bottom Navigation & FAB */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[64px] bg-[#0A0C10] border-t border-white/[0.04] flex items-center justify-around px-2 z-[60] shadow-[0_-8px_30px_rgba(0,0,0,0.3)]">
        <button onClick={() => setView('home')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'home' ? 'text-emerald-400' : 'text-textSecondary hover:text-white'}`}>
          <Home className="w-5 h-5 mb-1" />
        </button>
        <button onClick={() => setView('notebooks')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'notebooks' ? 'text-emerald-400' : 'text-textSecondary hover:text-white'}`}>
          <BookOpen className="w-5 h-5 mb-1" />
        </button>
        
        <div className="w-14" /> {/* Spacer for FAB */}
        
        <button onClick={() => setView('memory')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'memory' ? 'text-emerald-400' : 'text-textSecondary hover:text-white'}`}>
          <Brain className="w-5 h-5 mb-1" />
        </button>
        <button onClick={() => setView('profile')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'profile' ? 'text-emerald-400' : 'text-textSecondary hover:text-white'}`}>
          <User className="w-5 h-5 mb-1" />
        </button>
        
        {/* FAB */}
        <button onClick={() => { setView('chat'); newChat(); }} className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-[#1f2937] hover:bg-[#374151] rounded-full flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.5)] border border-white/[0.1] text-white transition-transform active:scale-95 z-[70]">
          <PenSquare className="w-6 h-6" />
        </button>
      </div>

      {showAuth && <AuthPage onClose={() => setShowAuth(false)} />}
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
    { id: "home", label: "Home", icon: Home },
    { id: "search", label: "Search", icon: Search },
    { id: "notebooks", label: "Notebooks", icon: BookOpen, hideOnMobile: true },
    { id: "integrations", label: "Integrations", icon: LayoutGrid, hideOnMobile: true },
    { id: "memory", label: "Memory", icon: Brain, hideOnMobile: true },
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
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${item.hideOnMobile ? "hidden md:flex" : "flex"} ${active ? "text-white bg-white/[0.05]" : "text-textSecondary hover:text-white hover:bg-white/[0.03]"}`}
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
function TopBar({ plan, onToggleSidebar, sidebarOpen, isAuthed, onShowAuth, onShowPricing, messages, onExportChat }) {
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setShowExport(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="flex md:hidden items-center justify-between px-5 py-4 border-b border-white/[0.04]">
        <button onClick={onToggleSidebar} className="text-white hover:opacity-80">
          <Menu className="w-6 h-6" />
        </button>
        <div className="text-[22px] font-bold tracking-tight select-none">
          <span className="text-white">R</span><span className="text-emerald-500">e</span>
        </div>
        <button className="text-white hover:opacity-80 relative">
          <Bell className="w-5 h-5" />
        </button>
      </div>

      {/* Desktop Top Bar */}
      <div className="hidden md:flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          {!sidebarOpen && (
            <button onClick={onToggleSidebar} className="w-9 h-9 grid place-items-center rounded-lg bg-white/[0.04] border border-white/[0.07] text-textSecondary hover:text-white">
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {messages?.length > 0 && (
            <div className="relative" ref={exportRef}>
              <button
                data-testid="topbar-save-btn"
                onClick={() => setShowExport(!showExport)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-textSecondary hover:text-white border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02] transition-colors"
                title="Save Conversation"
              >
                <Download className="w-3.5 h-3.5" /> Save
              </button>
              {showExport && (
                <div className="absolute right-0 mt-2 w-36 bg-[#0f172a] border border-white/[0.08] rounded-lg shadow-xl overflow-hidden z-50 flex flex-col animate-fadeUp">
                  <button onClick={() => { setShowExport(false); onExportChat("pdf"); }} className="px-4 py-2.5 text-left text-xs text-white hover:bg-white/[0.05] border-b border-white/[0.04]">PDF Document</button>
                  <button onClick={() => { setShowExport(false); onExportChat("md"); }} className="px-4 py-2.5 text-left text-xs text-white hover:bg-white/[0.05] border-b border-white/[0.04]">Markdown</button>
                  <button onClick={() => { setShowExport(false); onExportChat("txt"); }} className="px-4 py-2.5 text-left text-xs text-white hover:bg-white/[0.05]">Plain Text</button>
                </div>
              )}
            </div>
          )}
          {isAuthed ? (
            plan === "free" && (
              <button data-testid="topbar-upgrade" onClick={onShowPricing} className="btn-transparent rounded-lg px-3 py-1.5 text-xs font-semibold">
                Upgrade
              </button>
            )
          ) : (
            <button data-testid="topbar-signin" onClick={onShowAuth} className="btn-transparent rounded-lg px-3 py-1.5 text-xs font-semibold">
              Sign in
            </button>
          )}
        </div>
      </div>
    </>
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
// Home Dashboard
// ────────────────────────────────────────────────────────────────────────────
function HomeDashboard({ user, setView, newChat, chats = [], openChat }) {
  const recentChats = chats.slice(0, 3);
  const totalChats = chats.length;
  const memoryCount = user?.unsafeMetadata?.re_memory?.length || 0;

  return (
    <div className="w-full h-full flex flex-col items-center justify-start pt-8 pb-32 px-5 overflow-y-auto animate-fadeUp">
      {/* 3D Spline Header */}
      <div className="w-full max-w-4xl h-[280px] md:h-[380px] rounded-[24px] md:rounded-[32px] overflow-hidden relative shadow-2xl bg-[#0A0C10] border border-white/[0.04] flex items-center justify-center">
        <div className="absolute inset-0 pointer-events-auto">
          <Spline 
            scene="https://prod.spline.design/9oABQroW0inykN99/scene.splinecode" 
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>

      <div className="w-full max-w-4xl mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AI Review Card */}
        <div className="bg-[#0A0C10] rounded-[24px] p-6 border border-white/[0.06] shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">AI Weekly Review</h2>
          </div>
          <p className="text-sm text-textSecondary leading-relaxed mb-6">
            You've started <strong className="text-white">{totalChats}</strong> conversations and expanded your knowledge graph with <strong className="text-white">{memoryCount}</strong> saved memories. Your intelligence engine is growing!
          </p>
          <button onClick={() => { setView('memory') }} className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] rounded-xl text-sm font-medium text-white transition-colors border border-white/[0.05]">
            View Memory Insights
          </button>
        </div>

        {/* Recent Projects */}
        <div className="bg-[#0A0C10] rounded-[24px] p-6 border border-white/[0.06] shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <History className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Recent Projects</h2>
          </div>
          <div className="flex flex-col gap-2">
            {recentChats.length > 0 ? recentChats.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer border border-transparent hover:border-white/[0.05]" onClick={() => { openChat(c.id); }}>
                <span className="text-sm font-medium text-white/90 truncate mr-4">{c.title || "New Chat"}</span>
                <span className="text-[11px] font-mono text-textSecondary/50 shrink-0 uppercase tracking-wider">
                  {new Date(c.updatedAt || Date.now()).toLocaleDateString()}
                </span>
              </div>
            )) : (
              <div className="py-4 text-center text-sm text-textSecondary/50">
                No recent projects yet.
                <button onClick={() => { setView('chat'); newChat(); }} className="mt-3 block w-full px-3 py-2 bg-white/[0.02] rounded-lg text-emerald-400 hover:bg-white/[0.05] transition-colors">Start a new chat</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Chat panel
// ────────────────────────────────────────────────────────────────────────────
function ChatPanel({ messages, onSend, streaming, isResearchMode, onRegenerate, onReact, onExportChat, plan, limitInfo, onUpgrade, onStop, activeApp, setActiveApp, activeIntegrations, setView, loadingChatId, showAlert }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const empty = messages.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto" data-testid="chat-scroll">
        {loadingChatId ? (
          <div className="min-h-[400px] flex flex-col justify-end max-w-3xl mx-auto w-full px-4 sm:px-6 pb-20 gap-8 animate-fadeUp">
            {/* User Message Skeleton */}
            <div className="self-end max-w-[70%] w-full">
              <div className="h-[60px] bg-white/[0.04] rounded-2xl rounded-tr-md animate-pulse border border-white/[0.02]" />
            </div>
            {/* AI Message Skeleton */}
            <div className="self-start max-w-[80%] w-full flex flex-col gap-3 mt-4">
              <div className="h-4 bg-white/[0.04] rounded-md animate-pulse w-full" />
              <div className="h-4 bg-white/[0.04] rounded-md animate-pulse w-[90%]" />
              <div className="h-4 bg-white/[0.04] rounded-md animate-pulse w-[60%]" />
            </div>
          </div>
        ) : empty ? (
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
      <Composer onSend={onSend} streaming={streaming} isResearchMode={isResearchMode} onStop={onStop} activeApp={activeApp} setActiveApp={setActiveApp} activeIntegrations={activeIntegrations} setView={setView} showAlert={showAlert} />
    </div>
  );
}

function Hero({ onPick, isResearchMode }) {
  const [topicIndex, setTopicIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useUser();
  
  const topics = useMemo(() => [
    "What are we exploring?",
    "What are we getting into?",
    ...(user ? [`Hey, ${user.firstName || user.fullName || 'there'}!`] : [])
  ], [user]);

  const subTopics = useMemo(() => [
    "Search the web, analyze documents, and generate insights in real-time.",
    "Experience the next evolution of intelligent search and reasoning.",
    "Ask anything. I'll search, reason, and stream the facts instantly.",
    "Your advanced AI research partner."
  ], []);

  useEffect(() => {
    let timeout;
    const currentTopic = topics[topicIndex % topics.length];
    
    if (isDeleting) {
      if (displayedText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayedText(prev => prev.slice(0, -1));
        }, 20);
      } else {
        setIsDeleting(false);
        setTopicIndex((prev) => prev + 1);
      }
    } else {
      if (displayedText.length < currentTopic.length) {
        timeout = setTimeout(() => {
          setDisplayedText(currentTopic.slice(0, displayedText.length + 1));
        }, 50);
      } else {
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 3000);
      }
    }
    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, topicIndex, topics]);

  return (
    <>
      <div className="hidden md:flex min-h-full flex-col items-center justify-center px-4 py-12 animate-fadeUp">
        <h1 className="font-display text-[28px] sm:text-[36px] font-bold tracking-tight text-center mb-2 h-[48px] flex items-center justify-center transition-all duration-500">
          {isResearchMode ? "Deep " : ""}
          <span className="gradient-text">
            {isResearchMode ? "Research Lab" : displayedText}
          </span>
          {!isResearchMode && <span className="animate-pulse ml-1 inline-block w-1.5 h-8 sm:h-10 bg-emerald-500 rounded-full" />}
        </h1>
        <p className={`text-sm sm:text-base text-textSecondary text-center max-w-md mb-8 transition-opacity duration-500 ${isDeleting ? "opacity-0" : "opacity-100"}`}>
          {isResearchMode ? "Multi-step research with citations." : subTopics[topicIndex % subTopics.length]}
        </p>
      </div>
      
      {/* Mobile Home View */}
      <div className="md:hidden flex flex-col w-full h-full px-5 pt-8 pb-24 animate-fadeUp">
        <h1 className="text-[24px] font-bold text-white mb-6 tracking-tight">
          Hello {user ? (user.firstName || user.fullName) : 'Yasuntha'},
        </h1>
        
        {/* Gradient Card */}
        <div className="w-full aspect-[1.8] rounded-[24px] bg-gradient-to-br from-[#2d1b4e] via-[#1f1a3a] to-[#152e3b] shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </div>
      </div>
    </>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      data-testid={m.role === "user" ? "msg-user" : "msg-ai"}
    >
      {m.role === "user" ? (
        <div className="self-end max-w-[85%]">
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
      ) : (
        <div className="flex" ref={bubbleRef}>
          <div className="flex-1 min-w-0">
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
              {streaming && !m.content ? (
                <div className="flex flex-col gap-3 mt-2 w-full max-w-[400px]">
                  <div className="h-[16px] bg-white/[0.04] rounded-md animate-pulse w-full"></div>
                  <div className="h-[16px] bg-white/[0.04] rounded-md animate-pulse w-[85%]"></div>
                  <div className="h-[16px] bg-white/[0.04] rounded-md animate-pulse w-[50%]"></div>
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: renderMarkdownMath(m.content || "_(no response)_") }} />
              )}
            </div>
            {!m.streaming && m.content && (
              <>
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
      )}
    </motion.div>
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
        <button onClick={onUpgrade} className="btn-transparent px-3 py-1.5 rounded-lg text-[12.5px] font-semibold">
          <Crown className="w-3.5 h-3.5" /> Upgrade for higher limits
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Composer with file attach + mode pills inside
// ────────────────────────────────────────────────────────────────────────────
function Composer({ onSend, streaming, isResearchMode, onStop, activeApp, setActiveApp, activeIntegrations, setView, showAlert }) {
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
  const [isDragging, setIsDragging] = useState(false);

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

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const processFile = (f) => {
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
        showAlert("Only images and PDFs are supported");
      }
    };
    reader.readAsDataURL(f);
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
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
        <div 
          className={`relative rounded-2xl bg-[#12151C] border transition-colors shadow-2xl shadow-black/40 overflow-hidden ${isDragging ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-white/[0.08] focus-within:border-white/[0.16]"}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#12151C]/90 backdrop-blur-[2px] pointer-events-none border-2 border-dashed border-emerald-500/50 m-1 rounded-xl">
              <FileText className="w-8 h-8 text-emerald-400 mb-2 animate-bounce" />
              <span className="font-semibold text-emerald-400">Drop document here</span>
            </div>
          )}
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
          <div className="flex justify-center w-full">
            <SignIn routing="hash" />
          </div>
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
// Pricing View (full page)
// ────────────────────────────────────────────────────────────────────────────
function PricingView({ isAuthed, authHeaders, billing, onRequireAuth }) {
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
    } catch (e) { setError(e.message); } finally { setBusy(null); }
  };

  const openPortal = async () => {
    const headers = await authHeaders();
    const r = await fetch(`${API}/billing/portal`, { headers });
    const d = await r.json();
    if (d.url) window.open(d.url, "_blank");
  };

  const currentPlan = billing?.plan || "free";

  const plans = [
    { id: "free", name: "Free", price: "$0", per: "forever", limit: "20 messages / day",
      features: ["Streaming chat", "Chat history", "Basic web search", "Guest access"] },
    { id: "pro", name: "Pro", price: "$12", per: "month", limit: "500 messages / day",
      features: ["App integrations (GitHub, Drive)", "Deep dive & lit review", "Smarter model access", "Exports without watermark", "Everything in Free"] },
    { id: "elite", name: "Elite", price: "$49", per: "month", limit: "1500 messages / day",
      features: ["Highest daily limits", "Priority access during peak hours", "Earliest access to new models", "Dedicated support", "Everything in Pro"] },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-bg overflow-y-auto animate-fadeUp">
      <div className="w-full max-w-5xl mx-auto px-6 py-12 flex flex-col">
        <h1 className="font-display text-3xl font-bold mb-2 text-white">Upgrade your experience</h1>
        <p className="text-textSecondary text-[15px] mb-10">Pick the plan that suits you. Cancel anytime.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {plans.map((p) => {
            const isCurrent = currentPlan === p.id;
            const isPaid = p.id !== "free";
            return (
              <div key={p.id} className={`rounded-2xl border p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                p.id === "pro" ? "border-emerald-500/50 bg-emerald-500/[0.04] shadow-[0_0_40px_rgba(16,185,129,0.08)]" :
                p.id === "elite" ? "border-amber-400/30 bg-amber-400/[0.03]" :
                "border-white/[0.08] bg-white/[0.02]"}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">{p.name}</h3>
                  {p.id === "pro" && <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Most Popular</span>}
                  {p.id === "elite" && <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Power User</span>}
                </div>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-4xl font-display font-bold text-white">{p.price}</span>
                  <span className="text-sm text-textSecondary">/{p.per}</span>
                </div>
                <div className={`text-[12px] font-semibold mb-6 py-1.5 px-3 rounded-lg inline-block w-fit ${
                  p.id === "pro" ? "text-emerald-400 bg-emerald-400/10" :
                  p.id === "elite" ? "text-amber-400 bg-amber-400/10" :
                  "text-textSecondary bg-white/[0.04]"}`}>
                  {p.limit}
                </div>
                <ul className="flex flex-col gap-3 flex-1 mb-8">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-textSecondary">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${p.id === "elite" ? "text-amber-400" : "text-emerald-500"}`} />
                      <span className="leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => isCurrent ? openPortal() : subscribe(p.id)}
                  disabled={busy === p.id || (!isPaid && isCurrent)}
                  className={`w-full py-3 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center gap-2 ${
                    isCurrent ? "border border-white/[0.12] text-textSecondary cursor-default" :
                    p.id === "pro" ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]" :
                    p.id === "elite" ? "bg-amber-400 text-black hover:bg-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.2)]" :
                    "border border-white/[0.1] text-white hover:bg-white/[0.06]"}`}
                >
                  {busy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isCurrent ? "Current Plan" : isPaid ? "Upgrade" : "Get Started"}
                </button>
                {isCurrent && isPaid && (
                  <button onClick={openPortal} className="mt-2 w-full py-2 rounded-lg text-[12px] text-textSecondary hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-colors flex items-center justify-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Manage billing
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        {billing?.subscription_status === "cancelled" && (
          <div className="text-[13px] text-amber-300 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl p-4 text-center">
            Your {billing.plan} plan is cancelled. You keep access until {billing.current_period_end ? new Date(billing.current_period_end).toLocaleDateString() : "period end"}.
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Profile View
// ────────────────────────────────────────────────────────────────────────────
function ProfileView({ isAuthed, authHeaders, onRequireAuth, activeIntegrations, fetchIntegrations, showAlert }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-start pt-8 pb-32 px-5 overflow-y-auto animate-fadeUp">
      <div className="w-full max-w-4xl flex flex-col gap-12">
        <section>
          <h2 className="text-2xl font-display font-bold text-white mb-6">Profile Settings</h2>
          <div className="flex justify-center w-full overflow-hidden">
            <UserProfile 
              routing="hash" 
              appearance={{ 
                variables: {
                  colorBackground: '#12151C',
                  colorText: 'white',
                  colorInputBackground: '#1A1D24',
                  colorPrimary: '#34d399',
                },
                elements: { 
                  rootBox: "w-full flex justify-center",
                  card: "w-full max-w-[100vw] mx-auto m-0 shadow-xl border border-white/[0.08] bg-[#12151C]"
                } 
              }} 
            />
          </div>
        </section>
        <section>
          <IntegrationsView 
            isAuthed={isAuthed} 
            authHeaders={authHeaders} 
            onRequireAuth={onRequireAuth} 
            activeIntegrations={activeIntegrations} 
            fetchIntegrations={fetchIntegrations} 
            showAlert={showAlert} 
            isEmbedded={true}
          />
        </section>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Integrations View
// ────────────────────────────────────────────────────────────────────────────
function IntegrationsView({ isAuthed, authHeaders, onRequireAuth, activeIntegrations, fetchIntegrations, showAlert, isEmbedded = false }) {
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(null);

  const handleConnect = async (slug) => {
    if (!isAuthed) return onRequireAuth();
    if (slug !== "github" && slug !== "google-drive") { showAlert("This integration is not supported yet."); return; }
    
    setConnecting(slug);
    try {
      const headers = await authHeaders();
      const providerAuth = slug === "google-drive" ? "google" : "github";
      const res = await fetch(`${API}/auth/${providerAuth}/login`, { headers });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showAlert(`Error: ${data.detail || "Failed to connect"}`);
      }
    } catch (e) {
      console.error("Connect failed", e);
      showAlert("Network error. Is the backend running?");
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
    <div className={isEmbedded ? "animate-fadeUp" : "flex-1 overflow-y-auto px-6 py-10 animate-fadeUp"}>
      <div className={isEmbedded ? "w-full" : "max-w-4xl mx-auto"}>
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
  const { user } = useUser();
  const [memories, setMemories] = useState(() => {
    let cloud = user?.unsafeMetadata?.re_memory || [];
    let local = [];
    try {
      const raw = localStorage.getItem("re_memory");
      local = raw && !raw.startsWith("[") ? [{id: Date.now().toString(), text: raw}] : (raw ? JSON.parse(raw) : []);
    } catch {}
    const merged = [...cloud];
    for (const lm of local) {
      if (!merged.some(cm => cm.text === lm.text)) merged.push(lm);
    }
    return merged;
  });
  const [draft, setDraft] = useState("");
  const [showTestMode, setShowTestMode] = useState(false);
  const [videoBg, setVideoBg] = useState("#000");

  const handleVideoLoaded = (e) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(e.target, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      setVideoBg(`rgb(${r},${g},${b})`);
    } catch(err) { console.error("Could not extract video color:", err); }
  };

  const saveMemories = (newMemories) => {
    setMemories(newMemories);
    localStorage.setItem("re_memory", JSON.stringify(newMemories));
    if (user) user.update({ unsafeMetadata: { ...user.unsafeMetadata, re_memory: newMemories } }).catch(console.error);
  };

  const addMemory = () => {
    if (!draft.trim()) return;
    saveMemories([...memories, { id: Date.now().toString(), text: draft.trim() }]);
    setDraft("");
  };

  const deleteMemory = (id) => {
    saveMemories(memories.filter((m) => m.id !== id));
  };

  if (showTestMode) {
    return (
      <div className="flex-1 flex items-center justify-center relative transition-colors duration-500" style={{ backgroundColor: videoBg }}>
        <button onClick={() => setShowTestMode(false)} className="absolute top-6 left-6 p-2 text-white/50 hover:text-white transition-colors bg-white/[0.03] rounded-lg hover:bg-white/[0.08] z-10">
          <X className="w-5 h-5" />
        </button>
        <video 
          src="/voice-feature.mp4" 
          autoPlay 
          loop 
          muted 
          onLoadedData={handleVideoLoaded}
          className="max-w-full max-h-full"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10 animate-fadeUp">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold font-display tracking-tight mb-2">Memory</h2>
        <p className="text-textSecondary mb-10">What should Resynth know about you to provide better, more personalized answers?</p>

        <div className="flex flex-col gap-4 max-w-2xl">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMemory()}
              placeholder="e.g. I am a React developer."
              className="flex-1 bg-[#12151C] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl px-4 py-3 text-[14px] text-textPrimary placeholder:text-textSecondary/50 outline-none transition-colors"
            />
            <button onClick={addMemory} className="px-6 py-2 bg-white text-black rounded-lg text-[13px] font-medium hover:bg-white/90 transition-colors">
              Add
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {memories.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-lg p-4 group">
                <span className="text-[14px] text-textPrimary/90">{m.text}</span>
                <button onClick={() => deleteMemory(m.id)} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/[0.08] rounded text-textSecondary hover:text-red-400 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          {memories.length === 0 && (
              <div className="text-center py-8 text-textSecondary/50 text-[13px]">No memories saved yet. The AI can also auto-save memories here during conversation!</div>
            )}
          </div>
          
          <div className="mt-8 pt-8 border-t border-white/[0.08] flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-white mb-1">Upcoming Voice Feature</h3>
              <p className="text-[13px] text-textSecondary">Test the new animation flow</p>
            </div>
            <button onClick={() => setShowTestMode(true)} className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[13px] font-medium hover:bg-emerald-500/20 transition-colors">
              Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// NotebookView — NotebookLM-style research notebooks
// ────────────────────────────────────────────────────────────────────────────
function NotebookView({ isAuthed, authHeaders, onRequireAuth, API, showPrompt, showAlert }) {
  const [notebooks, setNotebooks] = useState([]);
  const [activeNotebook, setActiveNotebook] = useState(null);
  const [sources, setSources] = useState([]);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [inputText, setInputText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(null); // 'podcast' | 'study-guide' | null
  const [artifact, setArtifact] = useState(null); // { type, content }
  const [loadingSources, setLoadingSources] = useState(false);
  const fileRef = useRef(null);
  const chatEndRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => { if (isAuthed) fetchNotebooks(); }, [isAuthed]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchNotebooks = async () => {
    const h = await authHeaders();
    const res = await fetch(`${API}/notebooks`, { headers: h });
    const data = await res.json();
    setNotebooks(data || []);
  };

  const fetchNotebook = async (id) => {
    setLoadingSources(true);
    const h = await authHeaders();
    const res = await fetch(`${API}/notebooks/${id}`, { headers: h });
    const data = await res.json();
    setSources(data.sources || []);
    setActiveNotebook(data.notebook);
    setMessages([]);
    setArtifact(null);
    setLoadingSources(false);
  };

  const createNotebook = async () => {
    if (!isAuthed) { onRequireAuth(); return; }
    const title = await showPrompt("Notebook name:", "Untitled Notebook");
    if (!title) return;
    const h = await authHeaders();
    const res = await fetch(`${API}/notebooks`, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify({ title }) });
    const nb = await res.json();
    await fetchNotebooks();
    fetchNotebook(nb.id);
  };

  const deleteNotebook = async (id) => {
    if (!window.confirm("Delete this notebook and all its sources?")) return;
    const h = await authHeaders();
    await fetch(`${API}/notebooks/${id}`, { method: "DELETE", headers: h });
    if (activeNotebook?.id === id) { setActiveNotebook(null); setSources([]); setMessages([]); }
    fetchNotebooks();
  };

  const uploadSource = async (file) => {
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = String(reader.result).split(",")[1];
      const h = await authHeaders();
      await fetch(`${API}/notebooks/${activeNotebook.id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify({ filename: file.name, base64_data: b64 })
      });
      await fetchNotebook(activeNotebook.id);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const deleteSource = async (sourceId) => {
    const h = await authHeaders();
    await fetch(`${API}/sources/${sourceId}`, { method: "DELETE", headers: h });
    setSources(s => s.filter(x => x.id !== sourceId));
  };

  const sendMessage = async () => {
    if (!inputText.trim() || streaming || sources.length === 0) return;
    const userMsg = { role: "user", content: inputText };
    setMessages(m => [...m, userMsg, { role: "assistant", content: "", streaming: true, status: "Reading sources..." }]);
    setInputText("");
    setStreaming(true);

    const h = await authHeaders();
    const controller = new AbortController();
    abortRef.current = controller;

    const history = messages.map(m => ({ role: m.role, content: m.content || "" }));
    const resp = await fetch(`${API}/chat/stream`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", ...h },
      body: JSON.stringify({ message: inputText, messages: history, notebook_id: activeNotebook.id })
    });

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "", acc = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx); buf = buf.slice(idx + 2);
        for (const line of raw.split("\n")) {
          if (!line.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim());
            if (evt.type === "done") break;
            if (evt.type === "text" && (evt.text || evt.content)) {
              acc = (evt.text || evt.content);
              setMessages(m => m.map((x, i, a) => i === a.length - 1 ? { ...x, content: acc, status: null } : x));
            } else if (evt.type === "token" && (evt.text || evt.content)) {
              acc += (evt.text || evt.content);
              setMessages(m => m.map((x, i, a) => i === a.length - 1 ? { ...x, content: acc, status: null } : x));
            } else if (evt.type === "status") {
              setMessages(m => m.map((x, i, a) => i === a.length - 1 ? { ...x, status: evt.message } : x));
            }
          } catch {}
        }
      }
    }
    setMessages(m => m.map((x, i, a) => i === a.length - 1 ? { ...x, streaming: false, status: null } : x));
    setStreaming(false);
  };

  const generateArtifact = async (type) => {
    if (sources.length === 0) return;
    setGenerating(type);
    setArtifact(null);
    const h = await authHeaders();
    const endpoint = type === "podcast" ? "podcast" : "study-guide";
    const res = await fetch(`${API}/notebooks/${activeNotebook.id}/${endpoint}`, { method: "POST", headers: h });
    const data = await res.json();
    setArtifact({ type, content: type === "podcast" ? data.script : data.guide });
    setGenerating(null);
  };

  if (!isAuthed) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <BookOpen className="w-12 h-12 text-textSecondary/40" />
        <h2 className="text-xl font-bold text-white">Notebooks</h2>
        <p className="text-textSecondary text-center max-w-sm">Sign in to create research notebooks, upload documents, and generate AI-powered insights.</p>
        <button onClick={onRequireAuth} className="px-6 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors">Sign in</button>
      </div>
    );
  }

  // ── Artifact overlay ──────────────────────────────────────────────────────
  if (artifact) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
          <button onClick={() => setArtifact(null)} className="p-2 rounded-lg hover:bg-white/[0.05] text-textSecondary hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          {artifact.type === "podcast" ? <Mic className="w-4 h-4 text-purple-400" /> : <GraduationCap className="w-4 h-4 text-emerald-400" />}
          <h2 className="text-sm font-semibold text-white">{artifact.type === "podcast" ? "Audio Overview Script" : "Study Guide"}</h2>
          <span className="ml-auto text-xs text-textSecondary">{activeNotebook?.title}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <pre className="whitespace-pre-wrap font-sans text-[14px] leading-[1.85] text-white/85 max-w-3xl mx-auto">{artifact.content}</pre>
        </div>
      </div>
    );
  }

  // ── Notebooks list (no active notebook) ───────────────────────────────────
  if (!activeNotebook) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Notebooks</h1>
            <p className="text-xs text-textSecondary mt-0.5">Upload documents, ask questions, generate insights</p>
          </div>
          <button onClick={createNotebook} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-black text-[13px] font-semibold hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Plus className="w-4 h-4" /> New Notebook
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {notebooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-textSecondary/50" />
              </div>
              <p className="text-textSecondary text-[14px] max-w-xs">No notebooks yet. Create one and upload your PDFs or text files to start researching.</p>
              <button onClick={createNotebook} className="px-5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.1] transition-colors">
                Create your first notebook
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notebooks.map(nb => (
                <div key={nb.id} onClick={() => fetchNotebook(nb.id)} className="group relative bg-white/[0.03] border border-white/[0.07] hover:border-emerald-500/30 hover:bg-white/[0.05] rounded-2xl p-5 cursor-pointer transition-all duration-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-emerald-400" />
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteNotebook(nb.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-textSecondary hover:text-red-400 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3 className="text-[14px] font-semibold text-white truncate mb-1">{nb.title}</h3>
                  <p className="text-[12px] text-textSecondary">{new Date(nb.created_at).toLocaleDateString()}</p>
                  <ChevronRight className="absolute right-4 bottom-5 w-4 h-4 text-textSecondary/30 group-hover:text-emerald-400 transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Notebook detail view (split pane) ─────────────────────────────────────
  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Sources Panel */}
      <div className="w-[280px] shrink-0 border-r border-white/[0.06] flex flex-col bg-[#090B0F]">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-white/[0.05]">
          <button onClick={() => { setActiveNotebook(null); setSources([]); setMessages([]); }} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-textSecondary hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <h2 className="text-[13px] font-semibold text-white truncate flex-1">{activeNotebook.title}</h2>
        </div>

        <div className="px-3 py-3 border-b border-white/[0.05]">
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-white/[0.15] hover:border-emerald-500/40 hover:bg-emerald-500/5 text-[12.5px] text-textSecondary hover:text-emerald-400 transition-all">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "Uploading..." : "Add source (PDF / TXT)"}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadSource(f); e.target.value = ""; }} />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
          {loadingSources ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-textSecondary" /></div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 text-[12px] text-textSecondary/50 px-4">No sources yet. Upload a PDF or text file to get started.</div>
          ) : sources.map(src => (
            <div key={src.id} className="group flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <FileText className="w-3.5 h-3.5 text-emerald-400/70 shrink-0" />
              <span className="text-[12px] text-textSecondary flex-1 truncate">{src.filename}</span>
              <button onClick={() => deleteSource(src.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-400 text-textSecondary/50 transition-all">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Generate buttons */}
        <div className="px-3 py-3 border-t border-white/[0.05] flex flex-col gap-2">
          <button onClick={() => generateArtifact("podcast")} disabled={generating !== null || sources.length === 0} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-[12.5px] font-medium transition-colors">
            {generating === "podcast" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Headphones className="w-3.5 h-3.5" />}
            Audio Overview
          </button>
          <button onClick={() => generateArtifact("study-guide")} disabled={generating !== null || sources.length === 0} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-[12.5px] font-medium transition-colors">
            {generating === "study-guide" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />}
            Study Guide
          </button>
        </div>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {sources.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <FileQuestion className="w-10 h-10 text-textSecondary/30" />
            <p className="text-[14px] text-textSecondary max-w-xs">Upload at least one source to start chatting with your documents.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-1">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-white font-semibold">{activeNotebook.title}</h3>
            <p className="text-[13px] text-textSecondary max-w-sm">{sources.length} source{sources.length > 1 ? "s" : ""} loaded. Ask anything about your documents.</p>
            {[`Summarize the key findings`, `What are the main themes?`, `List the key concepts`].map(q => (
              <button key={q} onClick={() => { setInputText(q); }} className="px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-[13px] text-textSecondary hover:text-white transition-colors">
                {q}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 flex flex-col gap-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                {m.role === "user" ? (
                  <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-white/[0.07] border border-white/[0.06] text-[14px] text-white leading-relaxed">{m.content}</div>
                ) : (
                  <div className="max-w-[85%]">
                    {m.streaming && !m.content ? (
                      <div className="flex items-center gap-2 text-[12.5px] text-textSecondary">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {m.status || "Reading sources..."}
                      </div>
                    ) : (
                      <div className="text-[14px] leading-[1.8] text-white/90" dangerouslySetInnerHTML={{ __html: marked.parse(m.content || "") }} />
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Input */}
        <div className="px-4 md:px-8 py-4 border-t border-white/[0.05]">
          <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] focus-within:border-emerald-500/40 rounded-2xl px-4 py-3 transition-colors">
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={sources.length === 0 ? "Upload a source to start chatting..." : "Ask about your documents..."}
              disabled={sources.length === 0 || streaming}
              rows={1}
              className="flex-1 bg-transparent text-[14px] text-white placeholder:text-textSecondary/50 resize-none outline-none max-h-[120px] disabled:opacity-40"
            />
            <button onClick={sendMessage} disabled={!inputText.trim() || streaming || sources.length === 0} className="p-2 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-textSecondary/40 text-center mt-2">Answers are strictly grounded in your uploaded sources</p>
        </div>
      </div>
    </div>
  );
}

