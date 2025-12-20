"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type EventType =
  | "concert"
  | "comedy"
  | "trivia"
  | "family"
  | "sports"
  | "food-drink"
  | "festival"
  | "other";

type Event = {
  id: string;
  name: string;
  businessName: string;
  eventType: EventType;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // "7:00–9:30 PM"
  location: string;
  zip: string;
  distanceMiles: number;
  is21Plus: boolean;
  kidFriendly: boolean;
  images: string[];
  tags: string[];
  priceText: string;
};

const ALL_EVENTS: Event[] = [
  {
    id: "evt-1",
    name: "Whiskey Steak & Jazz Night",
    businessName: "The Drover",
    eventType: "food-drink",
    description:
      "Special whiskey-marinated steak menu with live jazz trio in the bar.",
    date: "2025-12-05",
    time: "6:30–9:30 PM",
    location: "Omaha, NE",
    zip: "68124",
    distanceMiles: 8,
    is21Plus: true,
    kidFriendly: false,
    images: [
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=1200&q=80",
    ],
    tags: ["steak", "whiskey", "live music"],
    priceText: "À la carte menu",
  },
  {
    id: "evt-2",
    name: "Family Roll-Your-Own Sushi Night",
    businessName: "Blue Sushi Sake Grill",
    eventType: "family",
    description:
      "Hands-on sushi class for families, with kid-friendly rolls and mocktails.",
    date: "2025-12-07",
    time: "4:00–6:00 PM",
    location: "Multiple Omaha locations",
    zip: "68114",
    distanceMiles: 5,
    is21Plus: false,
    kidFriendly: true,
    images: [
      "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80",
    ],
    tags: ["class", "kids", "sushi"],
    priceText: "$35 per person",
  },
  {
    id: "evt-3",
    name: "Comedy Night – Local Headliners",
    businessName: "Funny Bone",
    eventType: "comedy",
    description:
      "Stand-up showcase with regional comics. Two shows, two-drink minimum.",
    date: "2025-12-06",
    time: "7:30 & 9:45 PM",
    location: "Village Pointe, Omaha, NE",
    zip: "68118",
    distanceMiles: 9,
    is21Plus: true,
    kidFriendly: false,
    images: [
      "https://images.unsplash.com/photo-1512428232641-8fcd1437a3a2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512428702800-1c8d5b4c3c56?auto=format&fit=crop&w=1200&q=80",
    ],
    tags: ["stand-up", "night out"],
    priceText: "$25 + fees",
  },
  {
    id: "evt-4",
    name: "Glow Bowling + Arcade Night",
    businessName: "The Mark",
    eventType: "sports",
    description:
      "Glow-in-the-dark bowling, arcade deals, and family lane specials.",
    date: "2025-12-06",
    time: "5:00–10:00 PM",
    location: "West Omaha, NE",
    zip: "68116",
    distanceMiles: 11,
    is21Plus: false,
    kidFriendly: true,
    images: [
      "https://images.unsplash.com/photo-1518131678677-bc1a4dca4ccb?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504274066651-8d1d1a7d4793?auto=format&fit=crop&w=1200&q=80",
    ],
    tags: ["bowling", "arcade", "family"],
    priceText: "Lane packages from $29",
  },
  {
    id: "evt-5",
    name: "Escape Room Tournament Night",
    businessName: "Escape Room Omaha",
    eventType: "trivia",
    description:
      "Timed competition across multiple rooms. Teams compete for gift card prizes.",
    date: "2025-12-12",
    time: "7:00–10:00 PM",
    location: "Omaha, NE",
    zip: "68102",
    distanceMiles: 4,
    is21Plus: false,
    kidFriendly: true,
    images: [
      "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    ],
    tags: ["competition", "puzzles", "prizes"],
    priceText: "$30 per player",
  },
];

const EVENT_TYPE_OPTIONS: { value: EventType | "any"; label: string }[] = [
  { value: "any", label: "Any event type" },
  { value: "concert", label: "Concert / Live music" },
  { value: "comedy", label: "Comedy" },
  { value: "trivia", label: "Trivia / Game night" },
  { value: "family", label: "Family event" },
  { value: "sports", label: "Sports / Bowling / Games" },
  { value: "food-drink", label: "Food & drink event" },
  { value: "festival", label: "Festival / market" },
  { value: "other", label: "Other" },
];

export default function EventsPage() {
  const [showFilters, setShowFilters] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [eventType, setEventType] = useState<EventType | "any">("any");
  const [zip, setZip] = useState("");
  const [maxDistance, setMaxDistance] = useState<number>(25);
  const [only21Plus, setOnly21Plus] = useState(false);
  const [onlyKidFriendly, setOnlyKidFriendly] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const filteredEvents = useMemo(() => {
    return ALL_EVENTS.filter((evt) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesSearch =
          evt.name.toLowerCase().includes(q) ||
          evt.businessName.toLowerCase().includes(q) ||
          evt.description.toLowerCase().includes(q) ||
          evt.location.toLowerCase().includes(q) ||
          evt.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      if (startDate && evt.date < startDate) return false;
      if (endDate && evt.date > endDate) return false;

      if (eventType !== "any" && evt.eventType !== eventType) return false;

      if (zip.trim() && !evt.zip.startsWith(zip.trim())) return false;

      if (evt.distanceMiles > maxDistance) return false;

      if (only21Plus && !evt.is21Plus) return false;
      if (onlyKidFriendly && !evt.kidFriendly) return false;

      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [
    search,
    startDate,
    endDate,
    eventType,
    zip,
    maxDistance,
    only21Plus,
    onlyKidFriendly,
  ]);

  function handleShare(evt: Event) {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/events#${evt.id}`
        : `/events#${evt.id}`;

    const text = `Check this out: ${evt.name} at ${evt.businessName} on ${evt.date} (${evt.time})`;

    if (typeof navigator !== "undefined" && (navigator as any).share) {
      (navigator as any)
        .share({
          title: evt.name,
          text,
          url,
        })
        .catch(() => {
          // ignore if user cancels
        });
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        alert("Event link copied – paste it to invite a friend.");
      });
    } else {
      alert("Sharing coming soon – for now just copy the page URL.");
    }
  }

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white flex flex-col items-center">
      <div className="w-full max-w-5xl px-4 pt-4 pb-10 flex flex-col gap-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
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
                Events & special nights
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="hidden sm:inline text-white/55">
              {filteredEvents.length} event
              {filteredEvents.length === 1 ? "" : "s"} showing
            </span>
            <Link
              href="/"
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/20 hover:bg-white/10"
            >
              ⟵ Home
            </Link>
          </div>
        </header>

        {/* Top label row */}
        <section className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-pink-300/80">
              Events
            </p>
            <p className="text-sm text-white/75">
              Browse upcoming events, classes, and specials around town.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="px-3 py-1.5 rounded-full border border-white/20 text-[11px] hover:bg-white/10"
          >
            {showFilters ? "Hide filters & map" : "Show filters & map"}
          </button>
        </section>

        {/* Filters + map (placeholder) */}
        {showFilters && (
          <section className="rounded-2xl border border-white/12 bg-slate-950/70 px-4 py-4 flex flex-col md:flex-row gap-4">
            {/* Filters left */}
            <div className="flex-1 flex flex-col gap-3">
              {/* Search */}
              <div className="w-full rounded-full bg-black/70 border border-white/20 px-3 py-2 text-[12px]">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, business, area, or keyword…"
                  className="w-full bg-transparent outline-none"
                />
              </div>

              {/* Date range + event type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date range */}
                <div className="flex flex-col gap-1 text-[11px]">
                  <span className="text-white/60">Date range</span>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={today}
                      className="w-1/2 rounded-full bg-black/80 border border-white/25 px-3 py-1.5 text-[12px] outline-none focus:border-pink-400/80"
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || today}
                      className="w-1/2 rounded-full bg-black/80 border border-white/25 px-3 py-1.5 text-[12px] outline-none focus:border-pink-400/80"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="self-start text-[10px] text-white/45 hover:text-white/70 mt-0.5"
                  >
                    Clear dates
                  </button>
                </div>

                {/* Event type */}
                <div className="flex flex-col gap-1 text-[11px]">
                  <span className="text-white/60">Event type</span>
                  <select
                    value={eventType}
                    onChange={(e) =>
                      setEventType(e.target.value as EventType | "any")
                    }
                    className="rounded-full bg-black/80 border border-white/25 px-3 py-1.5 text-[12px] outline-none focus:border-pink-400/80"
                  >
                    {EVENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Zip + distance + toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-white/60">Zip (optional)</span>
                    <input
                      type="text"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="e.g. 68124"
                      className="rounded-full bg-black/80 border border-white/25 px-3 py-1.5 text-[12px] outline-none focus:border-pink-400/80"
                    />
                  </div>

                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-white/60">
                      Max distance: {maxDistance} mi
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={maxDistance}
                      onChange={(e) =>
                        setMaxDistance(Number(e.target.value) || 1)
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-white/60">Vibe filters</span>
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={only21Plus}
                      onChange={(e) => setOnly21Plus(e.target.checked)}
                      className="h-3 w-3 rounded border-white/40 bg-black"
                    />
                    <span className="text-[11px] text-white/70">
                      21+ only events
                    </span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onlyKidFriendly}
                      onChange={(e) => setOnlyKidFriendly(e.target.checked)}
                      className="h-3 w-3 rounded border-white/40 bg-black"
                    />
                    <span className="text-[11px] text-white/70">
                      Kid-friendly events
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Map placeholder right */}
            <div className="w-full md:w-64 lg:w-80 rounded-2xl bg-black/70 border border-white/15 p-3 text-[11px] text-white/65 flex flex-col justify-between">
              <div className="flex-1 rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-black border border-white/10 flex items-center justify-center text-center px-3">
                <span className="text-[11px] text-white/55">
                  Map of current events (placeholder).
                  <br />
                  Eventually these pins will be real locations filtered by your
                  settings.
                </span>
              </div>
              <p className="mt-2 text-[10px] text-white/45">
                When we connect live data, events will show here as pins you can
                tap to jump to the matching card.
              </p>
            </div>
          </section>
        )}

        {/* Events list */}
        <section className="flex flex-col gap-3">
          {filteredEvents.length === 0 && (
            <p className="text-sm text-white/60">
              No events match those filters yet. Try clearing the dates or
              loosening the filters.
            </p>
          )}

          {filteredEvents.map((evt) => (
            <article
              key={evt.id}
              id={evt.id}
              className="rounded-3xl border border-white/12 bg-black/70 overflow-hidden flex flex-col sm:flex-row"
            >
              {/* Image strip with horizontal swipe */}
              <div className="w-full sm:w-64 h-40 sm:h-auto flex-shrink-0 rounded-none sm:rounded-l-3xl overflow-hidden border-b sm:border-b-0 sm:border-r border-white/10 bg-black/40">
                <div className="h-full w-full overflow-x-auto no-scrollbar flex snap-x snap-mandatory">
                  {evt.images.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative flex-shrink-0 w-full h-40 sm:h-full snap-center"
                    >
                      <img
                        src={src}
                        alt={`${evt.name} photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-1 right-1 text-[9px] px-1.5 py-0.5 rounded-full bg-black/70 text-white/80 border border-white/20">
                        {idx + 1}/{evt.images.length}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 px-4 py-3 sm:px-5 sm:py-4 flex flex-col justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-pink-300/85 mb-1">
                    {evt.eventType === "food-drink"
                      ? "Food & drink event"
                      : evt.eventType === "sports"
                      ? "Games & sports"
                      : evt.eventType === "family"
                      ? "Family event"
                      : evt.eventType === "trivia"
                      ? "Trivia / competition"
                      : evt.eventType === "concert"
                      ? "Concert / live music"
                      : evt.eventType === "comedy"
                      ? "Comedy"
                      : evt.eventType === "festival"
                      ? "Festival / market"
                      : "Event"}
                  </p>
                  <h2 className="text-sm sm:text-base font-semibold">
                    {evt.name}
                  </h2>
                  <p className="text-[11px] text-white/70">
                    at <span className="font-medium">{evt.businessName}</span>
                  </p>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-white/60">
                    <span>
                      {evt.date} • {evt.time}
                    </span>
                    <span>{evt.location}</span>
                    <span>{evt.priceText}</span>
                    <span>{evt.distanceMiles} mi away</span>
                  </div>

                  <p className="mt-2 text-[11px] text-white/65">
                    {evt.description}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {evt.is21Plus && (
                      <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-[9px] text-white/75">
                        21+
                      </span>
                    )}
                    {evt.kidFriendly && (
                      <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-[9px] text-white/75">
                        Kid-friendly
                      </span>
                    )}
                    {evt.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-[9px] text-white/70"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] text-white/50">
                    These buttons are frontend-only for now. Later they&apos;ll
                    link to real ticket flows & invites.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleShare(evt)}
                      className="px-3 py-1.5 rounded-full bg-white/5 border border-white/25 text-[11px] hover:bg-white/10"
                    >
                      Share
                    </button>
                    <button
                      type="button"
                      className="px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-400 text-[11px] font-semibold text-black shadow-lg shadow-pink-500/30 hover:brightness-110"
                    >
                      Buy tickets (mock)
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}