"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Mode = "restaurants" | "activities";

type Place = {
  id: string;
  name: string;
  type: string;
  location: string;
  blurb: string;
  priceLevel: "$" | "$$" | "$$$";
  distanceMiles: number;
  openNow: boolean;
  tags: string[];
  images: string[];
  mode: Mode;
  cuisineOrActivity: string; // e.g. "Steakhouse", "Bowling"
};

// --- Sample data (same style as other pages) ---

const PLACES: Place[] = [
  {
    id: "block16",
    name: "Block 16",
    type: "Restaurant • Burgers • Street Food",
    location: "Downtown Omaha, NE",
    blurb:
      "Crazy-good burgers, fries, and creative specials. Local favorite, always busy.",
    priceLevel: "$$",
    distanceMiles: 3,
    openNow: true,
    tags: ["casual", "local favorite", "burgers", "kid-friendly"],
    images: [
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1550547660-8d1d1a7d4793?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "restaurants",
    cuisineOrActivity: "Burgers / Street Food",
  },
  {
    id: "jcoco",
    name: "J. Coco",
    type: "Restaurant • Upscale • New American",
    location: "Omaha, NE",
    blurb:
      "Date-night spot with cocktails and elevated comfort food. Great for anniversaries or kid-free nights.",
    priceLevel: "$$$",
    distanceMiles: 7,
    openNow: false,
    tags: ["date night", "cocktails", "upscale", "21+"],
    images: [
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "restaurants",
    cuisineOrActivity: "Upscale / New American",
  },
  {
    id: "blue-sushi",
    name: "Blue Sushi Sake Grill",
    type: "Restaurant • Sushi • Drinks",
    location: "Multiple Omaha locations",
    blurb:
      "Rolls, happy hour, and a fun vibe. Easy pick when no one can decide what they want.",
    priceLevel: "$$",
    distanceMiles: 5,
    openNow: true,
    tags: ["sushi", "happy hour", "group friendly"],
    images: [
      "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "restaurants",
    cuisineOrActivity: "Sushi / Japanese",
  },
  {
    id: "drover",
    name: "The Drover",
    type: "Restaurant • Steakhouse",
    location: "Omaha, NE",
    blurb:
      "Classic Omaha whiskey steaks, old-school feel, and a heavier dinner when you want to splurge.",
    priceLevel: "$$$",
    distanceMiles: 9,
    openNow: true,
    tags: ["steak", "old school", "special occasion"],
    images: [
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "restaurants",
    cuisineOrActivity: "Steakhouse",
  },
  {
    id: "mark",
    name: "The Mark",
    type: "Bowling • Arcade • Bar",
    location: "West Omaha, NE",
    blurb:
      "Bowling, arcade games, food & drinks. Easy group spot when nobody can decide.",
    priceLevel: "$$",
    distanceMiles: 10,
    openNow: true,
    tags: ["bowling", "arcade", "groups", "kid-friendly"],
    images: [
      "https://images.unsplash.com/photo-1518131678677-bc1a4dca4ccb?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504274066651-8d1d1a7d4793?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "activities",
    cuisineOrActivity: "Bowling / Arcade",
  },
  {
    id: "funny-bone",
    name: "Funny Bone",
    type: "Comedy Club",
    location: "Village Pointe, Omaha, NE",
    blurb:
      "Stand-up comedy, drinks, and a night out that isn’t just dinner-and-a-movie.",
    priceLevel: "$$",
    distanceMiles: 8,
    openNow: false,
    tags: ["comedy", "night out", "date night", "21+"],
    images: [
      "https://images.unsplash.com/photo-1512428232641-8fcd1437a3a2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512428702800-1c8d5b4c3c56?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "activities",
    cuisineOrActivity: "Comedy Club",
  },
  {
    id: "escape",
    name: "Escape Room Omaha",
    type: "Escape Room • Team Activity",
    location: "Omaha, NE",
    blurb:
      "Puzzles, time pressure, and team banter. Great for double dates or friend groups.",
    priceLevel: "$$",
    distanceMiles: 4,
    openNow: true,
    tags: ["puzzles", "teamwork", "indoor"],
    images: [
      "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "activities",
    cuisineOrActivity: "Escape Room",
  },
];

const PRICE_TEXT: Record<"$" | "$$" | "$$$", string> = {
  $: "$",
  $$: "$$",
  $$$: "$$$",
};

// --- Round Config Types / Helpers ---

type Phase = "setup" | "rounds" | "winner";

type RoundConfig = {
  roundNumber: number;
  keepCount: number | null; // null = discovery / unlimited list
  label: string;
};

type VoteVisibility = "realtime" | "hidden";

type ChatMessage = {
  id: string;
  userName: string;
  text: string;
  likes: number;
  createdAt: string;
};

function generateGroupCode() {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `LG-${n}`;
}

// helper to convert hours + minutes -> seconds
function computeRoundSeconds(hours: number, minutes: number) {
  const safeH = Math.max(0, hours);
  const safeM = Math.max(0, Math.min(59, minutes));
  const totalMinutes = safeH * 60 + safeM;
  if (totalMinutes <= 0) return 0;
  return totalMinutes * 60;
}

export default function GroupPage() {
  // Phase + group meta
  const [phase, setPhase] = useState<Phase>("setup");
  const [groupCode] = useState<string>(() => generateGroupCode());
  const [groupName, setGroupName] = useState<string>("Friday Night Dinner");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // ⬇️ changed: split hours + minutes
  const [roundHours, setRoundHours] = useState<number>(24);
  const [roundMinutes, setRoundMinutes] = useState<number>(0);

  const [numRounds, setNumRounds] = useState<number>(4); // 1 discovery + 3 vote rounds
  const [roundKeepCounts, setRoundKeepCounts] = useState<Record<number, number>>({
    2: 5,
    3: 3,
    4: 1,
  });

  const [voteVisibility, setVoteVisibility] =
    useState<VoteVisibility>("realtime");
  const [maxVotesPerPerson, setMaxVotesPerPerson] = useState<number>(3);
  const [allowUserInvites, setAllowUserInvites] = useState<boolean>(true);

  // Voting / rounds state
  const [mode, setMode] = useState<Mode>("restaurants");
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [roundConfigs, setRoundConfigs] = useState<RoundConfig[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]); // in the running
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [searchText, setSearchText] = useState<string>("");
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [filterOpenNow, setFilterOpenNow] = useState<boolean>(false);
  const [filterKidFriendly, setFilterKidFriendly] = useState<boolean>(false);
  const [filterAdults, setFilterAdults] = useState<boolean>(false);
  const [cuisineFilter, setCuisineFilter] = useState<string>("all");

  // Timer (simplified per-round seconds)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Winner
  const [winnerId, setWinnerId] = useState<string | null>(null);

  // Chat
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "m1",
      userName: "Alex",
      text: "I’m good with sushi or burgers.",
      likes: 2,
      createdAt: "Just now",
    },
    {
      id: "m2",
      userName: "Sam",
      text: "Can we keep it under 20 min drive?",
      likes: 1,
      createdAt: "1 min ago",
    },
  ]);
  const [chatDraft, setChatDraft] = useState<string>("");

  // Build round config when starting group
  function handleStartGroup() {
    const configs: RoundConfig[] = [];
    configs.push({
      roundNumber: 1,
      keepCount: null,
      label: "Round 1 — Idea dump / discovery",
    });
    for (let r = 2; r <= numRounds; r++) {
      const keep =
        r === numRounds ? 1 : roundKeepCounts[r] || (r === 2 ? 5 : 3);
      configs.push({
        roundNumber: r,
        keepCount: keep,
        label:
          r === numRounds
            ? "Final round — pick tonight’s spot"
            : `Round ${r} — cut it down to ${keep}`,
      });
    }
    setRoundConfigs(configs);
    setCurrentRound(1);
    setPhase("rounds");
    setActiveIds([]);
    setVotes({});
    setWinnerId(null);
    // ⬇️ use hours + minutes for timer
    setSecondsLeft(computeRoundSeconds(roundHours, roundMinutes));
  }

  // Timer effect
  useEffect(() => {
    if (phase !== "rounds" || secondsLeft === null) return;
    if (secondsLeft <= 0) return;

    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [phase, secondsLeft]);

  const currentRoundConfig = roundConfigs.find(
    (r) => r.roundNumber === currentRound
  );

  const isFinalRound =
    currentRoundConfig?.roundNumber === numRounds ||
    currentRoundConfig?.keepCount === 1;

  // Filter places for current mode + filters
  const filteredPlaces: Place[] = useMemo(() => {
    const base = PLACES.filter((p) => p.mode === mode);

    const text = searchText.trim().toLowerCase();
    let result = base.filter((p) => {
      const matchesText =
        text.length === 0 ||
        p.name.toLowerCase().includes(text) ||
        p.location.toLowerCase().includes(text) ||
        p.tags.some((t) => t.toLowerCase().includes(text));
      const matchesDistance =
        maxDistance === null || p.distanceMiles <= maxDistance;
      const matchesOpen = !filterOpenNow || p.openNow;
      const matchesKid =
        !filterKidFriendly || p.tags.includes("kid-friendly");
      const matches21 = !filterAdults || p.tags.includes("21+");
      const matchesCuisine =
        cuisineFilter === "all" ||
        p.cuisineOrActivity === cuisineFilter;

      return (
        matchesText &&
        matchesDistance &&
        matchesOpen &&
        matchesKid &&
        matches21 &&
        matchesCuisine
      );
    });

    // Round 1 shows everything; later rounds only show in-running items
    if (phase === "rounds" && currentRound > 1) {
      result = result.filter((p) => activeIds.includes(p.id));
    }

    return result;
  }, [
    mode,
    searchText,
    maxDistance,
    filterOpenNow,
    filterKidFriendly,
    filterAdults,
    cuisineFilter,
    activeIds,
    phase,
    currentRound,
  ]);

  // All distinct cuisines / activities for dropdown
  const cuisineOptions = useMemo(() => {
    const forMode = PLACES.filter((p) => p.mode === mode);
    const set = new Set<string>();
    forMode.forEach((p) => set.add(p.cuisineOrActivity));
    return Array.from(set);
  }, [mode]);

  // Round 1 add/remove selection (host & each user add their own in real app; here it's just local)
  function toggleRound1Selection(id: string) {
    setActiveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Voting handler for later rounds
  function handleVote(id: string, delta: 1 | -1) {
    if (currentRound === 1 || phase !== "rounds") return;
    setVotes((prev) => {
      const current = prev[id] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  }

  // Host advances round (either when timer hits 0 or manual)
  function advanceRound() {
    if (phase !== "rounds" || !currentRoundConfig) return;

    // Discovery -> move to first voting round (2)
    if (currentRound === 1) {
      if (activeIds.length === 0) return;
      setVotes({});
      setCurrentRound(2);
      setSecondsLeft(computeRoundSeconds(roundHours, roundMinutes));
      return;
    }

    // Voting rounds
    const keepCount = currentRoundConfig.keepCount;
    if (!keepCount || activeIds.length === 0) return;

    const inRunning = PLACES.filter((p) => activeIds.includes(p.id));

    // Sort by vote count desc, tie-break by name
    const sorted = [...inRunning].sort((a, b) => {
      const va = votes[a.id] ?? 0;
      const vb = votes[b.id] ?? 0;
      if (vb !== va) return vb - va;
      return a.name.localeCompare(b.name);
    });

    const kept = sorted.slice(0, keepCount);
    const keptIds = kept.map((p) => p.id);

    setActiveIds(keptIds);
    setVotes({});

    if (isFinalRound || keepCount === 1) {
      // Winner determined
      const winner = kept[0] ?? null;
      setWinnerId(winner ? winner.id : null);
      setPhase("winner");
      setSecondsLeft(null);
    } else {
      // Move to next round
      setCurrentRound((prev) => prev + 1);
      setSecondsLeft(computeRoundSeconds(roundHours, roundMinutes));
    }
  }

  const canAdvanceRound = useMemo(() => {
    if (phase !== "rounds" || !currentRoundConfig) return false;

    if (currentRound === 1) {
      return activeIds.length > 0;
    }

    // For voting rounds, need at least one place with votes
    const inRunning = PLACES.filter((p) => activeIds.includes(p.id));
    const withVotes = inRunning.filter((p) => (votes[p.id] ?? 0) > 0);
    return withVotes.length > 0;
  }, [phase, currentRound, currentRoundConfig, activeIds, votes]);

  function resetGroup() {
    setPhase("setup");
    setActiveIds([]);
    setVotes({});
    setWinnerId(null);
    setCurrentRound(1);
    setSecondsLeft(null);
  }

  // Timer text helper
  function formatSeconds(sec: number | null): string {
    if (sec === null) return "--:--";
    if (sec <= 0) return "00:00";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const mm = m.toString().padStart(2, "0");
    const ss = s.toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // Chat actions
  function sendChatMessage() {
    const text = chatDraft.trim();
    if (!text) return;
    const newMessage: ChatMessage = {
      id: `m-${Date.now()}`,
      userName: "You",
      text,
      likes: 0,
      createdAt: "Just now",
    };
    // ⬇️ append so newest ends up at the bottom
    setChatMessages((prev) => [...prev, newMessage]);
    setChatDraft("");
  }

  function likeChatMessage(id: string) {
    setChatMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, likes: m.likes + 1 } : m
      )
    );
  }

  const winnerPlace = winnerId
    ? PLACES.find((p) => p.id === winnerId)
    : null;

  // --- Render ---

  // Winner screen is its own full view
  if (phase === "winner" && winnerPlace) {
    return (
      <main className="min-h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white flex flex-col items-center">
        <div className="w-full max-w-3xl px-4 pt-6 pb-10 flex flex-col gap-4 relative overflow-hidden">
          {/* Confetti-ish background accents */}
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-pink-500/30 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-sky-400/30 blur-3xl" />
          </div>

          {/* Top bar */}
          <header className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <img
                src="/lg-logo.png"
                alt="Let'sGo logo"
                className="h-9 w-9 rounded-xl object-contain"
              />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.25em] text-white/60">
                  Let&apos;sGo — Group Winner
                </span>
                <span className="text-xs text-white/80">
                  Group: {groupName || "Untitled group"} ({groupCode})
                </span>
              </div>
            </div>

            <Link
              href="/"
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/20 text-[11px] hover:bg-white/10"
            >
              ⟵ Home
            </Link>
          </header>

          {/* Winner card */}
          <section className="relative z-10 mt-2 rounded-3xl border border-emerald-400/60 bg-gradient-to-br from-emerald-500/10 via-black/80 to-sky-500/15 px-4 py-5 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
            <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300 mb-2">
              Tonight&apos;s winner 🎉
            </p>
            <h1 className="text-2xl font-bold mb-1">{winnerPlace.name}</h1>
            <p className="text-sm text-white/80 mb-1">{winnerPlace.type}</p>
            <p className="text-xs text-white/70 mb-3">
              {winnerPlace.location}
            </p>

            <div className="rounded-2xl overflow-hidden border border-white/20 bg-black/50 mb-3">
              <div className="w-full h-52 sm:h-64 overflow-x-auto no-scrollbar flex snap-x snap-mandatory">
                {winnerPlace.images.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative flex-shrink-0 w-full h-full snap-center"
                  >
                    <img
                      src={src}
                      alt={`${winnerPlace.name} photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm text-white/75 mb-3">
              {winnerPlace.blurb}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/80">
              <div className="flex gap-3">
                <span>{PRICE_TEXT[winnerPlace.priceLevel]}</span>
                <span>{winnerPlace.distanceMiles} mi away</span>
                {winnerPlace.openNow ? (
                  <span className="text-emerald-300 font-semibold">
                    Open now
                  </span>
                ) : (
                  <span className="text-red-300 font-semibold">
                    Closed
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded-full bg-white/10 border border-white/25 text-[11px] hover:bg-white/15">
                  Share to group (placeholder)
                </button>
                <button className="px-3 py-1 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 text-black text-[11px] font-semibold shadow-lg shadow-emerald-500/30">
                  Send summary email (placeholder)
                </button>
              </div>
            </div>
          </section>

          <div className="relative z-10 flex justify-between items-center mt-2 text-[11px] text-white/60">
            <span>
              Screenshot this and drop it in the group chat so nobody can
              say they didn&apos;t agree. 😄
            </span>
            <button
              onClick={resetGroup}
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/20 hover:bg-white/10"
            >
              Start a new group
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Normal setup + rounds view
  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white flex flex-col items-center">
      <div className="w-full max-w-5xl px-4 pt-4 pb-24 flex flex-col gap-4">
        {/* TOP BAR */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/lg-logo.png"
              alt="Let&apos;sGo logo"
              className="h-9 w-9 rounded-xl object-contain"
            />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/60">
                Let&apos;sGo — Group Pick
              </span>
              <span className="text-xs text-white/75">
                {phase === "setup"
                  ? "Set up a multi-round group vote"
                  : `Group: ${groupName || "Untitled group"} · Code: ${
                      groupCode
                    }`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/20 hover:bg-white/10"
            >
              ⟵ Home
            </Link>
            {phase !== "setup" && (
              <button
                onClick={resetGroup}
                className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/20 hover:bg-white/10"
              >
                Restart group
              </button>
            )}
          </div>
        </header>

        {/* PHASE 0: SETUP */}
        {phase === "setup" && (
          <section className="mt-2 rounded-3xl border border-white/15 bg-black/70 px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-pink-300/80 mb-1">
                Group Setup
              </p>
              <h1 className="text-lg sm:text-xl font-semibold mb-1">
                Configure tonight&apos;s group decision
              </h1>
              <p className="text-xs sm:text-sm text-white/70">
                You are the host. You control rounds, invites, and tie-breakers.
                Everyone else joins using the group code or invite link.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="text-white/70">Group name</span>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="rounded-lg bg-slate-950/80 border border-white/20 px-3 py-1.5 text-xs outline-none focus:border-pink-400/80"
                    placeholder="e.g. Friday dinner, Sunday brunch crew..."
                  />
                </label>

                <div className="flex gap-2">
                  <label className="flex-1 flex flex-col gap-1">
                    <span className="text-white/70">Start date</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded-lg bg-slate-950/80 border border-white/20 px-3 py-1.5 text-xs outline-none focus:border-pink-400/80"
                    />
                  </label>
                  <label className="flex-1 flex flex-col gap-1">
                    <span className="text-white/70">End date</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-lg bg-slate-950/80 border border-white/20 px-3 py-1.5 text-xs outline-none focus:border-pink-400/80"
                    />
                  </label>
                </div>

                {/* ⬇️ hours + minutes inputs */}
                <label className="flex flex-col gap-1">
                  <span className="text-white/70">
                    Time between rounds
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        value={roundHours}
                        onChange={(e) =>
                          setRoundHours(
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-20 rounded-lg bg-slate-950/80 border border-white/20 px-3 py-1.5 text-xs outline-none focus:border-pink-400/80"
                      />
                      <span className="text-white/65 text-[11px]">
                        hours
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={roundMinutes}
                        onChange={(e) =>
                          setRoundMinutes(
                            Math.min(
                              59,
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          )
                        }
                        className="w-20 rounded-lg bg-slate-950/80 border border-white/20 px-3 py-1.5 text-xs outline-none focus:border-pink-400/80"
                      />
                      <span className="text-white/65 text-[11px]">
                        mins
                      </span>
                    </div>
                  </div>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-white/70">
                    Number of rounds (including final)
                  </span>
                  <input
                    type="number"
                    min={2}
                    max={5}
                    value={numRounds}
                    onChange={(e) =>
                      setNumRounds(
                        Math.min(5, Math.max(2, Number(e.target.value) || 2))
                      )
                    }
                    className="rounded-lg bg-slate-950/80 border border-white/20 px-3 py-1.5 text-xs outline-none focus:border-pink-400/80"
                  />
                  <span className="text-[10px] text-white/45">
                    Round 1 is always discovery. The final round locks in a
                    single winner.
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-2 text-xs">
                {/* Round keep counts */}
                <div className="rounded-xl bg-slate-950/80 border border-white/15 px-3 py-2 flex flex-col gap-1.5">
                  <span className="text-white/75 text-[11px] font-semibold">
                    Selections allowed per round
                  </span>
                  {Array.from({ length: Math.max(2, numRounds - 1) }).map(
                    (_, idx) => {
                      const roundNumber = idx + 2;
                      const isFinal = roundNumber === numRounds;
                      if (roundNumber > numRounds) return null;
                      return (
                        <div
                          key={roundNumber}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-white/65">
                            {isFinal
                              ? `Round ${roundNumber} (final)`
                              : `Round ${roundNumber}`}
                          </span>
                          {isFinal ? (
                            <span className="text-white/60 text-[11px]">
                              Keep <span className="font-semibold">1</span>{" "}
                              (winner)
                            </span>
                          ) : (
                            <input
                              type="number"
                              min={2}
                              max={10}
                              value={roundKeepCounts[roundNumber] ?? ""}
                              onChange={(e) =>
                                setRoundKeepCounts((prev) => ({
                                  ...prev,
                                  [roundNumber]:
                                    Number(e.target.value) || 2,
                                }))
                              }
                              className="w-16 rounded-lg bg-black/50 border border-white/25 px-2 py-1 text-[11px] text-right outline-none focus:border-pink-400/80"
                            />
                          )}
                        </div>
                      );
                    }
                  )}
                  <span className="text-[10px] text-white/45">
                    These control how many options survive each voting round.
                  </span>
                </div>

                <div className="rounded-xl bg-slate-950/80 border border-white/15 px-3 py-2 flex flex-col gap-1.5">
                  <span className="text-white/75 text-[11px] font-semibold">
                    Voting options
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70 text-[11px]">
                      Vote visibility
                    </span>
                    <div className="flex gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setVoteVisibility("realtime")}
                        className={`px-2 py-0.5 rounded-full border text-xs ${
                          voteVisibility === "realtime"
                            ? "bg-white text-black border-white"
                            : "bg-black/40 border-white/30 text-white/70"
                        }`}
                      >
                        Realtime
                      </button>
                      <button
                        type="button"
                        onClick={() => setVoteVisibility("hidden")}
                        className={`px-2 py-0.5 rounded-full border text-xs ${
                          voteVisibility === "hidden"
                            ? "bg-white text-black border-white"
                            : "bg-black/40 border-white/30 text-white/70"
                        }`}
                      >
                        Hidden
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center justify-between gap-2">
                    <span className="text-white/70 text-[11px]">
                      Max votes per person / round
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={maxVotesPerPerson}
                      onChange={(e) =>
                        setMaxVotesPerPerson(
                          Math.max(1, Number(e.target.value) || 1)
                        )
                      }
                      className="w-16 rounded-lg bg-black/50 border border-white/25 px-2 py-1 text-[11px] text-right outline-none focus:border-pink-400/80"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-white/70 text-[11px]">
                      Players can invite others anytime
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAllowUserInvites((prev) => !prev)
                      }
                      className={`w-12 h-6 rounded-full border flex items-center px-1 transition-colors ${
                        allowUserInvites
                          ? "bg-emerald-400/80 border-emerald-300 justify-end"
                          : "bg-black/60 border-white/30 justify-start"
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-white" />
                    </button>
                  </label>

                  <span className="text-[10px] text-white/45 mt-0.5">
                    Host can always add or remove participants. Players can
                    never remove others.
                  </span>
                </div>

                <div className="mt-1 text-[11px] text-white/60">
                  <span className="font-semibold">
                    Group code: {groupCode}
                  </span>
                  <span className="ml-2 text-white/40">
                    (shared via link in a real build)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-1">
              <button
                type="button"
                onClick={handleStartGroup}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-orange-400 text-black text-xs sm:text-sm font-semibold shadow-lg shadow-pink-500/40"
              >
                Start Round 1
              </button>
            </div>
          </section>
        )}

        {/* PHASE: ROUNDS */}
        {phase === "rounds" && currentRoundConfig && (
          <>
            {/* Round info + controls */}
            <section className="mt-1 flex flex-col gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-sky-300/80 mb-1">
                  {currentRound === 1
                    ? "Round 1 — Idea round"
                    : `Round ${currentRound} of ${numRounds}`}
                </p>
                <h1 className="text-xl font-semibold mb-1">
                  {currentRoundConfig.label}
                </h1>
                <p className="text-xs sm:text-sm text-white/70">
                  {currentRound === 1
                    ? "Everyone adds places they’d actually go to. Unlimited adds until the host advances."
                    : "Each person votes on the in-running places. Host can advance when it feels fair or when the timer ends."}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/65">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Time left:{" "}
                    <span className="font-mono">
                      {formatSeconds(secondsLeft)}
                    </span>{" "}
                    (mock countdown)
                  </span>
                  <span>
                    Mode:{" "}
                    <span className="font-semibold">
                      {mode === "restaurants"
                        ? "Restaurants"
                        : "Activities"}
                    </span>
                  </span>
                  {currentRound > 1 && currentRoundConfig.keepCount && (
                    <span>
                      This round keeps{" "}
                      <span className="font-semibold">
                        {isFinalRound
                          ? "1 (winner)"
                          : currentRoundConfig.keepCount}
                      </span>
                    </span>
                  )}
                  <span>
                    Votes:{" "}
                    <span className="font-semibold">
                      max {maxVotesPerPerson} / person
                    </span>
                  </span>
                  <span>
                    Visibility:{" "}
                    <span className="font-semibold">
                      {voteVisibility === "realtime"
                        ? "Realtime"
                        : "Hidden"}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setChatOpen(true)}
                    className="px-3 py-1 rounded-full bg-white/5 border border-white/20 text-[11px] hover:bg-white/10"
                  >
                    💬 Group chat
                  </button>
                  <button
                    type="button"
                    onClick={advanceRound}
                    disabled={!canAdvanceRound}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
                      canAdvanceRound
                        ? "bg-sky-500 text-black hover:bg-sky-400"
                        : "bg-white/5 text-white/35 cursor-not-allowed"
                    }`}
                  >
                    {currentRound === 1
                      ? "Start voting"
                      : isFinalRound
                      ? "Lock winner"
                      : "Next round"}
                  </button>
                </div>
              </div>
            </section>

            {/* Filters */}
            <section className="mt-2 rounded-2xl border border-white/15 bg-black/70 px-4 py-3 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                {/* Mode toggle */}
                <div className="relative w-full sm:w-72 p-1 rounded-full bg-slate-900/80 border border-white/20 text-[11px] text-white/70">
                  <span
                    className="absolute inset-y-1 w-1/2 rounded-full bg-white text-black shadow-md shadow-black/40 transition-transform duration-300"
                    style={{
                      transform:
                        mode === "restaurants"
                          ? "translateX(0%)"
                          : "translateX(100%)",
                    }}
                  />
                  <div className="relative z-10 grid grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setMode("restaurants")}
                      className={`py-1 rounded-full transition-colors ${
                        mode === "restaurants"
                          ? "font-semibold text-black"
                          : "text-white/65"
                      }`}
                    >
                      Restaurants
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("activities")}
                      className={`py-1 rounded-full transition-colors ${
                        mode === "activities"
                          ? "font-semibold text-black"
                          : "text-white/65"
                      }`}
                    >
                      Activities
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="flex-1">
                  <input
                    type="search"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search by name, area, tag..."
                    className="w-full rounded-full bg-slate-950/80 border border-white/20 px-3 py-1.5 text-[12px] outline-none focus:border-sky-400/80"
                  />
                </div>
              </div>

              {/* Secondary filters */}
              <div className="flex flex-wrap gap-2 text-[11px] items-center">
                <div className="flex items-center gap-1">
                  <span className="text-white/65">Within</span>
                  <select
                    value={maxDistance === null ? "any" : String(maxDistance)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMaxDistance(v === "any" ? null : Number(v));
                    }}
                    className="rounded-full bg-black/60 border border-white/25 px-2 py-1 outline-none"
                  >
                    <option value="any">Any distance</option>
                    <option value="5">5 mi</option>
                    <option value="10">10 mi</option>
                    <option value="15">15 mi</option>
                    <option value="20">20 mi</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-white/65">
                    {mode === "restaurants" ? "Cuisine" : "Activity"}
                  </span>
                  <select
                    value={cuisineFilter}
                    onChange={(e) => setCuisineFilter(e.target.value)}
                    className="rounded-full bg-black/60 border border-white/25 px-2 py-1 outline-none"
                  >
                    <option value="all">All</option>
                    {cuisineOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setFilterOpenNow((prev) => !prev)
                  }
                  className={`px-2 py-1 rounded-full border text-[11px] ${
                    filterOpenNow
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                      : "bg-black/60 border-white/25 text-white/70"
                  }`}
                >
                  Open now
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFilterKidFriendly((prev) => !prev)
                  }
                  className={`px-2 py-1 rounded-full border text-[11px] ${
                    filterKidFriendly
                      ? "bg-amber-400/20 border-amber-300 text-amber-100"
                      : "bg-black/60 border-white/25 text-white/70"
                  }`}
                >
                  Kid friendly
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFilterAdults((prev) => !prev)
                  }
                  className={`px-2 py-1 rounded-full border text-[11px] ${
                    filterAdults
                      ? "bg-purple-500/25 border-purple-300 text-purple-100"
                      : "bg-black/60 border-white/25 text-white/70"
                  }`}
                >
                  21+
                </button>
              </div>
            </section>

            {/* Places list */}
            <section className="mt-3 space-y-3 sm:space-y-4">
              {filteredPlaces.map((place) => {
                const isSelected = activeIds.includes(place.id);
                const voteCount = votes[place.id] ?? 0;
                const showVotes = voteVisibility === "realtime";

                return (
                  <div
                    key={place.id}
                    className={`w-full rounded-2xl border px-3 py-3 sm:px-4 sm:py-4 bg-slate-900/80 hover:border-sky-400/70 transition-all ${
                      isSelected
                        ? "border-sky-400/80 shadow-[0_0_0_1px_rgba(56,189,248,0.45)]"
                        : "border-white/10"
                    }`}
                  >
                    <div className="flex gap-3 sm:gap-4 items-stretch">
                      {/* Image carousel */}
                      <div className="w-28 sm:w-36 flex-shrink-0 rounded-xl overflow-hidden border border-white/15 bg-black/40">
                        <div className="h-full w-full overflow-x-auto no-scrollbar flex snap-x snap-mandatory">
                          {place.images.map((src, idx) => (
                            <div
                              key={idx}
                              className="relative flex-shrink-0 w-full h-24 sm:h-28 snap-center"
                            >
                              <img
                                src={src}
                                alt={`${place.name} photo ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.22em] text-sky-300/80 mb-0.5">
                                {mode === "restaurants"
                                  ? "Restaurant"
                                  : "Activity"}{" "}
                                candidate
                              </p>
                              <h2 className="text-sm sm:text-base font-semibold">
                                {place.name}
                              </h2>
                              <p className="text-[11px] text-white/70">
                                {place.type}
                              </p>
                            </div>
                            <div className="text-right text-[10px] text-white/65 whitespace-nowrap pl-1">
                              <div>{PRICE_TEXT[place.priceLevel]}</div>
                              <div>{place.distanceMiles} mi</div>
                              {place.openNow && (
                                <div className="text-emerald-300">
                                  Open now
                                </div>
                              )}
                            </div>
                          </div>

                          <p className="text-[11px] text-white/60 mt-1">
                            {place.location}
                          </p>
                          <p className="text-[11px] text-white/55 mt-1 line-clamp-2">
                            {place.blurb}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-[9px] text-white/70">
                              {place.cuisineOrActivity}
                            </span>
                            {place.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] text-white/65"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Bottom actions */}
                        {currentRound === 1 ? (
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[10px] text-white/55">
                              {isSelected
                                ? "In this group’s list."
                                : "Not added yet — tap to include it."}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                toggleRound1Selection(place.id)
                              }
                              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                isSelected
                                  ? "bg-slate-800 border border-sky-400/80 text-sky-200 hover:bg-slate-700"
                                  : "bg-sky-500 text-black hover:bg-sky-400"
                              }`}
                            >
                              {isSelected
                                ? "Remove from list"
                                : "Add to list"}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleVote(place.id, -1)
                                }
                                className="h-7 w-7 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-xs hover:bg-white/10"
                              >
                                −
                              </button>
                              <span className="text-xs">
                                {showVotes ? (
                                  <>
                                    <span className="font-semibold">
                                      {voteCount}
                                    </span>{" "}
                                    vote
                                    {voteCount === 1 ? "" : "s"}
                                  </>
                                ) : (
                                  <span className="text-white/50">
                                    Votes hidden
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleVote(place.id, 1)
                                }
                                className="h-7 px-3 rounded-full border border-sky-400/80 bg-sky-500/20 text-xs font-semibold hover:bg-sky-500/30"
                              >
                                + Vote
                              </button>
                            </div>

                            <span className="text-[10px] text-white/50">
                              Raise hands → host taps + to log votes
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredPlaces.length === 0 && (
                <p className="text-sm text-white/60">
                  No places match your filters yet. Try changing search or
                  distance.
                </p>
              )}
            </section>
          </>
        )}
      </div>

      {/* Bottom bar for quick hints (rounds only) */}
      {phase === "rounds" && (
        <div className="fixed bottom-0 inset-x-0 bg-black/90 border-t border-white/10">
          <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-2 text-[11px] sm:text-xs text-white/70">
            {currentRound === 1 ? (
              <>
                <span className="pr-3">
                  Use search & filters, then tap{" "}
                  <strong>Add to list</strong> for every place the group
                  would actually go to. When it feels good, the host taps{" "}
                  <strong>Start voting</strong>.
                </span>
                <button
                  onClick={advanceRound}
                  disabled={!canAdvanceRound}
                  className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors ${
                    canAdvanceRound
                      ? "bg-sky-500 text-black hover:bg-sky-400"
                      : "bg-white/5 text-white/40 cursor-not-allowed"
                  }`}
                >
                  Start voting
                </button>
              </>
            ) : (
              <>
                <span className="pr-3">
                  Run hands-up votes, tap <strong>+ Vote</strong> to log
                  them. When it feels fair, host taps{" "}
                  <strong>
                    {isFinalRound ? "Lock winner" : "Next round"}
                  </strong>
                  .
                </span>
                <button
                  onClick={advanceRound}
                  disabled={!canAdvanceRound}
                  className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors ${
                    canAdvanceRound
                      ? "bg-sky-500 text-black hover:bg-sky-400"
                      : "bg-white/5 text-white/40 cursor-not-allowed"
                  }`}
                >
                  {isFinalRound ? "Lock winner" : "Next round"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* CHAT PANEL (50% height) */}
      {chatOpen && (
        <div className="fixed bottom-0 inset-x-0 h-1/2 bg-black/95 border-t border-white/15 z-40 flex flex-col">
          <div className="px-4 py-2 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                Group chat
              </span>
              <span className="text-[11px] text-white/45">
                ({groupName || "Untitled group"})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="text-[11px] px-2 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              Close
            </button>
          </div>

          {/* ⬇️ messages anchored at bottom like a chat app */}
          <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2 justify-end">
            {chatMessages.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white/85">
                    {m.userName}
                  </span>
                  <span className="text-[10px] text-white/45">
                    {m.createdAt}
                  </span>
                </div>
                <p className="text-white/80 text-[11px]">{m.text}</p>
                <button
                  type="button"
                  onClick={() => likeChatMessage(m.id)}
                  className="self-start mt-0.5 text-[10px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20"
                >
                  ❤️ {m.likes}
                </button>
              </div>
            ))}

            {chatMessages.length === 0 && (
              <p className="text-xs text-white/50">
                No messages yet. Be the first to say hi.
              </p>
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-2 flex items-center gap-2">
            <input
              type="text"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-full bg-slate-900 border border-white/20 px-3 py-1.5 text-xs outline-none focus:border-sky-400/70"
            />
            <button
              type="button"
              onClick={sendChatMessage}
              className="px-3 py-1.5 rounded-full bg-sky-500 text-black text-xs font-semibold hover:bg-sky-400"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </main>
  );
}