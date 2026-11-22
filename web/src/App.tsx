import { useEffect, useState } from "react";
import "./still.css";

type Tab = "home" | "focus" | "checkin" | "habits" | "society" | "collection" | "settings";
type DayState = "steady" | "heavy" | "tiny";
type Habit = {
  id: number;
  icon: string;
  title: string;
  area: string;
  difficulty: "easy" | "medium" | "hard";
  baseRoots: number;
  streak: number;
  lastCompletedDay: number | null;
  lastReward: number;
  done: boolean;
};
type Post = {
  id: number;
  icon: string;
  text: string;
  reactions: { like: number; love: number; same: number; proud: number };
  reacted: "like" | "love" | "same" | "proud" | null;
  comments: { id: number; text: string }[];
};
type State = {
  onboarded: boolean;
  tab: Tab;
  userName: string;
  day: number;
  roots: number;
  focusMinutes: number;
  checkins: number;
  theme: "dark" | "normal";
  dailyState: DayState;
  mood: number;
  load: number;
  selectedDepth: "light" | "medium" | "deep";
  focusActive: boolean;
  focusProgress: number;
  focusProofPending: boolean;
  intention: string;
  supportMode: string | null;
  lastReflection: string;
  draftIcon: string;
  draftDifficulty: "easy" | "medium" | "hard";
  habits: Habit[];
  societyPosts: Post[];
  hardWinDraft: string;
};

const STORAGE_KEY = "still_final_app_state_v1";

const defaultState: State = {
  onboarded: false,
  tab: "home",
  userName: "",
  day: 1,
  roots: 0,
  focusMinutes: 0,
  checkins: 0,
  theme: "dark",
  dailyState: "steady",
  mood: 48,
  load: 62,
  selectedDepth: "medium",
  focusActive: false,
  focusProgress: 0,
  focusProofPending: false,
  intention: "Study without checking my phone",
  supportMode: null,
  lastReflection: "You do not need to fix the whole day. Name one small action and stay with it for ten quiet minutes.",
  draftIcon: "🌱",
  draftDifficulty: "easy",
  habits: [
    { id: 1, icon: "🏃", title: "Move my body", area: "Body", difficulty: "medium", baseRoots: 2, streak: 0, lastCompletedDay: null, lastReward: 0, done: false },
    { id: 2, icon: "📚", title: "Read 30 pages", area: "Mind", difficulty: "hard", baseRoots: 3, streak: 0, lastCompletedDay: null, lastReward: 0, done: false },
    { id: 3, icon: "🌙", title: "Sleep before 11", area: "Rest", difficulty: "hard", baseRoots: 3, streak: 0, lastCompletedDay: null, lastReward: 0, done: false }
  ],
  societyPosts: [
    { id: 1, icon: "🌙", text: "I wanted to disappear into scrolling, but I took a shower and answered one message.", reactions: { like: 21, love: 8, same: 18, proud: 9 }, reacted: null, comments: [{ id: 11, text: "This is exactly the kind of win people miss. You came back." }] },
    { id: 2, icon: "🌱", text: "Did ten minutes of the assignment. Not finished, but I came back.", reactions: { like: 14, love: 5, same: 11, proud: 6 }, reacted: null, comments: [] },
    { id: 3, icon: "💧", text: "Drank water, cried a little, then made my bed. Tiny win, real win.", reactions: { like: 26, love: 17, same: 24, proud: 14 }, reacted: "love", comments: [] }
  ],
  hardWinDraft: ""
};

const depths = {
  light: { icon: "🍃", label: "Light", minutes: 25, roots: 15, copy: "For low-energy days. One small start still counts." },
  medium: { icon: "🌿", label: "Medium", minutes: 50, roots: 35, copy: "The steady block. Enough depth without forcing the day." },
  deep: { icon: "🌳", label: "Deep", minutes: 90, roots: 70, copy: "For work that needs real quiet and a little courage." }
};

const dayStates = {
  steady: { icon: "🌿", title: "I can focus", copy: "Protect one clean session." },
  heavy: { icon: "🌙", title: "I feel heavy", copy: "Lower the pressure first." },
  tiny: { icon: "🌱", title: "I need small steps", copy: "Make the next move visible." }
};

