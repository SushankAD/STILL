import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import CollectionImage from "./CollectionImage";
import ProofPhotoInput from "./ProofPhotoInput";
import { playCompletionRingtone, unlockAudio } from "./lib/chime";
import { expireFocusCountdown, focusSecondsLeft, isFocusProofReady } from "./lib/focus-timer";
import { getSeedGrowth, seedRootsProgress, seedStages, updateSeedMilestones } from "./lib/seed-growth";
import type { SeedMilestones } from "./lib/seed-growth";
import {
  abandonFocusSession,
  completeFocusSession,
  startFocusSession,
} from "./lib/focus-api";
import {
  fetchTodayCheckIn,
  localDateString,
  saveCheckInRecord,
} from "./lib/checkin-api";
import {
  activeHabitDate,
  archiveHabit as archiveCloudHabit,
  completionLabels,
  createHabit as createCloudHabit,
  editHabit as editCloudHabit,
  fetchHabits,
  removeHabitCompletion,
} from "./lib/habit-api";
import type { HabitCompletion, HabitDraft, HabitRecord } from "./lib/habit-api";
import { DEFAULT_SOCIAL_WINDOW, findTemplate, habitRoots, habitTemplates } from "../supabase/functions/_shared/habit-policy";
import type { SocialWindow } from "../supabase/functions/_shared/habit-policy";
import { prepareProofImage, verifyFocusProofWithAI } from "./lib/proof-ai";
import type { PreparedImage, ProofVerificationResult } from "./lib/proof-ai";
import { fetchCollectionPhotos, uploadProofPhoto } from "./lib/proof-api";
import type { CollectionPhoto } from "./lib/proof-api";
import {
  addSocietyComment,
  createSocietyPost,
  fetchSocietyPosts,
  toggleSocietyReaction,
} from "./lib/society-api";
import type { ReactionType, SocietyPost } from "./lib/society-api";
import { fetchUserStats } from "./lib/stats-api";

const HabitProof = lazy(() => import("./HabitProof"));

type Tab = "home" | "focus" | "checkin" | "habits" | "society" | "collection" | "settings";
type DayState = "steady" | "heavy" | "tiny";
type Habit = HabitRecord;
type HabitLoadStatus = "loading" | "ready" | "error";
type FocusOperation = "starting" | "saving" | "ending";
type Post = SocietyPost;
type State = {
  onboarded: boolean;
  tab: Tab;
  userName: string;
  day: number;
  roots: number;
  seedStartedAt: number | null;
  seedMilestones: SeedMilestones;
  seventhVisitAt: number | null;
  focusMinutes: number;
  checkins: number;
  theme: "dark" | "normal";
  dailyState: DayState;
  mood: number;
  load: number;
  selectedDepth: "light" | "medium" | "deep";
  focusActive: boolean;
  focusPaused: boolean;
  focusProgress: number;
  focusProofPending: boolean;
  focusTotalSeconds: number;
  focusRemainingSeconds: number;
  focusEndsAt: number | null;
  focusFinishedAt: number | null;
  focusSessionId: string | null;
  intention: string;
  supportMode: string | null;
  lastReflection: string;
  draftIcon: string;
  draftDifficulty: "easy" | "medium" | "hard";
  habits: Habit[];
  societyPosts: Post[];
  collectionPhotos: CollectionPhoto[];
  hardWinDraft: string;
  lastCheckInDate?: string;
};

const STORAGE_KEY = "still_final_app_state_v1";

type StillAppProps = {
  userId?: string;
  accountCreatedAt?: string;
  profileName?: string;
  demoMode?: boolean;
  onSaveProfileName?: (name: string) => Promise<void>;
  onSignOut?: () => Promise<void>;
};

const defaultState: State = {
  onboarded: false,
  tab: "home",
  userName: "",
  day: 1,
  roots: 0,
  seedStartedAt: null,
  seedMilestones: {},
  seventhVisitAt: null,
  focusMinutes: 0,
  checkins: 0,
  theme: "dark",
  dailyState: "steady",
  mood: 48,
  load: 62,
  selectedDepth: "medium",
  focusActive: false,
  focusPaused: false,
  focusProgress: 0,
  focusProofPending: false,
  focusTotalSeconds: 3000,
  focusRemainingSeconds: 3000,
  focusEndsAt: null,
  focusFinishedAt: null,
  focusSessionId: null,
  intention: "Study without checking my phone",
  supportMode: null,
  lastReflection: "You do not need to fix the whole day. Name one small action and stay with it for ten quiet minutes.",
  draftIcon: "🌱",
  draftDifficulty: "easy",
  lastCheckInDate: "",
  habits: [
    { id: 1, icon: "🏃", title: "Move my body", area: "Body", difficulty: "medium", baseRoots: 2, streak: 0, lastCompletedDay: null, lastReward: 0, done: false },
    { id: 2, icon: "📚", title: "Read 20 pages", area: "Mind", difficulty: "medium", baseRoots: 2, streak: 0, lastCompletedDay: null, lastReward: 0, done: false },
    { id: 3, icon: "🌙", title: "Sleep before 11", area: "Rest", difficulty: "hard", baseRoots: 3, streak: 0, lastCompletedDay: null, lastReward: 0, done: false }
  ],
  societyPosts: [
    { id: 1, icon: "🌙", text: "I wanted to disappear into scrolling, but I took a shower and answered one message.", reactions: { like: 21, love: 8, same: 18, proud: 9 }, reacted: null, comments: [{ id: 11, text: "This is exactly the kind of win people miss. You came back." }] },
    { id: 2, icon: "🌱", text: "Did ten minutes of the assignment. Not finished, but I came back.", reactions: { like: 14, love: 5, same: 11, proud: 6 }, reacted: null, comments: [] },
    { id: 3, icon: "💧", text: "Drank water, cried a little, then made my bed. Tiny win, real win.", reactions: { like: 26, love: 17, same: 24, proud: 14 }, reacted: "love", comments: [] }
  ],
  collectionPhotos: [],
  hardWinDraft: ""
};

const depths = {
  light: { icon: "🍃", label: "Light", minutes: 25, roots: 15, copy: "For low-energy days. One small start still counts." },
  medium: { icon: "🌿", label: "Medium", minutes: 50, roots: 35, copy: "The steady block. Enough depth without forcing the day." },
  deep: { icon: "🌳", label: "Deep", minutes: 90, roots: 70, copy: "For work that needs real quiet and a little courage." }
};

const dayStates: Record<DayState, { icon: string; title: string; copy: string; tab: Tab; prompt: string }> = {
  steady: { icon: "🌿", title: "I can focus", copy: "Protect one clean session.", tab: "focus", prompt: "What would you like to focus on today?" },
  heavy: { icon: "🌙", title: "I feel heavy", copy: "Lower the pressure first.", tab: "checkin", prompt: "What feels heavy right now?" },
  tiny: { icon: "🌱", title: "I need small steps", copy: "Make the next move visible.", tab: "habits", prompt: "What is one small step you can take today?" }
};

function loadState(storageKey: string, accountMode: boolean): State {
  const initialState = accountMode ? { ...defaultState, societyPosts: [] } : defaultState;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!saved) return initialState;
    const seedStartedAt = saved.seedStartedAt ?? (saved.onboarded ? Date.now() : null);
    return {
      ...initialState,
      ...saved,
      tab: "home",
      seedStartedAt,
      seedMilestones: accountMode ? saved.seedMilestones ?? {}
        : updateSeedMilestones(saved.seedMilestones ?? {}, saved.roots ?? 0, seedStartedAt ?? Date.now()),
      habits: saved.habits || defaultState.habits,
      societyPosts: accountMode ? [] : saved.societyPosts ?? initialState.societyPosts,
      collectionPhotos: accountMode ? [] : saved.collectionPhotos || [],
    };
  } catch {
    return initialState;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Could not complete the action. Please try again.";
}

