"use client";

import React, { useEffect, useMemo, useState } from "react";

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
  mapQuery: string;
  category: Mode;
  // extra metadata for filters
  cuisine?: string;
  activityType?: string;
  zipcode?: string;
  outdoorSeating?: boolean;
  familyFriendly?: boolean;
};

const PLACES: Place[] = [
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
    zipcode: "68102",
    outdoorSeating: false,
    familyFriendly: true,
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
    tags: ["upscale", "date night", "cocktails"],
    images: [
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    ],
    mapQuery: "J Coco Omaha NE",
    category: "restaurants",
    cuisine: "New American",
    zipcode: "68124",
    outdoorSeating: false,
    familyFriendly: false,
  },
  {
    id: "blue-sushi",
    name: "Blue Sushi Sake Grill",
    type: "Restaurant • Sushi • Drinks",
    location: "Multiple Omaha locations (example 68114)",
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
    mapQuery: "Blue Sushi Omaha NE",
    category: "restaurants",
    cuisine: "Sushi",
    zipcode: "68114",
    outdoorSeating: true,
    familyFriendly: true,
  },
  {
    id: "drover",
    name: "The Drover",
    type: "Restaurant • Steakhouse",
    location: "Omaha, NE 68137",
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
    mapQuery: "The Drover Omaha NE",
    category: "restaurants",
    cuisine: "Steakhouse",
    zipcode: "68137",
    outdoorSeating: false,
    familyFriendly: false,
  },
  // ACTIVITIES
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
    activityType: "Bowling",
    zipcode: "68116",
    outdoorSeating: false,
    familyFriendly: true,
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
    activityType: "Comedy Club",
    zipcode: "68118",
    outdoorSeating: false,
    familyFriendly: false,
  },
  {
    id: "escape",
    name: "Escape Room Omaha",
    type: "Escape Room • Team Activity",
    location: "Omaha, NE 68132",
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
    activityType: "Escape Room",
    zipcode: "68132",
    outdoorSeating: false,
    familyFriendly: true,
  },
];

const PRICE_TEXT: Record<"$" | "$$" | "$$$", string> = {
  $: "$",
  $$: "$$",
  $$$: "$$$",
};

const CUISINE_OPTIONS = [
  "Any cuisine",
  "American",
  "New American",
  "Burgers",
  "Steakhouse",
  "Sushi",
  "Mexican",
  "Italian",
  "BBQ",
  "Chinese",
  "Thai",
  "Indian",
  "Mediterranean",
  "Pizza",
];

const ACTIVITY_OPTIONS = [
  "Any activity",
  "Bowling",
  "Comedy Club",
  "Escape Room",
  "Mini Golf",
  "Go Karts",
  "Arcade",
  "Karaoke",
];

