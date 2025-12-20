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
};

const PLACES: Place[] = [
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
    tags: [
      "american",
      "date night",
      "cocktails",
      "upscale",
      "21+",
      "indoor",
      "dinner",
      "lively",
      "dine-in",
      "fine-dining",
      "reservations",
    ],
    images: [
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "restaurants",
  },
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
    tags: [
      "american",
      "burgers",
      "street food",
      "casual",
      "local favorite",
      "kid-friendly",
      "indoor",
      "outdoor",
      "dinner",
      "lively",
      "fast-casual",
      "counter-service",
      "takeout",
    ],
    images: [
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1550547660-8d1d1a7d4793?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "restaurants",
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
    tags: [
      "sushi",
      "seafood",
      "happy hour",
      "group friendly",
      "indoor",
      "outdoor",
      "late-night",
      "lively",
      "dine-in",
      "bar-food",
      "reservations",
    ],
    images: [
      "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "restaurants",
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
    tags: [
      "steak",
      "steakhouse",
      "old school",
      "special occasion",
      "indoor",
      "dinner",
      "chill",
      "dine-in",
      "fine-dining",
      "reservations",
    ],
    images: [
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "restaurants",
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
    tags: [
      "comedy",
      "night out",
      "date night",
      "21+",
      "indoor",
      "late-night",
      "lively",
      "high-energy",
    ],
    images: [
      "https://images.unsplash.com/photo-1512428232641-8fcd1437a3a2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512428702800-1c8d5b4c3c56?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "activities",
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
    tags: [
      "bowling",
      "arcade",
      "sports bar",
      "groups",
      "kid-friendly",
      "indoor",
      "outdoor",
      "high-energy",
      "lively",
      "late-night",
    ],
    images: [
      "https://images.unsplash.com/photo-1518131678677-bc1a4dca4ccb?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504274066651-8d1d1a7d4793?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "activities",
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
    tags: [
      "escape-room",
      "puzzles",
      "teamwork",
      "indoor",
      "evening",
      "chill",
    ],
    images: [
      "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "activities",
  },
];

const PRICE_TEXT: Record<"$" | "$$" | "$$$", string> = {
  $: "$",
  $$: "$$",
  $$$: "$$$",
};

type Phase = "setup" | "spinning" | "result";

// --- Filter button configs ---

const BUDGET_FILTERS = [
  { id: "$", label: "$ (casual)" },
  { id: "$$", label: "$$ (mid)" },
  { id: "$$$", label: "$$$ (splurge)" },
];

const WHO_FILTERS = [
  { id: "21+", label: "Adults 21+ only" },
  { id: "kid-friendly", label: "Kid friendly" },
];

const CUISINE_FILTERS = [
  { id: "american", label: "American / New American" },
  { id: "burgers", label: "Burgers" },
  { id: "sushi", label: "Sushi" },
  { id: "steak", label: "Steak / steakhouse" },
  { id: "seafood", label: "Seafood" },
  { id: "tacos", label: "Tacos" },
  { id: "pizza", label: "Pizza" },
  { id: "bbq", label: "BBQ / smokehouse" },
  { id: "mexican", label: "Mexican" },
  { id: "italian", label: "Italian / pasta" },
  { id: "indian", label: "Indian" },
  { id: "thai", label: "Thai" },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "vegan", label: "Vegan / veggie-forward" },
  { id: "ramen", label: "Ramen / noodles" },
  { id: "sandwiches", label: "Sandwiches" },
  { id: "brunch-spot", label: "Brunchy café" },
  { id: "dessert", label: "Dessert spot" },
  { id: "coffee", label: "Coffee / tea" },
  { id: "wine-bar", label: "Wine bar" },
];

// NEW: restaurant type filters
const RESTAURANT_TYPE_FILTERS = [
  { id: "fast-food", label: "Fast food / drive-thru" },
  { id: "fast-casual", label: "Fast casual / counter" },
  { id: "counter-service", label: "Order at counter" },
  { id: "dine-in", label: "Full-service dine-in" },
  { id: "fine-dining", label: "Fine dining" },
  { id: "bar-food", label: "Bar food / pub grub" },
  { id: "buffet", label: "Buffet" },
  { id: "food-truck", label: "Food truck / pop-up" },
  { id: "takeout-only", label: "Takeout only" },
];

const ACTIVITY_FILTERS = [
  { id: "bowling", label: "Bowling" },
  { id: "arcade", label: "Arcade / games" },
  { id: "escape-room", label: "Escape room" },
  { id: "comedy", label: "Comedy club" },
  { id: "live-music", label: "Live music" },
  { id: "movies", label: "Movie theater" },
  { id: "mini-golf", label: "Mini golf / putt putt" },
  { id: "go-karts", label: "Go karts" },
  { id: "karaoke", label: "Karaoke" },
  { id: "paint-and-sip", label: "Paint & sip" },
  { id: "trivia", label: "Trivia night" },
  { id: "sports bar", label: "Sports bar watch party" },
  { id: "museum", label: "Museum / gallery" },
  { id: "theater", label: "Theater / show" },
  { id: "axe-throwing", label: "Axe throwing" },
  { id: "arcade-bar", label: "Barcade" },
  { id: "outdoor-walk", label: "Scenic walk / park" },
  { id: "board-games", label: "Board game café" },
  { id: "vr", label: "VR / arcade" },
  { id: "classes", label: "Class / workshop" },
];

const VIBE_FILTERS = [
  { id: "chill", label: "Chill / quiet" },
  { id: "lively", label: "Lively" },
  { id: "high-energy", label: "High energy" },
  { id: "date night", label: "Romantic date night" },
  { id: "local favorite", label: "Local gem" },
  { id: "hipster", label: "Trendy / hipster" },
  { id: "sports bar", label: "Sports bar" },
  { id: "group friendly", label: "Group-friendly" },
];

const TIME_FILTERS = [
  { id: "brunch", label: "Brunch / late morning" },
  { id: "lunch", label: "Lunch" },
  { id: "afternoon", label: "Afternoon" },
  { id: "dinner", label: "Dinner" },
  { id: "evening", label: "Evening" },
  { id: "late-night", label: "Late night" },
];

const EXTRA_FILTERS = [
  { id: "indoor", label: "Indoor" },
  { id: "outdoor", label: "Outdoor / patio" },
  { id: "rooftop", label: "Rooftop" },
  { id: "reservations", label: "Takes reservations" },
  { id: "walk-in", label: "Good for walk-ins" },
  { id: "happy hour", label: "Happy hour" },
  { id: "cheap-drinks", label: "Cheap drinks" },
  { id: "photo-worthy", label: "Instagrammable" },
  { id: "games", label: "Games / activities" },
  { id: "quiet", label: "Quieter / convo friendly" },
];

export default function DateNightPage() {
  // Setup filters
  const [date, setDate] = useState<string>("");
  const [zipOrArea, setZipOrArea] = useState<string>("");
  const [maxDistance, setMaxDistance] = useState<number>(15);

  const [selectedBudgets, setSelectedBudgets] = useState<string[]>([]);
  const [selectedWho, setSelectedWho] = useState<string[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedRestaurantTypes, setSelectedRestaurantTypes] = useState<
    string[]
  >([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  // Phase / spinning / picks
  const [phase, setPhase] = useState<Phase>("setup");

  const [restaurantPool, setRestaurantPool] = useState<Place[]>([]);
  const [activityPool, setActivityPool] = useState<Place[]>([]);
  const [spinRestaurantIndex, setSpinRestaurantIndex] = useState(0);
  const [spinActivityIndex, setSpinActivityIndex] = useState(0);

  const [restaurant, setRestaurant] = useState<Place | null>(null);
  const [activity, setActivity] = useState<Place | null>(null);

  const [showDetails, setShowDetails] = useState(false);

  const restaurantsAll = useMemo(
    () => PLACES.filter((p) => p.mode === "restaurants"),
    []
  );
  const activitiesAll = useMemo(
    () => PLACES.filter((p) => p.mode === "activities"),
    []
  );

  // Helpers to toggle chips
  const toggleChip = (
    id: string,
    setFn: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setFn((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  function matchesFilters(place: Place): boolean {
    // Distance
    if (place.distanceMiles > maxDistance) return false;

    // Budget
    if (selectedBudgets.length && !selectedBudgets.includes(place.priceLevel)) {
      return false;
    }

    // Who's coming
    if (selectedWho.includes("21+") && !place.tags.includes("21+")) {
      return false;
    }
    if (
      selectedWho.includes("kid-friendly") &&
      !place.tags.includes("kid-friendly")
    ) {
      return false;
    }

    // Restaurant type (restaurants only, OR)
    if (place.mode === "restaurants" && selectedRestaurantTypes.length) {
      const hasType = selectedRestaurantTypes.some((t) =>
        place.tags.includes(t)
      );
      if (!hasType) return false;
    }

    // Extras (AND: all selected extras must be present)
    if (
      selectedExtras.length &&
      !selectedExtras.every((tag) => place.tags.includes(tag))
    ) {
      return false;
    }

    // Time of day (OR)
    if (
      selectedTimes.length &&
      !selectedTimes.some((tag) => place.tags.includes(tag))
    ) {
      return false;
    }

    // Vibes (OR)
    if (
      selectedVibes.length &&
      !selectedVibes.some((tag) => place.tags.includes(tag))
    ) {
      return false;
    }

    // Cuisine (restaurants only; fuzzy match)
    if (place.mode === "restaurants" && selectedCuisines.length) {
      const haystack = (
        place.name +
        " " +
        place.type +
        " " +
        place.tags.join(" ")
      )
        .toLowerCase()
        .replace("steakhouse", "steak");
      const matchesCuisine = selectedCuisines.some((c) =>
        haystack.includes(c)
      );
      if (!matchesCuisine) return false;
    }

    // Activity type (activities only)
    if (place.mode === "activities" && selectedActivities.length) {
      const haystack = (
        place.name +
        " " +
        place.type +
        " " +
        place.tags.join(" ")
      ).toLowerCase();
      const matchesActivity = selectedActivities.some((a) =>
        haystack.includes(a)
      );
      if (!matchesActivity) return false;
    }

    return true;
  }

  function handleSpin() {
    const rPool = restaurantsAll.filter(matchesFilters);
    const aPool = activitiesAll.filter(matchesFilters);

    const safeRPool = rPool.length ? rPool : restaurantsAll;
    const safeAPool = aPool.length ? aPool : activitiesAll;

    setRestaurantPool(safeRPool);
    setActivityPool(safeAPool);
    setSpinRestaurantIndex(0);
    setSpinActivityIndex(0);
    setShowDetails(false);
    setPhase("spinning");
  }

  // Spinning slot-machine effect
  useEffect(() => {
    if (phase !== "spinning") return;
    if (!restaurantPool.length || !activityPool.length) return;

    const rInterval = setInterval(() => {
      setSpinRestaurantIndex((prev) =>
        restaurantPool.length ? (prev + 1) % restaurantPool.length : 0
      );
    }, 110);

    const aInterval = setInterval(() => {
      setSpinActivityIndex((prev) =>
        activityPool.length ? (prev + 1) % activityPool.length : 0
      );
    }, 110);

    const stopTimeout = setTimeout(() => {
      const r =
        restaurantPool[Math.floor(Math.random() * restaurantPool.length)];
      const a =
        activityPool[Math.floor(Math.random() * activityPool.length)];
      setRestaurant(r);
      setActivity(a);
      setPhase("result");
    }, 2200);

    return () => {
      clearInterval(rInterval);
      clearInterval(aInterval);
      clearTimeout(stopTimeout);
    };
  }, [phase, restaurantPool, activityPool]);

  const isSpinning = phase === "spinning";
  const showResults = phase !== "setup";

  const spinningRestaurant =
    restaurantPool[spinRestaurantIndex] || restaurantPool[0] || restaurantsAll[0];
  const spinningActivity =
    activityPool[spinActivityIndex] || activityPool[0] || activitiesAll[0];

  const currentRestaurant =
    phase === "result" ? restaurant : spinningRestaurant;
  const currentActivity = phase === "result" ? activity : spinningActivity;

  // Require date + location before first spin
  const disableInitialSpin = !date || !zipOrArea.trim();

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white flex flex-col items-center">
      <div className="w-full max-w-5xl px-4 pt-4 pb-16 flex flex-col gap-5">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img
              src="/lg-logo.png"
              alt="Let&apos;sGo logo"
              className="h-9 w-9 rounded-xl object-contain"
            />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/60">
                Let&apos;sGo — Date night
              </span>
              <span className="text-xs text-white/75">
                Random AI planner · 1 restaurant + 1 activity
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

        {/* Nova hero (setup & spinning only) */}
        {phase !== "result" && (
          <section className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-slate-900/90 via-slate-950 to-black px-4 py-6 sm:px-6 sm:py-7">
            <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-64 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.45),_transparent_60%)] animate-pulse" />
            <div className="pointer-events-none absolute top-0 right-0 w-40 h-40 bg-[conic-gradient(from_0deg,_rgba(244,114,182,0.4),_rgba(96,165,250,0.4),_rgba(34,197,94,0.3),_rgba(244,114,182,0.4))] opacity-40 blur-3xl" />

            <div className="relative z-10 flex flex-col items-center gap-3 text-center">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-pink-500 via-sky-400 to-purple-500 shadow-[0_0_35px_rgba(56,189,248,0.75)] flex items-center justify-center">
                <span className="text-[11px] font-semibold tracking-[0.25em] text-white">
                  NOVA
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold">
                Let Nova plan tonight for you
              </h1>
              <p className="text-xs sm:text-sm text-white/70 max-w-xl">
                Tap a date, drop your area, mash some filters, and I&apos;ll
                spin up one place to eat and one thing to do so nobody has to
                decide.
              </p>
            </div>
          </section>
        )}

        {/* STEP 1 — SETUP */}
        {phase === "setup" && (
          <section className="rounded-3xl border border-white/15 bg-black/75 px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-4 text-xs">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-sky-300/80 mb-1">
                Step 1 — Pick your night
              </p>
              <p className="text-xs sm:text-sm text-white/70">
                All filters are optional. The more you tap, the more I&apos;ll
                narrow before I spin.
              </p>
            </div>

            {/* DATE + LOCATION + DISTANCE */}
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)]">
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-white/75">Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-lg bg-slate-950/80 border border-white/20 px-3 py-1.5 text-xs outline-none focus:border-sky-400/80"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-white/75">Zip or area</span>
                  <input
                    type="text"
                    value={zipOrArea}
                    onChange={(e) => setZipOrArea(e.target.value)}
                    placeholder="e.g. 68137 or Downtown Omaha"
                    className="rounded-lg bg-slate-950/80 border border-white/20 px-3 py-1.5 text-xs outline-none focus:border-sky-400/80"
                  />
                  <span className="text-[10px] text-white/45">
                    In a real build this would anchor the distance filter to
                    your exact area.
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-1 justify-end">
                <span className="text-white/75">Max distance</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={3}
                    max={25}
                    step={1}
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-16 text-right text-white/65">
                    {maxDistance} mi
                  </span>
                </div>
              </div>
            </div>

            {/* BIG FILTER GRID */}
            <div className="grid gap-3 md:grid-cols-2">
              {/* Column 1 */}
              <div className="flex flex-col gap-3">
                <FilterSection title="Budget">
                  {BUDGET_FILTERS.map((f) => (
                    <FilterChip
                      key={f.id}
                      label={f.label}
                      active={selectedBudgets.includes(f.id)}
                      onClick={() => toggleChip(f.id, setSelectedBudgets)}
                    />
                  ))}
                </FilterSection>

                <FilterSection title="Restaurant styles">
                  {CUISINE_FILTERS.map((f) => (
                    <FilterChip
                      key={f.id}
                      label={f.label}
                      active={selectedCuisines.includes(f.id)}
                      onClick={() => toggleChip(f.id, setSelectedCuisines)}
                    />
                  ))}
                </FilterSection>

                <FilterSection title="Restaurant type">
                  {RESTAURANT_TYPE_FILTERS.map((f) => (
                    <FilterChip
                      key={f.id}
                      label={f.label}
                      active={selectedRestaurantTypes.includes(f.id)}
                      onClick={() =>
                        toggleChip(f.id, setSelectedRestaurantTypes)
                      }
                    />
                  ))}
                </FilterSection>

                <FilterSection title="Extras">
                  {EXTRA_FILTERS.map((f) => (
                    <FilterChip
                      key={f.id}
                      label={f.label}
                      active={selectedExtras.includes(f.id)}
                      onClick={() => toggleChip(f.id, setSelectedExtras)}
                    />
                  ))}
                </FilterSection>
              </div>

              {/* Column 2 */}
              <div className="flex flex-col gap-3">
                <FilterSection title="Activity types">
                  {ACTIVITY_FILTERS.map((f) => (
                    <FilterChip
                      key={f.id}
                      label={f.label}
                      active={selectedActivities.includes(f.id)}
                      onClick={() => toggleChip(f.id, setSelectedActivities)}
                    />
                  ))}
                </FilterSection>

                <FilterSection title="Vibe">
                  {VIBE_FILTERS.map((f) => (
                    <FilterChip
                      key={f.id}
                      label={f.label}
                      active={selectedVibes.includes(f.id)}
                      onClick={() => toggleChip(f.id, setSelectedVibes)}
                    />
                  ))}
                </FilterSection>

                <FilterSection title="When are you going?">
                  {TIME_FILTERS.map((f) => (
                    <FilterChip
                      key={f.id}
                      label={f.label}
                      active={selectedTimes.includes(f.id)}
                      onClick={() => toggleChip(f.id, setSelectedTimes)}
                    />
                  ))}
                </FilterSection>

                <FilterSection title="Who&apos;s coming?">
                  {WHO_FILTERS.map((f) => (
                    <FilterChip
                      key={f.id}
                      label={f.label}
                      active={selectedWho.includes(f.id)}
                      onClick={() => toggleChip(f.id, setSelectedWho)}
                    />
                  ))}
                </FilterSection>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-white/60">
                When you&apos;re happy with the filters, tap spin and I&apos;ll
                show you tonight&apos;s combo. Or jump over to events instead.
              </p>
              <div className="flex flex-wrap gap-2">
                {date && (
                  <Link
                    href={{
                      pathname: "/events",
                      query: { date },
                    }}
                    className="px-3 py-1.5 rounded-full bg-white/10 border border-white/25 text-[11px] hover:bg-white/15"
                  >
                    Browse events for this date
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleSpin}
                  disabled={disableInitialSpin}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-transform ${
                    disableInitialSpin
                      ? "bg-white/10 text-white/40 cursor-not-allowed"
                      : "bg-gradient-to-r from-pink-500 via-purple-500 to-sky-400 text-black shadow-lg shadow-pink-500/40 hover:scale-[1.03]"
                  }`}
                >
                  Spin up a date night
                </button>
              </div>
            </div>
          </section>
        )}

        {/* RESULT VIEW — 2 cards + 3 buttons */}
        {showResults && currentRestaurant && currentActivity && (
          <section className="mt-4 flex flex-col items-center gap-5">
            <div className="grid gap-4 w-full max-w-4xl md:grid-cols-2">
              <ResultCard
                title="Restaurant"
                place={currentRestaurant}
                isSpinning={isSpinning}
              />
              <ResultCard
                title="Activity"
                place={currentActivity}
                isSpinning={isSpinning}
              />
            </div>

            {showDetails && (
              <div className="w-full max-w-4xl grid gap-3 md:grid-cols-2 text-xs">
                <DetailBlock label="Restaurant details" place={currentRestaurant} />
                <DetailBlock label="Activity details" place={currentActivity} />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
                className="px-4 py-1.5 rounded-full bg-white/10 border border-white/25 text-xs sm:text-sm hover:bg-white/15"
              >
                {showDetails ? "Hide details" : "Show details"}
              </button>
              <button
                type="button"
                className="px-4 py-1.5 rounded-full bg-white/10 border border-white/25 text-xs sm:text-sm hover:bg-white/15"
              >
                Share (placeholder)
              </button>
              <button
                type="button"
                onClick={handleSpin}
                className="px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-sky-400 text-black text-xs sm:text-sm font-semibold shadow-lg shadow-pink-500/40"
              >
                Spin again
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/* --- Subcomponents --- */

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 mb-1">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
        active
          ? "bg-sky-500/90 border-sky-300 text-black"
          : "bg-black/60 border-white/25 text-white/75 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function ResultCard({
  title,
  place,
  isSpinning,
}: {
  title: string;
  place: Place;
  isSpinning: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/15 bg-slate-950/80 overflow-hidden flex flex-col">
      <div className="relative h-40 sm:h-44 w-full overflow-x-auto no-scrollbar flex snap-x snap-mandatory">
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
          </div>
        ))}
        {isSpinning && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-sky-400/80 border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      <div className="px-3 py-3 sm:px-4 sm:py-3 flex-1 flex flex-col gap-1">
        <p className="text-[10px] uppercase tracking-[0.25em] text-sky-300/80 mb-0.5">
          {title}
        </p>
        <h2 className="text-sm sm:text-base font-semibold">{place.name}</h2>
        <p className="text-[11px] text-white/70">{place.type}</p>
        <p className="text-[11px] text-white/60">{place.location}</p>
        <p className="text-[11px] text-white/55 line-clamp-2 mt-1">
          {place.blurb}
        </p>
        <div className="mt-1 flex items-center justify-between text-[10px] text-white/65">
          <span>{PRICE_TEXT[place.priceLevel]}</span>
          <span>{place.distanceMiles} mi</span>
          <span
            className={
              place.openNow
                ? "text-emerald-300 font-semibold"
                : "text-red-300 font-semibold"
            }
          >
            {place.openNow ? "Open now" : "Closed"}
          </span>
        </div>
      </div>
    </div>
  );
}

function DetailBlock({ label, place }: { label: string; place: Place }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-slate-950/90 px-3 py-2 space-y-1">
      <p className="text-[11px] uppercase tracking-[0.2em] text-sky-300/80">
        {label}
      </p>
      <p className="text-sm font-semibold text-white/90">{place.name}</p>
      <p className="text-[11px] text-white/75">{place.type}</p>
      <p className="text-[11px] text-white/65">{place.location}</p>
      <p className="text-[11px] text-white/60">{place.blurb}</p>
      <p className="text-[10px] text-white/50 mt-1">
        Price: {PRICE_TEXT[place.priceLevel]} · Distance: {place.distanceMiles}{" "}
        mi · {place.openNow ? "Open now" : "Currently closed"}
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {place.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-[9px] text-white/70"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}