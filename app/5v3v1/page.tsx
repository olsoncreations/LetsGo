"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";

type Mode = "restaurants" | "activities";
type Step = 1 | 2 | 3;

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
  mapQuery: string;
  category: Mode;
  // For restaurants this is cuisine; for activities this is activity type
  cuisine: string;
  outdoorSeating?: boolean;
  familyFriendly?: boolean;
  zip?: string;
};

const PRICE_TEXT: Record<"$" | "$$" | "$$$", string> = {
  $: "$",
  $$: "$$",
  $$$: "$$$",
};

const CUISINE_OPTIONS = [
  "Any cuisine",
  "American",
  "Burgers",
  "Steakhouse",
  "Sushi / Japanese",
  "Mexican",
  "Chinese",
  "Italian",
  "BBQ / Southern",
  "Seafood",
  "Mediterranean",
  "Indian",
  "Thai",
  "Pizza",
  "Breakfast / Brunch",
  "Fast casual",
  "Bar / Pub",
  "Coffee / Café",
  "Dessert",
  "Other",
];

const ACTIVITY_OPTIONS = [
  "Any activity",
  "Bowling / arcade",
  "Mini golf (putt putt)",
  "Go karts",
  "Escape room",
  "Comedy club",
  "Sports bar",
  "Live music",
  "Trivia night",
  "Other activity",
];

const ALL_PLACES: Place[] = [
  {
    id: "block16",
    name: "Block 16",
    type: "Restaurant • Burgers • Street Food",
    location: "Downtown Omaha, NE 68102",
    blurb:
      "Crazy-good burgers, fries, and creative specials. Local favorite, always busy.",
    priceLevel: "$$",
    distanceMiles: 3,
    openNow: true,
    tags: ["burgers", "casual", "local favorite"],
    images: [
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1550547660-8d1d1a7d4793?auto=format&fit=crop&w=1200&q=80",
    ],
    mapQuery: "Block 16 Omaha NE",
    category: "restaurants",
    cuisine: "Burgers",
    outdoorSeating: false,
    familyFriendly: true,
    zip: "68102",
  },
  {
    id: "jcoco",
    name: "J. Coco",
    type: "Restaurant • Upscale • New American",
    location: "Omaha, NE 68124",
    blurb:
      "Date-night spot with cocktails and elevated comfort food. Great for anniversaries or kid-free nights.",
    priceLevel: "$$$",
    distanceMiles: 7,
    openNow: false,
    tags: ["upscale", "date night"],
    images: [
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
    ],
    mapQuery: "J Coco Omaha NE",
    category: "restaurants",
    cuisine: "American",
    outdoorSeating: false,
    familyFriendly: false,
    zip: "68124",
  },
  {
    id: "blue-sushi",
    name: "Blue Sushi Sake Grill",
    type: "Restaurant • Sushi • Drinks",
    location: "Multiple Omaha locations (example 68118)",
    blurb:
      "Rolls, happy hour, and a fun vibe. Easy pick when no one can decide what they want.",
    priceLevel: "$$",
    distanceMiles: 5,
    openNow: true,
    tags: ["sushi", "happy hour"],
    images: [
      "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80",
    ],
    mapQuery: "Blue Sushi Omaha NE",
    category: "restaurants",
    cuisine: "Sushi / Japanese",
    outdoorSeating: true,
    familyFriendly: true,
    zip: "68118",
  },
  {
    id: "drover",
    name: "The Drover",
    type: "Restaurant • Steakhouse",
    location: "Omaha, NE 68154",
    blurb:
      "Classic Omaha whiskey steaks, old-school feel, and a heavier dinner when you want to splurge.",
    priceLevel: "$$$",
    distanceMiles: 9,
    openNow: true,
    tags: ["steak", "special occasion"],
    images: [
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=1200&q=80",
    ],
    mapQuery: "The Drover Omaha NE",
    category: "restaurants",
    cuisine: "Steakhouse",
    outdoorSeating: false,
    familyFriendly: false,
    zip: "68154",
  },
  {
    id: "funny-bone",
    name: "Funny Bone",
    type: "Comedy Club",
    location: "Village Pointe, Omaha, NE 68118",
    blurb:
      "Stand-up comedy, drinks, and a night out that isn’t just dinner-and-a-movie.",
    priceLevel: "$$",
    distanceMiles: 8,
    openNow: false,
    tags: ["comedy", "night out", "date night"],
    images: [
      "https://images.unsplash.com/photo-1512428232641-8fcd1437a3a2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512428702800-1c8d5b4c3c56?auto=format&fit=crop&w=1200&q=80",
    ],
    mapQuery: "Funny Bone Omaha NE",
    category: "activities",
    cuisine: "Comedy club",
    familyFriendly: false,
    outdoorSeating: false,
    zip: "68118",
  },
  {
    id: "mark",
    name: "The Mark",
    type: "Bowling • Arcade • Bar",
    location: "West Omaha, NE 68116",
    blurb:
      "Bowling, arcade games, food & drinks. Easy group spot when nobody can decide.",
    priceLevel: "$$",
    distanceMiles: 10,
    openNow: true,
    tags: ["bowling", "arcade", "groups"],
    images: [
      "https://images.unsplash.com/photo-1518131678677-bc1a4dca4ccb?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504274066651-8d1d1a7d4793?auto=format&fit=crop&w=1200&q=80",
    ],
    mapQuery: "The Mark Omaha NE",
    category: "activities",
    cuisine: "Bowling / arcade",
    familyFriendly: true,
    outdoorSeating: false,
    zip: "68116",
  },
  {
    id: "escape",
    name: "Escape Room Omaha",
    type: "Escape Room • Team Activity",
    location: "Omaha, NE 68114",
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
    mapQuery: "Escape Room Omaha NE",
    category: "activities",
    cuisine: "Escape room",
    familyFriendly: true,
    outdoorSeating: false,
    zip: "68114",
  },
];

