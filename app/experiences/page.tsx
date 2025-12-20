"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type VisitType = "date" | "family" | "friends" | "solo";
type SortMode = "trending" | "date";

type Comment = {
  id: string;
  user: string;
  text: string;
  likes: number;
};

type ExperienceItem = {
  id: string;
  placeName: string;
  placeLocation: string;
  visitType: VisitType;
  headline: string;
  image: string;
  userName: string;
  initialLikes: number;
  dateISO: string; // YYYY-MM-DD
  comments: Comment[];
};

const EXPERIENCES: ExperienceItem[] = [
  {
    id: "exp-1",
    placeName: "J. Coco",
    placeLocation: "Omaha, NE",
    visitType: "date",
    headline: "Perfect quiet anniversary dinner, cocktails were on point.",
    image:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
    userName: "Megan",
    initialLikes: 132,
    dateISO: "2025-03-15",
    comments: [
      {
        id: "c1",
        user: "Alex",
        text: "We went here last week – agree 100%!",
        likes: 4,
      },
      {
        id: "c2",
        user: "Jordan",
        text: "What did you order for mains?",
        likes: 2,
      },
    ],
  },
  {
    id: "exp-2",
    placeName: "Block 16",
    placeLocation: "Downtown Omaha, NE",
    visitType: "family",
    headline:
      "Kids crushed the fries, line moved fast even though it was packed.",
    image:
      "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80",
    userName: "Jess",
    initialLikes: 89,
    dateISO: "2025-04-02",
    comments: [
      {
        id: "c3",
        user: "Sam",
        text: "That burger looks insane 🔥",
        likes: 6,
      },
      {
        id: "c4",
        user: "Taylor",
        text: "Is there decent vegetarian options?",
        likes: 1,
      },
    ],
  },
  {
    id: "exp-3",
    placeName: "Blue Sushi Sake Grill",
    placeLocation: "Multiple locations",
    visitType: "friends",
    headline: "Happy hour rolls and drinks, perfect pre-game spot.",
    image:
      "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80",
    userName: "Chris",
    initialLikes: 203,
    dateISO: "2025-05-10",
    comments: [
      {
        id: "c5",
        user: "Riley",
        text: "Blue is always the move 🙌",
        likes: 8,
      },
      {
        id: "c6",
        user: "Dana",
        text: "Which location is your favorite?",
        likes: 3,
      },
    ],
  },
  {
    id: "exp-4",
    placeName: "The Mark",
    placeLocation: "West Omaha, NE",
    visitType: "family",
    headline:
      "Two bowling games and the kids still begged for arcade time afterwards.",
    image:
      "https://images.unsplash.com/photo-1518131678677-bc1a4dca4ccb?auto=format&fit=crop&w=1200&q=80",
    userName: "Sara",
    initialLikes: 64,
    dateISO: "2025-05-25",
    comments: [
      {
        id: "c7",
        user: "Chris",
        text: "Arcade there is legit.",
        likes: 2,
      },
      {
        id: "c8",
        user: "Mia",
        text: "How busy was it on a Saturday?",
        likes: 1,
      },
    ],
  },
];

function visitTypeLabel(v: VisitType) {
  switch (v) {
    case "date":
      return "Date night";
    case "family":
      return "Family night";
    case "friends":
      return "Friends";
    case "solo":
      return "Solo";
  }
}

