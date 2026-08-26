const STORAGE_KEY = "still_final_app_state_v1";

const defaults = {
  onboarded: false,
  tab: "home",
  userName: "",
  profileNameDraft: "",
  day: 1,
  roots: 0,
  focusMinutes: 0,
  checkins: 0,
  theme: "dark",
  mood: 48,
  load: 62,
  dailyState: "steady",
  selectedDepth: "medium",
  focusActive: false,
  focusProgress: 0,
  focusProofPending: false,
  focusProofName: "",
  focusProofDataUrl: "",
  habitProofPendingId: null,
  habitProofName: "",
  habitProofDataUrl: "",
  intention: "Study without checking my phone",
  supportMode: null,
  hardWinDraft: "",
  draftIcon: "🌱",
  draftDifficulty: "easy",
  lastReflection: "You do not need to fix the whole day. Name one small action and stay with it for ten quiet minutes.",
  collectionReviewQueue: [],
  collectionPhotos: [],
  collectionMonthOffset: 0,
  collectionView: "calendar",
  habits: [
    { id: 1, icon: "🏃", title: "Move my body", area: "Body", difficulty: "medium", baseRoots: 2, streak: 0, lastCompletedDay: null, lastReward: 0, done: false },
    { id: 2, icon: "📚", title: "Read 30 pages", area: "Mind", difficulty: "hard", baseRoots: 3, streak: 0, lastCompletedDay: null, lastReward: 0, done: false },
    { id: 3, icon: "🌙", title: "Sleep before 11", area: "Rest", difficulty: "hard", baseRoots: 3, streak: 0, lastCompletedDay: null, lastReward: 0, done: false }
  ],
  societyPosts: [
    {
      id: 1,
      icon: "🌙",
      text: "I wanted to disappear into scrolling, but I took a shower and answered one message.",
      reactions: { like: 21, love: 8, same: 18, proud: 9 },
      reacted: null,
      comments: [
        { id: 11, text: "This is exactly the kind of win people miss. You came back.", createdAt: "today" },
        { id: 12, text: "The shower part is real. Sometimes that is the restart.", createdAt: "today" }
      ]
    },
    {
      id: 2,
      icon: "🌱",
      text: "Did ten minutes of the assignment. Not finished, but I came back.",
      reactions: { like: 14, love: 5, same: 11, proud: 6 },
      reacted: null,
      comments: [
        { id: 21, text: "Ten minutes counts. Starting again is the hard part.", createdAt: "today" }
      ]
    },
    {
      id: 3,
      icon: "💧",
      text: "Drank water, cried a little, then made my bed. Tiny win, real win.",
      reactions: { like: 26, love: 17, same: 24, proud: 14 },
      reacted: "love",
      comments: []
    }
  ]
};

let state = loadState();
let timer = null;

const screen = document.querySelector("#screen");
const tabs = Array.from(document.querySelectorAll(".tab"));
const toast = document.querySelector("#toast");
const dayCount = document.querySelector("#dayCount");

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
  { name: "Seed Drop", max: 7, asset: "./assets/still-logo-stage-1.png", copy: "Quiet beginning. Roots forming." },
  { name: "Rooted Drop", max: 29, asset: "./assets/still-logo-stage-2.png", copy: "Your roots are becoming visible." },
  { name: "First Leaves", max: 89, asset: "./assets/still-logo-stage-3.png", copy: "New life is starting to show." },
  { name: "Small Plant", max: 179, asset: "./assets/still-logo-stage-4.png", copy: "The practice is growing into something real." },
  { name: "Still Tree", max: 9999, asset: "./assets/still-logo-stage-5.png", copy: "Rooted, alive, and still becoming." }
];

const habitTemplates = [
  { icon: "🏃", title: "Move my body", area: "Body", difficulty: "medium", baseRoots: 2 },
  { icon: "💧", title: "Drink water", area: "Body", difficulty: "easy", baseRoots: 1 },
  { icon: "📚", title: "Read 20 pages", area: "Mind", difficulty: "medium", baseRoots: 2 },
  { icon: "📓", title: "Journal one page", area: "Mind", difficulty: "easy", baseRoots: 1 },
  { icon: "🌙", title: "Sleep before 11", area: "Rest", difficulty: "hard", baseRoots: 3 },
  { icon: "🚫", title: "No social scrolling", area: "Focus", difficulty: "hard", baseRoots: 3 }
];

const iconChoices = ["🌱", "🌿", "💧", "🌙", "📚", "📓", "🏃", "🧘", "☕", "🎧", "🚫", "✨"];
const societyReactions = {
  like: { label: "Like", icon: "👍" },
  love: { label: "Love", icon: "❤️" },
  same: { label: "Same", icon: "🤝" },
  proud: { label: "Proud", icon: "✨" }
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const merged = saved ? { ...structuredClone(defaults), ...saved } : structuredClone(defaults);
    if (merged.tab === "talk" || merged.tab === "support") merged.tab = "society";
    merged.userName = merged.userName || "";
    merged.profileNameDraft = merged.profileNameDraft || merged.userName || "";
    if (merged.onboarded && !merged.userName) merged.onboarded = false;
    merged.focusProofDataUrl = merged.focusProofDataUrl || "";
    merged.habitProofPendingId = merged.habitProofPendingId || null;
    merged.habitProofName = merged.habitProofName || "";
    merged.habitProofDataUrl = merged.habitProofDataUrl || "";
    merged.collectionReviewQueue = Array.isArray(merged.collectionReviewQueue) ? merged.collectionReviewQueue : [];
    merged.collectionPhotos = Array.isArray(merged.collectionPhotos) ? merged.collectionPhotos : [];
    merged.collectionMonthOffset = Number(merged.collectionMonthOffset || 0);
    merged.collectionView = merged.collectionView === "gallery" ? "gallery" : "calendar";
    merged.societyPosts = merged.societyPosts || structuredClone(defaults.societyPosts);
    merged.societyPosts = merged.societyPosts.map(normalizeSocietyPost);
    merged.habits = merged.habits.map((habit) => {
      const inferred = inferHabitIcon(habit.title);
      const shouldInfer = !habit.icon || (habit.icon === "🌱" && inferred !== "🌱");
      const difficulty = habit.difficulty || inferHabitDifficulty(habit.title);
      const baseRoots = habitBaseReward({ difficulty });
      return {
        ...habit,
        icon: shouldInfer ? inferred : habit.icon,
        difficulty,
        baseRoots,
        streak: Number(habit.streak || (habit.done ? 1 : 0)),
        lastCompletedDay: habit.lastCompletedDay ?? (habit.done ? merged.day : null),
        lastReward: Number(habit.lastReward || (habit.done ? baseRoots : 0)),
        hiddenDay: habit.hiddenDay ?? null
      };
    });
    return merged;
  } catch {
    return structuredClone(defaults);
  }
}

