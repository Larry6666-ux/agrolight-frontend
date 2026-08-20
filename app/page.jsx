"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Home, Store, Wrench, Bell, User, Sprout, Warehouse, Truck,
  Plus, X, Check, ChevronRight, ChevronLeft, Wallet as WalletIcon,
  ShieldCheck, TrendingUp, Users, Package, MapPin, Star, ArrowRight,
  RefreshCw, Trash2, Send, ClipboardCheck, BarChart3, Sparkles,
  Wheat, Sun, Siren, Navigation, Zap, Server, WifiOff, Loader2, LogOut,
  Bot, ChevronDown, ChevronUp
} from "lucide-react";

const BRAND = {
  green: "#1B5E3F",
  greenDark: "#123B28",
  greenSoft: "#E7F0EA",
  gold: "#D4A017",
  goldSoft: "#FBF0D6",
  blue: "#2C6E9E",
  blueSoft: "#E7F0F7",
  ink: "#22281F",
  paper: "#FAF9F5",
};

const SESSION_KEY = "agrolight-next-session";

const DEMO_FARMER = { phone: "08160510275", password: "password123" };
const DEMO_ADMIN = { phone: "08000000000", password: "password123" };
const DEMO_BUYER = {
  phone: "09099990000",
  password: "password123",
  fullName: "Delta Fresh Foods",
  userType: "buyer",
};

const CROPS = ["Cassava", "Maize", "Yam", "Rice", "Tomato", "Pepper"];
const CROP_PRICE_PER_TON = { Cassava: 210000, Maize: 260000, Yam: 320000, Rice: 480000, Tomato: 180000, Pepper: 350000 };

function estimateProduceValue(produceList) {
  return produceList
    .filter((p) => p.status !== "sold")
    .reduce((sum, p) => {
      const qty = parseFloat(p.quantity) || 1;
      const perTon = CROP_PRICE_PER_TON[p.cropType] || 200000;
      return sum + qty * perTon;
    }, 0);
}

const NEAREST_HUB = { name: "Ugbowo Hub", distance: "1.8 km", capacityAvailable: true };
const WEATHER_TODAY = { condition: "Sunny", temp: "29°C", note: "Good day for harvesting" };

const STATUS_STYLE = {
  available: { bg: BRAND.greenSoft, fg: BRAND.green, label: "Available" },
  processing: { bg: BRAND.goldSoft, fg: "#8A6A0F", label: "Processing" },
  processed: { bg: BRAND.blueSoft, fg: BRAND.blue, label: "Processed" },
  in_storage: { bg: BRAND.blueSoft, fg: BRAND.blue, label: "In Storage" },
  listed: { bg: BRAND.goldSoft, fg: "#8A6A0F", label: "Listed" },
  sold: { bg: "#EDEDED", fg: "#666", label: "Sold" },
};

function fakeDistance(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 997;
  return (0.6 + (h % 45) / 10).toFixed(1) + " km";
}

async function apiFetch(base, token, path, options = {}) {
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  let body = null;
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const msg = body?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

async function ensureSession(base, creds) {
  try {
    return await apiFetch(base, null, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone: creds.phone, password: creds.password }),
    });
  } catch (e) {
    const reg = await apiFetch(base, null, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: creds.fullName || "Demo User",
        phone: creds.phone,
        password: creds.password,
        userType: creds.userType || "farmer",
      }),
    });
    return apiFetch(base, null, "/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone: creds.phone, code: reg.devOtp }),
    });
  }
}

export default function AgroLightPrototype() {
  const [conn, setConn] = useState({ status: "loading" });
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_DEFAULT_API_BASE || "http://localhost:3000");
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState("home");
  const [screen, setScreen] = useState(null);
  const [adminMode, setAdminMode] = useState(false);
  const [adminSession, setAdminSession] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [toast, setToast] = useState(null);
  const buyerSessionRef = useRef(null);
