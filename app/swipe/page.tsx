"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

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
  vibe: string; // cuisine or activity label
};

const PLACES: Place[] = [
  {
    id: "block16",
    name: "Block 16",
    type: "Restaurant • Burgers • Street Food",
    location: "Downtown Omaha, NE 68102",
    blurb:
      "Crazy-good burgers, fries, and creative specials. Local favorite that’s always busy.",
    priceLevel: "$$",
    distanceMiles: 3,
    openNow: true,
    tags: ["burgers", "casual", "local favorite", "kid-friendly"],
    images: [
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1550547660-8d1d1a7d4793?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "restaurants",
    vibe: "Burgers / Street food",
  },
  {
    id: "jcoco",
    name: "J. Coco",
    type: "Restaurant • Upscale • New American",
    location: "Omaha, NE 68124",
    blurb:
      "Cocktails, elevated comfort food and a cozy vibe. Great for anniversaries or kid-free nights.",
    priceLevel: "$$$",
    distanceMiles: 7,
    openNow: false,
    tags: ["date night", "upscale", "cocktails", "21+"],
    images: [
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "restaurants",
    vibe: "Upscale / New American",
  },
  {
    id: "blue-sushi",
    name: "Blue Sushi Sake Grill",
    type: "Restaurant • Sushi • Drinks",
    location: "Multiple Omaha locations",
    blurb:
      "Rolls, happy hour and a fun vibe. Easy go-to when nobody can decide what they want.",
    priceLevel: "$$",
    distanceMiles: 5,
    openNow: true,
    tags: ["sushi", "happy hour", "group friendly"],
    images: [
      "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "restaurants",
    vibe: "Sushi / Japanese",
  },
  {
    id: "drover",
    name: "The Drover",
    type: "Restaurant • Steakhouse",
    location: "Omaha, NE 68124",
    blurb:
      "Classic Omaha whiskey steaks and an old-school feel. Heavier dinner when you want to splurge.",
    priceLevel: "$$$",
    distanceMiles: 9,
    openNow: true,
    tags: ["steak", "special occasion", "old school"],
    images: [
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "restaurants",
    vibe: "Steakhouse",
  },
  {
    id: "mark",
    name: "The Mark",
    type: "Bowling • Arcade • Bar",
    location: "West Omaha, NE 68116",
    blurb:
      "Bowling, arcade games, food and drinks. Easy group spot when nobody can decide.",
    priceLevel: "$$",
    distanceMiles: 10,
    openNow: true,
    tags: ["bowling", "arcade", "groups", "kid-friendly"],
    images: [
      "https://images.unsplash.com/photo-1518131678677-bc1a4dca4ccb?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504274066651-8d1d1a7d4793?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "activities",
    vibe: "Bowling / Arcade",
  },
  {
    id: "funny-bone",
    name: "Funny Bone",
    type: "Comedy club",
    location: "Village Pointe, Omaha, NE 68118",
    blurb:
      "Stand-up comedy, drinks and a night out that isn’t just dinner-and-a-movie.",
    priceLevel: "$$",
    distanceMiles: 8,
    openNow: false,
    tags: ["comedy", "night out", "date night", "21+"],
    images: [
      "https://images.unsplash.com/photo-1512428232641-8fcd1437a3a2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512428702800-1c8d5b4c3c56?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "activities",
    vibe: "Comedy",
  },
  {
    id: "escape",
    name: "Escape Room Omaha",
    type: "Escape room • Team activity",
    location: "Omaha, NE",
    blurb:
      "Puzzles, time pressure and team banter. Great for double dates or friend groups.",
    priceLevel: "$$",
    distanceMiles: 4,
    openNow: true,
    tags: ["puzzles", "teamwork", "indoor"],
    images: [
      "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    ],
    mode: "activities",
    vibe: "Escape room",
  },
];

const PRICE_TEXT: Record<"$" | "$$" | "$$$", string> = {
  $: "$",
  $$: "$$",
  $$$: "$$$",
};

export default function SwipePage() {
  const [mode, setMode] = useState<Mode>("restaurants");
  const [showFilters, setShowFilters] = useState(true);

  const [searchText, setSearchText] = useState("");
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [cuisineOrActivity, setCuisineOrActivity] = useState<string>("all");
  const [zip, setZip] = useState("");
  const [outdoorOnly, setOutdoorOnly] = useState(false);
  const [familyOnly, setFamilyOnly] = useState(false);

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeImageIndexByPlace, setActiveImageIndexByPlace] = useState<
    Record<string, number>
  >({});

const cardRefs = useRef<(HTMLElement | null)[]>([]);

  const filteredPlaces = useMemo(() => {
    const base = PLACES.filter((p) => p.mode === mode);

    const text = searchText.trim().toLowerCase();

    return base.filter((p) => {
      const matchText =
        !text ||
        p.name.toLowerCase().includes(text) ||
        p.location.toLowerCase().includes(text) ||
        p.tags.some((t) => t.toLowerCase().includes(text));

      const matchDistance =
        maxDistance == null || p.distanceMiles <= maxDistance;

      const matchCuisine =
        cuisineOrActivity === "all" || p.vibe === cuisineOrActivity;

      const outdoorTags = ["patio", "outdoor", "rooftop"];
      const familyTags = ["kid-friendly", "family", "family-friendly"];

      const matchOutdoor =
        !outdoorOnly ||
        p.tags.some((t) => outdoorTags.includes(t.toLowerCase()));

      const matchFamily =
        !familyOnly ||
        p.tags.some((t) => familyTags.includes(t.toLowerCase()));

      return (
        matchText &&
        matchDistance &&
        matchCuisine &&
        matchOutdoor &&
        matchFamily
      );
    });
  }, [
    mode,
    searchText,
    maxDistance,
    cuisineOrActivity,
    outdoorOnly,
    familyOnly,
  ]);

  const cuisineOptions = useMemo(() => {
    const set = new Set<string>();
    PLACES.filter((p) => p.mode === mode).forEach((p) =>
      set.add(p.vibe)
    );
    return Array.from(set);
  }, [mode]);

  function toggleSave(id: string) {
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleImageScroll(placeId: string, e: React.UIEvent<HTMLDivElement>) {
    const target = e.currentTarget;
    if (!target.clientWidth) return;
    const index = Math.round(target.scrollLeft / target.clientWidth);
    setActiveImageIndexByPlace((prev) => ({
      ...prev,
      [placeId]: index,
    }));
  }

  function handleSkip(index: number) {
    const next = Math.min(index + 1, filteredPlaces.length - 1);
    const el = cardRefs.current[next];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white flex flex-col items-center">
      {/* neon glow backdrop */}
      <div className="pointer-events-none fixed inset-0 opacity-60 mix-blend-screen">
        <div className="absolute -top-20 -left-16 w-64 h-64 bg-pink-500/30 blur-3xl rounded-full" />
        <div className="absolute -top-10 right-0 w-64 h-64 bg-sky-500/30 blur-3xl rounded-full" />
        <div className="absolute bottom-[-4rem] left-12 w-72 h-72 bg-purple-500/30 blur-3xl rounded-full" />
      </div>

      <div className="w-full max-w-5xl px-4 pt-4 pb-6 relative z-10 flex flex-col gap-4">
        {/* HEADER WITH HOME BUTTON */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-black/60 border border-white/20 flex items-center justify-center shadow-[0_0_25px_rgba(56,189,248,0.8)]">
              <img
                src="/lg-logo.png"
                alt="Let&apos;sGo"
                className="h-8 w-8 object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.35em] text-white/60">
                Let&apos;sGo
              </span>
              <span className="text-xs text-white/80">
                Swipe to decide where to go
              </span>
            </div>
          </div>

          <Link
            href="/"
            className="text-[11px] px-3 py-1.5 rounded-full bg-white/5 border border-white/25 hover:bg-white/10"
          >
            ⟵ Home
          </Link>
        </header>

        {/* TITLE / HINT */}
        <section className="mt-1">
          <p className="text-[11px] uppercase tracking-[0.3em] text-sky-300/80 mb-1">
            Solo swipe
          </p>
          <h1 className="text-lg sm:text-xl font-semibold mb-1">
            Build your “would go again” list
          </h1>
          <p className="text-xs sm:text-sm text-white/70">
            Scroll through full-screen cards. For each place, tap{" "}
            <span className="font-semibold">Save to my list</span> if you’d
            actually go, or <span className="font-semibold">Skip</span> to
            jump to the next one.
          </p>
        </section>

        {/* FILTERS + MAP */}
        <section className="mt-2 rounded-2xl border border-white/15 bg-black/70 px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 text-[11px] text-white/65">
            <span>
              Filters & map are{" "}
              <span className="font-semibold">
                {showFilters ? "visible" : "hidden"}
              </span>
              .
            </span>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="px-3 py-1 rounded-full bg-white/5 border border-white/25 hover:bg-white/10"
            >
              {showFilters ? "Hide filters & map" : "Show filters & map"}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col lg:flex-row gap-3">
                {/* mode toggle + search */}
                <div className="flex-1 flex flex-col gap-2">
                  {/* mode toggle */}
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

                  {/* search */}
                  <input
                    type="search"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search by name, neighborhood, or keyword..."
                    className="w-full rounded-full bg-slate-950/80 border border-white/20 px-3 py-1.5 text-[12px] outline-none focus:border-sky-400/80"
                  />
                </div>

                {/* map placeholder */}
                <div className="hidden lg:block w-72 rounded-xl bg-gradient-to-br from-slate-900 via-black to-slate-900 border border-white/15 px-3 py-2 text-[11px]">
                  <p className="text-white/70 mb-2">
                    Map of current picks (placeholder)
                  </p>
                  <div className="h-28 rounded-lg bg-black/80 border border-white/10 flex items-center justify-center text-[10px] text-white/45">
                    Map updates as you move through cards and change filters.
                  </div>
                </div>
              </div>

              {/* secondary filters */}
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-white/65">
                    {mode === "restaurants" ? "Cuisine" : "Activity"}
                  </span>
                  <select
                    value={cuisineOrActivity}
                    onChange={(e) =>
                      setCuisineOrActivity(e.target.value)
                    }
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

                <div className="flex items-center gap-1">
                  <span className="text-white/65">Zip (optional)</span>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="68137"
                    className="w-24 rounded-full bg-black/60 border border-white/25 px-2 py-1 text-[11px] outline-none"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-white/65">Max distance</span>
                  <select
                    value={maxDistance == null ? "any" : String(maxDistance)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMaxDistance(v === "any" ? null : Number(v));
                    }}
                    className="rounded-full bg-black/60 border border-white/25 px-2 py-1 outline-none"
                  >
                    <option value="any">Any</option>
                    <option value="5">5 mi</option>
                    <option value="10">10 mi</option>
                    <option value="15">15 mi</option>
                    <option value="20">20 mi</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setOutdoorOnly((v) => !v)}
                  className={`px-2 py-1 rounded-full border text-[11px] ${
                    outdoorOnly
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                      : "bg-black/60 border-white/25 text-white/70"
                  }`}
                >
                  Outdoor seating only
                </button>

                <button
                  type="button"
                  onClick={() => setFamilyOnly((v) => !v)}
                  className={`px-2 py-1 rounded-full border text-[11px] ${
                    familyOnly
                      ? "bg-amber-400/20 border-amber-300 text-amber-100"
                      : "bg-black/60 border-white/25 text-white/70"
                  }`}
                >
                  Family-friendly only
                </button>
              </div>
            </div>
          )}
        </section>

        {/* VERTICAL SNAP FEED */}
        <section className="mt-3">
          <div className="h-[calc(100vh-260px)] overflow-y-scroll snap-y snap-mandatory flex flex-col items-center gap-8 pb-10 no-scrollbar">
            {filteredPlaces.map((place, index) => {
              const saved = savedIds.includes(place.id);
              const activeIdx = activeImageIndexByPlace[place.id] ?? 0;
              const showDetails = activeIdx === 0;

              return (
                <article
                  key={place.id}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  className="snap-start flex justify-center w-full"
                >
                  <div className="relative w-full max-w-[420px] rounded-[28px] bg-black/80 border border-white/15 overflow-hidden shadow-[0_0_40px_rgba(15,23,42,0.9)]">
                    {/* image strip */}
                    <div className="h-[460px] sm:h-[540px] bg-black overflow-hidden">
                      <div
                        className="w-full h-full overflow-x-auto no-scrollbar flex snap-x snap-mandatory"
                        onScroll={(e) =>
                          handleImageScroll(place.id, e)
                        }
                      >
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
                            <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-white/70">
                              {idx + 1}/{place.images.length}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* info overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/85 to-black/60 px-4 pt-3 pb-4 text-[11px]">
                      {showDetails && (
                        <>
                          <p className="text-[10px] uppercase tracking-[0.22em] text-sky-300/80 mb-0.5">
                            {mode === "restaurants"
                              ? "Restaurant"
                              : "Activity"}
                          </p>
                          <h2 className="text-sm font-semibold">
                            {place.name}
                          </h2>
                          <p className="text-[11px] text-white/75">
                            {place.type}
                          </p>
                          <p className="text-[11px] text-white/65 mt-1">
                            {place.location}
                          </p>
                          <p className="text-[11px] text-white/60 mt-1 line-clamp-2">
                            {place.blurb}
                          </p>

                          <div className="mt-2 flex items-center justify-between text-[10px] text-white/70">
                            <div className="flex gap-3">
                              <span>{PRICE_TEXT[place.priceLevel]}</span>
                              <span>{place.distanceMiles} mi</span>
                              {place.openNow ? (
                                <span className="text-emerald-300 font-semibold">
                                  Open now
                                </span>
                              ) : (
                                <span className="text-red-300 font-semibold">
                                  Closed
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-[9px] text-white/80">
                              {place.vibe}
                            </span>
                            {place.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-[9px] text-white/70"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </>
                      )}

                      {/* actions always visible */}
                      <div
                        className={`${
                          showDetails ? "mt-3" : "mt-1"
                        } flex items-center justify-between`}
                      >
                        <span className="text-[10px] text-white/55">
                          {saved
                            ? "In your ‘would go again’ list."
                            : "Would you actually go here?"}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSkip(index)}
                            className="px-3 py-1.5 rounded-full text-[10px] bg-white/10 border border-white/25 hover:bg-white/15"
                          >
                            Skip
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSave(place.id)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-semibold ${
                              saved
                                ? "bg-sky-500/10 border border-sky-400 text-sky-200 hover:bg-sky-500/20"
                                : "bg-sky-500 text-black border border-sky-400 hover:bg-sky-400"
                            }`}
                          >
                            {saved ? "Saved" : "Save to my list"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {filteredPlaces.length === 0 && (
              <p className="text-sm text-white/60 mt-4">
                Nothing matches those filters yet. Try widening distance or
                clearing a few options.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}