function inferHabitDifficulty(title = "") {
  const text = title.toLowerCase();
  if (text.includes("sleep") || text.includes("social") || text.includes("scroll") || text.includes("run") || text.includes("workout")) {
    return "hard";
  }
  if (text.includes("read") || text.includes("journal") || text.includes("write") || text.includes("move") || text.includes("walk")) {
    return "medium";
  }
  return "easy";
}

function habitBaseReward(habit) {
  if (habit.difficulty === "hard") return 3;
  if (habit.difficulty === "medium") return 2;
  return 1;
}

function nextHabitReward(habit) {
  if (habit.lastCompletedDay === state.day) return 0;
  const base = Number(habit.baseRoots || habitBaseReward(habit));
  if (habit.lastCompletedDay === state.day - 1) {
    return base + Number(habit.streak || 0);
  }
  return base;
}

function habitDifficultyLabel(habit) {
  if (habit.difficulty === "hard") return "Hard";
  if (habit.difficulty === "medium") return "Medium";
  return "Easy";
}

function inferHabitIcon(title = "") {
  const text = title.toLowerCase();
  if (text.includes("move") || text.includes("run") || text.includes("walk") || text.includes("body")) return "🏃";
  if (text.includes("read") || text.includes("book") || text.includes("page")) return "📚";
  if (text.includes("sleep") || text.includes("rest")) return "🌙";
  if (text.includes("water") || text.includes("drink")) return "💧";
  if (text.includes("journal") || text.includes("write")) return "📓";
  if (text.includes("social") || text.includes("scroll") || text.includes("phone")) return "🚫";
  if (text.includes("meditat") || text.includes("breathe")) return "🧘";
  return "🌱";
}