const stages = [
  { name: "Seed Drop", max: 7, asset: "/assets/still-logo-stage-1.png", copy: "Quiet beginning. Roots forming." },
  { name: "Rooted Drop", max: 29, asset: "/assets/still-logo-stage-2.png", copy: "Your roots are becoming visible." },
  { name: "First Leaves", max: 89, asset: "/assets/still-logo-stage-3.png", copy: "New life is starting to show." },
  { name: "Small Plant", max: 179, asset: "/assets/still-logo-stage-4.png", copy: "The practice is growing into something real." },
  { name: "Still Tree", max: 9999, asset: "/assets/still-logo-stage-5.png", copy: "Rooted, alive, and still becoming." }
];

const habitTemplates = [
  { icon: "🏃", title: "Move my body", area: "Body", difficulty: "medium" as const, baseRoots: 2 },
  { icon: "💧", title: "Drink water", area: "Body", difficulty: "easy" as const, baseRoots: 1 },
  { icon: "📚", title: "Read 20 pages", area: "Mind", difficulty: "medium" as const, baseRoots: 2 },
  { icon: "📓", title: "Journal one page", area: "Mind", difficulty: "easy" as const, baseRoots: 1 },
  { icon: "🌙", title: "Sleep before 11", area: "Rest", difficulty: "hard" as const, baseRoots: 3 },
  { icon: "🚫", title: "No social scrolling", area: "Focus", difficulty: "hard" as const, baseRoots: 3 }
];

function loadState(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved ? { ...defaultState, ...saved, habits: saved.habits || defaultState.habits, societyPosts: saved.societyPosts || defaultState.societyPosts } : defaultState;
  } catch {
    return defaultState;
  }
}