const [activeEndpointData, setActiveEndpointData] = useState(null);
  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    (async () => {
      try {
        const cachedRaw = window.localStorage.getItem(SESSION_KEY);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed.apiBase && parsed.token) {
            setApiBase(parsed.apiBase);
            const ok = await tryRestore(parsed.apiBase, parsed.token, parsed.user);
            if (ok) return;
          }
        }
      } catch { /* no cached session */ }
      setConn({ status: "disconnected" });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryRestore(base, tok, cachedUser) {
    try {
      await apiFetch(base, tok, "/api/farmers/farms");
      setToken(tok);
      setUser(cachedUser);
      setConn({ status: "connected" });
      await refreshAll(base, tok);
      return true;
    } catch {
      return false;
    }
  }

  function persistSession(base, tok, u) {
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify({ apiBase: base, token: tok, user: u }));
    } catch { /* non-fatal, e.g. private browsing */ }
  }

  const connect = async (base) => {
    setConn({ status: "connecting" });
    setErrorMsg("");
    try {
      const login = await ensureSession(base, DEMO_FARMER);
      setApiBase(base);
      setToken(login.accessToken);
      setUser(login.user);
      setConn({ status: "connected" });
      persistSession(base, login.accessToken, login.user);
      await refreshAll(base, login.accessToken);
    } catch (e) {
      setConn({ status: "error" });
      setErrorMsg(e.message || "Could not reach that backend.");
    }
  };

  const disconnect = async () => {
    try { window.localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    setToken(null);
    setUser(null);
    setData(null);
    setAdminMode(false);
    setAdminSession(null);
    setConn({ status: "disconnected" });
  };

  const refreshAll = useCallback(async (base = apiBase, tok = token) => {
    if (!base || !tok) return;
    setRefreshing(true);
    try {
      const [farms, produceList, centres, myProcessingBookings, facilities, myColdBookings, myListings, wallet, walletHistory, notifications] =
        await Promise.all([
          apiFetch(base, tok, "/api/farmers/farms"),
          apiFetch(base, tok, "/api/farmers/produce"),
          apiFetch(base, tok, "/api/processing/centres"),
          apiFetch(base, tok, "/api/processing/bookings/mine"),
          apiFetch(base, tok, "/api/cold-storage/facilities"),
          apiFetch(base, tok, "/api/cold-storage/bookings/mine"),
          apiFetch(base, tok, "/api/marketplace/listings/mine"),
          apiFetch(base, tok, "/api/finance/wallet/balance"),
          apiFetch(base, tok, "/api/finance/wallet/history"),
          apiFetch(base, tok, "/api/notifications"),
        ]);

      const activeListings = (myListings || []).filter((l) => l.status === "active");
      const offerLists = await Promise.all(
        activeListings.map((l) => apiFetch(base, tok, `/api/marketplace/listings/${l.id}/offers`).catch(() => [])),
      );
      const offersByListing = {};
      activeListings.forEach((l, i) => { offersByListing[l.id] = offerLists[i] || []; });

      setData({
        farms: farms || [],
        produce: produceList || [],
        processingCentres: centres || [],
        processingBookings: myProcessingBookings || [],
        coldFacilities: facilities || [],
        coldBookings: myColdBookings || [],
        listings: myListings || [],
        offersByListing,
        wallet: wallet || { balance: 0 },
        walletHistory: walletHistory || [],
        notifications: notifications || [],
      });
    } catch (e) {
      showToast("Couldn't refresh from the backend: " + e.message);
    } finally {
      setRefreshing(false);
    }
  }, [apiBase, token]);

  const openAdmin = async () => {
    setAdminMode(true);
    if (adminSession) return;
    try {
      const login = await ensureSession(apiBase, DEMO_ADMIN);
      setAdminSession(login);
      const [users, pending] = await Promise.all([
        apiFetch(apiBase, login.accessToken, "/api/admin/users"),
        apiFetch(apiBase, login.accessToken, "/api/admin/verifications/pending"),
      ]);
      setAdminData({ users: users || [], pending: pending || [] });
    } catch (e) {
      showToast("Admin login failed: " + e.message);
    }
  };

  async function getBuyerSession() {
    if (buyerSessionRef.current) return buyerSessionRef.current;
    const login = await ensureSession(apiBase, DEMO_BUYER);
    buyerSessionRef.current = login;
    return login;
  }

  if (conn.status === "loading") {
    return <FullScreenNote icon={Loader2} spin text="Checking for a saved connection…" />;
  }

  if (conn.status !== "connected") {
    return <ConnectScreen apiBase={apiBase} setApiBase={setApiBase} status={conn.status} errorMsg={errorMsg} onConnect={connect} />;
  }

  if (!data) {
    return <FullScreenNote icon={Loader2} spin text="Loading your farm data…" />;
  }

  const ctx = { apiBase, token, user, data, refreshAll, showToast, buyerFetch: getBuyerSession };

  return (
    <div className="w-full min-h-screen flex items-start justify-center py-8 px-4" style={{ background: BRAND.paper, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        .agro-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
      `}</style>

      <div className="flex flex-col items-center gap-4">
        <div className="agro-display text-center" style={{ color: BRAND.green }}>
          <div className="text-lg font-bold tracking-tight">AgroLight OS</div>
          <div className="text-xs flex items-center gap-1 justify-center" style={{ color: "#6b7a71" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: refreshing ? BRAND.gold : BRAND.green }} />
            Live · {apiBase.replace(/^https?:\/\//, "")}
          </div>
        </div>

        <div className="relative rounded-[2.5rem] shadow-2xl border-[6px]" style={{ borderColor: "#0F241B", width: 390, height: 780, background: "#000" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-5 bg-black rounded-b-2xl z-20" />
          <div className="w-full h-full rounded-[2rem] overflow-hidden flex flex-col relative" style={{ background: "#FFFFFF" }}>

            <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold" style={{ color: BRAND.ink }}>
              <span>9:41</span>
              <span className="agro-display" style={{ color: BRAND.green }}>AgroLight OS</span>
              <span>●●●●</span>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ background: BRAND.paper }}>
              {toast && (
                <div className="mx-4 mt-2 rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2" style={{ background: BRAND.greenSoft, color: BRAND.green }}>
                  <Check size={14} /> {toast}
                </div>
              )}

              {adminMode ? (
                <AdminDashboard adminData={adminData} onExit={() => setAdminMode(false)} />
              ) : screen ? (
                <ScreenRouter screen={screen} ctx={ctx} goBack={() => setScreen(null)} openScreen={(name, props) => setScreen({ name, props })} />
              ) : (
                <TabRouter tab={tab} ctx={ctx} openScreen={(name, props) => setScreen({ name, props })} goToTab={setTab} onAdmin={openAdmin} onDisconnect={disconnect} />
              )}
            </div>

            {!screen && !adminMode && (
              <div className="flex items-stretch border-t bg-white" style={{ borderColor: "#EEEEE7" }}>
                <NavBtn icon={Home} label="Home" active={tab === "home"} onClick={() => setTab("home")} />
                <NavBtn icon={Store} label="Marketplace" active={tab === "market"} onClick={() => setTab("market")} dot />
                <NavBtn icon={Wrench} label="Services" active={tab === "services"} onClick={() => setTab("services")} />
                <NavBtn icon={Bell} label="Alerts" active={tab === "alerts"} onClick={() => setTab("alerts")} badge={data.notifications.filter((n) => !n.read).length} />
                <NavBtn icon={User} label="Profile" active={tab === "profile"} onClick={() => setTab("profile")} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectScreen({ apiBase, setApiBase, status, errorMsg, onConnect }) {
  return (
    <div className="w-full min-h-screen flex items-center justify-center px-6" style={{ background: BRAND.paper, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border p-6" style={{ borderColor: "#EFEFE8" }}>
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: BRAND.greenSoft }}>
            <Server size={24} color={BRAND.green} />
          </div>
          <h1 className="text-lg font-bold" style={{ color: BRAND.ink }}>Connect to your AgroLight OS backend</h1>
          <p className="text-xs mt-2" style={{ color: "#9AA39B" }}>
            Enter the URL where your Next.js + Drizzle API is running — a local dev server (with a tunnel like ngrok) or a deployed instance.
          </p>
        </div>

        <label className="text-[11px] font-semibold" style={{ color: "#9AA39B" }}>Backend URL</label>
        <input
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          placeholder="https://your-backend.example.com"
          className="w-full mt-1 mb-3 rounded-lg px-3 py-2.5 text-sm border outline-none"
          style={{ borderColor: "#EFEFE8", color: BRAND.ink }}
        />

        <button
          onClick={() => onConnect(apiBase)}
          disabled={status === "connecting" || !apiBase}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: BRAND.green }}
        >
          {status === "connecting" ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
          {status === "connecting" ? "Connecting…" : "Connect & log in as demo farmer"}
        </button>

        {status === "error" && (
          <div className="mt-3 rounded-lg p-3 flex items-start gap-2" style={{ background: "#FDECEA" }}>
            <WifiOff size={15} color="#C0392B" className="shrink-0 mt-0.5" />
            <p className="text-[11px]" style={{ color: "#C0392B" }}>{errorMsg}</p>
          </div>
        )}

        <p className="text-[10px] mt-4 text-center" style={{ color: "#C7CFC8" }}>
          Logs in with the seeded demo farmer (08160510275). Run <code>npm run db:seed</code> on the backend first.
        </p>
      </div>
    </div>
  );
}

function FullScreenNote({ icon: Icon, text, spin }) {
  return (
    <div className="w-full min-h-screen flex items-center justify-center" style={{ background: BRAND.paper }}>
      <div className="flex flex-col items-center gap-3">
        <Icon className={spin ? "animate-spin" : ""} size={30} color={BRAND.green} />
        <p className="text-xs" style={{ color: BRAND.ink }}>{text}</p>
      </div>
    </div>
  );
}

function NavBtn({ icon: Icon, label, active, onClick, badge, dot }) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center gap-0.5 py-2.5 relative">
      <div className="relative">
        <Icon size={20} color={active ? BRAND.green : "#9AA39B"} strokeWidth={active ? 2.4 : 2} />
        {!!badge && (
          <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ background: BRAND.gold }}>{badge}</span>
        )}
        {!badge && dot && <span className="absolute -top-0.5 -right-1 w-[7px] h-[7px] rounded-full" style={{ background: BRAND.gold }} />}
      </div>
      <span className="text-[9.5px] font-medium" style={{ color: active ? BRAND.green : "#9AA39B" }}>{label}</span>
    </button>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <h2 className="agro-display text-[15px] font-bold" style={{ color: BRAND.ink }}>{children}</h2>
      {right}
    </div>
  );
}
function Card({ children, onClick, className = "" }) {
  return (
    <div onClick={onClick} className={`bg-white rounded-2xl border p-3.5 ${onClick ? "active:scale-[0.98] cursor-pointer" : ""} ${className}`} style={{ borderColor: "#EFEFE8" }}>
      {children}
    </div>
  );
}
function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || { bg: "#eee", fg: "#555", label: status };
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}
function TopBar({ title, onBack, right }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-2 sticky top-0 z-10" style={{ background: BRAND.paper }}>
      <button onClick={onBack} className="w-8 h-8 rounded-full flex items-center justify-center bg-white border" style={{ borderColor: "#EFEFE8" }}><ChevronLeft size={18} color={BRAND.ink} /></button>
      <h1 className="agro-display text-[15px] font-bold" style={{ color: BRAND.ink }}>{title}</h1>
      <div className="w-8">{right}</div>
    </div>
  );
}
function PrimaryButton({ children, onClick, disabled, icon: Icon, loading }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} className="w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: BRAND.green }}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon && <Icon size={16} />} {children}
    </button>
  );
}
function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center px-8">
      <Icon size={30} color="#C7CFC8" />
      <p className="text-xs" style={{ color: "#9AA39B" }}>{text}</p>
    </div>
  );
}
function Label({ children }) { return <p className="text-[10.5px] font-semibold mb-1" style={{ color: "#9AA39B" }}>{children}</p>; }
function Input({ value, onChange, placeholder }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg px-3 py-2.5 text-xs border outline-none" style={{ borderColor: "#EFEFE8", color: BRAND.ink }} />;
}
function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-xs border outline-none bg-white" style={{ borderColor: "#EFEFE8", color: BRAND.ink }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function TabRouter({ tab, ctx, openScreen, goToTab, onAdmin, onDisconnect }) {
  if (tab === "home") return <HomeTab ctx={ctx} openScreen={openScreen} goToTab={goToTab} />;
  if (tab === "market") return <MarketTab ctx={ctx} openScreen={openScreen} />;
  if (tab === "services") return <ServicesTab openScreen={openScreen} />;
  if (tab === "alerts") return <AlertsTab ctx={ctx} />;
  if (tab === "profile") return <ProfileTab ctx={ctx} onAdmin={onAdmin} onDisconnect={onDisconnect} />;
  return null;
}

function HomeTab({ ctx, openScreen, goToTab }) {
  const { data, user } = ctx;
  const pendingOrders = data.processingBookings.filter((b) => b.status !== "completed").length
    + data.coldBookings.filter((b) => b.reservationStatus === "active").length;
  const produceValue = estimateProduceValue(data.produce);
  const firstName = (user?.fullName || "Farmer").split(" ")[0];

  return (
    <div className="pb-6">
      <div className="mx-4 mt-3 rounded-2xl p-4 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.greenDark})` }}>
        <Sprout className="absolute -right-3 -bottom-3 opacity-20" size={90} color="#FFFFFF" />
        <p className="text-[10.5px] font-medium text-white/80">Welcome back</p>
        <h1 className="agro-display text-lg font-bold text-white mt-0.5">{firstName} 👋</h1>
        <p className="text-[11px] text-white/85 mt-1.5 leading-snug max-w-[240px]">Find buyers, book processing, and reduce post-harvest losses — all in one place.</p>
      </div>

      <button onClick={() => openScreen("aiCopilot")} className="w-full text-left mx-0 mt-3 px-4">
        <div className="rounded-2xl p-4 relative overflow-hidden active:scale-[0.98]" style={{ background: `linear-gradient(135deg, ${BRAND.blue}, #1E4A66)` }}>
          <Bot className="absolute -right-2 -bottom-2 opacity-20" size={80} color="#FFFFFF" />
          <div className="flex items-center gap-1.5">
            <span className="text-base leading-none">🤖</span>
            <p className="text-sm font-bold text-white">Ask AgroLight AI</p>
          </div>
          <p className="text-[11px] text-white/85 mt-1">Tell us what you need after harvest.</p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <span className="text-[9.5px] px-2 py-1 rounded-full text-white" style={{ background: "rgba(255,255,255,0.18)" }}>"Find storage near me"</span>
            <span className="text-[9.5px] px-2 py-1 rounded-full text-white" style={{ background: "rgba(255,255,255,0.18)" }}>"Help me find a buyer"</span>
          </div>
        </div>
      </button>
      {/* Quick Action Endpoints Bar */}
{/* Quick Action Endpoints Bar */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px', background: '#111827', borderRadius: '8px', marginBottom: '16px' }}>
        {[
          { label: "Gov Portal", path: "/api/government/farmer-statistics", method: "GET" },
          { label: "Finance", path: "/api/finance/wallet/balance", method: "GET" },
          { label: "Logistics", path: "/api/logistics/providers", method: "GET" },
          { label: "Processing", path: "/api/processing/centres", method: "GET" },
          { label: "AI Copilot", path: "/api/ai/copilot", method: "POST" }
        ].map((item) => (
          <button
            key={item.path}
            onClick={async () => {
              try {
                const options = {
                  method: item.method,
                  headers: { 'Content-Type': 'application/json' },
                  ...(item.method === 'POST' ? { body: JSON.stringify({ prompt: "Hello AI Copilot" }) } : {})
                };
              const res = await fetch('https://agrolight-os-backend.vercel.app' + item.path, options);
        if (res.ok) {
          const data = await res.json();
          setActiveEndpointData({ title: item.label, content: data });
        } else {
          setActiveEndpointData({ title: item.label, error: "Status " + res.status + ": " + res.statusText });
        }
              } catch (e) {
                setActiveEndpointData({ title: item.label, error: e.message });
              }
            }}
           {/* Quick Action Endpoints Bar */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {[
          { label: 'Market Prices', path: '/api/market-prices' },
          { label: 'Farm Locations', path: '/api/farms' },
          { label: 'Solar Hardware', path: '/api/hardware' },
          { label: 'Copilot Chat Test', path: '/api/copilot', method: 'POST' },
          { label: 'Analytics Summary', path: '/api/analytics' },
        ].map((item, index) => (
          <button
            key={index}
            onClick={async () => {
              setActiveEndpointData({ title: item.label, content: 'Loading...' });
              try {
                const options = {
                  method: item.method || 'GET',
                  headers: { 'Content-Type': 'application/json' },
                  ...(item.method === 'POST' ? { body: JSON.stringify({ prompt: "Hello AI Copilot" }) } : {})
                };
                const res = await fetch('https://agrolight-os-backend.vercel.app' + item.path, options);
                if (res.ok) {
                  const data = await res.json();
                  setActiveEndpointData({ title: item.label, content: data });
                } else {
                  setActiveEndpointData({ title: item.label, error: "Status " + res.status + ": " + res.statusText });
                }
              } catch (e) {
                setActiveEndpointData({ title: item.label, error: e.message });
             }
        style={{ padding: '8px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
      >
        {item.label}
      </button>
    )}
  </div>
      {/* Dynamic Data Display Card */}
      {activeEndpointData && (
        <div style={{ background: '#1f2937', color: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #374151' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, color: '#10b981' }}>{activeEndpointData.title} Result</h4>
            <button 
              onClick={() => setActiveEndpointData(null)} 
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          </div>
          {activeEndpointData.error ? (
            <p style={{ color: '#ef4444', margin: 0 }}>Error: {activeEndpointData.error}</p>
          ) : (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px', background: '#111827', padding: '10px', borderRadius: '6px', maxHeight: '200px', overflowY: 'auto' }}>
              {Array.isArray(activeEndpointData.content) && activeEndpointData.content.length === 0 
                ? "No record found (0 entries)" 
                : JSON.stringify(activeEndpointData.content, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="px-4 grid grid-cols-3 gap-2 mt-3">
        <MiniStat emoji="🌾" label="Produce Value" value={`₦${(produceValue / 1000).toFixed(0)}k`} color={BRAND.green} />
        <MiniStat emoji="📦" label="Pending Orders" value={pendingOrders} color={BRAND.blue} />
        <MiniStat emoji="💰" label="Wallet Balance" value={`₦${(Number(data.wallet.balance) / 1000).toFixed(1)}k`} color="#8A6A0F" />
      </div>

      <div className="px-4 grid grid-cols-2 gap-2.5 mt-3">
        <div className="rounded-2xl p-3 bg-white border flex flex-col justify-between" style={{ borderColor: "#EFEFE8" }}>
          <div className="flex items-center gap-1.5"><Sun size={15} color={BRAND.gold} /><span className="text-[10.5px] font-semibold" style={{ color: BRAND.ink }}>Weather Today</span></div>
          <p className="text-sm font-bold agro-display mt-1.5" style={{ color: BRAND.ink }}>{WEATHER_TODAY.temp} · {WEATHER_TODAY.condition}</p>
          <p className="text-[9.5px] mt-0.5" style={{ color: "#9AA39B" }}>{WEATHER_TODAY.note}</p>
        </div>
        <button onClick={() => openScreen("bookProcessing")} className="rounded-2xl p-3 flex flex-col justify-between text-left active:scale-[0.98]" style={{ background: "#FDECEA", border: "1px solid #F6D2CC" }}>
          <div className="flex items-center gap-1.5"><Siren size={15} color="#C0392B" /><span className="text-[10.5px] font-bold" style={{ color: "#C0392B" }}>Need Processing?</span></div>
          <p className="text-[10.5px] font-semibold mt-1.5" style={{ color: "#C0392B" }}>🚜 Find nearest centre</p>
          <p className="text-[9.5px] mt-0.5" style={{ color: "#B0665D" }}>Tap for immediate help</p>
        </button>
      </div>

      <div className="px-4 mt-3">
        <Card className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: BRAND.blueSoft }}><Navigation size={18} color={BRAND.blue} /></div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold" style={{ color: "#9AA39B" }}>NEAREST HUB</p>
            <p className="text-xs font-bold" style={{ color: BRAND.ink }}>📍 {NEAREST_HUB.name} · {NEAREST_HUB.distance} away</p>
            <p className="text-[10px] mt-0.5" style={{ color: BRAND.green }}>{NEAREST_HUB.capacityAvailable ? "Capacity available" : "Fully booked"}</p>
          </div>
          <button onClick={() => openScreen("bookProcessing")} className="text-[10.5px] font-semibold px-3 py-1.5 rounded-full text-white shrink-0" style={{ background: BRAND.green }}>Book Now</button>
        </Card>
      </div>

      <button onClick={() => goToTab("market")} className="w-full text-left mx-0 mt-3 px-4">
        <div className="rounded-2xl p-3.5 flex items-center gap-3 relative overflow-hidden active:scale-[0.98]" style={{ background: BRAND.goldSoft, border: `1px solid #F0DFAE` }}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: BRAND.gold }}><Store size={18} color="#FFFFFF" /></div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5"><p className="text-xs font-bold" style={{ color: "#8A6A0F" }}>Marketplace</p><span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "#C0392B" }}>LIVE</span></div>
            <p className="text-[10.5px] mt-0.5" style={{ color: "#8A6A0F" }}>Sell produce straight to verified buyers</p>
          </div>
          <ChevronRight size={18} color="#8A6A0F" />
        </div>
      </button>

      <SectionTitle>Quick actions</SectionTitle>
      <div className="px-4 grid grid-cols-2 gap-2.5">
        <QuickAction icon={Sprout} label="My Farms" onClick={() => openScreen("farms")} />
        <QuickAction icon={Package} label="My Produce" onClick={() => openScreen("produce")} />
        <QuickAction icon={Warehouse} label="Book Cold Storage" onClick={() => openScreen("bookColdStorage")} />
        <QuickAction icon={WalletIcon} label="Wallet" onClick={() => openScreen("wallet")} />
      </div>

      <SectionTitle>Recent activity</SectionTitle>
      <div className="px-4 flex flex-col gap-2">
        {ctx.data.notifications.slice(0, 3).map((n) => (
          <Card key={n.id}><p className="text-xs" style={{ color: BRAND.ink }}>{n.text}</p><p className="text-[10px] mt-1" style={{ color: "#9AA39B" }}>{new Date(n.createdAt).toLocaleString()}</p></Card>
        ))}
        {ctx.data.notifications.length === 0 && <EmptyState icon={Bell} text="No activity yet." />}
      </div>
    </div>
  );
}
function MiniStat({ label, value, color, emoji }) {
  return (
    <div className="rounded-xl px-2 py-3 flex flex-col items-center bg-white border" style={{ borderColor: "#EFEFE8" }}>
      {emoji && <span className="text-sm leading-none mb-1">{emoji}</span>}
      <span className="text-[13px] font-bold agro-display" style={{ color }}>{value}</span>
      <span className="text-[8.8px] mt-0.5 text-center leading-tight" style={{ color: "#9AA39B" }}>{label}</span>
    </div>
  );
}
function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="rounded-2xl p-3.5 flex flex-col items-start gap-3 bg-white border active:scale-[0.98]" style={{ borderColor: "#EFEFE8" }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: BRAND.greenSoft }}><Icon size={17} color={BRAND.green} /></div>
      <span className="text-xs font-semibold text-left" style={{ color: BRAND.ink }}>{label}</span>
    </button>
  );
}

function ServicesTab({ openScreen }) {
  const items = [
    { icon: Wrench, label: "Processing Booking", desc: "Book a verified processing centre", onClick: () => openScreen("bookProcessing") },
    { icon: Warehouse, label: "Cold Storage Booking", desc: "Reserve temporary storage space", onClick: () => openScreen("bookColdStorage") },
    { icon: Truck, label: "Transport Request", desc: "Request pickup and delivery", onClick: () => openScreen("transport") },
    { icon: WalletIcon, label: "Wallet & Payments", desc: "Balance and transaction history", onClick: () => openScreen("wallet") },
  ];
  return (
    <div className="pb-6">
      <SectionTitle>Services</SectionTitle>
      <div className="px-4 flex flex-col gap-2.5">
        {items.map((it) => (
          <Card key={it.label} onClick={it.onClick} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: BRAND.greenSoft }}><it.icon size={18} color={BRAND.green} /></div>
            <div className="flex-1"><p className="text-xs font-semibold" style={{ color: BRAND.ink }}>{it.label}</p><p className="text-[10.5px]" style={{ color: "#9AA39B" }}>{it.desc}</p></div>
            <ChevronRight size={16} color="#C7CFC8" />
          </Card>
        ))}
      </div>
    </div>
  );
}

function MarketTab({ ctx, openScreen }) {
  const { apiBase, token, data, refreshAll, showToast, buyerFetch } = ctx;
  const [busyId, setBusyId] = useState(null);
  const activeListings = data.listings.filter((l) => l.status === "active");

  const simulateOffer = async (listing) => {
    setBusyId(listing.id);
    try {
      const buyer = await buyerFetch();
      const pct = 0.9 + Math.random() * 0.1;
      const amount = Math.round(Number(listing.price) * pct);
      await apiFetch(apiBase, buyer.accessToken, "/api/marketplace/offers", {
        method: "POST",
        body: JSON.stringify({ listingId: listing.id, amount }),
      });
      showToast(`${buyer.user.fullName} sent an offer`);
      await refreshAll();
    } catch (e) {
      showToast("Couldn't create offer: " + e.message);
    } finally {
      setBusyId(null);
    }
  };

  const respondOffer = async (offer, accept) => {
    setBusyId(offer.id);
    try {
      await apiFetch(apiBase, token, `/api/marketplace/offers/${offer.id}/${accept ? "accept" : "reject"}`, { method: "PATCH" });
      showToast(accept ? "Offer accepted — payment released" : "Offer rejected");
      await refreshAll();
    } catch (e) {
      showToast("Couldn't update offer: " + e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pb-6">
      <SectionTitle right={
        <button onClick={() => openScreen("newListing")} className="text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white" style={{ background: BRAND.green }}><Plus size={13} /> List produce</button>
      }>Marketplace</SectionTitle>

      <div className="px-4 flex flex-col gap-2.5">
        {activeListings.length === 0 && <EmptyState icon={Store} text="No active listings. List your produce to reach verified buyers." />}
        {activeListings.map((l) => {
          const offers = (data.offersByListing[l.id] || []).filter((o) => o.status === "pending");
          const busy = busyId === l.id;
          return (
            <Card key={l.id}>
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-semibold" style={{ color: BRAND.ink }}>{l.crop} · {l.quantity}</p><p className="text-[10.5px]" style={{ color: "#9AA39B" }}>Asking ₦{Number(l.price).toLocaleString()}</p></div>
                <StatusPill status="listed" />
              </div>
              {offers.length === 0 ? (
                <button onClick={() => simulateOffer(l)} disabled={busy} className="mt-2.5 w-full text-[11px] font-semibold rounded-lg py-2 flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: BRAND.blueSoft, color: BRAND.blue }}>
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Simulate buyer interest
                </button>
              ) : offers.map((o) => (
                <div key={o.id} className="mt-2.5 rounded-lg p-2.5" style={{ background: BRAND.goldSoft }}>
                  <p className="text-[11px] font-semibold" style={{ color: "#8A6A0F" }}>Buyer offered ₦{Number(o.amount).toLocaleString()}</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => respondOffer(o, true)} disabled={busyId === o.id} className="flex-1 text-[11px] font-semibold rounded-lg py-1.5 text-white disabled:opacity-50" style={{ background: BRAND.green }}>Accept</button>
                    <button onClick={() => respondOffer(o, false)} disabled={busyId === o.id} className="flex-1 text-[11px] font-semibold rounded-lg py-1.5 border disabled:opacity-50" style={{ borderColor: "#E0C9C9", color: "#B14545" }}>Decline</button>
                  </div>
                </div>
              ))}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AlertsTab({ ctx }) {
  const { apiBase, token, data, refreshAll } = ctx;
  const markAllRead = async () => {
    await apiFetch(apiBase, token, "/api/notifications/read-all", { method: "PATCH" });
    await refreshAll();
  };
  return (
    <div className="pb-6">
      <SectionTitle right={<button onClick={markAllRead} className="text-[10.5px] font-semibold" style={{ color: BRAND.blue }}>Mark all read</button>}>Notifications</SectionTitle>
      <div className="px-4 flex flex-col gap-2">
        {data.notifications.length === 0 && <EmptyState icon={Bell} text="You're all caught up." />}
        {data.notifications.map((n) => (
          <Card key={n.id} className="flex items-start gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: n.read ? "#DADAD2" : BRAND.gold }} />
            <div><p className="text-xs" style={{ color: BRAND.ink }}>{n.text}</p><p className="text-[10px] mt-1" style={{ color: "#9AA39B" }}>{new Date(n.createdAt).toLocaleString()}</p></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProfileTab({ ctx, onAdmin, onDisconnect }) {
  const { user, data, apiBase } = ctx;
  return (
    <div className="pb-6">
      <div className="px-4 pt-4 flex items-center gap-3">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold agro-display" style={{ background: BRAND.green }}>
          {(user?.fullName || "F A").split(" ").map((w) => w[0]).join("")}
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: BRAND.ink }}>{user?.fullName}</p>
          <p className="text-[11px]" style={{ color: "#9AA39B" }}>{user?.userType}</p>
        </div>
      </div>

      <div className="px-4 mt-4">
        <Card className="flex items-center justify-between">
          <div><p className="text-[10.5px]" style={{ color: "#9AA39B" }}>Wallet balance</p><p className="text-lg font-bold agro-display" style={{ color: BRAND.green }}>₦{Number(data.wallet.balance).toLocaleString()}</p></div>
          <ShieldCheck size={22} color={BRAND.gold} />
        </Card>
      </div>

      <SectionTitle>Platform</SectionTitle>
      <div className="px-4 flex flex-col gap-2">
        <Card onClick={onAdmin} className="flex items-center gap-3"><BarChart3 size={17} color={BRAND.blue} /><span className="text-xs font-semibold flex-1" style={{ color: BRAND.ink }}>View Admin Dashboard</span><ChevronRight size={16} color="#C7CFC8" /></Card>
        <Card onClick={onDisconnect} className="flex items-center gap-3"><LogOut size={17} color="#B14545" /><span className="text-xs font-semibold flex-1" style={{ color: "#B14545" }}>Disconnect from backend</span></Card>
      </div>

      <div className="px-4 mt-5 text-center">
        <p className="text-[10px]" style={{ color: "#C7CFC8" }}>Connected to {apiBase}</p>
        <p className="text-[10px] mt-0.5" style={{ color: "#C7CFC8" }}>AgroLight OS · Live API build</p>
      </div>
    </div>
  );
}

function ScreenRouter({ screen, ctx, goBack, openScreen }) {
  const props = { ctx, goBack, openScreen, ...(screen.props || {}) };
  switch (screen.name) {
    case "farms": return <FarmsScreen {...props} />;
    case "produce": return <ProduceScreen {...props} />;
    case "bookProcessing": return <BookProcessingScreen {...props} />;
    case "bookColdStorage": return <BookColdStorageScreen {...props} />;
    case "transport": return <TransportScreen {...props} />;
    case "wallet": return <WalletScreen {...props} />;
    case "newListing": return <NewListingScreen {...props} />;
    case "aiCopilot": return <AICopilotScreen {...props} />;
    default: return null;
  }
}

function FarmsScreen({ ctx, goBack }) {
  const { apiBase, token, data, refreshAll, showToast } = ctx;
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ farmName: "", farmSize: "", cropTypes: "", gpsLocation: "" });

  const addFarm = async () => {
    if (!form.farmName || !form.farmSize) return;
    setSaving(true);
    try {
      await apiFetch(apiBase, token, "/api/farmers/farms", { method: "POST", body: JSON.stringify(form) });
      setForm({ farmName: "", farmSize: "", cropTypes: "", gpsLocation: "" });
      setShowForm(false);
      await refreshAll();
    } catch (e) {
      showToast("Couldn't save farm: " + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="pb-6">
      <TopBar title="My Farms" onBack={goBack} />
      <div className="px-4 flex flex-col gap-2.5">
        {data.farms.map((f) => (
          <Card key={f.id}>
            <p className="text-xs font-semibold" style={{ color: BRAND.ink }}>{f.farmName}</p>
            <p className="text-[10.5px] mt-1" style={{ color: "#9AA39B" }}>{f.farmSize} · {f.cropTypes}</p>
            {f.gpsLocation && <p className="text-[10.5px] flex items-center gap-1 mt-0.5" style={{ color: "#9AA39B" }}><MapPin size={10} />{f.gpsLocation}</p>}
          </Card>
        ))}
        {data.farms.length === 0 && <EmptyState icon={Sprout} text="No farms registered yet." />}
      </div>
      <div className="px-4 mt-3">
        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="w-full rounded-xl py-2.5 text-xs font-semibold border-2 border-dashed flex items-center justify-center gap-1.5" style={{ borderColor: "#D7E4DB", color: BRAND.green }}><Plus size={14} /> Register a new farm</button>
        ) : (
          <Card className="flex flex-col gap-2">
            <Input placeholder="Farm name" value={form.farmName} onChange={(v) => setForm({ ...form, farmName: v })} />
            <Input placeholder="Size (e.g. 3 acres)" value={form.farmSize} onChange={(v) => setForm({ ...form, farmSize: v })} />
            <Input placeholder="Crop types" value={form.cropTypes} onChange={(v) => setForm({ ...form, cropTypes: v })} />
            <Input placeholder="Location" value={form.gpsLocation} onChange={(v) => setForm({ ...form, gpsLocation: v })} />
            <div className="flex gap-2 mt-1">
              <PrimaryButton onClick={addFarm} loading={saving}>Save farm</PrimaryButton>
              <button onClick={() => setShowForm(false)} className="px-4 rounded-xl border text-xs font-semibold" style={{ borderColor: "#EFEFE8", color: "#9AA39B" }}>Cancel</button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function ProduceScreen({ ctx, goBack }) {
  const { apiBase, token, data, refreshAll, showToast } = ctx;
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ farmId: data.farms[0]?.id || "", cropType: CROPS[0], quantity: "" });

  const addProduce = async () => {
    if (!form.quantity || !form.farmId) return;
    setSaving(true);
    try {
      await apiFetch(apiBase, token, "/api/farmers/produce", {
        method: "POST",
        body: JSON.stringify({ ...form, harvestDate: new Date().toISOString().slice(0, 10) }),
      });
      setForm({ farmId: data.farms[0]?.id || "", cropType: CROPS[0], quantity: "" });
      setShowForm(false);
      await refreshAll();
    } catch (e) {
      showToast("Couldn't save produce: " + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="pb-6">
      <TopBar title="My Produce" onBack={goBack} />
      <div className="px-4 flex flex-col gap-2.5">
        {data.produce.map((p) => (
          <Card key={p.id} className="flex items-center justify-between">
            <div><p className="text-xs font-semibold" style={{ color: BRAND.ink }}>{p.cropType} · {p.quantity}</p><p className="text-[10.5px] mt-0.5" style={{ color: "#9AA39B" }}>Harvested {p.harvestDate}</p></div>
            <StatusPill status={p.status} />
          </Card>
        ))}
        {data.produce.length === 0 && <EmptyState icon={Package} text="No produce recorded yet." />}
      </div>
      <div className="px-4 mt-3">
        {data.farms.length === 0 ? (
          <p className="text-[11px] text-center" style={{ color: "#9AA39B" }}>Register a farm first before adding produce.</p>
        ) : !showForm ? (
          <button onClick={() => setShowForm(true)} className="w-full rounded-xl py-2.5 text-xs font-semibold border-2 border-dashed flex items-center justify-center gap-1.5" style={{ borderColor: "#D7E4DB", color: BRAND.green }}><Plus size={14} /> Add produce</button>
        ) : (
          <Card className="flex flex-col gap-2">
            <Select value={form.farmId} onChange={(v) => setForm({ ...form, farmId: v })} options={data.farms.map((f) => ({ value: f.id, label: f.farmName }))} />
            <Select value={form.cropType} onChange={(v) => setForm({ ...form, cropType: v })} options={CROPS.map((c) => ({ value: c, label: c }))} />
            <Input placeholder="Quantity (e.g. 1.5 tons)" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
            <div className="flex gap-2 mt-1">
              <PrimaryButton onClick={addProduce} loading={saving}>Save produce</PrimaryButton>
              <button onClick={() => setShowForm(false)} className="px-4 rounded-xl border text-xs font-semibold" style={{ borderColor: "#EFEFE8", color: "#9AA39B" }}>Cancel</button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function BookProcessingScreen({ ctx, goBack }) {
  const { apiBase, token, data, refreshAll, showToast } = ctx;
  const eligible = data.produce.filter((p) => p.status === "available");
  const [produceId, setProduceId] = useState(eligible[0]?.id || "");
  const [centre, setCentre] = useState(null);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    if (!produceId || !centre) return;
    setSaving(true);
    try {
      await apiFetch(apiBase, token, "/api/processing/bookings", {
        method: "POST",
        body: JSON.stringify({ produceId, processingCentreId: centre.id }),
      });
      showToast("Processing booked");
      await refreshAll();
      goBack();
    } catch (e) {
      showToast("Couldn't book processing: " + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="pb-6">
      <TopBar title="Book Processing" onBack={goBack} />
      {eligible.length === 0 ? <div className="px-4"><EmptyState icon={Wrench} text="No available produce to book. Add produce first." /></div> : (
        <>
          <div className="px-4"><Label>Select produce</Label><Select value={produceId} onChange={setProduceId} options={eligible.map((p) => ({ value: p.id, label: `${p.cropType} · ${p.quantity}` }))} /></div>
          <SectionTitle>Verified processors nearby</SectionTitle>
          <div className="px-4 flex flex-col gap-2">
            {data.processingCentres.length === 0 && <EmptyState icon={Wrench} text="No processing centres registered on this backend yet." />}
            {data.processingCentres.map((p) => (
              <Card key={p.id} onClick={() => setCentre(p)} className={centre?.id === p.id ? "ring-2" : ""}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: BRAND.ink }}>{p.businessName}</p>
                    <p className="text-[10.5px] flex items-center gap-2 mt-0.5" style={{ color: "#9AA39B" }}>
                      <span className="flex items-center gap-0.5"><Star size={10} fill={BRAND.gold} color={BRAND.gold} />{p.rating}</span>
                      <span>{fakeDistance(p.id)}</span>
                    </p>
                  </div>
                  <p className="text-xs font-bold" style={{ color: BRAND.green }}>₦{Number(p.pricePerTon).toLocaleString()}/t</p>
                </div>
              </Card>
            ))}
          </div>
          <div className="px-4 mt-4"><PrimaryButton onClick={confirm} disabled={!centre} loading={saving} icon={Check}>Confirm booking</PrimaryButton></div>
        </>
      )}
    </div>
  );
}

function BookColdStorageScreen({ ctx, goBack }) {
  const { apiBase, token, data, refreshAll, showToast } = ctx;
  const eligible = data.produce.filter((p) => p.status === "available" || p.status === "processed");
  const [produceId, setProduceId] = useState(eligible[0]?.id || "");
  const [facility, setFacility] = useState(null);
  const [days, setDays] = useState("7");
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    if (!produceId || !facility) return;
    setSaving(true);
    try {
      await apiFetch(apiBase, token, "/api/cold-storage/bookings", {
        method: "POST",
        body: JSON.stringify({ produceId, facilityId: facility.id, durationDays: Number(days) || 1 }),
      });
      showToast("Cold storage reserved");
      await refreshAll();
      goBack();
    } catch (e) {
      showToast("Couldn't reserve storage: " + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="pb-6">
      <TopBar title="Book Cold Storage" onBack={goBack} />
      {eligible.length === 0 ? <div className="px-4"><EmptyState icon={Warehouse} text="No eligible produce for storage right now." /></div> : (
        <>
          <div className="px-4 flex flex-col gap-2.5">
            <div><Label>Select produce</Label><Select value={produceId} onChange={setProduceId} options={eligible.map((p) => ({ value: p.id, label: `${p.cropType} · ${p.quantity}` }))} /></div>
            <div><Label>Storage duration (days)</Label><Input value={days} onChange={setDays} placeholder="7" /></div>
          </div>
          <SectionTitle>Nearby cold rooms</SectionTitle>
          <div className="px-4 flex flex-col gap-2">
            {data.coldFacilities.length === 0 && <EmptyState icon={Warehouse} text="No cold storage facilities registered on this backend yet." />}
            {data.coldFacilities.map((c) => (
              <Card key={c.id} onClick={() => setFacility(c)} className={facility?.id === c.id ? "ring-2" : ""}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: BRAND.ink }}>{c.facilityName}</p>
                    <p className="text-[10.5px] flex items-center gap-2 mt-0.5" style={{ color: "#9AA39B" }}>
                      <span className="flex items-center gap-0.5"><Star size={10} fill={BRAND.gold} color={BRAND.gold} />{c.rating}</span>
                      <span>{fakeDistance(c.id)}</span>
                    </p>
                  </div>
                  <p className="text-xs font-bold" style={{ color: BRAND.green }}>₦{c.pricePerDay}/day</p>
                </div>
              </Card>
            ))}
          </div>
          <div className="px-4 mt-4"><PrimaryButton onClick={confirm} disabled={!facility} loading={saving} icon={Check}>Reserve storage</PrimaryButton></div>
        </>
      )}
    </div>
  );
}

function TransportScreen({ ctx, goBack }) {
  const { apiBase, token, showToast } = ctx;
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  const send = async () => {
    setSaving(true);
    try {
      await apiFetch(apiBase, token, "/api/logistics/deliveries", {
        method: "POST",
        body: JSON.stringify({ pickupLocation: pickup, dropoffLocation: dropoff }),
      });
      setSent(true);
      showToast("Transport requested");
    } catch (e) {
      showToast("Couldn't request transport: " + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="pb-6">
      <TopBar title="Transport Request" onBack={goBack} />
      {sent ? <div className="px-4"><EmptyState icon={Truck} text="Request sent. A verified transporter will accept shortly." /></div> : (
        <div className="px-4 flex flex-col gap-2.5">
          <div><Label>Pickup location</Label><Input value={pickup} onChange={setPickup} placeholder="e.g. Amos Family Farm" /></div>
          <div><Label>Drop-off location</Label><Input value={dropoff} onChange={setDropoff} placeholder="e.g. Ovie Cassava Processors" /></div>
          <div className="mt-2"><PrimaryButton icon={Truck} disabled={!pickup || !dropoff} loading={saving} onClick={send}>Find transport</PrimaryButton></div>
        </div>
      )}
    </div>
  );
}

function WalletScreen({ ctx, goBack }) {
  const { data } = ctx;
  return (
    <div className="pb-6">
      <TopBar title="Wallet" onBack={goBack} />
      <div className="px-4"><Card className="text-center py-5"><p className="text-[10.5px]" style={{ color: "#9AA39B" }}>Current balance</p><p className="text-2xl font-bold agro-display mt-1" style={{ color: BRAND.green }}>₦{Number(data.wallet.balance).toLocaleString()}</p></Card></div>
      <SectionTitle>Transaction history</SectionTitle>
      <div className="px-4 flex flex-col gap-2">
        {data.walletHistory.length === 0 && <EmptyState icon={WalletIcon} text="No transactions yet." />}
        {data.walletHistory.map((tx) => (
          <Card key={tx.id} className="flex items-center justify-between">
            <div><p className="text-xs font-semibold" style={{ color: BRAND.ink }}>{tx.description}</p><p className="text-[10px] mt-0.5" style={{ color: "#9AA39B" }}>{new Date(tx.createdAt).toLocaleDateString()}</p></div>
            <p className="text-xs font-bold" style={{ color: Number(tx.amount) >= 0 ? BRAND.green : "#B14545" }}>{Number(tx.amount) >= 0 ? "+" : ""}₦{Number(tx.amount).toLocaleString()}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewListingScreen({ ctx, goBack }) {
  const { apiBase, token, data, refreshAll, showToast } = ctx;
  const eligible = data.produce.filter((p) => ["available", "processed", "in_storage"].includes(p.status));
  const [produceId, setProduceId] = useState(eligible[0]?.id || "");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!produceId || !price) return;
    setSaving(true);
    try {
      await apiFetch(apiBase, token, "/api/marketplace/listings", {
        method: "POST",
        body: JSON.stringify({ produceId, price: Number(price) }),
      });
      showToast("Listed on marketplace");
      await refreshAll();
      goBack();
    } catch (e) {
      showToast("Couldn't create listing: " + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="pb-6">
      <TopBar title="List Produce" onBack={goBack} />
      {eligible.length === 0 ? <div className="px-4"><EmptyState icon={Store} text="No produce available to list right now." /></div> : (
        <div className="px-4 flex flex-col gap-2.5">
          <div><Label>Select produce</Label><Select value={produceId} onChange={setProduceId} options={eligible.map((p) => ({ value: p.id, label: `${p.cropType} · ${p.quantity} (${p.status})` }))} /></div>
          <div><Label>Asking price (₦)</Label><Input value={price} onChange={setPrice} placeholder="e.g. 180000" /></div>
          <div className="mt-2"><PrimaryButton onClick={create} disabled={!produceId || !price} loading={saving} icon={Store}>Publish listing</PrimaryButton></div>
        </div>
      )}
    </div>
  );
}

/* ---------------- AI Copilot ---------------- */
const AI_SUGGESTED_PROMPTS = [
  "Find processing",
  "Find storage",
  "Find buyers",
  "What should I do with my harvest?",
];

function AICopilotScreen({ ctx, goBack }) {
  const { apiBase, token, refreshAll, showToast } = ctx;
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi! Tell me what you need after harvest — e.g. \"I harvested 2 tonnes of cassava, find me processing and storage for 5 days.\"", data: null },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setMessages((m) => [...m, { role: "user", text: msg, data: null }]);
    setInput("");
    setSending(true);
    try {
      const result = await apiFetch(apiBase, token, "/api/ai/copilot", {
        method: "POST",
        body: JSON.stringify({ message: msg }),
      });
      setMessages((m) => [...m, { role: "ai", text: result.reason, data: result }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: "Sorry, I couldn't reach the AI Copilot: " + e.message, data: null }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pb-3 flex flex-col h-full">
      <TopBar title="AgroLight AI" onBack={goBack} />
      <p className="text-[10.5px] text-center -mt-1.5 mb-2" style={{ color: "#9AA39B" }}>Your intelligent farming assistant</p>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 flex flex-col gap-3" style={{ maxHeight: 480 }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%] flex flex-col gap-2">
              <div
                className="rounded-2xl px-3 py-2.5 text-xs"
                style={m.role === "user"
                  ? { background: BRAND.green, color: "#fff", borderBottomRightRadius: 4 }
                  : { background: "#fff", color: BRAND.ink, border: "1px solid #EFEFE8", borderBottomLeftRadius: 4 }}
              >
                {m.text}
              </div>
              {m.data && (m.data.recommended_processor || m.data.recommended_storage || m.data.buyers) && (
                <AIRecommendation data={m.data} apiBase={apiBase} token={token} refreshAll={refreshAll} showToast={showToast} />
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3 py-2.5 text-xs flex items-center gap-1.5" style={{ background: "#fff", border: "1px solid #EFEFE8", color: "#9AA39B" }}>
              <Loader2 size={12} className="animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-2 flex flex-wrap gap-1.5">
        {AI_SUGGESTED_PROMPTS.map((p) => (
          <button key={p} onClick={() => send(p)} className="text-[10.5px] font-medium px-2.5 py-1.5 rounded-full" style={{ background: BRAND.blueSoft, color: BRAND.blue }}>{p}</button>
        ))}
      </div>

      <div className="px-4 pt-2.5 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Ask AgroLight AI…"
          className="flex-1 rounded-full px-3.5 py-2.5 text-xs border outline-none"
          style={{ borderColor: "#EFEFE8", color: BRAND.ink }}
        />
        <button onClick={() => send()} disabled={sending || !input.trim()} className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40" style={{ background: BRAND.green }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

function AIRecommendation({ data, apiBase, token, refreshAll, showToast }) {
  const [showAlts, setShowAlts] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {data.recommended_processor && (
        <RecCard
          kind="processing"
          icon={Wrench}
          title={data.recommended_processor.name}
          subtitle={`₦${data.recommended_processor.price_per_ton.toLocaleString()}/ton · estimated ₦${data.recommended_processor.estimated_cost.toLocaleString()}`}
          why={[
            `${data.recommended_processor.distance_km} km away`,
            `${data.recommended_processor.rating}★ rating`,
            `₦${data.recommended_processor.price_per_ton.toLocaleString()}/ton`,
            data.quantity_tons ? `Suitable for ${data.quantity_tons} ton(s)` : null,
          ].filter(Boolean)}
          confirmLabel={`Book ${data.recommended_processor.name} for ${data.quantity_tons ?? "your"} tonne(s) at ₦${data.recommended_processor.estimated_cost.toLocaleString()}?`}
          buttonLabel="Book Processing"
          disabled={!data.matched_produce_id}
          disabledNote={!data.matched_produce_id ? "Add this produce under My Produce first, then ask again." : null}
          onConfirm={async () => {
            await apiFetch(apiBase, token, "/api/processing/bookings", {
              method: "POST",
              body: JSON.stringify({ produceId: data.matched_produce_id, processingCentreId: data.recommended_processor.id }),
            });
            showToast("Processing booked");
            await refreshAll();
          }}
        />
      )}

      {data.recommended_storage && (
        <RecCard
          kind="storage"
          icon={Warehouse}
          title={data.recommended_storage.name}
          subtitle={`₦${data.recommended_storage.price_per_day.toLocaleString()}/day · estimated ₦${data.recommended_storage.estimated_cost.toLocaleString()}`}
          why={[
            `${data.recommended_storage.distance_km} km away`,
            `${data.recommended_storage.rating}★ rating`,
            `₦${data.recommended_storage.price_per_day.toLocaleString()}/day`,
            `${data.recommended_storage.days} day(s) requested`,
          ]}
          confirmLabel={`Reserve ${data.recommended_storage.name} for ${data.recommended_storage.days} day(s) at ₦${data.recommended_storage.estimated_cost.toLocaleString()}?`}
          buttonLabel="Reserve Storage"
          disabled={!data.matched_produce_id}
          disabledNote={!data.matched_produce_id ? "Add this produce under My Produce first, then ask again." : null}
          onConfirm={async () => {
            await apiFetch(apiBase, token, "/api/cold-storage/bookings", {
              method: "POST",
              body: JSON.stringify({ produceId: data.matched_produce_id, facilityId: data.recommended_storage.id, durationDays: data.recommended_storage.days }),
            });
            showToast("Storage reserved");
            await refreshAll();
          }}
        />
      )}

      {data.buyers && (
        <div className="rounded-xl border p-3" style={{ borderColor: "#EFEFE8", background: "#fff" }}>
          <p className="text-[10.5px] font-semibold mb-1.5" style={{ color: BRAND.ink }}>Marketplace activity</p>
          {data.buyers.length === 0 ? (
            <p className="text-[10.5px]" style={{ color: "#9AA39B" }}>No active listings found for this crop yet.</p>
          ) : data.buyers.map((b) => (
            <p key={b.listingId} className="text-[10.5px]" style={{ color: "#9AA39B" }}>{b.crop} · {b.quantity} · ₦{b.price.toLocaleString()}</p>
          ))}
        </div>
      )}

      {(data.alternative_processors?.length > 0 || data.alternative_storage?.length > 0) && (
        <div>
          <button onClick={() => setShowAlts((v) => !v)} className="text-[10.5px] font-semibold flex items-center gap-1" style={{ color: BRAND.blue }}>
            View Alternatives {showAlts ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showAlts && (
            <div className="mt-1.5 flex flex-col gap-1.5">
              {(data.alternative_processors || []).map((c) => (
                <div key={c.id} className="rounded-lg px-2.5 py-2 text-[10.5px]" style={{ background: BRAND.paper }}>
                  {c.name} · {c.distance_km} km · {c.rating}★ · ₦{c.price_per_ton.toLocaleString()}/ton
                </div>
              ))}
              {(data.alternative_storage || []).map((f) => (
                <div key={f.id} className="rounded-lg px-2.5 py-2 text-[10.5px]" style={{ background: BRAND.paper }}>
                  {f.name} · {f.distance_km} km · {f.rating}★ · ₦{f.price_per_day.toLocaleString()}/day
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecCard({ icon: Icon, title, subtitle, why, confirmLabel, buttonLabel, disabled, disabledNote, onConfirm }) {
  const [showWhy, setShowWhy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setDone(true);
      setConfirming(false);
    } catch (e) {
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "#EFEFE8", background: "#fff" }}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: BRAND.blueSoft }}><Icon size={15} color={BRAND.blue} /></div>
        <div className="flex-1">
          <p className="text-xs font-semibold" style={{ color: BRAND.ink }}>{title}</p>
          <p className="text-[10.5px]" style={{ color: "#9AA39B" }}>{subtitle}</p>
        </div>
      </div>

      <button onClick={() => setShowWhy((v) => !v)} className="text-[10px] font-semibold mt-2 flex items-center gap-1" style={{ color: BRAND.blue }}>
        Why AgroLight recommends this {showWhy ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {showWhy && (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {why.map((w, i) => <li key={i} className="text-[10px]" style={{ color: "#9AA39B" }}>• {w}</li>)}
        </ul>
      )}

      {done ? (
        <p className="text-[10.5px] font-semibold mt-2.5 flex items-center gap-1" style={{ color: BRAND.green }}><Check size={12} /> Done</p>
      ) : disabled ? (
        <p className="text-[10px] mt-2.5" style={{ color: "#B0665D" }}>{disabledNote}</p>
      ) : confirming ? (
        <div className="mt-2.5">
          <p className="text-[10.5px] mb-1.5" style={{ color: BRAND.ink }}>{confirmLabel}</p>
          <div className="flex gap-2">
            <button onClick={confirm} disabled={busy} className="flex-1 text-[11px] font-semibold rounded-lg py-1.5 text-white disabled:opacity-50" style={{ background: BRAND.green }}>
              {busy ? "Booking…" : "Confirm"}
            </button>
            <button onClick={() => setConfirming(false)} className="px-3 rounded-lg border text-[11px] font-semibold" style={{ borderColor: "#EFEFE8", color: "#9AA39B" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="w-full mt-2.5 text-[11px] font-semibold rounded-lg py-2 text-white" style={{ background: BRAND.green }}>{buttonLabel}</button>
      )}
    </div>
  );
}

function AdminDashboard({ adminData, onExit }) {
  if (!adminData) return <div className="pb-6"><TopBar title="Admin Dashboard" onBack={onExit} /><div className="px-4"><EmptyState icon={Loader2} text="Loading admin data…" /></div></div>;

  const targets = [
    { label: "Registered users (live)", value: adminData.users.length, target: 1000 },
    { label: "Pending verifications (live)", value: adminData.pending.length, target: 10 },
  ];

  return (
    <div className="pb-6">
      <TopBar title="Admin Dashboard" onBack={onExit} />
      <SectionTitle right={<span className="text-[10px]" style={{ color: "#9AA39B" }}>Live from backend</span>}>Platform metrics</SectionTitle>
      <div className="px-4 flex flex-col gap-2.5">
        {targets.map((t) => {
          const pct = Math.min(100, Math.round((t.value / t.target) * 100));
          return (
            <Card key={t.label}>
              <div className="flex items-center justify-between mb-1.5"><p className="text-[11px] font-semibold" style={{ color: BRAND.ink }}>{t.label}</p><p className="text-[10.5px]" style={{ color: "#9AA39B" }}>{t.value} / {t.target}</p></div>
              <div className="w-full h-1.5 rounded-full" style={{ background: "#EFEFE8" }}><div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: BRAND.green }} /></div>
            </Card>
          );
        })}
      </div>

      <SectionTitle>Registered users</SectionTitle>
      <div className="px-4 flex flex-col gap-2">
        {adminData.users.slice(0, 6).map((u) => (
          <Card key={u.id} className="flex items-center gap-3">
            <ClipboardCheck size={16} color={BRAND.blue} />
            <div className="flex-1"><p className="text-xs font-semibold" style={{ color: BRAND.ink }}>{u.fullName}</p><p className="text-[10px]" style={{ color: "#9AA39B" }}>{u.userType} · {u.phone}</p></div>
            <StatusPill status={u.accountStatus === "active" ? "available" : "sold"} />
          </Card>
        ))}
        {adminData.users.length === 0 && <EmptyState icon={Users} text="No users registered on this backend yet." />}
      </div>
    </div>
  );
}