function normalizeSocietyPost(post) {
  const legacyHeld = Number(post.roots || 0);
  const reactions = post.reactions || {
    like: legacyHeld,
    love: 0,
    same: legacyHeld,
    proud: post.held ? 1 : 0
  };
  return {
    id: post.id,
    icon: post.icon || "🌱",
    text: post.text || "",
    reactions: {
      like: Number(reactions.like ?? reactions.here ?? 0),
      love: Number(reactions.love || 0),
      same: Number(reactions.same || 0),
      proud: Number(reactions.proud || 0)
    },
    reacted: post.reacted === "here" ? "like" : post.reacted || null,
    comments: Array.isArray(post.comments) ? post.comments : [],
    replyDraft: post.replyDraft || ""
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setState(patch) {
  state = { ...state, ...patch };
  saveState();
  render();
}

function applyTheme() {
  document.body.classList.toggle("normal-mode", state.theme === "normal");
}

function displayName() {
  return (state.userName || state.profileNameDraft || "friend").trim();
}

function firstName() {
  return displayName().split(/\s+/)[0] || "friend";
}

function proofDateLabel(date = new Date()) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function makeFocusProofItem(depth) {
  if (!state.focusProofDataUrl) return null;
  const now = new Date();
  return {
    id: now.getTime(),
    kind: "Focus",
    image: state.focusProofDataUrl,
    name: state.focusProofName || "Proof photo",
    task: state.intention || "Focus session",
    depth: depth.label,
    roots: depth.roots,
    day: state.day,
    date: proofDateLabel(now),
    createdAt: now.toISOString()
  };
}

function makeHabitProofItem(habit, reward) {
  if (!state.habitProofDataUrl) return null;
  const now = new Date();
  return {
    id: now.getTime(),
    kind: "Habit",
    image: state.habitProofDataUrl,
    name: state.habitProofName || "Habit proof photo",
    task: habit.title,
    depth: habitDepthLabel(habit),
    roots: reward,
    day: state.day,
    date: proofDateLabel(now),
    createdAt: now.toISOString()
  };
}

function habitDepthLabel(habit) {
  if (habit.difficulty === "hard") return "Deep";
  if (habit.difficulty === "medium") return "Medium";
  return "Light";
}

function readProofImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Not an image"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(String(reader.result));
      img.onload = () => {
        const maxSize = 960;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(String(reader.result));
          return;
        }
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(notify._t);
  notify._t = window.setTimeout(() => toast.classList.remove("show"), 2100);
}

function getStage() {
  return stages.find((stage) => state.day <= stage.max) || stages[stages.length - 1];
}

function rootPct() {
  return Math.min(100, Math.round((state.roots % 500) / 500 * 100));
}

function setTab(tab) {
  if (!state.onboarded) return;
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
  state.tab = tab;
  saveState();
  render();
}

function render() {
  const shouldResetScroll = render._lastTab !== state.tab || render._lastOnboarded !== state.onboarded;
  applyTheme();
  dayCount.textContent = String(state.day);
  tabs.forEach((tab) => tab.classList.toggle("active", state.onboarded && tab.dataset.tab === state.tab));

  if (!state.onboarded) {
    renderOnboarding();
    if (shouldResetScroll) screen.scrollTop = 0;
    render._lastTab = state.tab;
    render._lastOnboarded = state.onboarded;
    return;
  }

  if (state.tab === "home") renderHome();
  if (state.tab === "focus") renderFocus();
  if (state.tab === "checkin") renderCheckin();
  if (state.tab === "habits") renderHabits();
  if (state.tab === "society") renderSociety();
  if (state.tab === "collection") renderCollection();
  if (state.tab === "settings") renderSettings();

  if (shouldResetScroll) screen.scrollTop = 0;
  render._lastTab = state.tab;
  render._lastOnboarded = state.onboarded;
}

function renderOnboarding() {
  screen.innerHTML = `
    <section class="onboarding">
      <div class="app-mark"><img class="brand-mark-img" src="./assets/still-app-icon.png" alt="STILL app icon"></div>
      <p class="eyebrow">STILL</p>
      <h1>Focus when you can. Feel what you must.</h1>
      <p class="onboard-copy">A quiet place for focus, habits, check-ins, and hard days.</p>
    </section>

    <div class="section-title">
      <h2>What should STILL call you?</h2>
      <p>Private to you.</p>
    </div>
    <input class="input" id="userNameInput" maxlength="24" value="${escapeAttr(state.profileNameDraft || state.userName || "")}" placeholder="Your name">

    <div class="section-title">
      <h2>What kind of day is this?</h2>
      <p>Choose gently.</p>
    </div>
    <div class="state-grid">
      ${Object.entries(dayStates).map(([id, item]) => `
        <button class="state-chip ${state.dailyState === id ? "selected" : ""}" data-day-state="${id}">
          <span>${item.icon}</span>
          <strong>${item.title}</strong>
          <small>${item.copy}</small>
        </button>
      `).join("")}
    </div>

    <button class="primary-btn" id="enterApp" style="margin-top:16px">Enter STILL</button>
  `;

  screen.querySelectorAll("[data-day-state]").forEach((btn) => {
    btn.addEventListener("click", () => setState({ dailyState: btn.dataset.dayState }));
  });
  screen.querySelector("#userNameInput").addEventListener("input", (event) => {
    state.profileNameDraft = event.target.value;
    saveState();
  });
  screen.querySelector("#enterApp").addEventListener("click", () => {
    const name = screen.querySelector("#userNameInput").value.trim();
    if (!name) return notify("Add your name first.");
    const tab = state.dailyState === "heavy" ? "checkin" : state.dailyState === "tiny" ? "habits" : "home";
    setState({ onboarded: true, tab, userName: name, profileNameDraft: name });
    notify(`Welcome to STILL, ${firstName()}.`);
  });
}

function renderHome() {
  const stage = getStage();
  const pending = state.habits.filter((habit) => !habit.done);
  const today = dayStates[state.dailyState] || dayStates.steady;

  screen.innerHTML = `
    <section class="hero-card">
      <div class="drop-stage">
        <img class="home-stage-img" src="${stage.asset}" alt="${escapeAttr(stage.name)} home mark">
      </div>
      <div class="stage-title">
        <h2>Hello, ${escapeHtml(firstName())}</h2>
        <p>${stage.name}. ${stage.copy}</p>
      </div>
      <div class="progress-line" aria-label="Root progress">
        <span style="--pct:${rootPct()}%"></span>
      </div>
      <div class="stat-grid">
        <div class="stat"><b>${state.roots}</b><small>Roots</small></div>
        <div class="stat"><b>${state.focusMinutes}</b><small>Focus min</small></div>
        <div class="stat"><b>${state.checkins}</b><small>Check-ins</small></div>
      </div>
    </section>

    ${renderCollectionReviewCard()}

    <section class="pulse-card">
      <div>
        <span>${today.icon}</span>
        <strong>${today.title}</strong>
        <p>${homePrompt()}</p>
      </div>
      <button class="small-btn" data-go="${state.dailyState === "heavy" ? "checkin" : state.dailyState === "tiny" ? "habits" : "focus"}">Start</button>
    </section>

    <div class="section-title">
      <h2>What do you need?</h2>
      <p>Choose gently.</p>
    </div>
    <div class="quick-row">
      <article class="action-card" data-go="focus">
        <div class="emoji-badge mint-icon" aria-hidden="true">🌿</div>
        <strong>Focus when you can</strong>
        <p>One protected session. No full-life reset required.</p>
      </article>
      <article class="action-card" data-go="checkin">
        <div class="emoji-badge amber-icon" aria-hidden="true">🌙</div>
        <strong>Feel what you must</strong>
        <p>Name the load, lower the pressure, choose one next step.</p>
      </article>
    </div>

    <article class="society-teaser" data-go="collection">
      <div class="emoji-badge amber-icon" aria-hidden="true">📸</div>
      <div>
        <strong>Collection</strong>
        <p>Keep the proof photos that deserve to become part of your dated progress gallery.</p>
      </div>
    </article>

    <article class="society-teaser" data-go="society">
      <div class="emoji-badge blue-icon" aria-hidden="true">✨</div>
      <div>
        <strong>Small hard wins</strong>
        <p>Read quiet posts from people who kept going in ordinary, difficult moments.</p>
      </div>
    </article>

    <div class="section-title">
      <h2>Today</h2>
      <p>${pending.length} open</p>
    </div>
    <div>
      ${pending.slice(0, 3).map(habitRow).join("") || `<div class="message-card"><strong>Clear day.</strong><p>You finished the visible load. Let the app stay quiet now.</p></div>`}
    </div>
  `;

  screen.querySelectorAll("[data-go]").forEach((el) => {
    el.addEventListener("click", () => setTab(el.dataset.go));
  });
  bindHabitButtons();
  bindCollectionButtons();
}

function homePrompt() {
  if (state.dailyState === "heavy") return "Start with a check-in. Let the app lower the day before it asks for effort.";
  if (state.dailyState === "tiny") return "Pick one small habit. A visible start is enough.";
  return "You have enough steadiness for one clean focus session.";
}

function renderFocus() {
  const depth = depths[state.selectedDepth];

  if (state.focusActive) {
    if (state.focusProofPending) {
      screen.innerHTML = `
        <div class="section-title" style="margin-top:0">
          <h2>Proof</h2>
          <p>Earn the roots.</p>
        </div>
        <div class="proof-card">
          <div class="emoji-badge mint-icon" aria-hidden="true">📷</div>
          <strong>Upload a quick proof photo.</strong>
          <p>STILL gives the reward after proof, not after a tap. A notebook page, workout screen, tidy desk, book page, or finished task photo is enough.</p>
        </div>
        <label class="file-upload" for="focusProof">
          <span>${state.focusProofName ? "Change photo" : "Choose proof photo"}</span>
          <input id="focusProof" type="file" accept="image/*">
        </label>
        ${state.focusProofDataUrl ? `<img class="proof-preview" src="${escapeAttr(state.focusProofDataUrl)}" alt="Selected proof photo">` : ""}
        <div class="proof-name">${state.focusProofName ? escapeHtml(state.focusProofName) : "No photo selected yet."}</div>
        <button class="primary-btn" id="submitProof" style="margin-top:12px" ${state.focusProofDataUrl ? "" : "disabled"}>Submit proof & earn +${depth.roots} roots</button>
        <button class="ghost-btn" id="backToTimer" style="width:100%;margin-top:10px">Back to timer</button>
        <button class="danger-btn" id="quitFocus" style="width:100%;margin-top:10px">End without reward</button>
      `;
      screen.querySelector("#focusProof").addEventListener("change", (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        readProofImage(file)
          .then((dataUrl) => {
            state.focusProofName = file.name;
            state.focusProofDataUrl = dataUrl;
            saveState();
            renderFocus();
          })
          .catch(() => notify("Choose a valid image file."));
      });
      screen.querySelector("#submitProof").addEventListener("click", () => {
        if (!state.focusProofDataUrl) return notify("Upload a proof photo first.");
        finishFocus();
      });
      screen.querySelector("#backToTimer").addEventListener("click", () => {
        setState({ focusProofPending: false, focusProofName: "", focusProofDataUrl: "" });
      });
      screen.querySelector("#quitFocus").addEventListener("click", () => {
        setState({ focusActive: false, focusProgress: 0, focusProofPending: false, focusProofName: "", focusProofDataUrl: "" });
        notify("Stopped. No reward without proof.");
      });
      return;
    }

    const remaining = Math.max(0, depth.minutes - Math.round(depth.minutes * state.focusProgress / 100));
    screen.innerHTML = `
      <div class="timer-face" style="--timer:${state.focusProgress}%">
        <div class="timer-inner">
          <b>${String(remaining).padStart(2, "0")}:00</b>
          <span>${depth.label} session</span>
        </div>
      </div>
      <div class="message-card">
        <strong>${escapeHtml(state.intention || "Stay with one thing")}</strong>
        <p>This block has one job: protect your attention from becoming a negotiation. Stay with the named task until the timer ends or you consciously stop.</p>
      </div>
      <div class="button-row" style="margin-top:14px">
        <button class="ghost-btn" id="pauseFocus">Pause</button>
        <button class="primary-btn" id="finishFocus">Complete</button>
      </div>
      <button class="danger-btn" id="quitFocus" style="width:100%;margin-top:10px">End without reward</button>
    `;
    screen.querySelector("#pauseFocus").addEventListener("click", () => {
      setState({ focusActive: false });
      notify("Session paused.");
    });
    screen.querySelector("#finishFocus").addEventListener("click", requestFocusProof);
    screen.querySelector("#quitFocus").addEventListener("click", () => {
      setState({ focusActive: false, focusProgress: 0, focusProofPending: false, focusProofName: "", focusProofDataUrl: "" });
      notify("Stopped. No shame, just data.");
    });
    startFocusTimer();
    return;
  }

  screen.innerHTML = `
    <div class="section-title" style="margin-top:0">
      <h2>Focus</h2>
      <p>One task, one block.</p>
    </div>
    <div class="focus-intro">
      <strong>Focus is for days with enough steadiness to begin.</strong>
      <p>Choose the smallest block your body can actually meet. STILL protects the session, rewards completion, and never pretends one timer fixes your whole life.</p>
    </div>

    <div class="ritual-steps" aria-label="Focus flow">
      <div><b>1</b><span>Choose energy</span></div>
      <div><b>2</b><span>Name one task</span></div>
      <div><b>3</b><span>Stay until done</span></div>
    </div>

    <div class="section-title">
      <h2>Energy today</h2>
      <p>Pick honestly.</p>
    </div>
    <div class="focus-depth-grid">
      ${Object.entries(depths).map(([id, item]) => `
        <button class="focus-choice ${state.selectedDepth === id ? "selected" : ""}" data-depth="${id}">
          <span class="depth-icon" aria-hidden="true">${item.icon}</span>
          <strong>${item.label}</strong>
          <span class="depth-meta">${item.minutes}m</span>
          <span class="depth-roots">+${item.roots} roots</span>
        </button>
      `).join("")}
    </div>

    <div class="section-title">
      <h2>One visible task</h2>
      <p>No vague goals.</p>
    </div>
    <input class="input" id="intention" maxlength="72" value="${escapeAttr(state.intention)}" placeholder="Example: outline biology notes">

    <button class="primary-btn" id="beginFocus" style="margin-top:14px">Start ${depth.minutes} minutes</button>
  `;

  screen.querySelectorAll("[data-depth]").forEach((btn) => {
    btn.addEventListener("click", () => setState({ selectedDepth: btn.dataset.depth }));
  });
  screen.querySelector("#intention").addEventListener("input", (event) => {
    state.intention = event.target.value;
    saveState();
  });
  screen.querySelector("#beginFocus").addEventListener("click", () => {
    setState({ focusActive: true, focusProgress: 0, focusProofName: "", focusProofDataUrl: "" });
    notify("Focus started.");
  });
}

function renderCheckin() {
  const modes = [
    ["listen", "🌙 Listen", "I just need to be heard."],
    ["encourage", "☀️ Encourage", "I need a gentle push."],
    ["reflect", "🍃 Reflect", "Help me think clearly."]
  ];

  screen.innerHTML = `
    <div class="section-title" style="margin-top:0">
      <h2>Check-in</h2>
      <p>Sort the day.</p>
    </div>
    <div class="check-card">
      <strong>This decides what STILL asks from you next.</strong>
      <p>Use Check-in when the day feels unclear. It names your state, lowers the pressure, and turns the next step into something small enough to do.</p>
    </div>

    <div class="section-title">
      <h2>Today feels like</h2>
      <p>Be honest.</p>
    </div>
    <div class="state-grid compact">
      ${Object.entries(dayStates).map(([id, item]) => `
        <button class="state-chip ${state.dailyState === id ? "selected" : ""}" data-day-state="${id}">
          <span>${item.icon}</span>
          <strong>${item.title}</strong>
          <small>${item.copy}</small>
        </button>
      `).join("")}
    </div>

    <div class="slider-wrap">
      <label for="moodRange"><span>Mood</span><b>${state.mood}/100</b></label>
      <input id="moodRange" type="range" min="0" max="100" value="${state.mood}">
    </div>
    <div class="slider-wrap">
      <label for="loadRange"><span>Mental load</span><b>${state.load}/100</b></label>
      <input id="loadRange" type="range" min="0" max="100" value="${state.load}">
    </div>
    <textarea class="textarea" id="checkNote" placeholder="What feels heavy right now?"></textarea>
    <button class="primary-btn" id="saveCheck" style="margin-top:12px">Save check-in</button>
    <div class="message-card" style="margin-top:12px">
      <strong>Suggested next step</strong>
      <p>${escapeHtml(suggestNextStep())}</p>
    </div>
    <div class="section-title">
      <h2>Need support?</h2>
      <p>Choose a tone.</p>
    </div>
    <div class="safety-note">
      STILL can help you reflect, but it is not emergency care. If you may hurt yourself or someone else, contact local emergency support now.
    </div>
    ${modes.map(([id, title, copy]) => `
      <button class="support-mode" data-mode="${id}">
        <strong>${title}</strong>
        <span>${copy}</span>
      </button>
    `).join("")}
    ${state.supportMode ? `<div class="message-card" style="margin-top:12px">
      <strong>Current reflection</strong>
      <p>${escapeHtml(state.lastReflection)}</p>
    </div>` : ""}
  `;
  screen.querySelectorAll("[data-day-state]").forEach((btn) => {
    btn.addEventListener("click", () => setState({ dailyState: btn.dataset.dayState }));
  });
  screen.querySelector("#moodRange").addEventListener("input", (event) => {
    state.mood = Number(event.target.value);
    saveState();
    renderCheckin();
  });
  screen.querySelector("#loadRange").addEventListener("input", (event) => {
    state.load = Number(event.target.value);
    saveState();
    renderCheckin();
  });
  screen.querySelector("#saveCheck").addEventListener("click", () => {
    setState({
      checkins: state.checkins + 1,
      roots: state.roots + 12,
      lastReflection: suggestNextStep()
    });
    notify("Check-in saved. +12 roots.");
  });
  screen.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = supportResponse(btn.dataset.mode);
      setState({ supportMode: btn.dataset.mode, lastReflection: text, roots: state.roots + 5 });
      notify("Reflection saved. +5 roots.");
    });
  });
}

