import { useState, useEffect, useRef } from "react";

// ─── DATA ────────────────────────────────────────────────────────────────────

// ✨ Avatar stages with stage-specific gradients (purple → green journey)
const AVATAR_STAGES = [
  {
    stage: "Seed", days: "Day 1–7",
    color: "#A78BFA", glow: "rgba(167,139,250,0.35)",
    desc: "Quiet beginning. Roots forming.",
    // Mostly purple — pure potential
    gradTop: "#C4B5FD", gradMid: "#8B5CF6", gradBot: "#7C3AED"
  },
  {
    stage: "Sprout", days: "Day 8–29",
    color: "#34D399", glow: "rgba(52,211,153,0.35)",
    desc: "Pushing through. Slowly.",
    // Purple top, green emerging at bottom
    gradTop: "#C4B5FD", gradMid: "#8B5CF6", gradBot: "#34D399"
  },
  {
    stage: "Standing", days: "Day 30–89",
    color: "#10B981", glow: "rgba(16,185,129,0.4)",
    desc: "Rooted now. Unmoved by storms.",
    // Equal purple-green
    gradTop: "#A78BFA", gradMid: "#34D399", gradBot: "#10B981"
  },
  {
    stage: "Still", days: "Day 90+",
    color: "#059669", glow: "rgba(5,150,105,0.45)",
    desc: "Present. Powerful. Rooted.",
    // Mostly green — fully rooted
    gradTop: "#A78BFA", gradMid: "#10B981", gradBot: "#047857"
  },
];

const FOCUS_PRESETS = [
  { id: "light", label: "Light", minutes: 25, xp: 15, emoji: "🍃", desc: "One pomodoro — build the rhythm" },
  { id: "medium", label: "Medium", minutes: 50, xp: 35, emoji: "🌿", desc: "The classic — real work happens here" },
  { id: "hard", label: "Hard", minutes: 90, xp: 70, emoji: "🌳", desc: "Deeper than usual. Push through." },
  { id: "deep", label: "Deep", minutes: 120, xp: 100, emoji: "🌲", desc: "2 hours. No interruptions. Full presence." },
];

const FOCUS_INTENTIONS = ["Study / Learn", "Deep work project", "Reading", "Writing / Journal", "Creative work", "Other"];

const BLOCKED_APPS = [
  { icon: "📷", name: "Instagram", blocked: true },
  { icon: "🎵", name: "TikTok", blocked: true },
  { icon: "▶️", name: "YouTube", blocked: true },
  { icon: "𝕏", name: "X / Twitter", blocked: true },
  { icon: "💬", name: "Snapchat", blocked: false },
  { icon: "🎮", name: "Games", blocked: true },
];

const HABIT_TEMPLATES = [
  { icon: "🏃", title: "Move my body", xp: 25, proof: true, category: "Body" },
  { icon: "💧", title: "Drink 3L water", xp: 10, proof: false, category: "Body" },
  { icon: "📚", title: "Read 30 pages", xp: 15, proof: false, category: "Mind" },
  { icon: "🌅", title: "Wake gently before 7", xp: 15, proof: true, category: "Discipline" },
  { icon: "🧘", title: "10 min meditation", xp: 10, proof: false, category: "Mind" },
  { icon: "📓", title: "Journal entry", xp: 10, proof: false, category: "Mind" },
  { icon: "🚫", title: "No social media day", xp: 30, proof: false, category: "Discipline" },
  { icon: "🌙", title: "Sleep before 11", xp: 15, proof: false, category: "Body" },
];

const HABIT_ICONS = ["🌱","🌿","🍃","🌸","🌊","☀️","🌙","💧","📚","🧘","🏃","🍎","💪","✨","🎯","📝","🎨","💻","☕","❤️","🎵","🌅","⏰","🔔","🥗","🌿","🌳","💎","🏆","✅"];

const HABIT_CATEGORIES = ["Body", "Mind", "Discipline", "Work", "Other"];

// ✨ Better milestone phrases — softer, more emotional
const MILESTONES = [
  { day: 7, title: "First Week", desc: "You stayed. That's everything.", color: "#34D399" },
  { day: 21, title: "Three Weeks", desc: "It's becoming part of you.", color: "#10B981" },
  { day: 30, title: "One Month", desc: "One month in. You're not the same.", color: "#059669" },
  { day: 60, title: "Two Months", desc: "Not a habit anymore. It's identity.", color: "#047857" },
  { day: 90, title: "Three Months", desc: "Three months. You're rooted now.", color: "#A78BFA" },
];

const TALK_MODES = {
  listen: { id: "listen", name: "Listen", emoji: "🌙", tagline: "I just need to be heard.", color: "#6366F1", bg: "#08071A", accent: "#A78BFA", placeholder: "What's weighing on you...", greeting: "I'm here. No advice unless you ask. What's on your mind?", system: `You are STILL's listener — deeply empathetic, calm, unhurried. The user just needs to be heard. NEVER give advice unless asked. Listen first. Reflect feelings back gently. Ask one soft question at a time. 2-4 sentences. Make them feel profoundly understood.` },
  encourage: { id: "encourage", name: "Encourage", emoji: "☀️", tagline: "I need a gentle push.", color: "#F59E0B", bg: "#1A1000", accent: "#FBBF24", placeholder: "What's holding you back...", greeting: "You came here for a reason. Tell me — what do you need to hear right now?", system: `You are STILL's gentle encourager — warm, steady, kind but firm. The user needs energy without aggression. Believe in them out loud. Speak to the version of them that hasn't given up. 2-4 sentences. Encouraging but never preachy.` },
  reflect: { id: "reflect", name: "Reflect", emoji: "🍃", tagline: "Help me think clearly.", color: "#10B981", bg: "#021510", accent: "#34D399", placeholder: "What's confusing you...", greeting: "Let's slow this down together. What's been clouding your mind?", system: `You are STILL's reflective guide — wise, calm, structured. Help them think out loud. Ask thoughtful questions. Help them find their own answer. NEVER tell them what to do. 2-4 sentences. Calm and grounding throughout.` },
};

const SOCIETY_POSTS = [
  { id: 1, avatar: "🌑", name: "ShadowRunner", time: "2m ago", text: "Nobody saw me study for 4 hours today. But I did. That's enough.", likes: 47, type: "win" },
  { id: 2, avatar: "🌿", name: "QuietStorm", time: "15m ago", text: "Hard day. Everything felt heavy. But I opened this app and that felt like something.", likes: 89, type: "hard" },
  { id: 3, avatar: "🌱", name: "RisingAsh", time: "1h ago", text: "Day 23. I almost quit on day 3. Day 3 me would not believe this.", likes: 134, type: "win" },
  { id: 4, avatar: "🌙", name: "MidnightBuilder", time: "2h ago", text: "Cried in the car today. Then went in and did my job anyway. Nobody knew.", likes: 201, type: "win" },
];

const AFFIRMATIONS = [
  "I am still here. I am still here.",
  "My quiet is not weakness — it's depth.",
  "I've survived 100% of my hard days.",
  "Slow growth is still growth.",
  "I don't need applause to keep going.",
  "Roots grow in silence.",
  "I am becoming who I needed.",
];

const FOCUS_QUOTES = [
  "Slow down to go deep.",
  "Every minute of presence matters.",
  "They scroll while you stay.",
  "Discipline is a form of self-love.",
  "Roots grow in silence.",
];

// ─── STYLES ──────────────────────────────────────────────────────────────────

