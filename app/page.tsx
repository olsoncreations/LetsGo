import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white flex flex-col items-center">
      {/* global neon blobs */}
      <div className="pointer-events-none fixed inset-0 opacity-60 mix-blend-screen">
        <div className="absolute -top-20 -left-24 w-72 h-72 bg-pink-500/30 blur-3xl rounded-full" />
        <div className="absolute -top-10 right-0 w-64 h-64 bg-sky-500/30 blur-3xl rounded-full" />
        <div className="absolute bottom-[-4rem] left-10 w-80 h-80 bg-purple-500/25 blur-3xl rounded-full" />
        <div className="absolute bottom-[-5rem] right-[-2rem] w-72 h-72 bg-amber-400/25 blur-3xl rounded-full" />
      </div>

      <div className="w-full max-w-6xl px-4 pt-4 pb-10 relative z-10 flex flex-col gap-6">
        {/* HEADER ONLY */}
        <header className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-black/60 border border-white/20 flex items-center justify-center shadow-[0_0_25px_rgba(244,63,94,0.8)]">
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
                Go. Play. Eat. Get paid to live life.
              </span>
            </div>
          </div>

          <Link
            href="/profile"
            className="text-[11px] px-3 py-1.5 rounded-full bg-white/5 border border-white/25 hover:bg-white/10"
          >
            Profile
          </Link>
        </header>

        {/* MODES GRID – MAIN CONTENT */}
        <section className="mt-2">
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/60 mb-3">
            Pick how you want to plan your night
          </p>

          <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
            <ModeCard
              label="Discovery"
              title="Explore New Adventures"
              description="Flip through full-screen cards for food and fun. Swipe right on places you’d actually go and build your personal 'Would go again' list."
              bestFor="Quick decisions, solo or couple"
              href="/swipe"
              accent="pink"
            />

            <ModeCard
              label="Date night"
              title="Let AI plan your date"
              description="Tell us your vibe, budget, distance and our generative AI will select 1 restaurant + 1 activity with a game-show style reveal!"
              bestFor="Couples, last-minute nights out"
              href="/datenight"
              accent="purple"
            />

            <ModeCard
              label="1 on 1"
              title="5 → 3 → 1 mini pick"
              description="You pick 5, they narrow to 3, you lock the final 1. Built for two people to help them decide."
              bestFor="2–4 people"
              href="/5v3v1"
              accent="sky"
            />

            <ModeCard
              label="Fun with Friends"
              title="Multi-round group vote"
              description="Spin up a group code, let everyone add places, then run round-by-round votes until there’s a single winner nobody can argue with."
              bestFor="Friend groups, trips, office crews"
              href="/group"
              accent="emerald"
            />

            <ModeCard
              label="Events"
              title="See what’s happening"
              description="Browse concerts, trivia, themed nights and more."
              bestFor="Planning ahead"
              href="/events"
              accent="amber"
            />

            <ModeCard
              label="Experiences"
              title="Scroll other people’s nights"
              description="User feed of real nights out at real places. Photos, videos, comments and vibes to spark ideas."
              bestFor="Discovery & inspiration"
              href="/experiences"
              accent="rose"
            />
          </div>

          <p className="mt-5 text-[11px] text-white/45 max-w-2xl">
            *** See profile page for progressive payouts! Remember to keep your receipts!
          </p>
        </section>
      </div>
    </main>
  );
}

type Accent =
  | "pink"
  | "purple"
  | "sky"
  | "emerald"
  | "amber"
  | "rose";

type ModeCardProps = {
  label: string;
  title: string;
  description: string;
  bestFor: string;
  href: string;
  accent: Accent;
};

function accentClasses(accent: Accent) {
  switch (accent) {
    case "pink":
      return {
        border: "border-pink-400/70",
        glow: "shadow-[0_0_40px_rgba(244,114,182,0.7)]",
        hover: "hover:bg-pink-500/10 hover:border-pink-300",
      };
    case "purple":
      return {
        border: "border-purple-400/70",
        glow: "shadow-[0_0_40px_rgba(168,85,247,0.7)]",
        hover: "hover:bg-purple-500/10 hover:border-purple-300",
      };
    case "sky":
      return {
        border: "border-sky-400/70",
        glow: "shadow-[0_0_40px_rgba(56,189,248,0.7)]",
        hover: "hover:bg-sky-500/10 hover:border-sky-300",
      };
    case "emerald":
      return {
        border: "border-emerald-400/70",
        glow: "shadow-[0_0_40px_rgba(16,185,129,0.7)]",
        hover: "hover:bg-emerald-500/10 hover:border-emerald-300",
      };
    case "amber":
      return {
        border: "border-amber-400/70",
        glow: "shadow-[0_0_40px_rgba(245,158,11,0.7)]",
        hover: "hover:bg-amber-500/10 hover:border-amber-300",
      };
    case "rose":
    default:
      return {
        border: "border-rose-400/70",
        glow: "shadow-[0_0_40px_rgba(244,63,94,0.7)]",
        hover: "hover:bg-rose-500/10 hover:border-rose-300",
      };
  }
}

function ModeCard({
  label,
  title,
  description,
  bestFor,
  href,
  accent,
}: ModeCardProps) {
  const { border, glow, hover } = accentClasses(accent);

  return (
    <Link
      href={href}
      className={`group rounded-[1.5rem] bg-slate-950/90 px-5 py-5 flex flex-col justify-between border border-white/12 ${border} ${glow} ${hover} transition-all duration-200`}
    >
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-white/60 mb-1">
          {label}
        </p>
        <h2 className="text-sm sm:text-base font-semibold mb-1">
          {title}
        </h2>
        <p className="text-[11px] text-white/75 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-white/60">
        <span className="max-w-[70%]">Best for: {bestFor}</span>
        <span className="text-white/70 group-hover:text-white">
          
        </span>
      </div>
    </Link>
  );
}