export default function ExperiencesPage() {
  const [sortMode, setSortMode] = useState<SortMode>("trending");

  // Experience likes
  const [likes, setLikes] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {};
    for (const exp of EXPERIENCES) base[exp.id] = exp.initialLikes;
    return base;
  });
  const [likedIds, setLikedIds] = useState<string[]>([]);

  // Comments data + likes
  const [commentsById, setCommentsById] = useState<Record<string, Comment[]>>(
    () => {
      const base: Record<string, Comment[]> = {};
      for (const exp of EXPERIENCES) base[exp.id] = exp.comments;
      return base;
    }
  );
  const [likedCommentKeys, setLikedCommentKeys] = useState<string[]>([]);
  const [draftById, setDraftById] = useState<Record<string, string>>({});

  // Which posts currently have comments expanded
  const [openCommentsIds, setOpenCommentsIds] = useState<string[]>([]);

  const sortedExperiences = useMemo(() => {
    const list = [...EXPERIENCES];
    if (sortMode === "trending") {
      list.sort(
        (a, b) => (likes[b.id] ?? b.initialLikes) - (likes[a.id] ?? a.initialLikes)
      );
    } else {
      list.sort(
        (a, b) =>
          new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
      );
    }
    return list;
  }, [sortMode, likes]);

  function toggleLike(expId: string) {
    setLikes((prev) => {
      const liked = likedIds.includes(expId);
      const current = prev[expId] ?? 0;
      return {
        ...prev,
        [expId]: liked ? Math.max(0, current - 1) : current + 1,
      };
    });
    setLikedIds((prev) =>
      prev.includes(expId) ? prev.filter((x) => x !== expId) : [...prev, expId]
    );
  }

  function toggleComments(expId: string) {
    setOpenCommentsIds((prev) =>
      prev.includes(expId) ? prev.filter((id) => id !== expId) : [...prev, expId]
    );
  }

  function handleDraftChange(id: string, value: string) {
    setDraftById((prev) => ({ ...prev, [id]: value }));
  }

  function submitComment(expId: string) {
    const text = draftById[expId]?.trim();
    if (!text) return;
    setCommentsById((prev) => {
      const existing = prev[expId] ?? [];
      const newComment: Comment = {
        id: `new-${expId}-${existing.length + 1}`,
        user: "You",
        text,
        likes: 0,
      };
      return { ...prev, [expId]: [...existing, newComment] };
    });
    setDraftById((prev) => ({ ...prev, [expId]: "" }));
  }

  function toggleCommentLike(expId: string, commentId: string) {
    const key = `${expId}:${commentId}`;
    const alreadyLiked = likedCommentKeys.includes(key);

    setCommentsById((prev) => {
      const list = prev[expId] ?? [];
      const updated = list.map((c) => {
        if (c.id !== commentId) return c;
        return {
          ...c,
          likes: Math.max(0, c.likes + (alreadyLiked ? -1 : 1)),
        };
      });
      return { ...prev, [expId]: updated };
    });

    setLikedCommentKeys((prev) =>
      alreadyLiked ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  return (
    <main className="h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white flex flex-col overflow-hidden">
      {/* HEADER (fixed) */}
      <header className="shrink-0 w-full max-w-5xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between gap-3">
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
              User experiences (early mock)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Trending / Newest toggle */}
          <div className="relative text-[11px]">
            <div className="w-32 p-1 rounded-full bg-black/70 border border-white/25 flex">
              <button
                type="button"
                className={`flex-1 py-0.5 rounded-full ${
                  sortMode === "trending"
                    ? "bg-white text-black text-[11px] font-semibold"
                    : "text-white/65"
                }`}
                onClick={() => setSortMode("trending")}
              >
                Trending
              </button>
              <button
                type="button"
                className={`flex-1 py-0.5 rounded-full ${
                  sortMode === "date"
                    ? "bg-white text-black text-[11px] font-semibold"
                    : "text-white/65"
                }`}
                onClick={() => setSortMode("date")}
              >
                Newest
              </button>
            </div>
          </div>

          <Link
            href="/"
            className="px-3 py-1.5 rounded-full bg-white/5 border border-white/20 text-[11px] hover:bg-white/10"
          >
            ⟵ Home
          </Link>
        </div>
      </header>

      {/* SNAP SCROLL FEED */}
      <section className="flex-1 overflow-y-auto snap-y snap-mandatory">
        {sortedExperiences.map((exp) => {
          const likeCount = likes[exp.id] ?? exp.initialLikes;
          const isLiked = likedIds.includes(exp.id);
          const comments = commentsById[exp.id] ?? [];
          const draft = draftById[exp.id] ?? "";
          const isCommentsOpen = openCommentsIds.includes(exp.id);

          return (
            <article
              key={exp.id}
              className="snap-start h-[100dvh] flex-none flex items-center justify-center px-4"
            >
              <div className="w-full max-w-md sm:max-w-lg rounded-3xl overflow-hidden border border-white/15 bg-black/80 shadow-2xl shadow-black/60 flex flex-col h-[90vh]">
                {/* IMAGE AREA */}
                <div className="relative w-full flex-1 bg-black">
                  <img
                    src={exp.image}
                    alt={exp.headline}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12 bg-gradient-to-t from-black/90 via-black/45 to-transparent">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/70 border border-white/25 text-white/85">
                        {visitTypeLabel(exp.visitType)}
                      </span>
                      <span className="text-[10px] text-white/75">
                        @{exp.userName}
                      </span>
                    </div>
                    <p className="text-[13px] font-semibold leading-snug">
                      {exp.headline}
                    </p>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      at {exp.placeName} · {exp.placeLocation}
                    </p>
                  </div>
                </div>

                {/* LIKE + COMMENTS BAR */}
                <div className="px-4 py-2 flex items-center justify-between text-[11px] text-white/70 bg-black/95 border-t border-white/15">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => toggleLike(exp.id)}
                      className={`h-8 px-3 rounded-full border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                        isLiked
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                          : "bg-white/5 border-white/35 hover:bg-white/10"
                      }`}
                    >
                      <span>{isLiked ? "❤ Liked" : "♡ Like"}</span>
                      <span className="text-[10px] opacity-80">
                        {likeCount.toLocaleString()}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleComments(exp.id)}
                      className="h-8 px-3 rounded-full border border-white/30 bg-white/5 hover:bg-white/10 flex items-center gap-1 text-[11px]"
                    >
                      <span>💬 Comments</span>
                      <span className="text-[10px] opacity-80">
                        {comments.length}
                      </span>
                      <span className="text-[9px] opacity-60">
                        {isCommentsOpen ? "(hide)" : "(show)"}
                      </span>
                    </button>
                  </div>

                  <span className="hidden sm:inline text-[10px] text-white/55">
                    Swipe / scroll to see more nights out
                  </span>
                </div>

                {/* COMMENTS PANEL (TOGGLED) */}
                {isCommentsOpen && (
                  <div className="px-4 pb-3 pt-2 text-[11px] text-white/75 bg-black/90 border-t border-white/10 flex flex-col gap-2 flex-[0_0_32vh] overflow-y-auto">
                    <div>
                      <p className="font-semibold mb-1">Comments</p>
                      {comments.length === 0 ? (
                        <p className="text-[10px] text-white/55">
                          Be the first to ask a question or leave a reaction for
                          this place.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {comments.map((c) => {
                            const key = `${exp.id}:${c.id}`;
                            const commentLiked = likedCommentKeys.includes(key);
                            return (
                              <li
                                key={c.id}
                                className="flex items-start justify-between gap-2"
                              >
                                <div className="pr-2">
                                  <span className="font-semibold mr-1">
                                    @{c.user}
                                  </span>
                                  <span className="text-white/80">
                                    {c.text}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleCommentLike(exp.id, c.id)
                                  }
                                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                    commentLiked
                                      ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
                                      : "border-white/25 bg-white/5 text-white/70 hover:bg-white/10"
                                  }`}
                                >
                                  <span>{commentLiked ? "❤" : "♡"}</span>
                                  <span>{c.likes}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {/* COMMENT COMPOSER */}
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={draft}
                        onChange={(e) =>
                          handleDraftChange(exp.id, e.target.value)
                        }
                        placeholder="Add a comment or question…"
                        className="flex-1 rounded-full bg-slate-900 border border-white/25 px-3 py-1.5 text-[11px] outline-none focus:border-sky-400"
                      />
                      <button
                        type="button"
                        onClick={() => submitComment(exp.id)}
                        className="px-3 py-1.5 rounded-full bg-sky-500 text-black text-[11px] font-semibold hover:bg-sky-400 disabled:bg-white/10 disabled:text-white/40"
                        disabled={!draft.trim()}
                      >
                        Comment
                      </button>
                    </div>

                    <p className="text-[9px] text-white/40">
                      Later we&apos;ll link comments to real accounts and notify
                      the business when someone asks a question.
                    </p>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}