export default function FiveThreeOnePage() {
  const [mode, setMode] = useState<Mode>("restaurants");
  const [step, setStep] = useState<Step>(1);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("Any cuisine");
  const [zipFilter, setZipFilter] = useState("");
  const [maxDistance, setMaxDistance] = useState(25);
  const [outdoorOnly, setOutdoorOnly] = useState(false);
  const [familyOnly, setFamilyOnly] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(true);

  const [firstSelections, setFirstSelections] = useState<string[]>([]);
  const [secondSelections, setSecondSelections] = useState<string[]>([]);
  const [finalChoice, setFinalChoice] = useState<string | null>(null);
  const [showWinner, setShowWinner] = useState(false);

  // reset type filter when switching Restaurants / Activities
  useEffect(() => {
    setTypeFilter(mode === "restaurants" ? "Any cuisine" : "Any activity");
  }, [mode]);

  // base list for current mode + filters (used in Step 1)
  const sourcePlaces = useMemo(() => {
    let base = ALL_PLACES.filter((p) => p.category === mode);

    const q = query.trim().toLowerCase();
    if (q) {
      base = base.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.blurb.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Cuisine / activity type filter
    base = base.filter((p) => {
      if (mode === "restaurants") {
        if (typeFilter === "Any cuisine") return true;
        return p.cuisine === typeFilter;
      } else {
        if (typeFilter === "Any activity") return true;
        return p.cuisine === typeFilter;
      }
    });

    // Distance filter
    base = base.filter((p) => p.distanceMiles <= maxDistance);

    // Zip filter (very simple match)
    if (zipFilter.trim()) {
      base = base.filter((p) => p.zip === zipFilter.trim());
    }

    if (outdoorOnly) {
      base = base.filter((p) => p.outdoorSeating);
    }
    if (familyOnly) {
      base = base.filter((p) => p.familyFriendly);
    }

    return base;
  }, [
    mode,
    query,
    typeFilter,
    maxDistance,
    zipFilter,
    outdoorOnly,
    familyOnly,
  ]);

  // Which places to show depending on step
  const stepPlaces: Place[] = useMemo(() => {
    if (step === 1) return sourcePlaces;

    if (step === 2) {
      return ALL_PLACES.filter((p) => firstSelections.includes(p.id));
    }

    // step 3
    return ALL_PLACES.filter((p) => secondSelections.includes(p.id));
  }, [step, sourcePlaces, firstSelections, secondSelections]);

  const stepTitle =
    step === 1
      ? "Step 1 — You pick 5 options"
      : step === 2
      ? "Step 2 — They pick 3 from your list"
      : "Step 3 — You pick the final winner";

  const stepSubtitle =
    step === 1
      ? "Use search, filters, and the map to find places you'd actually go. Tap 5 cards to select them."
      : step === 2
      ? "Hand them the phone or send a link. They choose 3 from your 5 picks."
      : "You both see the final 3. Tap your favorite to lock it in.";

  // selection handlers
  function handleToggleFirst(id: string) {
    setFirstSelections((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  function handleToggleSecond(id: string) {
    setSecondSelections((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  function handleFinal(id: string) {
    setFinalChoice(id);
  }

  const canProceed =
    step === 1
      ? firstSelections.length === 5
      : step === 2
      ? secondSelections.length === 3
      : !!finalChoice;

  function handlePrimaryAction() {
    if (!canProceed) return;

    if (step === 1) {
      setStep(2);
      // later: actually send to other player
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (step === 3) {
      setShowWinner(true);
    }
  }

  function handleRestart() {
    setStep(1);
    setFirstSelections([]);
    setSecondSelections([]);
    setFinalChoice(null);
    setShowWinner(false);
  }

  const currentPrimaryLabel =
    step === 1
      ? "Send to Other Player"
      : step === 2
      ? "Next step"
      : "Lock in winner";

  const winnerPlace =
    showWinner && finalChoice
      ? ALL_PLACES.find((p) => p.id === finalChoice)
      : null;

  // ----------------------------------------------------------
  // Winner screen
  // ----------------------------------------------------------
  if (winnerPlace && showWinner) {
    return (
      <main className="min-h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white flex flex-col items-center">
        <div className="w-full max-w-3xl px-4 pt-4 pb-8 flex flex-col gap-4">
          {/* Header */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/lg-logo.png"
                alt="Let'sGo logo"
                className="h-9 w-9 rounded-lg object-contain"
              />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.25em] text-white/60">
                  Let&apos;sGo
                </span>
                <span className="text-xs text-white/80">
                  5 → 3 → 1 picker · Winner
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/20 hover:bg-white/10"
              >
                ⟵ Home
              </Link>
              <button
                onClick={handleRestart}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/20 hover:bg-white/10"
              >
                Restart
              </button>
            </div>
          </header>

          {/* Winner card */}
          <section className="relative rounded-3xl border border-emerald-400/70 bg-gradient-to-br from-emerald-500/20 via-slate-900 to-black px-4 py-5 overflow-hidden">
            {/* fake confetti */}
            <div className="pointer-events-none absolute inset-0 opacity-40">
              <div className="absolute -top-6 left-4 text-4xl">🎉</div>
              <div className="absolute top-8 right-8 text-4xl">🎊</div>
              <div className="absolute bottom-4 left-16 text-3xl">✨</div>
            </div>

            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300 mb-1">
                    Tonight&apos;s winner
                  </p>
                  <h1 className="text-xl sm:text-2xl font-bold">
                    {winnerPlace.name}
                  </h1>
                  <p className="text-sm text-white/75">{winnerPlace.location}</p>
                </div>
                <div className="text-right text-[11px] text-white/70">
                  <p>{PRICE_TEXT[winnerPlace.priceLevel]}</p>
                  <p>{winnerPlace.distanceMiles} mi away</p>
                  <p
                    className={
                      winnerPlace.openNow ? "text-emerald-300" : "text-red-300"
                    }
                  >
                    {winnerPlace.openNow ? "Open now" : "Closed"}
                  </p>
                </div>
              </div>

              {/* Big image */}
              <div className="w-full rounded-2xl overflow-hidden border border-white/20 bg-black/40">
                <div className="h-56 sm:h-72 w-full overflow-x-auto no-scrollbar flex snap-x snap-mandatory">
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
                      <div className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/75 text-white/80 border border-white/30">
                        {idx + 1}/{winnerPlace.images.length}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[12px] text-white/80 mb-1">
                    {winnerPlace.type}
                  </p>
                  <p className="text-[12px] text-white/70 mb-2">
                    {winnerPlace.blurb}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {winnerPlace.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-black/50 border border-white/25 text-[10px] text-white/75"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="sm:w-40 flex flex-col gap-2 text-[11px]">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      winnerPlace.mapQuery
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full text-center px-3 py-2 rounded-full bg-emerald-400 text-black font-semibold hover:bg-emerald-300"
                  >
                    Open in Maps
                  </a>
                  <button className="w-full px-3 py-2 rounded-full bg-white/10 border border-white/25 hover:bg-white/15">
                    Send to other player (email / text later)
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-white/60 mt-2">
                Screenshot this or share it so nobody can say they didn&apos;t
                agree. 😄
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  // ----------------------------------------------------------
  // Main 5→3→1 screen (steps 1–3)
  // ----------------------------------------------------------
  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white flex flex-col items-center">
      <div className="w-full max-w-5xl px-4 pt-4 pb-24 flex flex-col gap-4">
        {/* Top bar with logo */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/lg-logo.png"
              alt="Let'sGo logo"
              className="h-8 w-8 rounded-lg object-contain"
            />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/60">
                Let&apos;sGo
              </span>
              <span className="text-xs text-white/80">
                5 → 3 → 1 picker · Step {step} of 3
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/20 hover:bg-white/10"
            >
              ⟵ Home
            </Link>
            <button className="px-3 py-1.5 rounded-full bg-white/5 border border-white/20 hover:bg-white/10">
              Invite a friend
            </button>
            <button
              onClick={handleRestart}
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/20 hover:bg-white/10"
            >
              Restart
            </button>
          </div>
        </header>

        {/* Step info */}
        <section className="rounded-3xl border border-white/10 bg-black/70 px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-pink-300/80 mb-1">
            Your picks
          </p>
          <h1 className="text-lg sm:text-xl font-semibold mb-1">{stepTitle}</h1>
          <p className="text-sm text-white/70">{stepSubtitle}</p>
        </section>

        {/* Filters + map toggler */}
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span>
            Filters &amp; map are{" "}
            <span className="font-semibold">
              {filtersVisible ? "visible" : "hidden"}
            </span>
            .
          </span>
          <button
            onClick={() => setFiltersVisible((v) => !v)}
            className="px-3 py-1 rounded-full bg-white/5 border border-white/20 hover:bg-white/10"
          >
            {filtersVisible ? "Hide filters & map" : "Show filters & map"}
          </button>
        </div>

        {/* Filters + map section */}
        {filtersVisible && (
          <section className="rounded-3xl border border-white/10 bg-black/70 px-4 py-4 flex flex-col md:flex-row gap-4">
            {/* Left: filters */}
            <div className="flex-1 flex flex-col gap-3">
              {/* Mode toggle */}
              <div className="relative w-full md:w-80 p-1 rounded-full bg-slate-950/80 border border-white/20 text-[11px] text-white/70">
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
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-white/60">
                  Search by name, area, or keyword...
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-full bg-slate-950/80 border border-white/20 px-3 py-1.5 text-[12px] outline-none focus:border-pink-400/80"
                />
              </div>

              {/* Type filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-white/60">
                  {mode === "restaurants" ? "Cuisine type" : "Activity type"}
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full rounded-full bg-slate-950/80 border border-white/20 px-3 py-1.5 text-[12px] outline-none focus:border-pink-400/80"
                >
                  {(mode === "restaurants"
                    ? CUISINE_OPTIONS
                    : ACTIVITY_OPTIONS
                  ).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Zip + distance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-white/60">
                    Zip (optional)
                  </label>
                  <input
                    type="text"
                    value={zipFilter}
                    onChange={(e) => setZipFilter(e.target.value)}
                    placeholder="e.g. 68124"
                    className="w-full rounded-full bg-slate-950/80 border border-white/20 px-3 py-1.5 text-[12px] outline-none focus:border-pink-400/80"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-white/60">
                    Max distance: {maxDistance} mi
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={25}
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-4 text-[11px] text-white/70 mt-1">
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={outdoorOnly}
                    onChange={(e) => setOutdoorOnly(e.target.checked)}
                    className="h-3 w-3"
                  />
                  <span>Outdoor seating only</span>
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={familyOnly}
                    onChange={(e) => setFamilyOnly(e.target.checked)}
                    className="h-3 w-3"
                  />
                  <span>Family-friendly only</span>
                </label>
              </div>
            </div>

            {/* Right: map placeholder */}
            <div className="md:w-64 lg:w-72 rounded-2xl border border-white/20 bg-slate-950/80 px-3 py-3 text-[11px]">
              <div className="w-full h-40 rounded-xl bg-gradient-to-br from-sky-500/20 via-emerald-400/10 to-transparent border border-white/15 flex items-center justify-center mb-2">
                <span className="text-white/70 text-xs text-center px-3">
                  Map of current picks
                  <br />
                  <span className="text-[10px] text-white/50">
                    (Pins will update once we hook in live data.)
                  </span>
                </span>
              </div>
              <p className="text-white/60">
                As we connect real data, we&apos;ll drop pins for any place that
                matches your filters and is in your 5 → 3 → 1 list.
              </p>
            </div>
          </section>
        )}

        {/* Grid of cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stepPlaces.map((place) => {
            const isFirstSelected = firstSelections.includes(place.id);
            const isSecondSelected = secondSelections.includes(place.id);
            const isFinal = finalChoice === place.id;

            const isSelected =
              step === 1
                ? isFirstSelected
                : step === 2
                ? isSecondSelected
                : isFinal;

            return (
              <button
                key={place.id}
                type="button"
                onClick={() => {
                  if (step === 1) handleToggleFirst(place.id);
                  else if (step === 2) handleToggleSecond(place.id);
                  else handleFinal(place.id);
                }}
                className={`group w-full text-left rounded-3xl border bg-black/75 overflow-hidden transition-all ${
                  isSelected
                    ? "border-emerald-400/80 shadow-[0_0_0_1px_rgba(34,197,94,0.55)]"
                    : "border-white/15 hover:border-pink-300/80"
                }`}
              >
                {/* Image carousel */}
                <div className="relative h-52 w-full overflow-x-auto no-scrollbar flex snap-x snap-mandatory">
                  {place.images.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative flex-shrink-0 w-full h-full snap-center"
                    >
                      <img
                        src={src}
                        alt={`${place.name} photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/75 text-white/80 border border-white/30">
                        {idx + 1}/{place.images.length}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Content */}
                <div className="px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-pink-300/80 mb-0.5">
                    {place.category === "restaurants" ? "Restaurant" : "Activity"}
                  </p>
                  <h2 className="text-sm sm:text-base font-semibold">
                    {place.name}
                  </h2>
                  <p className="text-[11px] text-white/70">{place.type}</p>
                  <p className="text-[11px] text-white/65 mt-0.5">
                    {place.location}
                  </p>

                  <div className="mt-1 flex items-start justify-between gap-2">
                    <p className="text-[11px] text-white/55 line-clamp-2">
                      {place.blurb}
                    </p>
                    <div className="text-right text-[10px] text-white/65 whitespace-nowrap">
                      <div>{PRICE_TEXT[place.priceLevel]}</div>
                      <div>{place.distanceMiles} mi</div>
                      <div
                        className={
                          place.openNow ? "text-emerald-300" : "text-red-300"
                        }
                      >
                        {place.openNow ? "Open now" : "Closed"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {place.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-[9px] text-white/70"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 text-[10px] text-white/55">
                    {step === 1 &&
                      (isSelected
                        ? "In your 5. Tap again to remove."
                        : "Tap to add to your 5.")}
                    {step === 2 &&
                      (isSelected
                        ? "In their 3. Tap again to remove."
                        : "Tap to add to the 3.")}
                    {step === 3 &&
                      (isSelected
                        ? "Your current winner."
                        : "Tap to choose as winner.")}
                  </div>
                </div>
              </button>
            );
          })}

          {stepPlaces.length === 0 && (
            <p className="text-sm text-white/60">
              No places match your filters yet. Try relaxing your filters or
              switching between Restaurants / Activities.
            </p>
          )}
        </section>
      </div>

      {/* Bottom sticky bar */}
      <div className="fixed bottom-0 inset-x-0 bg-black/90 border-t border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between text-[11px] text-white/70 gap-2">
          <span>
            {step === 1 &&
              `Selected: ${firstSelections.length} / 5 · This is your list.`}
            {step === 2 &&
              `Selected: ${secondSelections.length} / 3 · This is their shortlist.`}
            {step === 3 &&
              (finalChoice
                ? "Winner selected. Lock it in when you're ready."
                : "Tap one place to choose the winner.")}
          </span>

          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={!canProceed}
            className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
              canProceed
                ? "bg-gradient-to-r from-pink-500 to-orange-400 text-black hover:brightness-110"
                : "bg-white/10 text-white/40 cursor-not-allowed"
            }`}
          >
            {currentPrimaryLabel}
          </button>
        </div>
      </div>
    </main>
  );
}