function renderHabits() {
  const habitProof = state.habits.find((habit) => habit.id === Number(state.habitProofPendingId));
  if (habitProof) {
    const reward = nextHabitReward(habitProof);
    screen.innerHTML = `
      <div class="section-title" style="margin-top:0">
        <h2>Habit proof</h2>
        <p>Earn the roots.</p>
      </div>
      <div class="proof-card">
        <div class="emoji-badge mint-icon" aria-hidden="true">${escapeHtml(habitProof.icon || "🌱")}</div>
        <strong>Upload proof for “${escapeHtml(habitProof.title)}”.</strong>
        <p>Choose a relevant picture that shows the habit happened. Roots unlock after proof, not after a tap.</p>
      </div>
      <label class="file-upload" for="habitProof">
        <span>${state.habitProofName ? "Change photo" : "Choose habit proof photo"}</span>
        <input id="habitProof" type="file" accept="image/*">
      </label>
      ${state.habitProofDataUrl ? `<img class="proof-preview" src="${escapeAttr(state.habitProofDataUrl)}" alt="Selected habit proof photo">` : ""}
      <div class="proof-name">${state.habitProofName ? escapeHtml(state.habitProofName) : "No photo selected yet."}</div>
      <button class="primary-btn" id="submitHabitProof" style="margin-top:12px" ${state.habitProofDataUrl ? "" : "disabled"}>Submit proof & earn +${reward} roots</button>
      <button class="ghost-btn" id="cancelHabitProof" style="width:100%;margin-top:10px">Back to habits</button>
    `;

    screen.querySelector("#habitProof").addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      readProofImage(file)
        .then((dataUrl) => {
          state.habitProofName = file.name;
          state.habitProofDataUrl = dataUrl;
          saveState();
          renderHabits();
        })
        .catch(() => notify("Choose a valid image file."));
    });
    screen.querySelector("#submitHabitProof").addEventListener("click", () => {
      if (!state.habitProofDataUrl) return notify("Upload a relevant proof photo first.");
      completeHabitWithProof(habitProof.id);
    });
    screen.querySelector("#cancelHabitProof").addEventListener("click", () => {
      setState({ habitProofPendingId: null, habitProofName: "", habitProofDataUrl: "" });
    });
    return;
  }

  const visibleHabits = state.habits.filter((habit) => habit.hiddenDay !== state.day);
  screen.innerHTML = `
    <div class="section-title" style="margin-top:0">
      <h2>Habits</h2>
      <p>Set today's list.</p>
    </div>
    <div class="message-card">
      <strong>Add or remove habits before you begin.</strong>
      <p>Tap ✓ only after doing the habit. STILL will ask for a relevant proof photo before roots are earned.</p>
    </div>
    <div id="habitList">
      ${visibleHabits.map(habitRow).join("") || `<div class="message-card"><strong>All clear for today.</strong><p>Completed habits vanish after you dismiss them. They return on the next app day.</p></div>`}
    </div>
    <div class="section-title">
      <h2>Quick add</h2>
      <p>Emoji helps</p>
    </div>
    <div class="template-grid">
      ${habitTemplates.map((template, index) => `
        <button class="template-btn" data-template="${index}">
          <span>${template.icon}</span>
          <strong>${escapeHtml(template.title)}</strong>
          <small>${habitDifficultyLabel(template)} · +${template.baseRoots}</small>
        </button>
      `).join("")}
    </div>
    <div class="section-title">
      <h2>Add practice</h2>
      <p>Keep it tiny</p>
    </div>
    <div class="icon-picker" aria-label="Choose habit emoji">
      ${iconChoices.map((icon) => `
        <button class="icon-choice ${state.draftIcon === icon ? "selected" : ""}" data-icon="${icon}" aria-label="Use ${icon}">${icon}</button>
      `).join("")}
    </div>
    <div class="difficulty-grid" aria-label="Choose habit difficulty">
      <button class="difficulty-choice ${state.draftDifficulty === "easy" ? "selected" : ""}" data-difficulty="easy">
        <strong>Easy</strong>
        <span>+1 root</span>
      </button>
      <button class="difficulty-choice ${state.draftDifficulty === "medium" ? "selected" : ""}" data-difficulty="medium">
        <strong>Medium</strong>
        <span>+2 roots</span>
      </button>
      <button class="difficulty-choice ${state.draftDifficulty === "hard" ? "selected" : ""}" data-difficulty="hard">
        <strong>Hard</strong>
        <span>+3 roots</span>
      </button>
    </div>
    <input class="input" id="newHabit" maxlength="42" placeholder="Example: ten-minute reset walk">
    <button class="primary-btn" id="addHabit" style="margin-top:10px">Add habit</button>
  `;
  bindHabitButtons();
  screen.querySelectorAll("[data-template]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const template = habitTemplates[Number(btn.dataset.template)];
      state.habits.push({ id: Date.now(), ...template, streak: 0, lastCompletedDay: null, lastReward: 0, done: false });
      saveState();
      renderHabits();
      notify(`${template.icon} Habit added.`);
    });
  });
  screen.querySelectorAll("[data-icon]").forEach((btn) => {
    btn.addEventListener("click", () => setState({ draftIcon: btn.dataset.icon }));
  });
  screen.querySelectorAll("[data-difficulty]").forEach((btn) => {
    btn.addEventListener("click", () => setState({ draftDifficulty: btn.dataset.difficulty }));
  });
  screen.querySelector("#addHabit").addEventListener("click", () => {
    const input = screen.querySelector("#newHabit");
    const title = input.value.trim();
    if (!title) return notify("Name the habit first.");
    const difficulty = state.draftDifficulty;
    state.habits.push({
      id: Date.now(),
      icon: state.draftIcon,
      title,
      area: "Custom",
      difficulty,
      baseRoots: habitBaseReward({ difficulty }),
      streak: 0,
      lastCompletedDay: null,
      lastReward: 0,
      done: false
    });
    saveState();
    renderHabits();
    notify("Habit added.");
  });
}