function StillApp({ userId, accountCreatedAt, profileName, demoMode = false, onSaveProfileName, onSignOut }: StillAppProps) {
  const storageKey = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
  const [state, setState] = useState<State>(() => loadState(storageKey, Boolean(userId)));
  const [toast, setToast] = useState("");
  const [draftName, setDraftName] = useState(state.userName || profileName || "");
  const [newHabit, setNewHabit] = useState("");
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [seedClock, setSeedClock] = useState(() => Date.now());
  const [habitStatus, setHabitStatus] = useState<HabitLoadStatus>(userId ? "loading" : "ready");
  const [habitError, setHabitError] = useState("");
  const [habitRetry, setHabitRetry] = useState(0);
  const [savingHabit, setSavingHabit] = useState(false);
  const [busyHabitIds, setBusyHabitIds] = useState<Set<Habit["id"]>>(new Set());
  const activeHabitActions = useRef<Set<Habit["id"]>>(new Set());
  const [savingCheckIn, setSavingCheckIn] = useState(false);
  const [focusProofImage, setFocusProofImage] = useState<PreparedImage | null>(null);
  const [focusProofName, setFocusProofName] = useState("");
  const [focusProofChecking, setFocusProofChecking] = useState(false);
  const [focusProofResult, setFocusProofResult] = useState<ProofVerificationResult | null>(null);
  const [focusProofError, setFocusProofError] = useState("");
  const [focusOperation, setFocusOperation] = useState<FocusOperation | null>(null);
  const pendingFocusOperation = useRef<FocusOperation | null>(null);
  const focusProofCheck = useRef(0);
  const runningFocusDeadline = useRef(state.focusActive ? state.focusEndsAt : null);
  const [habitProofTarget, setHabitProofTarget] = useState<Habit | null>(null);
  const [habitEdit, setHabitEdit] = useState<{ habit: Habit; title: string; window: SocialWindow } | null>(null);
  const [habitEditError, setHabitEditError] = useState("");
  const habitCreation = useRef<{ key: string; id: string; busy: boolean } | null>(null);
  const statsVersion = useRef(0);
  const [statsStatus, setStatsStatus] = useState<HabitLoadStatus>(userId ? "loading" : "ready");
  const collectionVersion = useRef(0);
  const [collectionStatus, setCollectionStatus] = useState<HabitLoadStatus>(userId ? "loading" : "ready");
  const [societyStatus, setSocietyStatus] = useState<HabitLoadStatus>(userId ? "loading" : "ready");
  const [societyRetry, setSocietyRetry] = useState(0);
  const [postingWin, setPostingWin] = useState(false);
  const [openRepliesPostId, setOpenRepliesPostId] = useState<Post["id"] | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const save = useCallback((patch: Partial<State> | ((current: State) => Partial<State>)) => {
    const now = Date.now();
    setSeedClock(now);
    setState((current) => {
      const next = { ...current, ...(typeof patch === "function" ? patch(current) : patch) };
      if (!userId && next.roots !== current.roots) {
        next.seedMilestones = updateSeedMilestones(current.seedMilestones, next.roots, now);
      }
      return next;
    });
  }, [userId]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(userId ? { ...state, collectionPhotos: [], societyPosts: [] } : state));
    } catch {
      // Keep the session usable if browser storage is unavailable.
    }
  }, [state, storageKey, userId]);
  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2100);
  }, []);
  const markHabitBusy = (id: Habit["id"], busy: boolean) => {
    if (busy) activeHabitActions.current.add(id);
    else activeHabitActions.current.delete(id);
    setBusyHabitIds(new Set(activeHabitActions.current));
  };
  const reloadHabits = () => {
    if (!userId) return;
    setHabitError("");
    setHabitStatus("loading");
    setHabitRetry((attempt) => attempt + 1);
  };
  const refreshStats = useCallback(() => {
    if (!userId) return;
    const version = ++statsVersion.current;
    void fetchUserStats(userId).then((stats) => {
      if (version !== statsVersion.current) return;
      save(stats);
      setStatsStatus("ready");
    }).catch(() => {
      if (version === statsVersion.current) setStatsStatus("error");
    });
  }, [save, userId]);
  const refreshCollection = useCallback(() => {
    if (!userId) return;
    const version = ++collectionVersion.current;
    void fetchCollectionPhotos(userId).then((collectionPhotos) => {
      if (version !== collectionVersion.current) return;
      save({ collectionPhotos });
      setCollectionStatus("ready");
    }).catch(() => {
      if (version === collectionVersion.current) setCollectionStatus("error");
    });
  }, [save, userId]);
  const persistProfileName = async (name: string) => {
    if (!onSaveProfileName) return true;
    try {
      await onSaveProfileName(name);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save your profile.");
      return false;
    }
  };
  const signOut = async () => {
    try {
      await onSignOut?.();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not sign out.");
    }
  };
  const setTab = (tab: Tab) => {
    if (!state.onboarded) return;
    save({ tab });
  };

  useEffect(() => {
    document.body.classList.toggle("normal-mode", state.theme === "normal");
  }, [state.theme]);

  useEffect(() => {
    const updateSeedClock = () => setSeedClock(Date.now());
    const interval = window.setInterval(updateSeedClock, 60_000);
    document.addEventListener("visibilitychange", updateSeedClock);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateSeedClock);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const version = statsVersion;
    const refreshVisibleStats = () => {
      if (document.visibilityState === "visible") refreshStats();
    };
    refreshStats();
    document.addEventListener("visibilitychange", refreshVisibleStats);
    window.addEventListener("online", refreshVisibleStats);
    return () => {
      version.current++;
      document.removeEventListener("visibilitychange", refreshVisibleStats);
      window.removeEventListener("online", refreshVisibleStats);
    };
  }, [refreshStats, userId]);

  useEffect(() => {
    if (!userId || state.tab !== "collection") return;
    const refreshVisibleCollection = () => {
      if (document.visibilityState === "visible") refreshCollection();
    };
    refreshCollection();
    document.addEventListener("visibilitychange", refreshVisibleCollection);
    window.addEventListener("online", refreshVisibleCollection);
    return () => {
      document.removeEventListener("visibilitychange", refreshVisibleCollection);
      window.removeEventListener("online", refreshVisibleCollection);
    };
  }, [refreshCollection, state.tab, userId]);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    fetchSocietyPosts().then((societyPosts) => {
      if (!active) return;
      save({ societyPosts });
      setSocietyStatus("ready");
    }).catch(() => {
      if (active) setSocietyStatus("error");
    });

    return () => {
      active = false;
    };
  }, [userId, save, societyRetry]);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    fetchHabits(userId)
      .then((habits) => {
        if (!active) return;
        save({ habits });
        setHabitError("");
        setHabitStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setHabitError(errorMessage(error));
        setHabitStatus("error");
      });

    return () => {
      active = false;
    };
  }, [userId, save, habitRetry]);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    void fetchTodayCheckIn(userId, localDateString()).then((checkIn) => {
      if (!active || !checkIn) return;
      save({
        dailyState: checkIn.dayState,
        mood: checkIn.mood,
        load: checkIn.mentalLoad,
        lastReflection: checkIn.reflection,
        lastCheckInDate: checkIn.checkInDate,
      });
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, [userId, save]);

  const finishFocusTimer = useCallback((deadline: number, now: number) => {
    if (runningFocusDeadline.current !== deadline) return;
    const finishedTimer = expireFocusCountdown(deadline, now);
    if (!finishedTimer) return;

    runningFocusDeadline.current = null;
    playCompletionRingtone();
    setClockTick(now);
    save(finishedTimer);
    notify("Focus timer completed! Time for proof.");
  }, [save, notify]);

  useEffect(() => {
    const deadline = state.focusEndsAt;
    if (!state.focusActive || state.focusPaused || deadline === null) return;

    const tick = () => {
      const now = Date.now();
      if (now >= deadline) finishFocusTimer(deadline, now);
      else setClockTick(now);
    };
    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [state.focusActive, state.focusPaused, state.focusEndsAt, finishFocusTimer]);

  useEffect(() => {
    if (!userId || habitStatus !== "ready") return;
    const refreshAfterRollover = () => {
      const now = new Date();
      if (state.habits.some((habit) => habit.activeDate !== activeHabitDate(habit, now))) {
        setHabitRetry((attempt) => attempt + 1);
      }
    };
    const interval = window.setInterval(refreshAfterRollover, 30_000);
    window.addEventListener("focus", refreshAfterRollover);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshAfterRollover);
    };
  }, [userId, habitStatus, state.habits]);

  const accountStart = Date.parse(accountCreatedAt ?? "");
  const seedStart = Number.isFinite(accountStart) ? accountStart : state.seedStartedAt ?? seedClock;
  const growth = getSeedGrowth(seedStart, state.seedMilestones, seedClock,
    userId ? state.seventhVisitAt : seedStart + 6 * 86_400_000);
  const { stage, next, nextTimeAt } = growth;
  const rootProgress = next ? seedRootsProgress(state.roots, next.roots) : null;
  const pending = habitStatus === "ready" ? state.habits.filter((habit) => !habit.done) : [];
  const firstName = (state.userName || "friend").trim().split(/\s+/)[0];

  const today = localDateString();
  const todayCheckedIn = state.lastCheckInDate === today;

  const handleSaveCheckIn = async () => {
    if (savingCheckIn) return;

    const isUpdate = todayCheckedIn;
    setSavingCheckIn(true);

    if (userId) {
      try {
        const saved = await saveCheckInRecord({
          dayState: state.dailyState,
          mood: state.mood,
          mentalLoad: state.load,
          reflection: state.lastReflection || "",
        });

        save((current) => ({
          lastCheckInDate: saved.checkInDate,
          checkins: current.checkins + (current.lastCheckInDate === saved.checkInDate ? 0 : 1),
          roots: current.roots + saved.earned,
        }));
        refreshStats();
        notify(saved.earned ? `Check-in saved. +${saved.earned} roots.` : "Check-in updated.");
      } catch (error) {
        notify(errorMessage(error) || "Could not save check-in.");
      } finally {
        setSavingCheckIn(false);
      }
    } else {
      const nextCheckins = isUpdate ? state.checkins : state.checkins + 1;
      const nextRoots = isUpdate ? state.roots : state.roots + 12;
      save({
        lastCheckInDate: today,
        checkins: nextCheckins,
        roots: nextRoots,
      });
      notify(isUpdate ? "Check-in updated." : "Check-in saved. +12 roots.");
      setSavingCheckIn(false);
    }
  };

  const enterApp = async () => {
    const name = draftName.trim();
    if (!name) return notify("Add your name first.");
    if (!(await persistProfileName(name))) return;
    const tab = dayStates[state.dailyState].tab;
    save({ onboarded: true, tab, userName: name, seedStartedAt: state.seedStartedAt ?? Date.now() });
    notify(`Welcome to STILL, ${name.split(/\s+/)[0]}.`);
  };

  const habitRow = (habit: Habit) => (
    <div className={`habit-row ${habit.done ? "done" : ""}`} key={habit.id}>
      <div className="habit-symbol">{habit.done ? "✓" : habit.icon}</div>
      <div>
        <strong className="habit-name">{habit.title}</strong>
        <span className="habit-meta">{habit.area} · {habit.difficulty} · {habit.streak ? `${habit.streak} day repeat` : "No repeat yet"}</span>
        <span className="habit-reward">{habit.done ? `Earned +${habit.lastReward || habit.baseRoots} roots` : `Next +${habit.baseRoots} roots`}</span>
        {habit.done && habit.lastMethod && <span className="habit-meta">{completionLabels[habit.lastMethod]}</span>}
      </div>
      <div className="habit-actions">
        {!habit.done && (
          <button
            className="small-btn"
            aria-label={`Complete ${habit.title}`}
            disabled={busyHabitIds.has(habit.id)}
            onClick={() => openHabitProof(habit)}
          >
            ✓
          </button>
        )}
        {habit.done && <button className="icon-mini-btn vanish-btn" aria-label={`Undo ${habit.title}`} disabled={busyHabitIds.has(habit.id)} onClick={() => { void undoHabitCompletion(habit); }}>×</button>}
        {state.tab === "habits" && (
          <button className="icon-mini-btn" aria-label={`Edit ${habit.title}`} disabled={busyHabitIds.has(habit.id)}
            onClick={() => {
              setHabitProofTarget(null);
              setHabitEditError("");
              setHabitEdit({ habit, title: habit.title, window: habit.socialWindow ?? DEFAULT_SOCIAL_WINDOW });
              document.querySelector(".screen")?.scrollTo({ top: 0, behavior: "smooth" });
            }}>✎</button>
        )}
        <button className="icon-mini-btn delete-habit-btn" aria-label={`Remove ${habit.title}`} disabled={busyHabitIds.has(habit.id)} onClick={() => { void archiveHabit(habit); }}><span className="icon-trash"></span></button>
      </div>
    </div>
  );

  const addHabitRecord = async (habit: HabitDraft) => {
    if (habitCreation.current?.busy) return false;
    const key = JSON.stringify(habit);
    const request = {
      key,
      id: habitCreation.current?.key === key ? habitCreation.current.id : crypto.randomUUID(),
      busy: true,
    };
    habitCreation.current = request;
    setSavingHabit(true);
    setHabitError("");
    try {
      const created = userId
        ? await createCloudHabit(habit, request.id)
        : { ...habit, id: request.id, streak: 0, lastCompletedDay: null, lastReward: 0, done: false };
      save((current) => ({
        habits: current.habits.some((item) => item.id === created.id) ? current.habits : [...current.habits, created],
      }));
      habitCreation.current = null;
      notify("Habit added.");
      return true;
    } catch (error: unknown) {
      const message = errorMessage(error);
      setHabitError(message);
      notify(message);
      return false;
    } finally {
      request.busy = false;
      setSavingHabit(false);
    }
  };

  const openHabitProof = (habit: Habit) => {
    setHabitEdit(null);
    setHabitProofTarget(habit);
  };

  const habitRecorded = (habit: Habit, completion: HabitCompletion, photoSaved?: boolean) => {
    const roots = completion.roots_awarded;
    save((current) => {
      const previous = current.habits.find((item) => item.id === habit.id);
      return {
        roots: current.roots + (previous?.completionId === completion.id || previous?.done ? 0 : roots),
        habits: current.habits.map((item) => item.id !== habit.id ? item : {
          ...item,
          done: true,
          activeDate: completion.completed_on,
          lastCompletedDay: completion.completed_on,
          completionId: completion.id,
          lastMethod: completion.verification_method,
          lastReward: roots,
          streak: item.done ? item.streak : item.streak + 1,
        }),
      };
    });
    setHabitProofTarget((current) => current?.id === habit.id ? null : current);
    setHabitRetry((attempt) => attempt + 1);
    refreshStats();
    if (photoSaved) refreshCollection();
    notify(photoSaved === false
      ? `Habit recorded. +${roots} roots. The Collection copy could not be saved.`
      : `${completionLabels[completion.verification_method]}. +${roots} roots.`);
  };

  const habitProof = habitProofTarget && (
    <Suspense fallback={<div className="message-card" role="status">Loading evidence instructions…</div>}>
      <HabitProof
        key={habitProofTarget.id}
        habit={habitProofTarget}
        userId={userId}
        onClose={() => setHabitProofTarget(null)}
        onComplete={(completion, photoSaved) => habitRecorded(habitProofTarget, completion, photoSaved)}
        onAlreadyComplete={() => {
          setHabitRetry((attempt) => attempt + 1);
          refreshStats();
        }}
      />
    </Suspense>
  );

  const saveHabitEdit = async () => {
    if (!habitEdit || activeHabitActions.current.has(habitEdit.habit.id)) return;
    const { habit, title, window: settings } = habitEdit;
    if (!title.trim()) {
      setHabitEditError("Enter a habit name.");
      return;
    }
    markHabitBusy(habit.id, true);
    setHabitEditError("");
    try {
      if (userId) {
        const updated = await editCloudHabit(String(habit.id), title, settings);
        save((current) => ({
          habits: current.habits.map((item) => item.id === habit.id
            ? { ...updated, streak: item.streak, done: item.done, lastCompletedDay: item.lastCompletedDay,
                lastReward: item.lastReward, lastMethod: item.lastMethod, completionId: item.completionId }
            : item),
        }));
        setHabitRetry((attempt) => attempt + 1);
      } else {
        save((current) => ({
          habits: current.habits.map((item) => item.id === habit.id
            ? { ...item, title: title.trim(), socialWindow: settings }
            : item),
        }));
      }
      setHabitEdit((current) => current?.habit.id === habit.id ? null : current);
      notify("Habit updated.");
    } catch (error: unknown) {
      setHabitEditError(errorMessage(error));
    } finally {
      markHabitBusy(habit.id, false);
    }
  };

  const undoHabitCompletion = async (habit: Habit) => {
    if (activeHabitActions.current.has(habit.id)) return;
    markHabitBusy(habit.id, true);
    setHabitError("");
    try {
      if (userId) {
        if (!habit.completionId) return;
        const { storageWarning } = await removeHabitCompletion(String(habit.id), habit.completionId);
        refreshStats();
        refreshCollection();
        setHabitRetry((attempt) => attempt + 1);
        if (storageWarning) notify("Completion removed. STILL could not remove the Collection copy.");
      }
      save((current) => ({
        roots: Math.max(0, current.roots - (current.habits.find((item) => item.id === habit.id)?.done ? habit.lastReward : 0)),
        habits: current.habits.map((item) => item.id !== habit.id ? item : {
          ...item, done: false, lastCompletedDay: null, lastReward: 0, completionId: undefined,
          lastMethod: undefined, streak: Math.max(0, item.streak - 1),
        }),
      }));
    } catch (error: unknown) {
      const message = errorMessage(error);
      setHabitError(message);
      notify(message);
    } finally {
      markHabitBusy(habit.id, false);
    }
  };

  const archiveHabit = async (habit: Habit) => {
    if (activeHabitActions.current.has(habit.id)) return;
    markHabitBusy(habit.id, true);
    setHabitError("");
    try {
      if (userId) await archiveCloudHabit(String(habit.id));
      save((current) => ({ habits: current.habits.filter((item) => item.id !== habit.id) }));
      setHabitProofTarget((current) => current?.id === habit.id ? null : current);
      setHabitEdit((current) => current?.habit.id === habit.id ? null : current);
      notify("Habit removed.");
    } catch (error: unknown) {
      const message = errorMessage(error);
      setHabitError(message);
      notify(message);
    } finally {
      markHabitBusy(habit.id, false);
    }
  };

  const addHabit = () => {
    const title = newHabit.trim();
    if (!title) return notify("Name the habit first.");
    const baseRoots = habitRoots[state.draftDifficulty];
    void addHabitRecord({
      icon: state.draftIcon,
      title,
      area: "Custom",
      difficulty: state.draftDifficulty,
      baseRoots,
    }).then((added) => {
      if (added) setNewHabit("");
    });
  };

  const handlePostSocietyWin = async () => {
    const text = state.hardWinDraft.trim();
    if (!text) return notify("Write the small win first.");
    if (postingWin || societyStatus === "loading") return;

    const icon = dayStates[state.dailyState].icon;
    setPostingWin(true);
    try {
      const created = userId
        ? await createSocietyPost(userId, icon, text)
        : { id: Date.now(), icon, text, reactions: { like: 0, love: 0, same: 0, proud: 0 }, reacted: null, comments: [] };

      save((current) => ({
        societyPosts: [created, ...current.societyPosts],
        roots: userId ? current.roots : current.roots + 8,
        hardWinDraft: "",
      }));
      notify(userId ? "Anonymous post shared." : "Anonymous post shared. +8 roots.");
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setPostingWin(false);
    }
  };

  const reactToPost = (post: Post, reaction: ReactionType) => {
    const prevPosts = state.societyPosts;
    const nextPosts = prevPosts.map((item) => {
      if (item.id !== post.id) return item;
      const reactions = { ...item.reactions };
      if (item.reacted) reactions[item.reacted] = Math.max(0, reactions[item.reacted] - 1);
      if (item.reacted === reaction) return { ...item, reacted: null, reactions };
      reactions[reaction] += 1;
      return { ...item, reacted: reaction, reactions };
    });
    save({ societyPosts: nextPosts });

    if (userId && typeof post.id === "string") {
      toggleSocietyReaction(userId, post.id, post.reacted, reaction).catch((error) => {
        save({ societyPosts: prevPosts });
        notify(errorMessage(error));
      });
    }
  };

  const handleReplyToPost = async (post: Post) => {
    const key = String(post.id);
    const text = (replyDrafts[key] || "").trim();
    if (!text) return notify("Write a short reply first.");

    try {
      const comment = userId && typeof post.id === "string"
        ? await addSocietyComment(userId, post.id, text)
        : { id: Date.now(), text };

      save({
        societyPosts: state.societyPosts.map((item) =>
          item.id === post.id ? { ...item, comments: [...item.comments, comment] } : item,
        ),
      });
      setReplyDrafts((current) => ({ ...current, [key]: "" }));
      notify("Reply shared.");
    } catch (error) {
      notify(errorMessage(error));
    }
  };

  const depth = depths[state.selectedDepth];
  const totalSeconds = state.focusTotalSeconds || (depth.minutes * 60);
  let remainingSeconds = totalSeconds;
  if (state.focusActive && state.focusEndsAt) {
    remainingSeconds = focusSecondsLeft(state.focusEndsAt, clockTick);
  } else if (state.focusPaused) {
    remainingSeconds = Math.max(0, state.focusRemainingSeconds ?? totalSeconds);
  }
  const progressPct = totalSeconds > 0
    ? Math.min(100, Math.max(0, Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100)))
    : 0;
  const timerMinutes = Math.floor(remainingSeconds / 60);
  const timerSeconds = remainingSeconds % 60;
  const formattedTimer = `${String(timerMinutes).padStart(2, "0")}:${String(timerSeconds).padStart(2, "0")}`;

  const focusProofReady = isFocusProofReady(state, clockTick) && (!userId || Boolean(state.focusSessionId));

  const beginFocusOperation = (operation: FocusOperation) => {
    if (pendingFocusOperation.current) return false;
    pendingFocusOperation.current = operation;
    setFocusOperation(operation);
    return true;
  };

  const endFocusOperation = () => {
    pendingFocusOperation.current = null;
    setFocusOperation(null);
  };

  const clearFocusPhoto = () => {
    focusProofCheck.current += 1;
    setFocusProofImage(null);
    setFocusProofName("");
    setFocusProofResult(null);
    setFocusProofError("");
    setFocusProofChecking(false);
  };

  const focusReset = {
    focusActive: false,
    focusPaused: false,
    focusEndsAt: null,
    focusFinishedAt: null,
    focusRemainingSeconds: 0,
    focusProgress: 0,
    focusProofPending: false,
    focusSessionId: null,
  };

  const handleStartFocus = async () => {
    if (state.focusActive || state.focusPaused || state.focusProofPending || !beginFocusOperation("starting")) return;
    clearFocusPhoto();
    unlockAudio();
    try {
      const record = userId
        ? await startFocusSession(state.intention, state.selectedDepth)
        : null;
      const minutes = record?.plannedMinutes ?? depth.minutes;
      const totalSec = minutes * 60;
      const now = Date.now();
      const deadline = now + totalSec * 1000;
      runningFocusDeadline.current = deadline;
      setClockTick(now);
      save({
        ...focusReset,
        focusActive: true,
        focusTotalSeconds: totalSec,
        focusRemainingSeconds: totalSec,
        focusEndsAt: deadline,
        focusSessionId: record?.id ?? null,
        intention: record?.intention ?? state.intention,
      });
      notify(`Focus started: ${minutes} minutes.`);
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      endFocusOperation();
    }
  };

  const handlePauseFocus = () => {
    const deadline = runningFocusDeadline.current;
    if (deadline === null) return;
    const now = Date.now();
    const seconds = focusSecondsLeft(deadline, now);
    if (seconds === 0) {
      finishFocusTimer(deadline, now);
      return;
    }

    runningFocusDeadline.current = null;
    save({
      focusActive: false,
      focusPaused: true,
      focusEndsAt: null,
      focusRemainingSeconds: seconds,
    });
    notify("Focus paused.");
  };

  const handleResumeFocus = () => {
    if (!state.focusPaused || state.focusRemainingSeconds <= 0) return;
    unlockAudio();
    const now = Date.now();
    const deadline = now + state.focusRemainingSeconds * 1000;
    runningFocusDeadline.current = deadline;
    setClockTick(now);
    save({ focusActive: true, focusPaused: false, focusEndsAt: deadline });
    notify("Focus resumed.");
  };

  const handleSelectFocusProof = async (file?: File) => {
    if (!focusProofReady || (!file && !focusProofImage) || focusProofChecking || pendingFocusOperation.current) return;
    const check = ++focusProofCheck.current;
    setFocusProofChecking(true);
    setFocusProofResult(null);
    setFocusProofError("");
    if (file) {
      setFocusProofName(file.name);
      setFocusProofImage(null);
    }

    try {
      const prepared = file ? await prepareProofImage(file) : focusProofImage!;
      if (check !== focusProofCheck.current) return;
      setFocusProofImage(prepared);
      const result = await verifyFocusProofWithAI(prepared, state.focusSessionId
        ? { focusSessionId: state.focusSessionId }
        : { activity: state.intention || `${depth.label} focus session` });
      if (check === focusProofCheck.current) setFocusProofResult(result);
    } catch (error) {
      if (check === focusProofCheck.current) setFocusProofError(errorMessage(error));
    } finally {
      if (check === focusProofCheck.current) setFocusProofChecking(false);
    }
  };

  const handleSubmitProof = async () => {
    if (!focusProofReady || focusProofChecking || !focusProofImage ||
      !focusProofResult?.verified || !beginFocusOperation("saving")) return;

    setFocusProofError("");
    try {
      const sessionId = state.focusSessionId;
      let completion = { newlyCompleted: true, roots: depth.roots, minutes: depth.minutes };
      if (userId) {
        const verificationId = focusProofResult.verificationId;
        if (!sessionId || !verificationId) throw new Error("Check the photo again before submitting this session.");
        completion = await completeFocusSession(sessionId, verificationId);
      }
      const { newlyCompleted, roots, minutes } = completion;
      const label = state.intention || `${depth.label} focus`;
      let photo: CollectionPhoto | null = null;
      let photoSaveFailed = false;

      if (newlyCompleted && userId && sessionId) {
        try {
          photo = await uploadProofPhoto(userId, focusProofImage, { kind: "focus", focusSessionId: sessionId }, label);
        } catch {
          photoSaveFailed = true;
        }
      } else if (!userId) {
        photo = {
          id: `local-${Date.now()}`,
          label,
          kind: "focus",
          createdAt: new Date().toISOString(),
          imageUrl: focusProofImage.dataUrl,
        };
      }

      save((current) => ({
        ...focusReset,
        roots: current.roots + (newlyCompleted ? roots : 0),
        focusMinutes: current.focusMinutes + (newlyCompleted ? minutes : 0),
        collectionPhotos: photo ? [photo, ...current.collectionPhotos] : current.collectionPhotos,
      }));
      clearFocusPhoto();
      refreshStats();

      if (photoSaveFailed) notify(`Focus complete. +${roots} roots. Could not save the Collection photo.`);
      else notify(newlyCompleted ? `Proof accepted! +${roots} roots.` : "Focus was already saved.");
    } catch (error) {
      setFocusProofError(errorMessage(error));
    } finally {
      endFocusOperation();
    }
  };

  const handleAbandonFocus = async () => {
    if (!beginFocusOperation("ending")) return;
    runningFocusDeadline.current = null;
    clearFocusPhoto();
    save(focusReset);

    try {
      if (userId && state.focusSessionId && !(await abandonFocusSession(state.focusSessionId))) {
        refreshStats();
        notify("This focus session was already saved.");
      } else {
        notify("Focus ended without roots.");
      }
    } catch {
      notify("Focus closed. Could not confirm the session status.");
    } finally {
      endFocusOperation();
    }
  };

  return (
    <main className="shell" aria-label="STILL app">
      <section className="phone-wrap" aria-label="STILL">
        <div className="phone">
          <header className="topbar">
            <button className="icon-btn" aria-label="Settings" onClick={() => setTab("settings")}><span className="icon-settings"></span></button>
            <div>{statsStatus === "ready" && <p className="tiny-label">Day <span>{state.day}</span></p>}<strong>STILL</strong></div>
            <button className="icon-btn" aria-label="Open collection" onClick={() => setTab("collection")}><span className="icon-collection"></span></button>
          </header>

          <div className="screen" tabIndex={-1}>
            {demoMode && <p className="demo-mode-label">Local demo — saved on this browser only.</p>}
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
                {statsStatus === "loading" ? (
                  <div className="message-card" role="status"><strong>Loading Seed Drop progress…</strong></div>
                ) : statsStatus === "error" ? (
                  <div className="message-card" role="alert">
                    <strong>Could not load Seed Drop progress.</strong>
                    <button className="ghost-btn" type="button" onClick={() => {
                      setStatsStatus("loading");
                      refreshStats();
                    }}>Retry</button>
                  </div>
                ) : (
                  <section className="hero-card">
                    <div className="drop-stage">
                      <img key={stage.number} className="home-stage-img" src={`/assets/still-logo-stage-${stage.number}.png`}
                        width={148} height={148} alt={stage.name} />
                    </div>
                    <div className="stage-title">
                      <h2>Hello, {firstName}</h2>
                      <p><strong>Stage {stage.number} of 5 · {stage.name}</strong></p>
                      <p>{stage.copy}</p>
                    </div>
                    <ol className="seed-steps" aria-label="Seed Drop stages">
                      {seedStages.map((step) => (
                        <li key={step.number} className={step.number <= stage.number ? "reached" : undefined}
                          aria-current={step.number === stage.number ? "step" : undefined}>
                          <span title={`${step.name} · ${step.roots.toLocaleString()} roots`}
                            aria-label={`Stage ${step.number}, ${step.name}, ${step.roots.toLocaleString()} roots`}>{step.number}</span>
                        </li>
                      ))}
                    </ol>
                    {next && nextTimeAt !== null && rootProgress ? (
                      <div className="seed-goal">
                        <div className="seed-goal-row">
                          <strong>Next · Stage {next.number}</strong>
                          <span>{state.roots.toLocaleString()} / {next.roots.toLocaleString()} roots</span>
                        </div>
                        <div className="progress-line" role="progressbar" aria-label={`Roots toward Stage ${next.number}`}
                          aria-valuemax={next.roots} aria-valuenow={rootProgress.credited} data-complete={rootProgress.goalMet}>
                          <span style={{ "--pct": `${rootProgress.percent}%` } as React.CSSProperties}></span>
                        </div>
                        <p>{state.roots >= next.roots ? "Roots goal met" : `${(next.roots - state.roots).toLocaleString()} roots to go`}</p>
                        <p>{seedClock >= nextTimeAt ? "Time requirement met" : `Time requirement ends ${new Date(nextTimeAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}</p>
                        <p>{stage.number === 1 ? "Spend at least 1 week in Stage 1." : `Spend at least 1 month in Stage ${stage.number}.`}</p>
                      </div>
                    ) : <p className="seed-finish">All five Seed Drop stages reached.</p>}
                    <div className="stat-grid"><div className="stat"><b>{state.roots}</b><small>Roots</small></div><div className="stat"><b>{state.focusMinutes}</b><small>Focus min</small></div><div className="stat"><b>{state.checkins}</b><small>Check-ins</small></div></div>
                  </section>
                )}
                <section className="pulse-card"><div><span>{dayStates[state.dailyState].icon}</span><strong>{dayStates[state.dailyState].title}</strong><p>{state.dailyState === "heavy" ? "Start with a check-in. Let the app lower the day before it asks for effort." : state.dailyState === "tiny" ? "Pick one small habit. A visible start is enough." : "You have enough steadiness for one clean focus session."}</p></div><button className="small-btn" onClick={() => setTab(dayStates[state.dailyState].tab)}>Start</button></section>
                <div className="section-title"><h2>What do you need?</h2><p>Choose gently.</p></div>
                <div className="quick-row">
                  <article className="action-card" onClick={() => setTab("focus")}><div className="emoji-badge mint-icon">🌿</div><strong>Focus when you can</strong><p>One protected session. No full-life reset required.</p></article>
                  <article className="action-card" onClick={() => setTab("checkin")}><div className="emoji-badge amber-icon">🌙</div><strong>Feel what you must</strong><p>Name the load, lower the pressure, choose one next step.</p></article>
                </div>
                <article className="society-teaser" onClick={() => setTab("collection")}><div className="emoji-badge amber-icon">📸</div><div><strong>Collection</strong><p>Keep proof photos that become part of your dated progress gallery.</p></div></article>
                <article className="society-teaser" onClick={() => setTab("society")}><div className="emoji-badge blue-icon">✨</div><div><strong>Small hard wins</strong><p>Read quiet posts from people who kept going in difficult moments.</p></div></article>
                <div className="section-title"><h2>Today</h2><p>{pending.length} open</p></div>
                {habitProof}
                {habitStatus === "loading" && <div className="message-card" role="status"><strong>Loading habits…</strong></div>}
                {habitStatus === "error" && <div className="message-card" role="alert"><strong>Could not load habits.</strong><p>{habitError}</p><button className="ghost-btn" onClick={reloadHabits}>Retry</button></div>}
                {habitStatus === "ready" && pending.slice(0, 3).map(habitRow)}
              </section>
            ) : state.tab === "checkin" ? (
              <section>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Check-in</h2><p>Sort the day.</p></div>
                <div className="check-card"><strong>This decides what STILL asks from you next.</strong><p>Use Check-in when the day feels unclear. Name your state and choose one small next step.</p></div>
                <div className="section-title"><h2>Today feels like</h2><p>Be honest.</p></div>
                <div className="state-grid compact">
                  {(Object.entries(dayStates) as [DayState, typeof dayStates.steady][]).map(([id, item]) => <button key={id} className={`state-chip ${state.dailyState === id ? "selected" : ""}`} onClick={() => save({ dailyState: id, tab: dayStates[id].tab })}><span>{item.icon}</span><strong>{item.title}</strong><small>{item.copy}</small></button>)}
                </div>
                <div className="slider-wrap"><label><span>Mood</span><b>{state.mood}/100</b></label><input type="range" min="0" max="100" value={state.mood} onChange={(event) => save({ mood: Number(event.target.value) })} /></div>
                <div className="slider-wrap"><label><span>Mental load</span><b>{state.load}/100</b></label><input type="range" min="0" max="100" value={state.load} onChange={(event) => save({ load: Number(event.target.value) })} /></div>
                <textarea className="textarea" maxLength={2000} placeholder={dayStates[state.dailyState].prompt} value={state.lastReflection} onChange={(event) => save({ lastReflection: event.target.value })} />
                <button className="primary-btn" style={{ marginTop: 12 }} disabled={savingCheckIn} onClick={handleSaveCheckIn}>{savingCheckIn ? "Saving…" : todayCheckedIn ? "Update check-in" : "Save check-in"}</button>
                <div className="message-card" style={{ marginTop: 12 }}><strong>Suggested next step</strong><p>{dayStates[state.dailyState].copy}</p></div>
              </section>
            ) : state.tab === "habits" ? (
              <section>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Habits</h2><p>Set today's list.</p></div>
                <div className="message-card"><strong>Add or remove habits before you begin.</strong><p>Tap ✓ to see what evidence your habit needs.</p></div>
                {habitProof}
                {habitEdit && (
                  <form className="proof-card habit-edit" onSubmit={(event) => { event.preventDefault(); void saveHabitEdit(); }}>
                    <strong>Edit {habitEdit.habit.title}</strong>
                    <label>Habit name
                      <input className="input" maxLength={42} required value={habitEdit.title}
                        onChange={(event) => setHabitEdit({ ...habitEdit, title: event.target.value })} />
                    </label>
                    {findTemplate(habitEdit.title) === "social" && (
                      <>
                        <label>Social media limit in minutes
                          <input className="input" type="number" required min={0} max={habitEdit.window.endHour * 60}
                            value={Number.isNaN(habitEdit.window.limitMinutes) ? "" : habitEdit.window.limitMinutes}
                            onChange={(event) => setHabitEdit({ ...habitEdit, window: { ...habitEdit.window, limitMinutes: event.target.valueAsNumber } })} />
                        </label>
                        <label>Local window end (starts at midnight)
                          <select className="input" value={habitEdit.window.endHour}
                            onChange={(event) => setHabitEdit({ ...habitEdit, window: { ...habitEdit.window, endHour: Number(event.target.value) } })}>
                            {Array.from({ length: 24 }, (_, index) => (
                              <option key={index} value={index + 1}>{index === 23 ? "Next midnight (full day)" : `${String(index + 1).padStart(2, "0")}:00`}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                    {habitEditError && <p role="alert">{habitEditError}</p>}
                    <div className="proof-inputs proof-actions">
                      <button className="ghost-btn" type="button" disabled={busyHabitIds.has(habitEdit.habit.id)} onClick={() => setHabitEdit(null)}>Cancel</button>
                      <button className="primary-btn" type="submit" disabled={busyHabitIds.has(habitEdit.habit.id)}>Save changes</button>
                    </div>
                  </form>
                )}
                {habitStatus === "loading" && <div className="message-card" role="status"><strong>Loading your habits…</strong></div>}
                {habitStatus === "error" && <div className="message-card" role="alert"><strong>Could not load habits.</strong><p>{habitError}</p><button className="ghost-btn" onClick={reloadHabits}>Retry</button></div>}
                {habitStatus === "ready" && state.habits.length === 0 && <div className="message-card"><strong>No habits yet.</strong><p>Add a practice below. It will be saved to your STILL account.</p></div>}
                {habitStatus === "ready" && <div>{state.habits.map(habitRow)}</div>}
                <div className="section-title"><h2>Quick add</h2><p>Emoji helps</p></div>
                <div className="template-grid">
                  {habitTemplates.map((template) => <button className="template-btn" key={template.title} disabled={savingHabit} onClick={() => { void addHabitRecord({ ...template, baseRoots: habitRoots[template.difficulty] }); }}><span>{template.icon}</span><strong>{template.title}</strong><small>{template.difficulty} · +{habitRoots[template.difficulty]}</small></button>)}
                </div>
                <div className="section-title"><h2>Add practice</h2><p>Keep it tiny</p></div>
                <div className="icon-picker">{["🌱", "🌿", "💧", "🌙", "📚", "📓", "🏃", "🧘", "☕", "🚫", "✨"].map((icon) => <button key={icon} className={`icon-choice ${state.draftIcon === icon ? "selected" : ""}`} onClick={() => save({ draftIcon: icon })}>{icon}</button>)}</div>
                <div className="difficulty-grid">
                  {(["easy", "medium", "hard"] as const).map((difficulty) => <button key={difficulty} className={`difficulty-choice ${state.draftDifficulty === difficulty ? "selected" : ""}`} onClick={() => save({ draftDifficulty: difficulty })}><strong>{difficulty[0].toUpperCase() + difficulty.slice(1)}</strong><span>+{difficulty === "hard" ? 3 : difficulty === "medium" ? 2 : 1} root</span></button>)}
                </div>
                <input className="input" maxLength={42} value={newHabit} onChange={(event) => setNewHabit(event.target.value)} placeholder="Example: ten-minute reset walk" />
                <button className="primary-btn" style={{ marginTop: 10 }} disabled={savingHabit} onClick={addHabit}>{savingHabit ? "Saving…" : "Add habit"}</button>
              </section>
            ) : state.tab === "focus" ? (
              <section>
                {state.focusActive || state.focusPaused ? (
                  <>
                    <div className="timer-face" style={{ "--timer": `${progressPct}%` } as React.CSSProperties}>
                      <div className="timer-inner">
                        <b>{formattedTimer}</b>
                        <span>{depth.label} session{state.focusPaused ? " (paused)" : ""}</span>
                      </div>
                    </div>
                    <div className="message-card">
                      <strong>{state.intention}</strong>
                      <p>{state.focusPaused ? "Session is currently paused. Tap Resume to continue." : "Stay with the named task until the timer ends or you consciously stop."}</p>
                    </div>
                    <button className="ghost-btn" style={{ width: "100%", marginTop: 14 }}
                      onClick={state.focusPaused ? handleResumeFocus : handlePauseFocus}>
                      {state.focusPaused ? "Resume" : "Pause"}
                    </button>
                    <button className="danger-btn" style={{ width: "100%", marginTop: 10 }} onClick={handleAbandonFocus}>Quit without roots</button>
                  </>
                ) : state.focusProofPending ? (
                  <>
                    <div className="section-title" style={{ marginTop: 0 }}><h2>Proof</h2>{focusProofReady && <p role="status">00:00 · Timer complete</p>}</div>
                    {focusProofReady ? (
                      <>
                        <div className="proof-card">
                          <div className="emoji-badge mint-icon">📷</div>
                          <strong>Upload a quick proof photo for "{state.intention}".</strong>
                          <p>A notebook page, workout screen, tidy desk, book page, or finished task is enough.</p>
                          <ProofPhotoInput
                            disabled={focusProofChecking || focusOperation !== null}
                            hasImage={Boolean(focusProofImage)}
                            onSelect={(file) => { void handleSelectFocusProof(file); }}
                          />
                          {focusProofName && <p className="proof-name">{focusProofName}</p>}
                          {focusProofImage && <img className="proof-preview" src={focusProofImage.dataUrl} alt="Focus proof preview" />}
                          {focusProofChecking && <p role="status" style={{ marginTop: 10 }}>Checking proof photo…</p>}
                          {focusProofError && (
                            <div className="message-card" style={{ marginTop: 10 }} role="alert">
                              <p>{focusProofError}</p>
                              {focusProofImage && <button className="ghost-btn" type="button" onClick={() => { void handleSelectFocusProof(); }}>Retry photo check</button>}
                            </div>
                          )}
                          {focusProofResult && (
                            <div className="message-card" style={{ marginTop: 10 }} role={focusProofResult.verified ? "status" : "alert"}>
                              <strong>{focusProofResult.verified ? "✓ Proof matches activity" : "⚠ Photo doesn't match yet"}</strong>
                              <p>{focusProofResult.reason}</p>
                            </div>
                          )}
                        </div>
                        <button
                          className="primary-btn"
                          style={{ marginTop: 12 }}
                          disabled={!focusProofImage || focusProofChecking || focusOperation === "saving" || !focusProofResult?.verified}
                          onClick={() => { void handleSubmitProof(); }}
                        >
                          {focusOperation === "saving" ? "Saving…" : `Submit proof & earn +${depth.roots} roots`}
                        </button>
                      </>
                    ) : (
                      <div className="message-card"><p>This saved session has no timer completion record. Quit to start again.</p></div>
                    )}
                    <button className="danger-btn" type="button" style={{ width: "100%", marginTop: 10 }}
                      disabled={focusOperation !== null} onClick={handleAbandonFocus}>Quit without roots</button>
                  </>
                ) : (
                  <>
                    <div className="section-title" style={{ marginTop: 0 }}><h2>Focus</h2><p>One task, one block.</p></div>
                    <div className="focus-intro"><strong>Focus is for days with enough steadiness to begin.</strong><p>Choose the smallest block your body can actually meet.</p></div>
                    <div className="ritual-steps"><div><b>1</b><span>Choose energy</span></div><div><b>2</b><span>Name one task</span></div><div><b>3</b><span>Stay until done</span></div></div>
                    <div className="section-title"><h2>Energy today</h2><p>Pick honestly.</p></div>
                    <div className="focus-depth-grid">
                      {(Object.entries(depths) as [keyof typeof depths, typeof depths.light][]).map(([id, item]) => (
                        <button key={id} className={`focus-choice ${state.selectedDepth === id ? "selected" : ""}`}
                          disabled={focusOperation !== null} onClick={() => save({ selectedDepth: id })}>
                          <span className="depth-icon">{item.icon}</span>
                          <strong>{item.label}</strong>
                          <span className="depth-meta">{item.minutes}m</span>
                          <span className="depth-roots">+{item.roots} roots</span>
                        </button>
                      ))}
                    </div>
                    <div className="section-title"><h2>One visible task</h2><p>No vague goals.</p></div>
                    <input className="input" maxLength={72} value={state.intention} disabled={focusOperation !== null}
                      onChange={(event) => save({ intention: event.target.value })} />
                    <button className="primary-btn" style={{ marginTop: 14 }} disabled={focusOperation !== null} onClick={handleStartFocus}>
                      {focusOperation === "starting" ? "Starting…" : `Start ${depth.minutes} minutes`}
                    </button>
                    <div style={{ textAlign: "center", marginTop: 10 }}>
                      <button type="button" className="ghost-btn" style={{ fontSize: 12, opacity: 0.8 }} onClick={() => { unlockAudio(); playCompletionRingtone(); notify("Playing ringtone chime 🔔"); }}>🔔 Test ringtone chime</button>
                    </div>
                  </>
                )}
              </section>
            ) : state.tab === "society" ? (
              <section>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Society</h2><p>Anonymous posts.</p></div>
                <div className="society-hero"><strong>A quiet anonymous forum for hard days.</strong><p>Share the small hard win, react gently, reply if it helps, and keep the room safe.</p></div>
                <div className="section-title"><h2>Post anonymously</h2><p>Small hard win.</p></div>
                <textarea className="textarea" maxLength={180} value={state.hardWinDraft} onChange={(event) => save({ hardWinDraft: event.target.value })} placeholder="Example: I opened the document and wrote two honest sentences." />
                <button className="primary-btn" style={{ marginTop: 10 }} disabled={postingWin || societyStatus === "loading"} onClick={() => { void handlePostSocietyWin(); }}>{postingWin ? "Sharing…" : "Post anonymously"}</button>
                <div className="section-title"><h2>Society feed</h2></div>
                {societyStatus === "loading" && <p role="status">Loading posts…</p>}
                {societyStatus === "error" && (
                  <div className="message-card" role="alert">
                    <strong>Could not load Society posts.</strong>
                    <button className="ghost-btn" type="button" disabled={postingWin} onClick={() => {
                      setSocietyStatus("loading");
                      setSocietyRetry((attempt) => attempt + 1);
                    }}>Retry Society</button>
                  </div>
                )}
                {societyStatus === "ready" && state.societyPosts.length === 0 && (
                  <div className="message-card"><strong>No posts yet.</strong><p>Share a small win to get things started.</p></div>
                )}
                {societyStatus !== "loading" && state.societyPosts.map((post) => {
                  const key = String(post.id);
                  const repliesOpen = openRepliesPostId === post.id;
                  return (
                    <article className="society-post" key={post.id}>
                      <div className="society-avatar">{post.icon}</div>
                      <div>
                        <div className="post-head">
                          <strong>Anonymous</strong>
                          <button
                            type="button"
                            className="ghost-btn"
                            style={{ padding: "3px 8px", fontSize: 11 }}
                            onClick={() => setOpenRepliesPostId(repliesOpen ? null : post.id)}
                          >
                            {post.comments.length} {post.comments.length === 1 ? "reply" : "replies"}
                          </button>
                        </div>
                        <p>{post.text}</p>
                        <div className="reaction-row">
                          {(["like", "love", "same", "proud"] as const).map((reaction) => (
                            <button
                              key={reaction}
                              className={`reaction-btn ${post.reacted === reaction ? "selected" : ""}`}
                              onClick={() => reactToPost(post, reaction)}
                            >
                              <span>{{ like: "👍", love: "❤️", same: "🤝", proud: "✨" }[reaction]}</span>
                              <strong>{reaction[0].toUpperCase() + reaction.slice(1)}</strong>
                              <em>{post.reactions[reaction]}</em>
                            </button>
                          ))}
                        </div>
                        {repliesOpen && (
                          <div style={{ marginTop: 8 }}>
                            {post.comments.map((comment) => (
                              <div className="comment" key={comment.id}>
                                <p>{comment.text}</p>
                              </div>
                            ))}
                            <div className="reply-box">
                              <input
                                className="input"
                                maxLength={240}
                                value={replyDrafts[key] || ""}
                                onChange={(event) => setReplyDrafts((current) => ({ ...current, [key]: event.target.value }))}
                                placeholder="Write a gentle reply…"
                              />
                              <button className="ghost-btn" onClick={() => { void handleReplyToPost(post); }}>Reply</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : state.tab === "settings" ? (
              <section>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Settings</h2><p>Make STILL yours.</p></div>
                <section className="settings-card"><strong>Profile</strong><p>Your name personalizes private screens.</p><input className="input" maxLength={24} value={state.userName} onChange={(event) => save({ userName: event.target.value })} onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name) void persistProfileName(name); }} /></section>
                <section className="settings-card"><strong>Appearance</strong><p>Choose the display mood.</p><div className="mode-grid"><button className={`mode-choice ${state.theme === "dark" ? "selected" : ""}`} onClick={() => save({ theme: "dark" })}><span>🌙</span><strong>Dark mode</strong><small>Low-light, calm, focused.</small></button><button className={`mode-choice ${state.theme === "normal" ? "selected" : ""}`} onClick={() => save({ theme: "normal" })}><span>☀️</span><strong>Normal mode</strong><small>Brighter, softer daytime UI.</small></button></div></section>
                {onSignOut && <button className="ghost-btn" style={{ width: "100%", marginTop: 12 }} onClick={() => { void signOut(); }}>Sign out</button>}
              </section>
            ) : (
              <section>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Collection</h2><p>{state.collectionPhotos.length} {state.collectionPhotos.length === 1 ? "proof" : "proofs"}</p></div>
                {collectionStatus === "error" && (
                  <div className="message-card" role="alert">
                    <strong>Could not refresh Collection.</strong>
                    <button className="ghost-btn" type="button" onClick={() => {
                      setCollectionStatus("loading");
                      refreshCollection();
                    }}>Retry Collection</button>
                  </div>
                )}
                {state.collectionPhotos.length === 0 ? (
                  collectionStatus === "loading" ? <p role="status">Loading photos…</p> :
                    collectionStatus === "ready" && <div className="message-card"><strong>Nothing collected yet.</strong><p>Save accepted habit photos or focus proof to see them here.</p></div>
                ) : (
                  <div className="collection-grid">
                    {state.collectionPhotos.map((photo) => (
                      <article className="collection-photo" key={photo.id}>
                        <CollectionImage key={photo.imageUrl} photo={photo} />
                        <div>
                          <strong>{photo.label}</strong>
                          <span>{photo.kind === "focus" ? "Focus" : "Habit"} · {new Date(photo.createdAt).toLocaleDateString()}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
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
