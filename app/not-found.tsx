import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-slate-900 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-7xl font-bold bg-gradient-to-r from-pink-400 to-sky-400 bg-clip-text text-transparent">
          404
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-white">
          Page not found
        </h1>
        <p className="mt-3 text-white/60 text-sm leading-relaxed">
          Looks like this page went out without you. Let&apos;s get you back on track.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-xl bg-gradient-to-r from-pink-500 to-sky-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-pink-500/25 transition hover:shadow-pink-500/40"
          >
            Go Home
          </Link>
          <Link
            href="/swipe"
            className="rounded-xl border border-white/15 px-6 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5"
          >
            Discover Places
          </Link>
        </div>
      </div>
    </div>
  );
}