function renderSociety() {
  screen.innerHTML = `
    <div class="section-title" style="margin-top:0">
      <h2>Society</h2>
      <p>Anonymous posts.</p>
    </div>
    <div class="society-hero">
      <strong>A quiet anonymous forum for hard days.</strong>
      <p>Post like Reddit, but without usernames, profiles, or pressure. Share the small hard win, react gently, reply if it helps, and keep the room safe.</p>
    </div>

    <div class="section-title">
      <h2>Post anonymously</h2>
      <p>Small hard win.</p>
    </div>
    <textarea class="textarea" id="hardWin" maxlength="180" placeholder="Example: I opened the document and wrote two honest sentences.">${escapeHtml(state.hardWinDraft || "")}</textarea>
    <button class="primary-btn" id="postWin" style="margin-top:10px">Post anonymously</button>

    <div class="section-title">
      <h2>Today in Society</h2>
      <p>${state.societyPosts.length} posts</p>
    </div>
    ${state.societyPosts.map(societyPost).join("")}
  `;

  screen.querySelector("#hardWin").addEventListener("input", (event) => {
    state.hardWinDraft = event.target.value;
    saveState();
  });
  screen.querySelector("#postWin").addEventListener("click", () => {
    const text = screen.querySelector("#hardWin").value.trim();
    if (!text) return notify("Write the small win first.");
    state.societyPosts.unshift({
      id: Date.now(),
      icon: dayStates[state.dailyState]?.icon || "🌱",
      text,
      reactions: { like: 0, love: 0, same: 0, proud: 0 },
      reacted: null,
      comments: [],
      replyDraft: ""
    });
    state.hardWinDraft = "";
    state.roots += 8;
    saveState();
    renderSociety();
    notify("Anonymous post shared. +8 roots.");
  });
  screen.querySelectorAll("[data-react]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const post = state.societyPosts.find((item) => item.id === Number(btn.dataset.post));
      if (!post) return;
      post.reactions = post.reactions || { like: 0, love: 0, same: 0, proud: 0 };
      const reaction = btn.dataset.react;
      if (post.reacted === reaction) {
        post.reactions[reaction] = Math.max(0, Number(post.reactions[reaction] || 0) - 1);
        post.reacted = null;
      } else {
        if (post.reacted) {
          post.reactions[post.reacted] = Math.max(0, Number(post.reactions[post.reacted] || 0) - 1);
        }
        post.reactions[reaction] = Number(post.reactions[reaction] || 0) + 1;
        post.reacted = reaction;
      }
      saveState();
      renderSociety();
      notify(post.reacted ? "Reacted anonymously." : "Reaction removed.");
    });
  });
  screen.querySelectorAll("[data-reply-input]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const post = state.societyPosts.find((item) => item.id === Number(input.dataset.replyInput));
      if (!post) return;
      post.replyDraft = event.target.value;
      saveState();
    });
  });
  screen.querySelectorAll("[data-reply]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const post = state.societyPosts.find((item) => item.id === Number(btn.dataset.reply));
      if (!post) return;
      const text = (post.replyDraft || "").trim();
      if (!text) return notify("Write a reply first.");
      post.comments = post.comments || [];
      post.comments.push({ id: Date.now(), text, createdAt: "now" });
      post.replyDraft = "";
      state.roots += 3;
      saveState();
      renderSociety();
      notify("Anonymous reply posted. +3 roots.");
    });
  });
}