const G = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#070710;font-family:'Sora',sans-serif;}
.app{min-height:100vh;background:#070710;color:#fff;position:relative;overflow:hidden;}
.scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;}
.scroll::-webkit-scrollbar{width:2px;}
.scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);}
.nav{display:flex;background:rgba(7,7,16,0.97);border-top:1px solid rgba(255,255,255,0.06);position:fixed;bottom:0;left:0;right:0;z-index:200;backdrop-filter:blur(24px);}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 0 14px;background:none;border:none;cursor:pointer;transition:all 0.2s;position:relative;}
.nav-label{font-size:9px;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.35);font-weight:500;}
.nav-btn.active .nav-label{color:#A78BFA;}
.nav-icon{font-size:19px;opacity:0.4;transition:all 0.2s;}
.nav-btn.active .nav-icon{opacity:1;}
.nav-btn.active::after{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:24px;height:2px;background:#A78BFA;border-radius:0 0 4px 4px;}
.card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.04);opacity:0.95}}
@keyframes ringPulse{0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,0.4)}50%{box-shadow:0 0 0 20px rgba(139,92,246,0)}}
@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes leafSway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes glow{0%,100%{filter:drop-shadow(0 0 18px rgba(167,139,250,0.5))}50%{filter:drop-shadow(0 0 28px rgba(167,139,250,0.8))}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.fade-up{animation:fadeUp 0.4s ease forwards;}
.dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.3);display:inline-block;animation:bounce 1.2s infinite;}
.xp-track{height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;}
.xp-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#6C63FF,#A78BFA);transition:width 1.2s cubic-bezier(.4,0,.2,1);}
.mode-card{border-radius:20px;padding:18px 20px;cursor:pointer;transition:all 0.25s;border:1px solid transparent;display:flex;align-items:center;justify-content:space-between;gap:14px;}
.mode-card:hover{transform:translateX(4px);}
.like-btn{background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:5px;color:rgba(255,255,255,0.3);font-size:12px;font-family:'Sora',sans-serif;transition:all 0.2s;padding:5px 10px;border-radius:20px;}
.like-btn:hover{color:#F43F5E;background:rgba(244,63,94,0.08);}
.like-btn.liked{color:#F43F5E;}
.preset-card{padding:14px 16px;border-radius:16px;border:1px solid;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:12px;}
.preset-card:hover{transform:translateY(-2px);}
.modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:300;display:flex;align-items:flex-end;justify-content:center;}
.modal{background:#0f0f1a;border-top:1px solid rgba(255,255,255,0.1);border-radius:24px 24px 0 0;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;animation:slideUp 0.3s ease;padding:24px 20px 40px;}
.icon-pick{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;transition:all 0.15s;border:1px solid;}
.fab{position:absolute;bottom:24px;right:20px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#6C63FF,#A78BFA);color:#fff;border:none;font-size:24px;cursor:pointer;box-shadow:0 10px 30px rgba(139,92,246,0.4);z-index:100;transition:all 0.2s;display:flex;align-items:center;justify-content:center;}
.fab:active{transform:scale(0.94);}
.tab-pill{padding:7px 14px;border-radius:50px;border:1px solid;font-size:12px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:600;transition:all 0.2s;white-space:nowrap;}
textarea{caret-color:#A78BFA;font-family:'Sora',sans-serif;}
textarea::placeholder,input::placeholder{color:rgba(255,255,255,0.25);}
textarea:focus,input:focus,button:focus{outline:none;}
input{font-family:'Sora',sans-serif;}
`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function Glow({ color, style }) {
  return <div style={{ position:"absolute", borderRadius:"50%", filter:"blur(80px)", pointerEvents:"none", background:`radial-gradient(circle, ${color}, transparent)`, ...style }} />;
}

function XPBar({ pct, color = "linear-gradient(90deg,#6C63FF,#A78BFA)" }) {
  return <div className="xp-track"><div className="xp-fill" style={{ width:`${pct}%`, background:color }} /></div>;
}

// ✨ NEW: Liquid Drop Avatar — purple→green gradient that evolves with stage
function LiquidDropAvatar({ stage, size = 130 }) {
  const s = AVATAR_STAGES[stage];
  const id = `liquidDrop${stage}`;

  return (
    <div style={{
      width: size, height: size, position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      {/* Outer glow rings */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: `radial-gradient(circle at 50% 50%, ${s.color}25, ${s.color}08, transparent 70%)`,
      }} />
      <div style={{
        position: "absolute", inset: "12%", borderRadius: "50%",
        border: `1px solid ${s.color}30`, background: `${s.color}08`
      }} />
      <div style={{
        position: "absolute", inset: "22%", borderRadius: "50%",
        background: `radial-gradient(circle at 40% 40%, ${s.color}15, transparent 70%)`,
        animation: "pulse 4s ease-in-out infinite"
      }} />

      {/* The liquid drop */}
      <svg width={size * 0.55} height={size * 0.65} viewBox="0 0 60 70"
        style={{ animation: "float 4s ease-in-out infinite", filter: `drop-shadow(0 0 16px ${s.glow})` }}>
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={s.gradTop} />
            <stop offset="50%" stopColor={s.gradMid} />
            <stop offset="100%" stopColor={s.gradBot} />
          </linearGradient>
        </defs>
        {/* Drop shape */}
        <path
          d="M30 5 C 8 28, 8 52, 30 65 C 52 52, 52 28, 30 5 Z"
          fill={`url(#${id})`}
        />
        {/* Highlight */}
        <ellipse cx="22" cy="22" rx="5" ry="8" fill="#FFFFFF" opacity="0.4" />
        <ellipse cx="20" cy="18" rx="2" ry="3" fill="#FFFFFF" opacity="0.85" />
      </svg>
    </div>
  );
}

// ✨ NEW: Daily affirmation — uses date as seed so it changes once per 24h
function getDailyAffirmation() {
  const today = new Date();
  // Use day-of-year as deterministic seed
  const start = new Date(today.getFullYear(), 0, 0);
  const diff = today.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return AFFIRMATIONS[dayOfYear % AFFIRMATIONS.length];
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────

function HomeScreen({ streak, xp, totalFocusMin, habits, setTab }) {
  const stage = streak < 8 ? 0 : streak < 30 ? 1 : streak < 90 ? 2 : 3;
  const s = AVATAR_STAGES[stage];
  const level = Math.floor(xp/200) + 1;
  const activeHabits = habits.filter(h => !h.done);

  // Daily affirmation — locked for 24 hours
  const dailyAffirmation = getDailyAffirmation();

  // Journey logic
  const nextMilestone = MILESTONES.find(m => m.day > streak) || MILESTONES[MILESTONES.length-1];
  const previousMilestone = [...MILESTONES].reverse().find(m => m.day <= streak);
  const daysToNext = Math.max(0, nextMilestone.day - streak);
  const startDay = previousMilestone?.day || 0;
  const segmentProgress = nextMilestone.day === startDay ? 100 : Math.min(((streak - startDay) / (nextMilestone.day - startDay)) * 100, 100);

  // ✨ FIXED: Calculate line fill across entire path (not just current segment)
  // Find current position as % of total path
  const totalDays = MILESTONES[MILESTONES.length - 1].day;
  const completedSegmentsBeforeCurrent = MILESTONES.findIndex(m => m.day > streak);
  const segmentIndex = completedSegmentsBeforeCurrent === -1 ? MILESTONES.length - 1 : completedSegmentsBeforeCurrent;
  // Each segment represents an equal visual portion of the path
  const segmentWidth = 100 / MILESTONES.length;
  // Fill = full segments completed + partial fill of current segment
  const visualLineFill = (segmentIndex * segmentWidth) + ((segmentProgress / 100) * segmentWidth);

  return (
    <div className="scroll" style={{ height:"100%", overflowY:"auto", padding:"0 18px 100px" }}>
      <Glow color={s.color} style={{ top:-80, left:"30%", width:400, height:400, opacity:0.12 }} />
      <Glow color="#6C63FF" style={{ bottom:"20%", right:-80, width:300, height:300, opacity:0.06 }} />

      {/* Top bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:52, paddingBottom:8 }}>
        <div>
          <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:4 }}>Day {streak}</div>
          <div style={{ fontSize:28, fontWeight:800, letterSpacing:"-0.05em" }}>STILL</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:50, border:"1px solid rgba(52,211,153,0.3)", background:"rgba(52,211,153,0.08)" }}>
            <span style={{ fontSize:13 }}>🌱</span>
            <span style={{ fontSize:13, fontWeight:700, color:"#34D399" }}>{streak}</span>
          </div>
          <div style={{ padding:"7px 14px", borderRadius:50, border:"1px solid rgba(139,92,246,0.3)", background:"rgba(139,92,246,0.08)" }}>
            <span style={{ fontSize:11, color:"#A78BFA", fontWeight:700 }}>Lv {level}</span>
          </div>
        </div>
      </div>

      <div style={{ color:"rgba(255,255,255,0.3)", fontSize:12, fontStyle:"italic", marginBottom:20 }}>
        For the ones who keep going.
      </div>

      {/* ✨ NEW: Liquid Drop Avatar */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"12px 0 24px" }}>
        <LiquidDropAvatar stage={stage} size={140} />
        <div style={{ marginTop:16, textAlign:"center" }}>
          <div style={{ fontWeight:700, fontSize:17, color:s.color, letterSpacing:"-0.01em" }}>{s.stage}</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, fontStyle:"italic", marginTop:4 }}>{s.desc}</div>
        </div>
        <div style={{ width:"100%", maxWidth:260, marginTop:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)" }}>Roots growing</span>
            <span style={{ fontSize:10, color:"#A78BFA", fontWeight:600 }}>{xp.toLocaleString()}</span>
          </div>
          <XPBar pct={(xp%200)/200*100} />
        </div>
      </div>

      {/* BIG FOCUS CTA */}
      <div onClick={()=>setTab("focus")} style={{ padding:"18px 20px", borderRadius:20, background:"linear-gradient(135deg,rgba(108,99,255,0.15),rgba(139,92,246,0.08))", border:"1px solid rgba(139,92,246,0.3)", marginBottom:14, cursor:"pointer", display:"flex", alignItems:"center", gap:14, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,transparent,rgba(139,92,246,0.08),transparent)", backgroundSize:"200% 100%", animation:"shimmer 3s infinite" }} />
        <div style={{ width:52, height:52, borderRadius:16, background:"rgba(139,92,246,0.2)", border:"1px solid rgba(139,92,246,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0, zIndex:1 }}>🌿</div>
        <div style={{ flex:1, zIndex:1 }}>
          <div style={{ fontWeight:800, fontSize:16, marginBottom:3 }}>Start Focus Session</div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12 }}>Slow down. Block distractions. Go deep.</div>
        </div>
        <div style={{ textAlign:"right", zIndex:1 }}>
          <div style={{ fontSize:18, color:"#A78BFA", fontWeight:800 }}>{totalFocusMin}m</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.08em" }}>focused</div>
        </div>
      </div>

      {/* Active habits preview */}
      {activeHabits.length > 0 && (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, marginTop:4 }}>
            <span style={{ color:"rgba(255,255,255,0.25)", fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase" }}>Your Habits ({activeHabits.length})</span>
            <button onClick={()=>setTab("habits")} style={{ background:"none", border:"none", color:"#A78BFA", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'Sora',sans-serif" }}>View all →</button>
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:18, overflowX:"auto", paddingBottom:4 }}>
            {activeHabits.slice(0, 4).map(h => (
              <div key={h.id} onClick={()=>setTab("habits")} style={{ minWidth:130, padding:"12px 14px", borderRadius:14, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", cursor:"pointer", flexShrink:0 }}>
                <div style={{ fontSize:20, marginBottom:6 }}>{h.icon}</div>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.title}</div>
                <div style={{ fontSize:10, color:"#A78BFA", fontWeight:600 }}>+{h.xp}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ✨ Daily Affirmation — locked for 24h */}
      <div className="card" style={{ padding:"18px 20px", marginBottom:18, borderColor:"rgba(139,92,246,0.2)", background:"rgba(99,102,241,0.05)" }}>
        <div style={{ color:"rgba(255,255,255,0.22)", fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:8 }}>Today's Affirmation</div>
        <div style={{ fontSize:14, fontStyle:"italic", lineHeight:1.7, color:"#E0DCFF", fontWeight:300 }}>"{dailyAffirmation}"</div>
      </div>

      {/* ✨ Your Journey — FIXED line fill logic */}
      <div style={{ color:"rgba(255,255,255,0.25)", fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 }}>Your Journey</div>
      <div className="card" style={{ padding:"22px 20px", borderColor:`${nextMilestone.color}30`, background:`linear-gradient(135deg, ${nextMilestone.color}08, transparent)` }}>

        {/* Big next milestone hero */}
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:18 }}>
          <div style={{ width:60, height:60, borderRadius:18, background:`${nextMilestone.color}15`, border:`2px solid ${nextMilestone.color}40`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, position:"relative" }}>
            <svg width="28" height="32" viewBox="0 0 60 70">
              <defs>
                <linearGradient id="nextMilestoneIcon" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor={nextMilestone.color} />
                </linearGradient>
              </defs>
              <path d="M30 5 C 8 28, 8 52, 30 65 C 52 52, 52 28, 30 5 Z" fill="url(#nextMilestoneIcon)" />
              <ellipse cx="22" cy="22" rx="4" ry="6" fill="#FFFFFF" opacity="0.4" />
            </svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:nextMilestone.color, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:700, marginBottom:4 }}>Next Milestone</div>
            <div style={{ fontSize:18, fontWeight:800, marginBottom:3, letterSpacing:"-0.02em" }}>{nextMilestone.title}</div>
            <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, fontStyle:"italic" }}>{nextMilestone.desc}</div>
          </div>
        </div>

        {/* Progress bar with countdown */}
        <div style={{ marginBottom:18 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>Day {streak} of {nextMilestone.day}</span>
            <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
              <span style={{ fontSize:24, fontWeight:800, color:nextMilestone.color, letterSpacing:"-0.02em" }}>{daysToNext}</span>
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>days left</span>
            </div>
          </div>
          <XPBar pct={segmentProgress} color={`linear-gradient(90deg,${nextMilestone.color}66,${nextMilestone.color})`} />
        </div>

        {/* ✨ FIXED: The full path with proper line fill */}
        <div style={{ paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:14, fontWeight:600 }}>The Full Path</div>

          <div style={{ position:"relative", paddingTop:6, paddingBottom:24 }}>
            {/* Background line */}
            <div style={{
              position:"absolute",
              top:19,
              left:14,
              right:14,
              height:2,
              background:"rgba(255,255,255,0.08)",
              zIndex:0,
              borderRadius:1
            }} />

            {/* ✨ Filled line — fills based on actual progress through path */}
            <div style={{
              position:"absolute",
              top:19,
              left:14,
              height:2,
              width: `calc((100% - 28px) * ${visualLineFill / 100})`,
              background:`linear-gradient(90deg, #34D399, ${nextMilestone.color})`,
              zIndex:1,
              borderRadius:1,
              transition:"width 1.5s ease",
              boxShadow:`0 0 8px ${nextMilestone.color}55`
            }} />

            {/* Milestone dots */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", position:"relative", zIndex:2 }}>
              {MILESTONES.map((m, i) => {
                const reached = streak >= m.day;
                const isNext = m.day === nextMilestone.day && streak < m.day;
                return (
                  <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, flex:1 }}>
                    <div style={{
                      width: isNext ? 32 : 28,
                      height: isNext ? 32 : 28,
                      borderRadius:"50%",
                      border:`2px solid ${reached ? m.color : isNext ? m.color : "rgba(255,255,255,0.15)"}`,
                      background: reached ? m.color : isNext ? `${m.color}25` : "#0a0a14",
                      display:"flex",
                      alignItems:"center",
                      justifyContent:"center",
                      fontSize: isNext ? 12 : 11,
                      fontWeight:800,
                      color: reached ? "#fff" : isNext ? m.color : "rgba(255,255,255,0.3)",
                      transition:"all 0.4s",
                      boxShadow: isNext ? `0 0 16px ${m.color}66` : reached ? `0 0 8px ${m.color}44` : "none",
                      animation: isNext ? "pulse 2.5s ease-in-out infinite" : "none"
                    }}>
                      {reached ? "✓" : isNext ? "●" : ""}
                    </div>
                    <div style={{
                      fontSize:9,
                      fontWeight:700,
                      color: reached || isNext ? m.color : "rgba(255,255,255,0.3)",
                      letterSpacing:"0.04em",
                      whiteSpace:"nowrap"
                    }}>D{m.day}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HABIT BUILDER ───────────────────────────────────────────────────────────

function HabitBuilder({ open, onClose, onSave, editHabit }) {
  const [icon, setIcon] = useState("🌱");
  const [title, setTitle] = useState("");
  const [xp, setXp] = useState(15);
  const [proof, setProof] = useState(true);
  const [category, setCategory] = useState("Body");
  const [frequency, setFrequency] = useState("daily");

  useEffect(() => {
    if (editHabit) {
      setIcon(editHabit.icon); setTitle(editHabit.title); setXp(editHabit.xp);
      setProof(editHabit.proof); setCategory(editHabit.category); setFrequency(editHabit.frequency || "daily");
    } else {
      setIcon("🌱"); setTitle(""); setXp(15); setProof(true); setCategory("Body"); setFrequency("daily");
    }
  }, [editHabit, open]);

  if (!open) return null;

  const save = () => {
    if (!title.trim()) return;
    onSave({ id: editHabit?.id || Date.now(), icon, title: title.trim(), xp, proof, category, frequency, done: editHabit?.done || false });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ width:40, height:4, background:"rgba(255,255,255,0.15)", borderRadius:2, margin:"0 auto 24px" }} />
        <div style={{ fontSize:20, fontWeight:800, marginBottom:4 }}>{editHabit ? "Edit Habit" : "Create Your Habit"}</div>
        <div style={{ color:"rgba(255,255,255,0.4)", fontSize:13, marginBottom:24 }}>What are you practicing?</div>

        <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10, fontWeight:600 }}>Choose Icon</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8, marginBottom:20 }}>
          {HABIT_ICONS.slice(0, 18).map(i => (
            <div key={i} className="icon-pick" onClick={()=>setIcon(i)}
              style={{ background: icon===i ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)", borderColor: icon===i ? "#A78BFA" : "rgba(255,255,255,0.08)" }}>{i}</div>
          ))}
        </div>

        <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>Habit Name</div>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Wake gently" maxLength={40}
          style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"12px 14px", color:"#fff", fontSize:14, marginBottom:20 }} />

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600 }}>Roots Reward</div>
          <div style={{ color:"#A78BFA", fontSize:18, fontWeight:800 }}>+{xp}</div>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:20 }}>
          {[{ v:10,l:"Easy"},{ v:15,l:"Medium"},{ v:25,l:"Hard"},{ v:40,l:"Deep"}].map(opt => (
            <button key={opt.v} onClick={()=>setXp(opt.v)}
              style={{ flex:1, padding:"10px 0", borderRadius:10, border:`1px solid ${xp===opt.v ? "#A78BFA" : "rgba(255,255,255,0.08)"}`, background: xp===opt.v ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.02)", color: xp===opt.v ? "#A78BFA" : "rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer", fontFamily:"'Sora',sans-serif", fontWeight:600 }}>
              <div>{opt.l}</div>
              <div style={{ fontSize:10, opacity:0.7, marginTop:2 }}>+{opt.v}</div>
            </button>
          ))}
        </div>

        <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>Category</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
          {HABIT_CATEGORIES.map(c => (
            <button key={c} onClick={()=>setCategory(c)} className="tab-pill"
              style={{ borderColor: category===c ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)", background: category===c ? "rgba(139,92,246,0.15)" : "transparent", color: category===c ? "#A78BFA" : "rgba(255,255,255,0.5)" }}>{c}</button>
          ))}
        </div>

        <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>Frequency</div>
        <div style={{ display:"flex", gap:8, marginBottom:20 }}>
          {[["daily","Daily"],["weekly","Weekly"],["once","One-time"]].map(([v,l]) => (
            <button key={v} onClick={()=>setFrequency(v)}
              style={{ flex:1, padding:"10px", borderRadius:10, border:`1px solid ${frequency===v ? "#A78BFA" : "rgba(255,255,255,0.08)"}`, background: frequency===v ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.02)", color: frequency===v ? "#A78BFA" : "rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer", fontFamily:"'Sora',sans-serif", fontWeight:600 }}>{l}</button>
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderRadius:12, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>📸 Photo Proof</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:3 }}>+5 bonus for photo proof</div>
          </div>
          <button onClick={()=>setProof(!proof)}
            style={{ width:44, height:24, borderRadius:50, border:"none", background: proof ? "#A78BFA" : "rgba(255,255,255,0.1)", position:"relative", cursor:"pointer", padding:0 }}>
            <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left: proof ? 22 : 2, transition:"all 0.2s" }} />
          </button>
        </div>

        <button onClick={save} disabled={!title.trim()}
          style={{ width:"100%", padding:"14px", borderRadius:14, border:"none", background: title.trim() ? "linear-gradient(135deg,#6C63FF,#A78BFA)" : "rgba(255,255,255,0.05)", color: title.trim() ? "#fff" : "rgba(255,255,255,0.2)", fontSize:15, fontWeight:800, cursor: title.trim() ? "pointer" : "default", fontFamily:"'Sora',sans-serif", marginBottom:10 }}>
          {editHabit ? "Save Changes" : "Create Habit"}
        </button>
        <button onClick={onClose}
          style={{ width:"100%", padding:"12px", borderRadius:14, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"rgba(255,255,255,0.5)", fontSize:13, cursor:"pointer", fontFamily:"'Sora',sans-serif" }}>Cancel</button>
      </div>
    </div>
  );
}