function StillApp() {
  const [state, setState] = useState<State>(loadState);
  const [toast, setToast] = useState("");
  const [draftName, setDraftName] = useState(state.userName);
  const [newHabit, setNewHabit] = useState("");
  const [timerTick, setTimerTick] = useState(0);

  const save = (patch: Partial<State>) => setState((current) => {
    const next = { ...current, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2100);
  };
  const setTab = (tab: Tab) => {
    if (!state.onboarded) return;
    save({ tab });
  };

  useEffect(() => {
    document.body.classList.toggle("normal-mode", state.theme === "normal");
  }, [state.theme]);

  useEffect(() => {
    if (!state.focusActive) return;
    const timer = window.setInterval(() => setTimerTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state.focusActive]);

  useEffect(() => {
    if (!state.focusActive) return;
    if (timerTick > 0 && timerTick % 27 === 0) {
      const next = Math.min(100, state.focusProgress + 2);
      save({ focusProgress: next });
      if (next >= 100) save({ focusActive: false, focusProofPending: true });
    }
  }, [timerTick]);

  const stage = stages.find((item) => state.day <= item.max) || stages[stages.length - 1];
  const pending = state.habits.filter((habit) => !habit.done);
  const firstName = (state.userName || "friend").trim().split(/\s+/)[0];
  const rootPct = Math.min(100, Math.round((state.roots % 500) / 500 * 100));

  const enterApp = () => {
    const name = draftName.trim();
    if (!name) return notify("Add your name first.");
    const tab: Tab = state.dailyState === "heavy" ? "checkin" : state.dailyState === "tiny" ? "habits" : "home";
    save({ onboarded: true, tab, userName: name });
    notify(`Welcome to STILL, ${name.split(/\s+/)[0]}.`);
  };

  const habitRow = (habit: Habit) => (
    <div className={`habit-row ${habit.done ? "done" : ""}`} key={habit.id}>
      <div className="habit-symbol">{habit.done ? "✓" : habit.icon}</div>
      <div>
        <strong className="habit-name">{habit.title}</strong>
        <span className="habit-meta">{habit.area} · {habit.difficulty} · {habit.streak ? `${habit.streak} day repeat` : "No repeat yet"}</span>
        <span className="habit-reward">{habit.done ? `Earned +${habit.lastReward || habit.baseRoots} today` : `Next +${habit.baseRoots} roots`}</span>
      </div>
      <div className="habit-actions">
        {!habit.done && <button className="small-btn" onClick={() => completeHabit(habit)}>✓</button>}
        {habit.done && <button className="icon-mini-btn vanish-btn" onClick={() => save({ habits: state.habits.map((item) => item.id === habit.id ? { ...item, done: false } : item) })}>×</button>}
        <button className="icon-mini-btn delete-habit-btn" onClick={() => save({ habits: state.habits.filter((item) => item.id !== habit.id) })}><span className="icon-trash"></span></button>
      </div>
    </div>
  );

  const completeHabit = (habit: Habit) => {
    save({
      roots: state.roots + habit.baseRoots,
      habits: state.habits.map((item) => item.id === habit.id ? { ...item, done: true, lastCompletedDay: state.day, lastReward: habit.baseRoots, streak: item.streak + 1 } : item)
    });
    notify(`Habit complete. +${habit.baseRoots} roots.`);
  };

  const addHabit = () => {
    const title = newHabit.trim();
    if (!title) return notify("Name the habit first.");
    const roots = state.draftDifficulty === "hard" ? 3 : state.draftDifficulty === "medium" ? 2 : 1;
    save({ habits: [...state.habits, { id: Date.now(), icon: state.draftIcon, title, area: "Custom", difficulty: state.draftDifficulty, baseRoots: roots, streak: 0, lastCompletedDay: null, lastReward: 0, done: false }] });
    setNewHabit("");
    notify("Habit added.");
  };

  const reactToPost = (post: Post, reaction: "like" | "love" | "same" | "proud") => {
    const nextPosts = state.societyPosts.map((item) => {
      if (item.id !== post.id) return item;
      const reactions = { ...item.reactions };
      if (item.reacted) reactions[item.reacted] = Math.max(0, reactions[item.reacted] - 1);
      if (item.reacted === reaction) return { ...item, reacted: null, reactions };
      reactions[reaction] += 1;
      return { ...item, reacted: reaction, reactions };
    });
    save({ societyPosts: nextPosts });
  };

  const depth = depths[state.selectedDepth];
  const remaining = Math.max(0, depth.minutes - Math.round(depth.minutes * state.focusProgress / 100));

  return (
    <main className="shell" aria-label="STILL app">
      <section className="phone-wrap" aria-label="STILL">
        <div className="phone">
          <header className="topbar">
            <button className="icon-btn" aria-label="Settings" onClick={() => setTab("settings")}><span className="icon-settings"></span></button>
            <div><p className="tiny-label">Day <span>{state.day}</span></p><strong>STILL</strong></div>
            <button className="icon-btn" aria-label="Open collection" onClick={() => setTab("collection")}><span className="icon-collection"></span></button>
          </header>

          <div className="screen" tabIndex={-1}>
            {!state.onboarded ? (
              <section>
                <div className="onboarding">
                  <div className="app-mark"><img className="brand-mark-img" src="/assets/still-app-icon.png" alt="STILL app icon" /></div>
                  <p className="eyebrow">STILL</p>
                  <h1>Focus when you can. Feel what you must.</h1>
                  <p className="onboard-copy">A quiet place for focus, habits, check-ins, and hard days.</p>
                </div>
                <div className="section-title"><h2>What should STILL call you?</h2><p>Private to you.</p></div>
                <input className="input" maxLength={24} value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Your name" />
                <div className="section-title"><h2>What kind of day is this?</h2><p>Choose gently.</p></div>
                <div className="state-grid">
                  {(Object.entries(dayStates) as [DayState, typeof dayStates.steady][]).map(([id, item]) => (
                    <button key={id} className={`state-chip ${state.dailyState === id ? "selected" : ""}`} onClick={() => save({ dailyState: id })}>
                      <span>{item.icon}</span><strong>{item.title}</strong><small>{item.copy}</small>
                    </button>
                  ))}
                </div>
                <button className="primary-btn" style={{ marginTop: 16 }} onClick={enterApp}>Enter STILL</button>
              </section>
            ) : state.tab === "home" ? (
              <section>
                <section className="hero-card">
                  <div className="drop-stage"><img className="home-stage-img" src={stage.asset} alt={stage.name} /></div>
                  <div className="stage-title"><h2>Hello, {firstName}</h2><p>{stage.name}. {stage.copy}</p></div>
                  <div className="progress-line"><span style={{ "--pct": `${rootPct}%` } as React.CSSProperties}></span></div>
                  <div className="stat-grid"><div className="stat"><b>{state.roots}</b><small>Roots</small></div><div className="stat"><b>{state.focusMinutes}</b><small>Focus min</small></div><div className="stat"><b>{state.checkins}</b><small>Check-ins</small></div></div>
                </section>
                <section className="pulse-card"><div><span>{dayStates[state.dailyState].icon}</span><strong>{dayStates[state.dailyState].title}</strong><p>{state.dailyState === "heavy" ? "Start with a check-in. Let the app lower the day before it asks for effort." : state.dailyState === "tiny" ? "Pick one small habit. A visible start is enough." : "You have enough steadiness for one clean focus session."}</p></div><button className="small-btn" onClick={() => setTab(state.dailyState === "heavy" ? "checkin" : state.dailyState === "tiny" ? "habits" : "focus")}>Start</button></section>
                <div className="section-title"><h2>What do you need?</h2><p>Choose gently.</p></div>
                <div className="quick-row">
                  <article className="action-card" onClick={() => setTab("focus")}><div className="emoji-badge mint-icon">🌿</div><strong>Focus when you can</strong><p>One protected session. No full-life reset required.</p></article>
                  <article className="action-card" onClick={() => setTab("checkin")}><div className="emoji-badge amber-icon">🌙</div><strong>Feel what you must</strong><p>Name the load, lower the pressure, choose one next step.</p></article>
                </div>
                <article className="society-teaser" onClick={() => setTab("collection")}><div className="emoji-badge amber-icon">📸</div><div><strong>Collection</strong><p>Keep proof photos that become part of your dated progress gallery.</p></div></article>
                <article className="society-teaser" onClick={() => setTab("society")}><div className="emoji-badge blue-icon">✨</div><div><strong>Small hard wins</strong><p>Read quiet posts from people who kept going in difficult moments.</p></div></article>
                <div className="section-title"><h2>Today</h2><p>{pending.length} open</p></div>
                {pending.slice(0, 3).map(habitRow)}
              </section>
            ) : state.tab === "checkin" ? (
              <section>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Check-in</h2><p>Sort the day.</p></div>
                <div className="check-card"><strong>This decides what STILL asks from you next.</strong><p>Use Check-in when the day feels unclear. Name your state and choose one small next step.</p></div>
                <div className="section-title"><h2>Today feels like</h2><p>Be honest.</p></div>
                <div className="state-grid compact">
                  {(Object.entries(dayStates) as [DayState, typeof dayStates.steady][]).map(([id, item]) => <button key={id} className={`state-chip ${state.dailyState === id ? "selected" : ""}`} onClick={() => save({ dailyState: id })}><span>{item.icon}</span><strong>{item.title}</strong><small>{item.copy}</small></button>)}
                </div>
                <div className="slider-wrap"><label><span>Mood</span><b>{state.mood}/100</b></label><input type="range" min="0" max="100" value={state.mood} onChange={(event) => save({ mood: Number(event.target.value) })} /></div>
                <div className="slider-wrap"><label><span>Mental load</span><b>{state.load}/100</b></label><input type="range" min="0" max="100" value={state.load} onChange={(event) => save({ load: Number(event.target.value) })} /></div>
                <textarea className="textarea" placeholder="What feels heavy right now?" />
                <button className="primary-btn" style={{ marginTop: 12 }} onClick={() => { save({ checkins: state.checkins + 1, roots: state.roots + 12 }); notify("Check-in saved. +12 roots."); }}>Save check-in</button>
                <div className="message-card" style={{ marginTop: 12 }}><strong>Suggested next step</strong><p>Make the next move visible. Choose one small action and stay with it for ten quiet minutes.</p></div>
              </section>
            ) : state.tab === "habits" ? (
              <section>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Habits</h2><p>Set today's list.</p></div>
                <div className="message-card"><strong>Add or remove habits before you begin.</strong><p>Tap ✓ after doing the habit. It earns roots and grows your repeat streak.</p></div>
                <div>{state.habits.map(habitRow)}</div>
                <div className="section-title"><h2>Quick add</h2><p>Emoji helps</p></div>
                <div className="template-grid">
                  {habitTemplates.map((template) => <button className="template-btn" key={template.title} onClick={() => save({ habits: [...state.habits, { id: Date.now(), ...template, streak: 0, lastCompletedDay: null, lastReward: 0, done: false }] })}><span>{template.icon}</span><strong>{template.title}</strong><small>{template.difficulty} · +{template.baseRoots}</small></button>)}
                </div>
                <div className="section-title"><h2>Add practice</h2><p>Keep it tiny</p></div>
                <div className="icon-picker">{["🌱", "🌿", "💧", "🌙", "📚", "📓", "🏃", "🧘", "☕", "🚫", "✨"].map((icon) => <button key={icon} className={`icon-choice ${state.draftIcon === icon ? "selected" : ""}`} onClick={() => save({ draftIcon: icon })}>{icon}</button>)}</div>
                <div className="difficulty-grid">
                  {(["easy", "medium", "hard"] as const).map((difficulty) => <button key={difficulty} className={`difficulty-choice ${state.draftDifficulty === difficulty ? "selected" : ""}`} onClick={() => save({ draftDifficulty: difficulty })}><strong>{difficulty[0].toUpperCase() + difficulty.slice(1)}</strong><span>+{difficulty === "hard" ? 3 : difficulty === "medium" ? 2 : 1} root</span></button>)}
                </div>
                <input className="input" maxLength={42} value={newHabit} onChange={(event) => setNewHabit(event.target.value)} placeholder="Example: ten-minute reset walk" />
                <button className="primary-btn" style={{ marginTop: 10 }} onClick={addHabit}>Add habit</button>
              </section>
            ) : state.tab === "focus" ? (
              <section>
                {state.focusActive ? (
                  <><div className="timer-face" style={{ "--timer": `${state.focusProgress}%` } as React.CSSProperties}><div className="timer-inner"><b>{String(remaining).padStart(2, "0")}:00</b><span>{depth.label} session</span></div></div><div className="message-card"><strong>{state.intention}</strong><p>Stay with the named task until the timer ends or you consciously stop.</p></div><div className="button-row" style={{ marginTop: 14 }}><button className="ghost-btn" onClick={() => save({ focusActive: false })}>Pause</button><button className="primary-btn" onClick={() => save({ focusActive: false, focusProofPending: true })}>Complete</button></div><button className="danger-btn" style={{ width: "100%", marginTop: 10 }} onClick={() => save({ focusActive: false, focusProgress: 0, focusProofPending: false })}>End without reward</button></>
                ) : state.focusProofPending ? (
                  <><div className="section-title" style={{ marginTop: 0 }}><h2>Proof</h2><p>Earn the roots.</p></div><div className="proof-card"><div className="emoji-badge mint-icon">📷</div><strong>Upload a quick proof photo.</strong><p>A notebook page, workout screen, tidy desk, book page, or finished task is enough.</p></div><button className="primary-btn" onClick={() => { save({ roots: state.roots + depth.roots, focusProgress: 0, focusProofPending: false, focusMinutes: state.focusMinutes + depth.minutes }); notify(`Proof accepted. +${depth.roots} roots.`); }}>Submit proof & earn +{depth.roots} roots</button></>
                ) : (
                  <><div className="section-title" style={{ marginTop: 0 }}><h2>Focus</h2><p>One task, one block.</p></div><div className="focus-intro"><strong>Focus is for days with enough steadiness to begin.</strong><p>Choose the smallest block your body can actually meet.</p></div><div className="ritual-steps"><div><b>1</b><span>Choose energy</span></div><div><b>2</b><span>Name one task</span></div><div><b>3</b><span>Stay until done</span></div></div><div className="section-title"><h2>Energy today</h2><p>Pick honestly.</p></div><div className="focus-depth-grid">{(Object.entries(depths) as [keyof typeof depths, typeof depths.light][]).map(([id, item]) => <button key={id} className={`focus-choice ${state.selectedDepth === id ? "selected" : ""}`} onClick={() => save({ selectedDepth: id })}><span className="depth-icon">{item.icon}</span><strong>{item.label}</strong><span className="depth-meta">{item.minutes}m</span><span className="depth-roots">+{item.roots} roots</span></button>)}</div><div className="section-title"><h2>One visible task</h2><p>No vague goals.</p></div><input className="input" maxLength={72} value={state.intention} onChange={(event) => save({ intention: event.target.value })} /><button className="primary-btn" style={{ marginTop: 14 }} onClick={() => { save({ focusActive: true, focusProgress: 0, focusProofPending: false }); notify("Focus started."); }}>Start {depth.minutes} minutes</button></>
                )}
              </section>
            ) : state.tab === "society" ? (
              <section>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Society</h2><p>Anonymous posts.</p></div>
                <div className="society-hero"><strong>A quiet anonymous forum for hard days.</strong><p>Share the small hard win, react gently, reply if it helps, and keep the room safe.</p></div>
                <div className="section-title"><h2>Post anonymously</h2><p>Small hard win.</p></div>
                <textarea className="textarea" maxLength={180} value={state.hardWinDraft} onChange={(event) => save({ hardWinDraft: event.target.value })} placeholder="Example: I opened the document and wrote two honest sentences." />
                <button className="primary-btn" style={{ marginTop: 10 }} onClick={() => { if (!state.hardWinDraft.trim()) return notify("Write the small win first."); save({ societyPosts: [{ id: Date.now(), icon: dayStates[state.dailyState].icon, text: state.hardWinDraft.trim(), reactions: { like: 0, love: 0, same: 0, proud: 0 }, reacted: null, comments: [] }, ...state.societyPosts], roots: state.roots + 8, hardWinDraft: "" }); notify("Anonymous post shared. +8 roots."); }}>Post anonymously</button>
                <div className="section-title"><h2>Today in Society</h2><p>{state.societyPosts.length} posts</p></div>
                {state.societyPosts.map((post) => (
                  <article className="society-post" key={post.id}><div className="society-avatar">{post.icon}</div><div><div className="post-head"><strong>Anonymous</strong><span>{post.comments.length} replies</span></div><p>{post.text}</p><div className="reaction-row">{(["like", "love", "same", "proud"] as const).map((reaction) => <button key={reaction} className={`reaction-btn ${post.reacted === reaction ? "selected" : ""}`} onClick={() => reactToPost(post, reaction)}><span>{{ like: "👍", love: "❤️", same: "🤝", proud: "✨" }[reaction]}</span><strong>{reaction[0].toUpperCase() + reaction.slice(1)}</strong><em>{post.reactions[reaction]}</em></button>)}</div></div></article>
                ))}
              </section>
            ) : state.tab === "settings" ? (
              <section>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Settings</h2><p>Make STILL yours.</p></div>
                <section className="settings-card"><strong>Profile</strong><p>Your name personalizes private screens.</p><input className="input" maxLength={24} defaultValue={state.userName} onChange={(event) => save({ userName: event.target.value })} /></section>
                <section className="settings-card"><strong>Appearance</strong><p>Choose the display mood.</p><div className="mode-grid"><button className={`mode-choice ${state.theme === "dark" ? "selected" : ""}`} onClick={() => save({ theme: "dark" })}><span>🌙</span><strong>Dark mode</strong><small>Low-light, calm, focused.</small></button><button className={`mode-choice ${state.theme === "normal" ? "selected" : ""}`} onClick={() => save({ theme: "normal" })}><span>☀️</span><strong>Normal mode</strong><small>Brighter, softer daytime UI.</small></button></div></section>
              </section>
            ) : (
              <section><div className="section-title" style={{ marginTop: 0 }}><h2>Collection</h2><p>Your proof gallery.</p></div><div className="message-card"><strong>Nothing collected yet.</strong><p>Complete focus sessions and habits, then proof photos will appear here.</p></div></section>
            )}
          </div>

          <nav className="tabbar" aria-label="App navigation">
            {([
              ["home", "Home", "home-icon"],
              ["focus", "Focus", "focus-icon"],
              ["checkin", "Check-in", "check-icon"],
              ["habits", "Habits", "habit-icon"],
              ["society", "Society", "society-icon"]
            ] as [Tab, string, string][]).map(([tab, label, icon]) => (
              <button key={tab} className={`tab ${state.tab === tab ? "active" : ""}`} onClick={() => setTab(tab)}><span className={`tab-icon ${icon}`}></span><span>{label}</span></button>
            ))}
          </nav>
        </div>
      </section>
      {toast && <div className="toast show" role="status">{toast}</div>}
    </main>
  );
}

export default StillApp;