function societyPost(post) {
  const comments = post.comments || [];
  const reactions = post.reactions || { like: 0, love: 0, same: 0, proud: 0 };
  return `
    <article class="society-post">
      <div class="society-avatar" aria-hidden="true">${escapeHtml(post.icon || "🌱")}</div>
      <div>
        <div class="post-head">
          <strong>Anonymous</strong>
          <span>${comments.length} ${comments.length === 1 ? "reply" : "replies"}</span>
        </div>
        <p>${escapeHtml(post.text)}</p>
        <div class="reaction-row" aria-label="Anonymous reactions">
          ${Object.entries(societyReactions).map(([id, reaction]) => `
            <button class="reaction-btn ${post.reacted === id ? "selected" : ""}" data-post="${post.id}" data-react="${id}">
              <span>${reaction.icon}</span>
              <strong>${reaction.label}</strong>
              <em>${Number(reactions[id] || 0)}</em>
            </button>
          `).join("")}
        </div>
        <div class="comment-list">
          ${comments.map((comment) => `
            <div class="comment">
              <strong>Anonymous</strong>
              <p>${escapeHtml(comment.text)}</p>
            </div>
          `).join("")}
        </div>
        <div class="reply-box">
          <input class="input" data-reply-input="${post.id}" maxlength="120" value="${escapeAttr(post.replyDraft || "")}" placeholder="Reply anonymously...">
          <button class="ghost-btn" data-reply="${post.id}">Reply</button>
        </div>
      </div>
    </article>
  `;
}

function renderCollection() {
  const month = collectionMonthInfo();
  screen.innerHTML = `
    <div class="section-title" style="margin-top:0">
      <h2>Collection</h2>
      <p>${state.collectionPhotos.length} kept</p>
    </div>
    <div class="collection-hero calendar-style">
      <strong>${month.total} ${month.total === 1 ? "memory" : "memories"} collected this month</strong>
      <p>Proof photos become private memories only when you choose to keep them.</p>
      <div class="collection-switch" aria-label="Collection view">
        <button class="${state.collectionView === "calendar" ? "selected" : ""}" data-collection-view="calendar">Calendar</button>
        <button class="${state.collectionView === "gallery" ? "selected" : ""}" data-collection-view="gallery">Gallery</button>
      </div>
    </div>

    ${state.collectionReviewQueue.length ? `
      <div class="section-title">
        <h2>End-of-day review</h2>
        <p>${state.collectionReviewQueue.length} waiting</p>
      </div>
      ${state.collectionReviewQueue.map(renderCollectionReviewCard).join("")}
    ` : ""}

    ${state.collectionView === "calendar" ? `<section class="collection-calendar">
      <div class="month-switch">
        <button class="icon-mini-btn" data-month-step="-1" aria-label="Previous month">‹</button>
        <div>
          <strong>${escapeHtml(month.label)}</strong>
          <span>${month.year}</span>
        </div>
        <button class="icon-mini-btn" data-month-step="1" aria-label="Next month">›</button>
      </div>
      <div class="memory-line">
        <div><b>${month.total}</b><span>memories</span></div>
        <div class="depth-legend">
          ${Object.entries(depths).map(([id, item]) => `
            <span class="${id}">
              <i>${item.icon}</i>
              ${month.depthCounts[item.label] || 0}
            </span>
          `).join("")}
        </div>
      </div>
      <div class="calendar-weekdays">
        ${["S", "M", "T", "W", "T", "F", "S"].map((day) => `<span>${day}</span>`).join("")}
      </div>
      <div class="calendar-grid">
        ${month.cells.map(calendarCell).join("")}
      </div>
    </section>` : renderCollectionGallery()}
  `;

  bindCollectionButtons();
  screen.querySelectorAll("[data-collection-view]").forEach((btn) => {
    btn.addEventListener("click", () => setState({ collectionView: btn.dataset.collectionView }));
  });
  screen.querySelectorAll("[data-month-step]").forEach((btn) => {
    btn.addEventListener("click", () => setState({ collectionMonthOffset: state.collectionMonthOffset + Number(btn.dataset.monthStep) }));
  });
}