function PhotoProofModal({ habit, onClose, onComplete }) {
  const [photo, setPhoto] = useState(null);
  const [note, setNote] = useState("");
  const fileRef = useRef(null);
  if (!habit) return null;
  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };
  const submit = () => { onComplete(habit, !!photo, note); onClose(); };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{ width:40, height:4, background:"rgba(255,255,255,0.15)", borderRadius:2, margin:"0 auto 24px" }} />
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:"rgba(139,92,246,0.15)", border:"1px solid rgba(139,92,246,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>{habit.icon}</div>
          <div>
            <div style={{ fontSize:17, fontWeight:800 }}>{habit.title}</div>
            <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12 }}>+{habit.xp}{habit.proof ? " +5 photo" : ""} roots</div>
          </div>
        </div>
        {habit.proof && (
          <>
            <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10, fontWeight:600 }}>Upload Proof</div>
            {!photo ? (
              <div onClick={()=>fileRef.current?.click()} style={{ border:"2px dashed rgba(139,92,246,0.3)", borderRadius:16, padding:"40px 20px", textAlign:"center", cursor:"pointer", background:"rgba(139,92,246,0.05)", marginBottom:16 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📸</div>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>Tap to add photo</div>
                <div style={{ color:"rgba(255,255,255,0.3)", fontSize:12 }}>+5 bonus roots</div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display:"none" }} />
              </div>
            ) : (
              <div style={{ marginBottom:16, position:"relative" }}>
                <img src={photo} alt="proof" style={{ width:"100%", borderRadius:16, display:"block", maxHeight:280, objectFit:"cover" }} />
                <button onClick={()=>setPhoto(null)} style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.6)", border:"none", color:"#fff", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:16 }}>✕</button>
                <div style={{ position:"absolute", bottom:10, left:10, background:"rgba(52,211,153,0.9)", color:"#fff", padding:"4px 12px", borderRadius:50, fontSize:11, fontWeight:700 }}>+5 Photo Bonus ✓</div>
              </div>
            )}
          </>
        )}
        <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>Note (optional)</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="How did it feel?" rows={3}
          style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"10px 14px", color:"#fff", fontSize:13, resize:"none", lineHeight:1.6, marginBottom:20 }} />
        <button onClick={submit} style={{ width:"100%", padding:"14px", borderRadius:14, border:"none", background:"linear-gradient(135deg,#6C63FF,#A78BFA)", color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"'Sora',sans-serif", marginBottom:10 }}>
          Complete — +{habit.xp + (photo ? 5 : 0)} roots
        </button>
        <button onClick={onClose} style={{ width:"100%", padding:"12px", borderRadius:14, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"rgba(255,255,255,0.5)", fontSize:13, cursor:"pointer", fontFamily:"'Sora',sans-serif" }}>Cancel</button>
      </div>
    </div>
  );
}