export default function SwipeFeed({ fullscreen = false }: { fullscreen?: boolean }) {
  const [mode, setMode] = useState<Mode>("restaurants");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [lovedIds, setLovedIds] = useState<string[]>([]);
  const [likesByPlace, setLikesByPlace] = useState<Record<string, number>>({});
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  // filters + map state
  const [showFilters, setShowFilters] = useState(true);
  const [cuisineFilter, setCuisineFilter] = useState<string>("Any cuisine");
  const [activityFilter, setActivityFilter] = useState<string>("Any activity");
  const [zipFilter, setZipFilter] = useState<string>("");
  const [maxDistance, setMaxDistance] = useState<number>(25);
  const [outdoorOnly, setOutdoorOnly] = useState<boolean>(false);
  const [familyOnly, setFamilyOnly] = useState<boolean>(false);

  const filteredPlaces = useMemo(
    () =>
      PLACES.filter((p) => {
        if (p.category !== mode) return false;
        if (blockedIds.includes(p.id)) return false;

        // distance filter
        if (p.distanceMiles > maxDistance) return false;

        // zip filter (simple startsWith for now)
        if (zipFilter.trim()) {
          if (!p.zipcode || !p.zipcode.startsWith(zipFilter.trim())) {
            return false;
          }
        }

        // outdoor / family flags
        if (outdoorOnly && !p.outdoorSeating) return false;
        if (familyOnly && !p.familyFriendly) return false;

        // cuisine / activity dropdown
        if (mode === "restaurants" && cuisineFilter !== "Any cuisine") {
          if (!p.cuisine || p.cuisine !== cuisineFilter) return false;
        }
        if (mode === "activities" && activityFilter !== "Any activity") {
          if (!p.activityType || p.activityType !== activityFilter) return false;
        }

        return true;
      }),
    [
      mode,
      blockedIds,
      maxDistance,
      zipFilter,
      outdoorOnly,
      familyOnly,
      cuisineFilter,
      activityFilter,
    ]
  );

  // keep index in range when list changes
  useEffect(() => {
    if (currentIndex >= filteredPlaces.length) {
      setCurrentIndex(filteredPlaces.length > 0 ? filteredPlaces.length - 1 : 0);
    }
  }, [filteredPlaces.length, currentIndex]);

  const currentPlace: Place | null =
    filteredPlaces.length > 0 ? filteredPlaces[currentIndex] : null;

  function goNext() {
    if (filteredPlaces.length === 0) return;
    setCurrentIndex((prev) =>
      prev < filteredPlaces.length - 1 ? prev + 1 : prev
    );
  }

  function goPrev() {
    if (filteredPlaces.length === 0) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }

  function handleLove() {
    if (!currentPlace) return;
    const id = currentPlace.id;
    const wasLoved = lovedIds.includes(id);

    setLovedIds((prev) =>
      wasLoved ? prev.filter((x) => x !== id) : [...prev, id]
    );

    setLikesByPlace((prev) => {
      const current = prev[id] ?? 0;
      return {
        ...prev,
        [id]: wasLoved ? Math.max(0, current - 1) : current + 1,
      };
    });
  }

  function handleBlock() {
    if (!currentPlace) return;
    setBlockedIds((prev) => [...prev, currentPlace.id]);
  }

  // touch (phone) swipe up/down
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    setTouchStartY(e.touches[0].clientY);
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (touchStartY === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY;

    if (deltaY < -50) {
      goNext();
    } else if (deltaY > 50) {
      goPrev();
    }

    setTouchStartY(null);
  }

  // scroll wheel (desktop) swipe-like behavior
  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (Math.abs(e.deltaY) < 20) return;
    if (e.deltaY > 0) {
      goNext();
    } else {
      goPrev();
    }
  }

  const cuisineOptions =
    mode === "restaurants" ? CUISINE_OPTIONS : ACTIVITY_OPTIONS;

  return (
    <div
      className={
        fullscreen
          ? "w-full h-full flex flex-col items-center"
          : "min-h-[100dvh] w-full flex flex-col items-center"
      }
    >
      <div className="w-full max-w-5xl px-4 pt-4 pb-6 flex flex-col gap-3">
        {/* Global header with logo */}
        <header className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <img
              src="/lg-logo.png"
              alt="Let'sGo logo"
              className="h-8 w-8 rounded-xl object-contain"
            />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/60">
                Let&apos;sGo
              </span>
              <span className="text-xs text-white/80">
                Swipe to decide where to go
              </span>
            </div>
          </div>

          {lovedIds.length > 0 && (
            <div className="text-[10px] text-emerald-300 text-right">
              <div className="font-semibold">
                {lovedIds.length} saved
              </div>
              <div className="text-[9px] text-emerald-200/70">
                Would do again
              </div>
            </div>
          )}
        </header>

        {/* Card container with touch + scroll handlers (TikTok-style) */}
        <div
          className="relative flex-1 h-[calc(100vh-120px)] max-h-[720px] mx-auto w-full"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {currentPlace ? (
            <div className="relative w-full h-full rounded-3xl overflow-hidden bg-slate-900 border border-white/15 shadow-2xl shadow-black/50 flex flex-col">
              {/* TOP BAR: mode toggle */}
              <div className="px-4 pt-3 flex items-center justify-between gap-3">
                {/* Restaurants / Activities */}
                <div className="relative w-64 max-w-[60%] p-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[11px] text-white/70">
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
                      onClick={() => {
                        setMode("restaurants");
                        setCurrentIndex(0);
                      }}
                      className={`py-1 rounded-full transition-colors duration-200 ${
                        mode === "restaurants"
                          ? "font-semibold text-black"
                          : "text-white/65"
                      }`}
                    >
                      Restaurants
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("activities");
                        setCurrentIndex(0);
                      }}
                      className={`py-1 rounded-full transition-colors duration-200 ${
                        mode === "activities"
                          ? "font-semibold text-black"
                          : "text-white/65"
                      }`}
                    >
                      Activities
                    </button>
                  </div>
                </div>

                {/* Simple info about index */}
                <p className="text-[10px] text-white/55">
                  {currentIndex + 1} / {filteredPlaces.length} in{" "}
                  {mode === "restaurants" ? "restaurants" : "activities"}
                </p>
              </div>

              {/* FILTERS + MAP TOGGLE */}
              <div className="px-4 mt-1 flex items-center justify-between text-[11px] text-white/60">
                <span>
                  Filters &amp; map are{" "}
                  <span className="font-semibold">
                    {showFilters ? "visible." : "hidden."}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className="px-2.5 py-1 rounded-full border border-white/25 bg-white/5 hover:bg-white/10 text-[10px]"
                >
                  {showFilters ? "Hide filters & map" : "Show filters & map"}
                </button>
              </div>

              {/* FILTER + MAP PANEL */}
              {showFilters && (
                <div className="px-4 pb-3 pt-2">
                  <div className="rounded-2xl border border-white/15 bg-black/60 px-3 py-3 flex flex-col md:flex-row gap-3">
                    {/* Left: filters */}
                    <div className="flex-1 flex flex-col gap-2 text-[11px]">
                      {/* Search by name/area/keyword (simple text filter later if you want) */}
                      <input
                        type="text"
                        placeholder="Search by name, area, or keyword (visual only for now)…"
                        className="w-full rounded-full bg-slate-950/80 border border-white/20 px-3 py-1.5 text-[11px] placeholder:text-white/35 focus:outline-none focus:border-pink-400/80"
                      />

                      {/* Cuisine / Activity dropdown */}
                      <div className="flex gap-2 flex-wrap">
                        <div className="flex-1 min-w-[160px]">
                          <label className="block text-[10px] text-white/50 mb-0.5">
                            {mode === "restaurants"
                              ? "Cuisine type"
                              : "Activity type"}
                          </label>
                          <select
                            className="w-full rounded-full bg-slate-950/80 border border-white/20 px-3 py-1.5 text-[11px] focus:outline-none focus:border-pink-400/80"
                            value={
                              mode === "restaurants"
                                ? cuisineFilter
                                : activityFilter
                            }
                            onChange={(e) =>
                              mode === "restaurants"
                                ? setCuisineFilter(e.target.value)
                                : setActivityFilter(e.target.value)
                            }
                          >
                            {cuisineOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Zip */}
                        <div className="w-32">
                          <label className="block text-[10px] text-white/50 mb-0.5">
                            Zip (optional)
                          </label>
                          <input
                            type="text"
                            maxLength={5}
                            value={zipFilter}
                            onChange={(e) => setZipFilter(e.target.value)}
                            className="w-full rounded-full bg-slate-950/80 border border-white/20 px-3 py-1.5 text-[11px] focus:outline-none focus:border-pink-400/80"
                          />
                        </div>
                      </div>

                      {/* Distance slider */}
                      <div className="mt-1">
                        <label className="block text-[10px] text-white/50 mb-0.5">
                          Max distance: {maxDistance} mi
                        </label>
                        <input
                          type="range"
                          min={1}
                          max={25}
                          value={maxDistance}
                          onChange={(e) =>
                            setMaxDistance(Number(e.target.value))
                          }
                          className="w-full"
                        />
                      </div>

                      {/* Checkboxes */}
                      <div className="flex flex-wrap gap-4 mt-1">
                        <label className="inline-flex items-center gap-1 text-[11px] text-white/70">
                          <input
                            type="checkbox"
                            className="accent-pink-500"
                            checked={outdoorOnly}
                            onChange={(e) => setOutdoorOnly(e.target.checked)}
                          />
                          Outdoor seating only
                        </label>
                        <label className="inline-flex items-center gap-1 text-[11px] text-white/70">
                          <input
                            type="checkbox"
                            className="accent-pink-500"
                            checked={familyOnly}
                            onChange={(e) => setFamilyOnly(e.target.checked)}
                          />
                          Family-friendly only
                        </label>
                      </div>
                    </div>

                    {/* Right: map placeholder */}
                    <div className="md:w-64 w-full rounded-2xl border border-white/15 bg-slate-950/80 flex flex-col justify-between">
                      <div className="flex-1 rounded-2xl overflow-hidden bg-black/60 flex items-center justify-center text-[11px] text-white/45">
                        <span>Map of current picks (placeholder)</span>
                      </div>
                      <p className="text-[10px] text-white/45 px-3 py-2">
                        Map will update as you filter or move through cards.
                        Later we&apos;ll hook this into real coordinates for
                        each place.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* MAIN CONTENT: image + details */}
              <div className="flex-1 flex flex-col">
                {/* Image area */}
                <div className="flex-1 relative px-4 pb-3">
                  <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-black/60">
                    <div className="h-full w-full overflow-x-auto no-scrollbar flex snap-x snap-mandatory">
                      {currentPlace.images.map((src, idx) => (
                        <div
                          key={idx}
                          className="relative flex-shrink-0 w-full h-full snap-center"
                        >
                          <img
                            src={src}
                            alt={`${currentPlace.name} photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/70 text-white/80 border border-white/20">
                            {idx + 1}/{currentPlace.images.length}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Block / Like buttons bottom-right */}
                    <div className="absolute bottom-3 right-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleBlock}
                        className="h-9 w-9 rounded-full bg-black/70 border border-red-400/80 text-sm flex items-center justify-center hover:bg-red-500/20"
                        title="Block this place"
                      >
                        ✕
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleLove}
                          className={`h-9 w-9 rounded-full border text-sm flex items-center justify-center transition-colors ${
                            lovedIds.includes(currentPlace.id)
                              ? "bg-emerald-500/20 border-emerald-400/90 text-emerald-200"
                              : "bg-black/70 border-emerald-400/80 text-emerald-200 hover:bg-emerald-500/20"
                          }`}
                          title="Would go again"
                        >
                          ❤
                        </button>
                        {likesByPlace[currentPlace.id] != null &&
                          likesByPlace[currentPlace.id] > 0 && (
                            <span className="text-[10px] text-emerald-200">
                              {likesByPlace[currentPlace.id]}
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details area */}
                {currentPlace && (
                  <div className="px-4 pb-3 pt-2 bg-black/70 border-t border-white/10">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-pink-300/85 mb-0.5">
                          {currentPlace.category === "restaurants"
                            ? "Restaurant pick"
                            : "Activity pick"}
                        </p>
                        <h1 className="text-sm sm:text-base font-semibold leading-tight">
                          {currentPlace.name}
                        </h1>
                        <p className="text-[11px] text-white/70">
                          {currentPlace.type}
                        </p>
                        <p className="text-[11px] text-white/65 break-words">
                          {currentPlace.location}
                        </p>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            currentPlace.mapQuery ||
                              `${currentPlace.name} ${currentPlace.location}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-sky-300 hover:text-sky-200 underline underline-offset-2"
                        >
                          Open in Maps
                        </a>
                        <p className="text-[11px] text-white/55 mt-0.5 line-clamp-2">
                          {currentPlace.blurb}
                        </p>
                      </div>

                      <div className="text-right text-[10px] text-white/65 whitespace-pre-line flex-shrink-0">
                        <p className="uppercase tracking-[0.18em] text-white/50 mb-0.5">
                          Hours
                        </p>
                        <p>
                          {/* simple placeholder hours block */}
                          Mon–Thu 11:00a–10:00p{"\n"}
                          Fri–Sat 11:00a–11:00p{"\n"}
                          Sun Closed
                        </p>
                        <div className="mt-1">
                          <div>{PRICE_TEXT[currentPlace.priceLevel]}</div>
                          <div>{currentPlace.distanceMiles} mi away</div>
                          <div
                            className={
                              currentPlace.openNow
                                ? "text-emerald-300"
                                : "text-red-300"
                            }
                          >
                            {currentPlace.openNow ? "Open now" : "Closed"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {currentPlace.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-[9px] text-white/70"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full h-full rounded-3xl border border-white/15 bg-slate-900/80 flex flex-col items-center justify-center text-center px-6">
              <p className="text-sm font-semibold mb-1">
                No more places in this mode.
              </p>
              <p className="text-[11px] text-white/60 mb-3">
                Try switching between Restaurants / Activities or clearing your
                blocked list later.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}