function renderCollectionGallery() {
  const groups = collectionGroups();
  if (!groups.length) {
    return `
      <div class="empty-state">
        <strong>No kept photos yet.</strong>
        <p>Complete a focus session, upload proof, then choose “Keep in Collection.”</p>
      </div>
    `;
  }
  return groups.map(([label, photos]) => `
    <section class="collection-group">
      <div class="collection-date">
        <strong>${escapeHtml(label)}</strong>
        <span>${photos.length} ${photos.length === 1 ? "photo" : "photos"}</span>
      </div>
      <div class="collection-grid">
        ${photos.map((photo) => `
          <article class="collection-photo">
            <img src="${escapeAttr(photo.image)}" alt="${escapeAttr(photo.task)}">
            <div>
              <strong>${escapeHtml(photo.task)}</strong>
              <span>${escapeHtml(photo.depth)} ${escapeHtml((photo.kind || "Focus").toLowerCase())} · +${photo.roots} roots</span>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function renderCollectionReviewCard(item = state.collectionReviewQueue[0]) {
  if (!item) return "";
  return `
    <section class="collection-review">
      <img class="collection-thumb" src="${escapeAttr(item.image)}" alt="${escapeAttr(item.task)} proof">
      <div>
        <strong>Keep this in Collection?</strong>
        <p>${escapeHtml(item.task)} · ${escapeHtml(item.kind || "Focus")} · Day ${item.day} · ${escapeHtml(item.date)}</p>
        <div class="button-row">
          <button class="primary-btn" data-keep-photo="${item.id}">Keep</button>
          <button class="ghost-btn" data-skip-photo="${item.id}">Skip</button>
        </div>
      </div>
    </section>
  `;
}

function collectionGroups() {
  const groups = new Map();
  state.collectionPhotos.forEach((photo) => {
    const label = `Day ${photo.day} · ${photo.date}`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(photo);
  });
  return Array.from(groups.entries());
}

function collectionMonthInfo() {
  const today = new Date();
  const monthDate = new Date(today.getFullYear(), today.getMonth() + Number(state.collectionMonthOffset || 0), 1);
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const label = monthDate.toLocaleDateString(undefined, { month: "long" });
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const monthPhotos = state.collectionPhotos.filter((photo) => {
    const date = new Date(photo.createdAt || photo.keptAt || Date.now());
    return date.getFullYear() === year && date.getMonth() === monthIndex;
  });
  const byDay = new Map();
  monthPhotos.forEach((photo) => {
    const date = new Date(photo.createdAt || photo.keptAt || Date.now());
    const day = date.getDate();
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(photo);
  });
  const depthCounts = monthPhotos.reduce((counts, photo) => {
    counts[photo.depth] = Number(counts[photo.depth] || 0) + 1;
    return counts;
  }, {});
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push({ empty: true });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, photos: byDay.get(day) || [] });
  }
  while (cells.length % 7 !== 0) cells.push({ empty: true });
  return { label, year, total: monthPhotos.length, depthCounts, cells };
}

function calendarCell(cell) {
  if (cell.empty) return `<div class="calendar-cell empty"></div>`;
  const photos = cell.photos || [];
  const first = photos[0];
  if (!first) {
    return `<div class="calendar-cell"><span>${cell.day}</span></div>`;
  }
  return `
    <div class="calendar-cell has-memory ${depthClass(first.depth)}">
      ${first.image ? `<img src="${escapeAttr(first.image)}" alt="${escapeAttr(first.task)}">` : ""}
      <span>${cell.day}</span>
      <b>${photos.length}</b>
    </div>
  `;
}

function depthClass(depth) {
  if (depth === "Deep") return "deep";
  if (depth === "Medium") return "medium";
  return "light";
}

function bindCollectionButtons() {
  screen.querySelectorAll("[data-keep-photo]").forEach((btn) => {
    btn.addEventListener("click", () => keepCollectionPhoto(Number(btn.dataset.keepPhoto)));
  });
  screen.querySelectorAll("[data-skip-photo]").forEach((btn) => {
    btn.addEventListener("click", () => skipCollectionPhoto(Number(btn.dataset.skipPhoto)));
  });
}

function keepCollectionPhoto(id) {
  const item = state.collectionReviewQueue.find((photo) => photo.id === id);
  if (!item) return;
  state.collectionPhotos.unshift({ ...item, keptAt: new Date().toISOString() });
  state.collectionReviewQueue = state.collectionReviewQueue.filter((photo) => photo.id !== id);
  saveState();
  render();
  notify("Saved to Collection.");
}

function skipCollectionPhoto(id) {
  state.collectionReviewQueue = state.collectionReviewQueue.filter((photo) => photo.id !== id);
  saveState();
  render();
  notify("Skipped. Proof still counted.");
}

function renderSettings() {
  screen.innerHTML = `
    <div class="section-title" style="margin-top:0">
      <h2>Settings</h2>
      <p>Make STILL yours.</p>
    </div>

    <section class="settings-card">
      <strong>Profile</strong>
      <p>Your name personalizes private screens. Society posts, reactions, and replies stay anonymous.</p>
      <input class="input" id="profileNameInput" maxlength="24" value="${escapeAttr(state.userName || "")}" placeholder="Your name">
      <button class="ghost-btn settings-action" id="saveProfileName" style="margin-top:10px">Save name</button>
    </section>

    <section class="settings-card">
      <strong>Appearance</strong>
      <p>Dark mode keeps the app quiet and night-friendly. Normal mode is brighter for daytime use.</p>
      <div class="mode-grid" role="group" aria-label="Appearance mode">
        <button class="mode-choice ${state.theme === "dark" ? "selected" : ""}" data-theme="dark">
          <span>🌙</span>
          <strong>Dark mode</strong>
          <small>Low-light, calm, focused.</small>
        </button>
        <button class="mode-choice ${state.theme === "normal" ? "selected" : ""}" data-theme="normal">
          <span>☀️</span>
          <strong>Normal mode</strong>
          <small>Brighter, softer daytime UI.</small>
        </button>
      </div>
    </section>

    <section class="settings-card">
      <strong>Daily setup</strong>
      <p>Use this when your day changes and you want STILL to ask again what kind of support fits.</p>
      <button class="ghost-btn settings-action" id="openSetup">Open daily setup</button>
    </section>

    <section class="settings-card">
      <strong>Collection</strong>
      <p>Review proof photos and keep only the ones that should become part of your dated progress gallery.</p>
      <button class="ghost-btn settings-action" id="openCollection">Open Collection</button>
    </section>

    <section class="settings-card">
      <strong>Current rhythm</strong>
      <div class="settings-stats">
        <span><b>${state.day}</b> days</span>
        <span><b>${state.roots}</b> roots</span>
        <span><b>${state.checkins}</b> check-ins</span>
      </div>
    </section>
  `;

  screen.querySelector("#profileNameInput").addEventListener("input", (event) => {
    state.profileNameDraft = event.target.value;
    saveState();
  });
  screen.querySelector("#saveProfileName").addEventListener("click", () => {
    const name = screen.querySelector("#profileNameInput").value.trim();
    if (!name) return notify("Add your name first.");
    setState({ userName: name, profileNameDraft: name });
    notify("Name saved.");
  });
  screen.querySelectorAll("[data-theme]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setState({ theme: btn.dataset.theme });
      notify(btn.dataset.theme === "dark" ? "Dark mode on." : "Normal mode on.");
    });
  });
  screen.querySelector("#openSetup").addEventListener("click", () => {
    setState({ onboarded: false });
    notify("Opening setup.");
  });
  screen.querySelector("#openCollection").addEventListener("click", () => setTab("collection"));
}