function HabitsScreen({ xp, setXp, habits, setHabits }) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editHabit, setEditHabit] = useState(null);
  const [proofHabit, setProofHabit] = useState(null);
  const [filter, setFilter] = useState("All");
  const [showTemplates, setShowTemplates] = useState(false);

  const saveHabit = (h) => {
    setHabits(prev => {
      const exists = prev.find(x => x.id === h.id);
      if (exists) return prev.map(x => x.id === h.id ? h : x);
      return [...prev, h];
    });
    setEditHabit(null);
  };
  const deleteHabit = (id) => setHabits(prev => prev.filter(h => h.id !== id));
  const completeHabit = (h, hasPhoto, note) => {
    const bonus = hasPhoto && h.proof ? 5 : 0;
    setXp(x => x + h.xp + bonus);
    setHabits(prev => prev.map(x => x.id === h.id ? { ...x, done: true } : x));
  };
  const addFromTemplate = (t) => {
    setHabits(prev => [...prev, { id: Date.now(), icon: t.icon, title: t.title, xp: t.xp, proof: t.proof, category: t.category, frequency: "daily", done: false }]);
    setShowTemplates(false);
  };
  const filtered = filter === "All" ? habits : habits.filter(h => h.category === filter);
  const activeHabits = filtered.filter(h => !h.done);
  const doneHabits = filtered.filter(h => h.done);

  return (
    <>
      <div className="scroll" style={{ height:"100%", overflowY:"auto", padding:"0 18px 100px", position:"relative" }}>
        <Glow color="#A78BFA" style={{ top:-80, left:"20%", width:400, height:400, opacity:0.06 }} />
        <div style={{ paddingTop:52, paddingBottom:18 }}>
          <div style={{ color:"rgba(255,255,255,0.25)", fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:6 }}>Your Habits</div>
          <div style={{ fontSize:24, fontWeight:800, letterSpacing:"-0.03em" }}>What are you practicing?</div>
          <div style={{ color:"rgba(255,255,255,0.35)", fontSize:13, marginTop:4 }}>Small, daily. That's how roots grow.</div>
        </div>
        <div style={{ display:"flex", gap:10, marginBottom:18 }}>
          <button onClick={()=>{setEditHabit(null); setBuilderOpen(true);}}
            style={{ flex:1, padding:"14px", borderRadius:16, border:"1px solid rgba(139,92,246,0.35)", background:"rgba(139,92,246,0.1)", color:"#A78BFA", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Sora',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <span style={{ fontSize:16 }}>+</span> Create Habit
          </button>
          <button onClick={()=>setShowTemplates(!showTemplates)}
            style={{ flex:1, padding:"14px", borderRadius:16, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.03)", color:"rgba(255,255,255,0.7)", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Sora',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            🌿 Templates
          </button>
        </div>
        {showTemplates && (
          <div className="fade-up card" style={{ padding:"16px", marginBottom:20, borderColor:"rgba(52,211,153,0.2)", background:"rgba(52,211,153,0.05)" }}>
            <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:12, fontWeight:600 }}>Quick Add</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {HABIT_TEMPLATES.map((t, i) => (
                <div key={i} onClick={()=>addFromTemplate(t)} style={{ padding:"10px 12px", borderRadius:12, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.03)", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18 }}>{t.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.title}</div>
                    <div style={{ fontSize:10, color:"#A78BFA", marginTop:1 }}>+{t.xp}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto" }}>
          {["All", ...HABIT_CATEGORIES].map(c => (
            <button key={c} onClick={()=>setFilter(c)} className="tab-pill" style={{ borderColor: filter===c ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)", background: filter===c ? "rgba(139,92,246,0.15)" : "transparent", color: filter===c ? "#A78BFA" : "rgba(255,255,255,0.4)" }}>{c}</button>
          ))}
        </div>
        {habits.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 20px" }}>
            <div style={{ fontSize:48, marginBottom:12, opacity:0.4 }}>🌱</div>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>No habits yet</div>
            <div style={{ color:"rgba(255,255,255,0.35)", fontSize:13, lineHeight:1.6 }}>Create your first habit or use a template</div>
          </div>
        )}
        {activeHabits.length > 0 && (
          <>
            <div style={{ color:"rgba(255,255,255,0.25)", fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 }}>Active ({activeHabits.length})</div>
            {activeHabits.map((h, i) => (
              <div key={h.id} className="card fade-up" style={{ padding:"14px 16px", marginBottom:10, animationDelay:`${i*0.05}s` }}>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <div onClick={()=>setProofHabit(h)} style={{ width:44, height:44, borderRadius:12, background:"rgba(139,92,246,0.1)", border:"1px solid rgba(139,92,246,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0, cursor:"pointer" }}>{h.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:3 }}>{h.title}</div>
                    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, color:"#A78BFA", background:"rgba(139,92,246,0.12)", padding:"2px 8px", borderRadius:50, fontWeight:600 }}>+{h.xp}</span>
                      <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>{h.category}</span>
                      <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>•</span>
                      <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>{h.frequency}</span>
                      {h.proof && <span style={{ fontSize:10 }}>📸</span>}
                    </div>
                  </div>
                  <button onClick={()=>setProofHabit(h)} style={{ padding:"8px 14px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#6C63FF,#A78BFA)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Sora',sans-serif", flexShrink:0 }}>Complete</button>
                </div>
                <div style={{ display:"flex", gap:8, marginTop:10, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                  <button onClick={()=>{setEditHabit(h); setBuilderOpen(true);}} style={{ flex:1, padding:"6px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"rgba(255,255,255,0.5)", fontSize:11, cursor:"pointer", fontFamily:"'Sora',sans-serif" }}>✏️ Edit</button>
                  <button onClick={()=>deleteHabit(h.id)} style={{ flex:1, padding:"6px", borderRadius:8, border:"1px solid rgba(239,68,68,0.2)", background:"transparent", color:"rgba(239,68,68,0.6)", fontSize:11, cursor:"pointer", fontFamily:"'Sora',sans-serif" }}>🗑 Delete</button>
                </div>
              </div>
            ))}
          </>
        )}
        {doneHabits.length > 0 && (
          <>
            <div style={{ color:"rgba(255,255,255,0.25)", fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10, marginTop:24 }}>Completed ({doneHabits.length})</div>
            {doneHabits.map((h) => (
              <div key={h.id} className="card" style={{ padding:"12px 14px", marginBottom:8, opacity:0.55, borderColor:"rgba(52,211,153,0.2)", background:"rgba(52,211,153,0.03)" }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:"rgba(52,211,153,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{h.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13, textDecoration:"line-through", color:"rgba(255,255,255,0.5)" }}>{h.title}</div>
                    <div style={{ fontSize:10, color:"#34D399", marginTop:2 }}>✓ Complete • +{h.xp}</div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <button className="fab" onClick={()=>{setEditHabit(null); setBuilderOpen(true);}}>+</button>
      <HabitBuilder open={builderOpen} onClose={()=>setBuilderOpen(false)} onSave={saveHabit} editHabit={editHabit} />
      {proofHabit && <PhotoProofModal habit={proofHabit} onClose={()=>setProofHabit(null)} onComplete={completeHabit} />}
    </>
  );
}

function FocusTimerScreen({ xp, setXp, totalFocusMin, setTotalFocusMin, setTab }) {
  const [phase, setPhase] = useState("setup");
  const [preset, setPreset] = useState(null);
  const [intention, setIntention] = useState("");
  const [blocked, setBlocked] = useState(BLOCKED_APPS);
  const [remaining, setRemaining] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (phase === "active") {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) { clearInterval(intervalRef.current); setPhase("complete"); setXp(x => x + preset.xp); setTotalFocusMin(t => t + preset.minutes); return 0; }
          return r - 1;
        });
      }, 1000);
      const q = setInterval(() => setQuoteIdx(i => (i+1) % FOCUS_QUOTES.length), 6000);
      return () => { clearInterval(intervalRef.current); clearInterval(q); };
    }
  }, [phase]);

  const start = () => { setRemaining(preset.minutes * 60); setTotalDuration(preset.minutes * 60); setPhase("active"); };
  const attemptQuit = () => setPhase("quit");
  const confirmQuit = () => { clearInterval(intervalRef.current); setPhase("setup"); setPreset(null); setIntention(""); };
  const fmtTime = (sec) => { const m = Math.floor(sec / 60); const s = sec % 60; return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; };
  const progress = totalDuration > 0 ? ((totalDuration - remaining) / totalDuration) * 100 : 0;

  if (phase === "active") {
    return (
      <div style={{ height:"100%", background:"#0a0015", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px", position:"relative", overflow:"hidden" }}>
        <Glow color="#A78BFA" style={{ top:"20%", left:"50%", transform:"translateX(-50%)", width:400, height:400, opacity:0.25 }} />
        <div style={{ position:"absolute", top:40, left:0, right:0, textAlign:"center", zIndex:2 }}>
          <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:4 }}>{preset.label} Session</div>
          <div style={{ color:"rgba(255,255,255,0.6)", fontSize:13, fontStyle:"italic" }}>{intention || "Present in silence"}</div>
        </div>
        <div style={{ position:"relative", width:280, height:280, marginBottom:40, zIndex:2 }}>
          <svg width="280" height="280" style={{ position:"absolute", inset:0, transform:"rotate(-90deg)" }}>
            <circle cx="140" cy="140" r="128" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
            <circle cx="140" cy="140" r="128" fill="none" stroke="url(#grad)" strokeWidth="4" strokeDasharray={`${2*Math.PI*128}`} strokeDashoffset={`${2*Math.PI*128*(1-progress/100)}`} strokeLinecap="round" style={{ transition:"stroke-dashoffset 1s linear" }} />
            <defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6C63FF" /><stop offset="100%" stopColor="#A78BFA" /></linearGradient></defs>
          </svg>
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", animation:"ringPulse 3s infinite" }}>
            <div style={{ fontSize:56, fontWeight:800, letterSpacing:"-0.04em", fontVariantNumeric:"tabular-nums" }}>{fmtTime(remaining)}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:"0.2em", textTransform:"uppercase", marginTop:4 }}>REMAINING</div>
          </div>
        </div>
        <div style={{ padding:"0 40px", textAlign:"center", marginBottom:30, zIndex:2, minHeight:40 }}>
          <div style={{ fontSize:15, fontStyle:"italic", color:"rgba(255,255,255,0.55)", fontWeight:300, lineHeight:1.6 }}>"{FOCUS_QUOTES[quoteIdx]}"</div>
        </div>
        <button onClick={attemptQuit} style={{ padding:"10px 24px", borderRadius:50, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.03)", color:"rgba(255,255,255,0.4)", fontSize:12, cursor:"pointer", fontFamily:"'Sora',sans-serif", fontWeight:500, zIndex:2 }}>Give up</button>
      </div>
    );
  }
  if (phase === "quit") {
    return (
      <div style={{ height:"100%", background:"#1a0000", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"30px" }}>
        <div style={{ fontSize:60, marginBottom:20 }}>🛑</div>
        <div style={{ fontSize:22, fontWeight:800, marginBottom:12, textAlign:"center" }}>Break the rhythm?</div>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:14, textAlign:"center", lineHeight:1.7, marginBottom:36, maxWidth:300 }}>You're {Math.floor(progress)}% through. You won't earn any roots.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%", maxWidth:280 }}>
          <button onClick={()=>setPhase("active")} style={{ padding:"14px", borderRadius:14, border:"none", background:"linear-gradient(135deg,#6C63FF,#A78BFA)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Sora',sans-serif" }}>Stay with it →</button>
          <button onClick={confirmQuit} style={{ padding:"14px", borderRadius:14, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.08)", color:"#F87171", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Sora',sans-serif" }}>Stop anyway</button>
        </div>
      </div>
    );
  }
  if (phase === "complete") {
    return (
      <div style={{ height:"100%", background:"linear-gradient(180deg,#0d0020,#000)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"30px", position:"relative", overflow:"hidden" }}>
        <Glow color="#A78BFA" style={{ top:"15%", left:"50%", transform:"translateX(-50%)", width:500, height:500, opacity:0.3 }} />
        <div style={{ fontSize:72, marginBottom:20, animation:"leafSway 3s ease-in-out infinite", zIndex:2 }}>🌿</div>
        <div style={{ fontSize:11, color:"#A78BFA", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:10, fontWeight:600, zIndex:2 }}>Session Complete</div>
        <div style={{ fontSize:32, fontWeight:800, marginBottom:12, letterSpacing:"-0.03em", zIndex:2 }}>{preset.minutes} minutes deep</div>
        <div style={{ fontSize:14, color:"rgba(255,255,255,0.55)", fontStyle:"italic", textAlign:"center", marginBottom:40, maxWidth:280, lineHeight:1.6, zIndex:2 }}>"While others scrolled, you stayed."</div>
        <div className="card" style={{ padding:"20px 24px", marginBottom:30, minWidth:280, zIndex:2 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}><span style={{ color:"rgba(255,255,255,0.5)", fontSize:13 }}>Roots Earned</span><span style={{ color:"#A78BFA", fontSize:22, fontWeight:800 }}>+{preset.xp}</span></div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}><span style={{ color:"rgba(255,255,255,0.5)", fontSize:13 }}>Focus Minutes</span><span style={{ color:"#34D399", fontSize:22, fontWeight:800 }}>+{preset.minutes}</span></div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:280, zIndex:2 }}>
          <button onClick={()=>{ setPhase("setup"); setPreset(null); setIntention(""); }} style={{ padding:"14px", borderRadius:14, border:"none", background:"linear-gradient(135deg,#6C63FF,#A78BFA)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Sora',sans-serif" }}>Start another →</button>
          <button onClick={()=>{ setPhase("setup"); setPreset(null); setIntention(""); setTab("home"); }} style={{ padding:"14px", borderRadius:14, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.03)", color:"rgba(255,255,255,0.6)", fontSize:13, cursor:"pointer", fontFamily:"'Sora',sans-serif" }}>Back to home</button>
        </div>
      </div>
    );
  }
  return (
    <div className="scroll" style={{ height:"100%", overflowY:"auto", padding:"0 18px 100px" }}>
      <Glow color="#6C63FF" style={{ top:-80, left:"30%", width:400, height:400, opacity:0.08 }} />
      <div style={{ paddingTop:52, paddingBottom:20 }}>
        <div style={{ color:"rgba(255,255,255,0.25)", fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:6 }}>Slow down to go deep.</div>
        <div style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.03em" }}>Focus Session</div>
        <div style={{ color:"rgba(255,255,255,0.35)", fontSize:13, marginTop:4 }}>Every minute of presence grows your roots</div>
      </div>
      <div className="card" style={{ padding:"16px 18px", marginBottom:20, borderColor:"rgba(139,92,246,0.2)", background:"rgba(139,92,246,0.05)" }}>
        <div style={{ display:"flex", justifyContent:"space-around", alignItems:"center" }}>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:22, fontWeight:800, color:"#A78BFA" }}>{totalFocusMin}</div><div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.08em", marginTop:2 }}>Total Min</div></div>
          <div style={{ width:1, height:30, background:"rgba(255,255,255,0.08)" }} />
          <div style={{ textAlign:"center" }}><div style={{ fontSize:22, fontWeight:800, color:"#34D399" }}>{Math.floor(totalFocusMin/60)}h {totalFocusMin%60}m</div><div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.08em", marginTop:2 }}>This Week</div></div>
          <div style={{ width:1, height:30, background:"rgba(255,255,255,0.08)" }} />
          <div style={{ textAlign:"center" }}><div style={{ fontSize:22, fontWeight:800, color:"#10B981" }}>{Math.floor(totalFocusMin/30)}</div><div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.08em", marginTop:2 }}>Sessions</div></div>
        </div>
      </div>
      <div style={{ color:"rgba(255,255,255,0.25)", fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:12 }}>1. Choose Your Depth</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
        {FOCUS_PRESETS.map((p, i) => {
          const selected = preset?.id === p.id;
          return (
            <div key={p.id} className="preset-card fade-up" onClick={()=>setPreset(p)} style={{ borderColor: selected ? "#A78BFA" : "rgba(255,255,255,0.08)", background: selected ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)", animationDelay:`${i*0.05}s` }}>
              <div style={{ width:48, height:48, borderRadius:14, background: selected ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)", border:`1px solid ${selected ? "#A78BFA" : "rgba(255,255,255,0.08)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{p.emoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{p.label}</div>
                  <div style={{ fontSize:11, color:"#A78BFA", fontWeight:700 }}>+{p.xp}</div>
                </div>
                <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, marginBottom:3 }}>{p.desc}</div>
                <div style={{ color:"rgba(255,255,255,0.25)", fontSize:11 }}>{p.minutes} minutes</div>
              </div>
              {selected && <div style={{ fontSize:16, color:"#A78BFA" }}>✓</div>}
            </div>
          );
        })}
      </div>
      {preset && (
        <div className="fade-up">
          <div style={{ color:"rgba(255,255,255,0.25)", fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:12 }}>2. Set Your Intention</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
            {FOCUS_INTENTIONS.map(int => (
              <button key={int} onClick={()=>setIntention(int)} style={{ padding:"12px 14px", borderRadius:12, border:`1px solid ${intention===int ? "#A78BFA" : "rgba(255,255,255,0.08)"}`, background: intention===int ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)", color: intention===int ? "#A78BFA" : "rgba(255,255,255,0.6)", fontSize:12, cursor:"pointer", fontFamily:"'Sora',sans-serif", fontWeight:600, textAlign:"left" }}>{int}</button>
            ))}
          </div>
        </div>
      )}
      {preset && intention && (
        <div className="fade-up">
          <div style={{ color:"rgba(255,255,255,0.25)", fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:12 }}>3. Distractions Blocked</div>
          <div className="card" style={{ padding:"14px 16px", marginBottom:20 }}>
            {blocked.map((a, i) => (
              <div key={a.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom: i < blocked.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{a.icon}</div>
                  <div style={{ fontSize:13, fontWeight:500, color: a.blocked ? "#fff" : "rgba(255,255,255,0.4)" }}>{a.name}</div>
                </div>
                <button onClick={()=>setBlocked(bl=>bl.map(b=>b.name===a.name?{...b,blocked:!b.blocked}:b))} style={{ width:40, height:22, borderRadius:50, border:"none", background: a.blocked ? "#A78BFA" : "rgba(255,255,255,0.1)", position:"relative", cursor:"pointer", padding:0 }}>
                  <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left: a.blocked ? 20 : 2, transition:"all 0.2s" }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {preset && intention && (
        <button onClick={start} className="fade-up" style={{ width:"100%", padding:"18px", borderRadius:16, border:"none", background:"linear-gradient(135deg,#6C63FF,#A78BFA)", color:"#fff", fontSize:16, fontWeight:800, cursor:"pointer", fontFamily:"'Sora',sans-serif", letterSpacing:"0.03em", marginBottom:12, boxShadow:"0 10px 40px rgba(139,92,246,0.3)" }}>🌿 BEGIN — {preset.minutes} MIN</button>
      )}
    </div>
  );
}

function TalkScreen() {
  const [mode, setMode] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);
  const start = (m) => { setMode(m); setMsgs([{ role:"assistant", text:m.greeting }]); };
  const send = async () => {
    if (!input.trim() || loading) return;
    const next = [...msgs, { role:"user", text:input }];
    setMsgs(next); setInput(""); setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system: mode.system, messages: next.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text })) }) });
      const data = await res.json();
      setMsgs(p => [...p, { role:"assistant", text: data.content?.[0]?.text || "I'm here." }]);
    } catch { setMsgs(p => [...p, { role:"assistant", text:"Still here. Try again." }]); }
    setLoading(false);
  };
  if (!mode) {
    return (
      <div className="scroll" style={{ height:"100%", overflowY:"auto", padding:"0 18px 100px" }}>
        <div style={{ paddingTop:52, paddingBottom:20 }}>
          <div style={{ color:"rgba(255,255,255,0.25)", fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:6 }}>AI Conversation</div>
          <div style={{ fontSize:22, fontWeight:800 }}>What do you need?</div>
          <div style={{ color:"rgba(255,255,255,0.35)", fontSize:13, marginTop:4 }}>Choose what would help most right now</div>
        </div>
        {Object.values(TALK_MODES).map((m, i) => (
          <div key={m.id} className="mode-card fade-up" onClick={()=>start(m)} style={{ marginBottom:14, borderColor:`${m.color}40`, background:`linear-gradient(135deg,${m.color}14,${m.color}04)`, animationDelay:`${i*0.1}s` }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:52, height:52, borderRadius:14, background:`${m.color}18`, border:`1px solid ${m.color}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{m.emoji}</div>
              <div><div style={{ fontWeight:700, fontSize:15, marginBottom:3 }}>{m.name}</div><div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, fontStyle:"italic" }}>"{m.tagline}"</div></div>
            </div>
            <span style={{ color:m.accent, fontSize:18, opacity:0.6 }}>→</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:mode.bg, position:"relative" }}>
      <Glow color={mode.color} style={{ top:0, left:"50%", transform:"translateX(-50%)", width:320, height:320, opacity:0.1 }} />
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 20px 12px", borderBottom:"1px solid rgba(255,255,255,0.08)", flexShrink:0, zIndex:2 }}>
        <button onClick={()=>{setMode(null);setMsgs([]);}} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize:22, cursor:"pointer" }}>←</button>
        <div style={{ width:32, height:32, borderRadius:10, background:`${mode.color}22`, border:`1px solid ${mode.color}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{mode.emoji}</div>
        <div><div style={{ fontWeight:700, fontSize:12, letterSpacing:"0.06em", textTransform:"uppercase" }}>{mode.name}</div><div style={{ color:"rgba(255,255,255,0.3)", fontSize:11, fontStyle:"italic" }}>{mode.tagline}</div></div>
      </div>
      <div className="scroll" style={{ flex:1, overflowY:"auto", padding:"20px 18px", display:"flex", flexDirection:"column", gap:12, zIndex:1 }}>
        {msgs.map((m,i) => (
          <div key={i} className="fade-up" style={{ display:"flex", justifyContent: m.role==="user" ? "flex-end" : "flex-start", alignItems:"flex-end", gap:8 }}>
            {m.role==="assistant" && <div style={{ width:26, height:26, borderRadius:"50%", background:`${mode.color}22`, border:`1px solid ${mode.accent}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>{mode.emoji}</div>}
            <div style={{ maxWidth:260, padding:"10px 14px", fontSize:14, lineHeight:1.65, borderRadius:18, borderTopRightRadius: m.role==="user" ? 4 : 18, borderTopLeftRadius: m.role==="assistant" ? 4 : 18, background: m.role==="user" ? mode.color : "rgba(255,255,255,0.07)", border: m.role==="assistant" ? `1px solid ${mode.accent}15` : "none" }}>{m.text}</div>
          </div>
        ))}
        {loading && (<div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
          <div style={{ width:26, height:26, borderRadius:"50%", background:`${mode.color}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>{mode.emoji}</div>
          <div style={{ padding:"12px 16px", borderRadius:18, borderTopLeftRadius:4, background:"rgba(255,255,255,0.07)", display:"flex", gap:5 }}>{[0,1,2].map(i => <span key={i} className="dot" style={{ animationDelay:`${i*0.15}s` }} />)}</div>
        </div>)}
        <div ref={endRef} />
      </div>
      <div style={{ padding:"10px 16px 80px", borderTop:"1px solid rgba(255,255,255,0.07)", zIndex:2 }}>
        <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder={mode.placeholder} rows={2} style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, padding:"10px 14px", color:"#fff", fontSize:14, resize:"none", lineHeight:1.5 }} />
          <button onClick={send} disabled={loading||!input.trim()} style={{ width:40, height:40, borderRadius:"50%", border:"none", background: input.trim()&&!loading ? mode.color : "rgba(255,255,255,0.07)", color:"#fff", fontSize:16, cursor: input.trim() ? "pointer" : "default", flexShrink:0 }}>↑</button>
        </div>
      </div>
    </div>
  );
}

function SocietyScreen() {
  const [posts, setPosts] = useState(SOCIETY_POSTS);
  const [liked, setLiked] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [filter, setFilter] = useState("all");
  const toggleLike = (id) => { const isLiked = liked.includes(id); setLiked(p => isLiked ? p.filter(x=>x!==id) : [...p, id]); setPosts(p => p.map(post => post.id===id ? { ...post, likes: post.likes+(isLiked?-1:1) } : post)); };
  const submit = () => { if (!newPost.trim()) return; const avs = ["🌙","🌱","🌿","💫"], ns = ["SilentOne","QuietOne","RisingUp","StillHere"]; const r = Math.floor(Math.random()*4); setPosts(p => [{ id:Date.now(), avatar:avs[r], name:ns[r], time:"just now", text:newPost, likes:0, type:"win" }, ...p]); setNewPost(""); };
  const filtered = filter==="all" ? posts : posts.filter(p=>p.type===filter);
  return (
    <div className="scroll" style={{ height:"100%", overflowY:"auto", padding:"0 18px 100px" }}>
      <div style={{ paddingTop:52, paddingBottom:18 }}>
        <div style={{ color:"rgba(255,255,255,0.25)", fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:6 }}>Anonymous Community</div>
        <div style={{ fontSize:22, fontWeight:800 }}>Society</div>
        <div style={{ color:"rgba(255,255,255,0.35)", fontSize:13, marginTop:4 }}>No names. No judgment. Just truth.</div>
      </div>
      <div className="card" style={{ padding:"14px 16px", marginBottom:16, borderColor:"rgba(139,92,246,0.2)" }}>
        <textarea value={newPost} onChange={e=>setNewPost(e.target.value)} placeholder="Share anonymously..." rows={2} style={{ width:"100%", background:"transparent", border:"none", color:"#fff", fontSize:13, resize:"none", lineHeight:1.6, marginBottom:8 }} />
        <button onClick={submit} style={{ padding:"7px 16px", borderRadius:50, border:"none", background: newPost.trim() ? "linear-gradient(135deg,#6C63FF,#A78BFA)" : "rgba(255,255,255,0.06)", color: newPost.trim() ? "#fff" : "rgba(255,255,255,0.2)", fontSize:12, cursor: newPost.trim() ? "pointer" : "default", fontFamily:"'Sora',sans-serif", fontWeight:700, float:"right" }}>Post</button>
        <div style={{ clear:"both" }} />
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[["all","All"],["win","🌱 Wins"],["hard","💙 Hard"]].map(([v,l]) => (
          <button key={v} onClick={()=>setFilter(v)} className="tab-pill" style={{ borderColor: filter===v ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)", background: filter===v ? "rgba(139,92,246,0.15)" : "transparent", color: filter===v ? "#A78BFA" : "rgba(255,255,255,0.35)" }}>{l}</button>
        ))}
      </div>
      {filtered.map((p, i) => (
        <div key={p.id} className="card fade-up" style={{ padding:"14px 16px", marginBottom:10, animationDelay:`${i*0.05}s` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <div style={{ width:30, height:30, borderRadius:"50%", background:"rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>{p.avatar}</div>
            <div><div style={{ fontWeight:600, fontSize:12 }}>{p.name}</div><div style={{ color:"rgba(255,255,255,0.22)", fontSize:10 }}>{p.time}</div></div>
            <div style={{ marginLeft:"auto", fontSize:10, padding:"3px 9px", borderRadius:50, background: p.type==="win" ? "rgba(52,211,153,0.1)" : "rgba(99,102,241,0.1)", color: p.type==="win" ? "#34D399" : "#A78BFA", fontWeight:600 }}>{p.type==="win" ? "Win" : "Hard"}</div>
          </div>
          <div style={{ color:"rgba(255,255,255,0.75)", fontSize:13, lineHeight:1.6, marginBottom:10 }}>{p.text}</div>
          <button className={`like-btn ${liked.includes(p.id) ? "liked" : ""}`} onClick={()=>toggleLike(p.id)}>
            <span>{liked.includes(p.id) ? "♥" : "♡"}</span><span>{p.likes}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

export default function StillApp() {
  const [tab, setTab] = useState("home");
  const [streak] = useState(7);
  const [xp, setXp] = useState(840);
  const [totalFocusMin, setTotalFocusMin] = useState(145);
  const [habits, setHabits] = useState([
    { id: 1, icon: "🏃", title: "Move my body", xp: 25, proof: true, category: "Body", frequency: "daily", done: false },
    { id: 2, icon: "📚", title: "Read 30 pages", xp: 15, proof: false, category: "Mind", frequency: "daily", done: false },
    { id: 3, icon: "🌅", title: "Wake gently before 7", xp: 15, proof: true, category: "Discipline", frequency: "daily", done: true },
  ]);

  const tabs = [
    { id:"home", icon:"🏠", label:"Home" },
    { id:"focus", icon:"🌿", label:"Focus" },
    { id:"habits", icon:"✓", label:"Habits" },
    { id:"talk", icon:"💬", label:"Talk" },
    { id:"society", icon:"👥", label:"Society" },
  ];

  return (
    <div className="app" style={{ height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{G}</style>
      <div style={{ flex:1, overflow:"hidden", position:"relative", zIndex:1 }}>
        {tab==="home" && <HomeScreen streak={streak} xp={xp} totalFocusMin={totalFocusMin} habits={habits} setTab={setTab} />}
        {tab==="focus" && <FocusTimerScreen xp={xp} setXp={setXp} totalFocusMin={totalFocusMin} setTotalFocusMin={setTotalFocusMin} setTab={setTab} />}
        {tab==="habits" && <HabitsScreen xp={xp} setXp={setXp} habits={habits} setHabits={setHabits} />}
        {tab==="talk" && <TalkScreen />}
        {tab==="society" && <SocietyScreen />}
      </div>
      <nav className="nav">
        {tabs.map(t => (
          <button key={t.id} className={`nav-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