function habitRow(habit) {
  const nextReward = nextHabitReward(habit);
  const earnedText = habit.done ? `Earned +${habit.lastReward || habit.baseRoots || habitBaseReward(habit)} today` : `Next +${nextReward} roots`;
  const streakText = habit.streak ? `${habit.streak} day repeat` : "No repeat yet";
  return `
    <div class="habit-row ${habit.done ? "done" : ""}" data-habit="${habit.id}">
      <div class="habit-symbol" aria-hidden="true">${habit.done ? "✓" : escapeHtml(habit.icon || "🌱")}</div>
      <div>
        <strong class="habit-name">${escapeHtml(habit.title)}</strong>
        <span class="habit-meta">${escapeHtml(habit.area)} · ${habitDifficultyLabel(habit)} · ${streakText}</span>
        <span class="habit-reward">${earnedText}</span>
      </div>
      <div class="habit-actions">
        <button class="${habit.done ? "icon-mini-btn vanish-btn" : "small-btn"}" ${habit.done ? `data-dismiss-habit="${habit.id}"` : `data-complete="${habit.id}"`} aria-label="${habit.done ? "Hide completed habit" : "Complete"} ${escapeAttr(habit.title)}">${habit.done ? "×" : "✓"}</button>
        <button class="icon-mini-btn delete-habit-btn" data-delete-habit="${habit.id}" aria-label="Remove ${escapeAttr(habit.title)}">
          <span class="icon-trash" aria-hidden="true"></span>
        </button>
      </div>
    </div>
  `;
}

function bindHabitButtons() {
  screen.querySelectorAll("[data-complete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.complete);
      const habit = state.habits.find((item) => item.id === id);
      if (!habit) return;
      setState({ habitProofPendingId: habit.id, habitProofName: "", habitProofDataUrl: "" });
      notify("Upload proof to earn roots.");
    });
  });
  screen.querySelectorAll("[data-dismiss-habit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const habit = state.habits.find((item) => item.id === Number(btn.dataset.dismissHabit));
      if (!habit) return;
      habit.hiddenDay = state.day;
      saveState();
      render();
      notify("Completed habit cleared for today.");
    });
  });
  screen.querySelectorAll("[data-delete-habit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const habit = state.habits.find((item) => item.id === Number(btn.dataset.deleteHabit));
      if (!habit) return;
      state.habits = state.habits.filter((item) => item.id !== habit.id);
      saveState();
      render();
      notify(`${habit.title} removed.`);
    });
  });
}

function completeHabitWithProof(id) {
  const habit = state.habits.find((item) => item.id === Number(id));
  if (!habit) return;
  const reward = nextHabitReward(habit);
  const proofItem = makeHabitProofItem(habit, reward);
  const continued = habit.lastCompletedDay === state.day - 1;
  habit.done = true;
  habit.streak = continued ? Number(habit.streak || 0) + 1 : 1;
  habit.lastCompletedDay = state.day;
  habit.lastReward = reward;
  habit.baseRoots = habitBaseReward(habit);
  if (reward > 0) state.roots += reward;
  state.habitProofPendingId = null;
  state.habitProofName = "";
  state.habitProofDataUrl = "";
  if (proofItem) state.collectionReviewQueue = [proofItem, ...state.collectionReviewQueue];
  saveState();
  render();
  notify(reward > 0 ? `Proof accepted. +${reward} roots.` : "Already rewarded today.");
}

function finishFocus() {
  const depth = depths[state.selectedDepth];
  const proofItem = makeFocusProofItem(depth);
  setState({
    focusActive: false,
    focusProgress: 0,
    focusProofPending: false,
    focusProofName: "",
    focusProofDataUrl: "",
    focusMinutes: state.focusMinutes + depth.minutes,
    roots: state.roots + depth.roots,
    day: state.day + 1,
    habits: state.habits.map((habit) => ({ ...habit, done: false })),
    collectionReviewQueue: proofItem ? [proofItem, ...state.collectionReviewQueue] : state.collectionReviewQueue,
    tab: "collection"
  });
  notify(`Proof accepted. +${depth.roots} roots. Choose if it belongs in Collection.`);
}

function requestFocusProof() {
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
  setState({ focusProofPending: true, focusProofName: "", focusProofDataUrl: "" });
  notify("Upload proof to claim roots.");
}

function startFocusTimer() {
  if (timer) window.clearInterval(timer);
  timer = window.setInterval(() => {
    if (!state.focusActive) {
      window.clearInterval(timer);
      timer = null;
      return;
    }
    state.focusProgress = Math.min(100, state.focusProgress + 2);
    saveState();
    const face = document.querySelector(".timer-face");
    if (face) face.style.setProperty("--timer", `${state.focusProgress}%`);
    if (state.focusProgress >= 100) {
      window.clearInterval(timer);
      timer = null;
      requestFocusProof();
    }
  }, 900);
}

function suggestNextStep() {
  if (state.load > 75 && state.mood < 40) {
    return "Lower the day. Drink water, send one honest message, then do a ten-minute focus block only if your body can meet it.";
  }
  if (state.load > 70) {
    return "Choose the smallest visible task. Make the start line so easy it almost feels unfair.";
  }
  if (state.mood < 35) {
    return "Do not negotiate with the whole future right now. Step outside, breathe, and write one sentence about what is true.";
  }
  return "You have enough steadiness for one clean action. Pick a medium focus block or finish one habit.";
}

function supportResponse(mode) {
  if (mode === "listen") {
    return "That sounds heavy because you are carrying the work and the feeling at the same time. You do not have to turn either one into a performance here.";
  }
  if (mode === "encourage") {
    return "You do not need a perfect mood to keep a promise to yourself. Make it small, make it honest, and let that count.";
  }
  return "The question is not what would fix everything. The question is: what is the next action that would make the next hour slightly lighter?";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

tabs.forEach((tab) => tab.addEventListener("click", () => setTab(tab.dataset.tab)));

document.querySelector("#settingsBtn").addEventListener("click", () => {
  if (!state.onboarded) return notify("Finish setup first.");
  setTab("settings");
});

document.querySelector("#shareBtn").addEventListener("click", () => {
  if (!state.onboarded) return notify("Enter STILL first.");
  setTab("collection");
});

render();
