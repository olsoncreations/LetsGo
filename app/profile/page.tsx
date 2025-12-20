"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Home,
  Upload,
  Calculator,
  Heart,
  User,
  X,
  Info,
} from "lucide-react";

type Business = {
  id: number;
  name: string;
  category: string;
  visitsThisYear: number;
  level: number;
  thisVisitCap: number;
  nextLevelCap: number;
};

type Receipt = {
  id: number;
  business: string;
  amount: number;
  payout: number;
  date: string;
  status: "approved" | "pending";
};

const userData = {
  name: "Chris Olson",
  username: "@chris",
  location: "Omaha, NE",
  memberSince: "2025",
  nightsOut: 42,
  placesVisited: 19,
  savedPlaces: 3,
};

const balanceData = {
  lifetime: 186.5,
  thisMonth: 42.75,
  pending: 18.0,
  available: 64.75,
};

const businesses: Business[] = [
  {
    id: 1,
    name: "Block 16",
    category: "Burgers • Casual",
    visitsThisYear: 4,
    level: 2,
    thisVisitCap: 5.0,
    nextLevelCap: 6.5,
  },
  {
    id: 2,
    name: "Blue Sushi Sake Grill",
    category: "Sushi • Drinks",
    visitsThisYear: 1,
    level: 1,
    thisVisitCap: 3.0,
    nextLevelCap: 4.5,
  },
  {
    id: 3,
    name: "The Drover",
    category: "Steakhouse",
    visitsThisYear: 7,
    level: 3,
    thisVisitCap: 8.0,
    nextLevelCap: 10.0,
  },
];

const receiptHistory: Receipt[] = [
  {
    id: 1,
    business: "Block 16",
    amount: 45.5,
    payout: 5.0,
    date: "2025-12-05",
    status: "approved",
  },
  {
    id: 2,
    business: "The Drover",
    amount: 89.0,
    payout: 8.0,
    date: "2025-12-01",
    status: "approved",
  },
  {
    id: 3,
    business: "Blue Sushi Sake Grill",
    amount: 62.3,
    payout: 3.0,
    date: "2025-11-28",
    status: "pending",
  },
];

// Generic sample ladder for the calculator modal
const SAMPLE_LADDER = [
  {
    levelLabel: "Level 1 (Starter)",
    visitsRange: "1–10 visits",
    percent: "5%",
    cap: "$5.00 cap",
    color: "text-cyan-400",
  },
  {
    levelLabel: "Level 2 (Regular)",
    visitsRange: "11–20 visits",
    percent: "7.5%",
    cap: "$7.50 cap",
    color: "text-blue-400",
  },
  {
    levelLabel: "Level 3 (Favorite)",
    visitsRange: "21–30 visits",
    percent: "10%",
    cap: "$10.00 cap",
    color: "text-purple-400",
  },
  {
    levelLabel: "Level 4 (VIP)",
    visitsRange: "31–40 visits",
    percent: "12.5%",
    cap: "$12.50 cap",
    color: "text-pink-400",
  },
  {
    levelLabel: "Level 5 (Elite)",
    visitsRange: "41–50 visits",
    percent: "15%",
    cap: "$15.00 cap",
    color: "text-yellow-400",
  },
  {
    levelLabel: "Level 6 (Legend)",
    visitsRange: "51–60 visits",
    percent: "17.5%",
    cap: "$17.50 cap",
    color: "text-orange-400",
  },
  {
    levelLabel: "Level 7 (Ultimate)",
    visitsRange: "61+ visits",
    percent: "20%",
    cap: "$20.00 cap",
    color: "text-red-400",
  },
];

export default function ProfilePage() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorSearch, setCalculatorSearch] = useState("");
  const [receiptView, setReceiptView] = useState<"all" | "by-business">("all");
  const [selectedUploadBusiness, setSelectedUploadBusiness] = useState("");
  const [uploadSearch, setUploadSearch] = useState("");
    const [receiptAmount, setReceiptAmount] = useState("");

  const [favoriteIds, setFavoriteIds] = useState<number[]>(
    businesses.map((b) => b.id)
  );
const toggleFavorite = (id: number) => {
  setFavoriteIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );
};

const filteredUploadBusinesses = businesses.filter((b) =>
  `${b.name} ${b.category ?? ""}`
    .toLowerCase()
    .includes(uploadSearch.toLowerCase())
);


  // Open calculator focused on one business (fills search field)
  const openCalculatorForBusiness = (businessName: string) => {
    setCalculatorSearch(businessName);
    setShowCalculator(true);
  };

  const closeCalculator = () => {
    setShowCalculator(false);
    setCalculatorSearch("");
  };

  const closeUpload = () => {
    setShowUploadModal(false);
    setSelectedUploadBusiness("");
    setReceiptAmount("");
  };

  const filteredCalculatorBusinesses = businesses.filter((b) =>
    b.name.toLowerCase().includes(calculatorSearch.toLowerCase())
  );

  // Aggregate receipts By Business for "By Business" view
  const receiptsByBusiness = Array.from(
    receiptHistory.reduce(
      (map, r) => {
        const existing = map.get(r.business) ?? {
          business: r.business,
          visitCount: 0,
          totalAmount: 0,
          totalPayout: 0,
          pendingCount: 0,
        };
        existing.visitCount += 1;
        existing.totalAmount += r.amount;
        existing.totalPayout += r.payout;
        if (r.status === "pending") existing.pendingCount += 1;
        map.set(r.business, existing);
        return map;
      },
      new Map<
        string,
        {
          business: string;
          visitCount: number;
          totalAmount: number;
          totalPayout: number;
          pendingCount: number;
        }
      >()
    ).values()
  );

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white flex justify-center">
      <div className="w-full max-w-6xl px-4 pt-4 pb-16 space-y-6 relative">
        {/* HEADER BAR */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-black/60 border border-white/25 flex items-center justify-center shadow-[0_0_24px_rgba(56,189,248,0.8)] overflow-hidden">
              <img
                src="/lg-logo.png"
                alt="Let&apos;sGo logo"
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

          <div className="flex items-center gap-2">
            <button className="text-[11px] px-3 py-1.5 rounded-full bg-white/5 border border-white/20 hover:bg-white/10 flex items-center gap-1">
              <User className="w-3 h-3" />
              Edit Profile
            </button>
            <Link
              href="/"
              className="text-[11px] px-3 py-1.5 rounded-full bg-white/5 border border-white/25 hover:bg-white/10 flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
          </div>
        </header>

        {/* PROFILE CARD */}
        <section className="rounded-3xl bg-slate-950/90 border border-white/12 shadow-[0_18px_60px_rgba(15,23,42,0.9)] px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-sky-500 to-pink-500 flex items-center justify-center text-sm font-semibold shadow-[0_0_25px_rgba(56,189,248,0.8)]">
                CO
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-semibold">{userData.name}</span>
                <span className="text-[11px] text-sky-400">
                  {userData.username} · {userData.location}
                </span>
                <span className="text-[10px] text-white/45">
                  Member since {userData.memberSince}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px]">
              <ProfileStat label="Nights out tracked" value={userData.nightsOut.toString()} />
              <ProfileStat label="Places tried" value={userData.placesVisited.toString()} />
              <ProfileStat
                label='Saved in "Would go again"'
                value={userData.savedPlaces.toString()}
              />
            </div>
          </div>
        </section>

        {/* BALANCE CARDS */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Lifetime payouts"
            accent="from-cyan-400 via-emerald-300 to-lime-300"
            border="border-cyan-300/80"
            shadow="shadow-[0_0_40px_rgba(34,211,238,0.65)]"
            amount={balanceData.lifetime}
            description="Total cash you've unlocked so far across all your nights out."
          />

          <SummaryCard
            title="This month"
            accent="from-fuchsia-400 via-pink-400 to-rose-300"
            border="border-fuchsia-300/85"
            shadow="shadow-[0_0_40px_rgba(217,70,239,0.6)]"
            amount={balanceData.thisMonth}
            description="Payouts already sent this calendar month."
          />

          <SummaryCard
            title="Pending"
            accent="from-amber-400 via-orange-400 to-red-300"
            border="border-amber-300/85"
            shadow="shadow-[0_0_40px_rgba(245,158,11,0.7)]"
            amount={balanceData.pending}
            description="In review from recent receipts."
          />

          <div className="rounded-3xl bg-slate-950 border border-emerald-300/85 shadow-[0_0_40px_rgba(16,185,129,0.7)] overflow-hidden flex flex-col">
            <div className="h-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-lime-300" />
            <div className="px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-2 flex-1">
              <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/85">
                Available to cash out
              </span>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold">
                    ${balanceData.available.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-white/60">
                    Cleared payouts ready to send to you.
                  </span>
                </div>
                <button className="px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 text-black text-[11px] font-semibold shadow-lg shadow-emerald-500/40 hover:brightness-110">
                  Cash out
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ACTION BUTTONS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-3xl p-6 text-left transition-all shadow-lg shadow-cyan-500/30 border border-cyan-400/30"
          >
            <Upload className="w-8 h-8 mb-3 text-cyan-200" />
            <div className="text-xl font-bold mb-1">Upload receipt</div>
            <div className="text-sm text-cyan-100">
              Submit your night out & earn rewards.
            </div>
          </button>

          <button
            onClick={() => setShowCalculator(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-3xl p-6 text-left transition-all shadow-lg shadow-purple-500/30 border border-purple-400/30"
          >
            <Calculator className="w-8 h-8 mb-3 text-purple-100" />
            <div className="text-xl font-bold mb-1">Payout calculator</div>
            <div className="text-sm text-pink-100">
              See what you&apos;ll earn at each level.
            </div>
          </button>
        </section>

        {/* HOW REWARDS WORK */}
        <section className="rounded-3xl bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-400/30 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start gap-3">
            <Info className="w-6 h-6 text-blue-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-lg sm:text-xl font-bold mb-2">
                How rewards work
              </h3>
              <div className="text-[11px] sm:text-sm text-gray-200 space-y-2">
                <p>
                  Your level at each business is based on how many verified
                  visits you&apos;ve made{" "}
                  <strong>this calendar year</strong>. The more you return, the
                  higher your payout per visit.
                </p>
                <p className="text-cyan-300 font-semibold">
                  Each business has its own payout ladder and % payback.
                </p>
                <p>
                  Levels and %s reset on a year-based window per business.
                  Frequent tiny purchases don&apos;t unlock unlimited payouts —
                  your reward is capped per visit based on your current level at
                  that business.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* YOUR PAYOUT LEVELS BY PLACE */}
        <section className="rounded-3xl bg-slate-950/90 border border-white/12 shadow-[0_18px_50px_rgba(15,23,42,0.9)] px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                Your payout levels by place
              </span>
              <span className="text-[11px] text-white/55">
                Each business has its own visit tiers, % payback and caps.
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {businesses.map((b) => {
              const progressPercent = Math.min(b.visitsThisYear / 10, 1) * 100;
              return (
                <div
                  key={b.id}
                  className="rounded-2xl bg-slate-950 border border-white/12 grid gap-3 sm:grid-cols-[minmax(0,2.1fr)_minmax(0,1.5fr)] overflow-hidden"
                >
                  {/* Left side: place + progress */}
                  <div className="px-4 py-3 border-b border-white/10 sm:border-b-0 sm:border-r border-white/10">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/55 mb-1">
                      {b.category}
                    </p>
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="text-[10px] text-white/60 mt-1">
                      <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 text-[10px] font-semibold mr-1">
                        Level {b.level}
                      </span>
                      {b.visitsThisYear} visits this year
                    </p>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-white/55 mb-1">
                        <span>Progress to next tier</span>
                        <span className="text-sky-300 font-semibold">
                          Next level: ${b.nextLevelCap.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-lime-300 shadow-[0_0_12px_rgba(56,189,248,0.7)]"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right side: payout summary + buttons */}
                  <div className="px-4 py-3 bg-gradient-to-br from-slate-900 via-slate-950 to-black flex flex-col justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-sky-200/80 mb-1">
                        This visit at this place
                      </p>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-semibold text-emerald-300">
                            ${b.thisVisitCap.toFixed(2)}
                          </span>
                          <span className="text-[11px] text-white/60">
                            max payout cap for a single receipt.
                          </span>
                        </div>
                        <p className="text-[10px] text-white/60 mt-1">
                          Visit total × % back is paid out, but never more than{" "}
                          {b.thisVisitCap.toFixed(2)} for one visit at your
                          current level.
                        </p>
                      </div>
                      <p className="text-[11px] text-emerald-300 font-semibold mt-1">
                        Next level: {b.nextLevelCap.toFixed(2)} cap per visit.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[10px] mt-2">
                      <button className="px-3 py-1.5 rounded-full bg-white/5 border border-white/20 hover:bg-white/10">
                        View visit history (placeholder)
                      </button>
                      <button
                        type="button"
                        onClick={() => openCalculatorForBusiness(b.name)}
                        className="px-3 py-1.5 rounded-full bg-transparent border border-sky-400/70 text-sky-200 hover:bg-sky-500/10"
                      >
                        View payout ladder
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* RECEIPT HISTORY */}
        <section className="rounded-3xl bg-slate-950/95 border border-white/12 shadow-[0_18px_40px_rgba(15,23,42,0.9)] px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg sm:text-xl font-semibold">Receipt history</h2>

            {/* Mobile-friendly segmented control */}
            <div className="inline-flex rounded-full bg-slate-900/80 border border-slate-700 p-1 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setReceiptView("all")}
                className={`flex-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition ${
                  receiptView === "all"
                    ? "bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/40"
                    : "text-slate-200"
                }`}
              >
                All Receipts
              </button>
              <button
                type="button"
                onClick={() => setReceiptView("by-business")}
                className={`flex-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition ${
                  receiptView === "by-business"
                    ? "bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/40"
                    : "text-slate-200"
                }`}
              >
                By Business
              </button>
            </div>
          </div>

          {receiptView === "all" ? (
            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/80 border-b border-slate-800 text-xs text-slate-300">
                    <tr>
                      <th className="text-left px-4 py-2">Date</th>
                      <th className="text-left px-4 py-2">Business</th>
                      <th className="text-right px-4 py-2">Receipt total</th>
                      <th className="text-right px-4 py-2">Payout</th>
                      <th className="text-center px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs sm:text-sm">
                    {receiptHistory.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-slate-800/70 last:border-0 hover:bg-slate-900/60 transition"
                      >
                        <td className="px-4 py-2 whitespace-nowrap">{r.date}</td>
                        <td className="px-4 py-2 whitespace-nowrap font-semibold">
                          {r.business}
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          ${r.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap text-emerald-300 font-semibold">
                          ${r.payout.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-[11px] font-semibold ${
                              r.status === "approved"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {receiptsByBusiness.map((b) => (
                <div
                  key={b.business}
                  className="rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{b.business}</p>
                      <p className="text-[11px] text-slate-400">
                        {b.visitCount} receipts • $
                        {b.totalAmount.toFixed(2)} spent
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Total payout</p>
                      <p className="text-sm font-semibold text-emerald-300">
                        ${b.totalPayout.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {b.pendingCount > 0 && (
                    <p className="text-[11px] text-amber-300">
                      {b.pendingCount} receipt
                      {b.pendingCount > 1 ? "s are" : " is"} still pending
                      review.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

{/* WOULD DO AGAIN */}
<section className="rounded-3xl bg-slate-950/95 border border-white/15 shadow-[0_14px_40px_rgba(15,23,42,0.85)] px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-3">
  <div className="flex items-center gap-2">
    <Heart className="w-5 h-5 text-pink-400" />
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">
        Your &quot;Would go again&quot; list
      </span>
      <span className="text-[11px] text-white/55">
        Saved from Swipe, Date night and Group picks.
      </span>
    </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 text-[11px]">
    {businesses
      .filter((b) => favoriteIds.includes(b.id))
      .map((b) => (
        <div
          key={b.id}
          className="bg-gradient-to-br from-pink-900/40 to-purple-900/40 rounded-2xl p-4 border border-pink-400/30 flex flex-col gap-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{b.name}</p>
              <p className="text-[10px] text-slate-300">{b.category}</p>
            </div>

            <button
              type="button"
              onClick={() => toggleFavorite(b.id)}
              className="p-1 rounded-full hover:bg-pink-500/10"
              aria-label="Toggle favorite"
            >
              <Heart
                className={`w-4 h-4 ${
                  favoriteIds.includes(b.id)
                    ? "text-pink-400 fill-pink-400"
                    : "text-pink-400"
                }`}
              />
            </button>
          </div>

          <p className="text-[10px] text-slate-400">
            Saved from Date night · Last visit: 3 days ago
          </p>
        </div>
      ))}

    {favoriteIds.length === 0 && (
      <p className="text-[11px] text-slate-400">
        You don&apos;t have any saved places yet. Swipe or save favorites and
        they&apos;ll show up here.
      </p>
    )}
  </div>
</section>

        {/* UPLOAD RECEIPT MODAL */}
{showUploadModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
    <div className="relative w-full max-w-lg rounded-2xl bg-slate-950 border border-cyan-500/40 shadow-[0_24px_80px_rgba(8,47,73,0.9)]">
      {/* header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <h2 className="text-lg font-semibold text-white">Upload receipt</h2>
        <button
          type="button"
          onClick={() => setShowUploadModal(false)}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* body */}
      <div className="space-y-4 px-5 py-5 text-sm">
        {/* Business search + select */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Select business
          </label>

          {/* 🔍 Search input */}
          <input
            type="text"
            value={uploadSearch}
            onChange={(e) => setUploadSearch(e.target.value)}
            placeholder="Start typing a name… (e.g. “Block 16”)"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />

          {/* Dropdown filtered by search */}
          <select
            value={selectedUploadBusiness}
            onChange={(e) => setSelectedUploadBusiness(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <option value="">Choose a business...</option>
            {filteredUploadBusinesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {uploadSearch && filteredUploadBusinesses.length === 0 && (
            <p className="mt-1 text-xs text-amber-300">
              No businesses match “{uploadSearch}”. Try a different name or spelling.
            </p>
          )}
        </div>

        {/* Receipt amount */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Receipt total amount
          </label>
          <input
            type="number"
            step="0.01"
            value={receiptAmount}
            onChange={(e) => setReceiptAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        {/* Upload box (still mock) */}
        <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/40 px-4 py-8 text-center text-xs text-slate-400">
          <Upload className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <p>Click to upload or drag and drop</p>
          <p className="mt-1 text-[10px] text-slate-500">PNG, JPG up to 10MB</p>
        </div>

        {/* Note */}
        <div className="rounded-lg border border-sky-500/30 bg-sky-950/40 px-4 py-3 text-[11px] text-sky-100">
          <strong>Note:</strong> You always pay the normal price in person. After
          your night out, upload a clear photo of your receipt. We&apos;ll match
          it to the business and amount, then apply the agreed % for your current
          level at that place.
        </div>

        {/* Submit button */}
        <button
          type="button"
          className="mt-2 w-full rounded-full bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/40 hover:bg-cyan-400"
        >
          Submit receipt
        </button>
      </div>
    </div>
  </div>
)}

        {/* PAYOUT CALCULATOR MODAL */}
        {showCalculator && (
          <div className="fixed inset-0 z-50 bg-black/80 flex justify-center items-start overflow-y-auto">
            <div className="w-full max-w-3xl bg-slate-950 rounded-2xl border border-purple-500/30 mt-10 mb-10 shadow-xl">
              <div className="sticky top-0 bg-slate-950 px-5 py-4 border-b border-slate-800 rounded-t-2xl flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold">
                  Payout calculator
                </h2>
                <button
                  type="button"
                  onClick={closeCalculator}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-5">
                {/* How it works + search */}
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/40 rounded-xl p-4 border border-purple-400/40 text-[11px] sm:text-sm">
                    <p className="font-semibold mb-1">How it works</p>
                    <p>
                      Each business sets its own payout structure. Your reward
                      level is based on verified visits to that specific
                      business during the current calendar year.
                    </p>
                    <p className="mt-1 text-slate-200">
                      Tiers below are an example ladder; real businesses will
                      pull their tiers from the database.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs mb-1 font-semibold">
                      Search businesses
                    </label>
                    <input
                      type="text"
                      value={calculatorSearch}
                      onChange={(e) => setCalculatorSearch(e.target.value)}
                      placeholder="Start typing a business name…"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Ladder per (filtered) business */}
                <div className="space-y-4">
                  {filteredCalculatorBusinesses.length === 0 && (
                    <p className="text-xs text-slate-400">
                      No businesses match that search yet.
                    </p>
                  )}

                  {filteredCalculatorBusinesses.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-2xl bg-slate-950/90 border border-slate-800 shadow-[0_16px_40px_rgba(15,23,42,0.9)] overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">{b.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {b.category}
                          </p>
                        </div>
                        <span className="px-2 py-1 rounded-full bg-sky-500/15 text-sky-200 text-[11px] font-semibold">
                          Current: Level {b.level}
                        </span>
                      </div>

                      <div className="px-4 py-3 space-y-2 text-[11px] sm:text-sm">
                        {SAMPLE_LADDER.map((tier) => (
                          <div
                            key={tier.levelLabel}
                            className="flex items-center justify-between bg-slate-900/70 rounded-lg px-3 py-2 border border-slate-800"
                          >
                            <div>
                              <span
                                className={`font-semibold ${tier.color} mr-1`}
                              >
                                {tier.levelLabel}
                              </span>
                              <span className="text-slate-300">
                                • {tier.visitsRange} • {tier.percent}
                              </span>
                            </div>
                            <span className="text-emerald-300 font-semibold text-xs sm:text-sm whitespace-nowrap">
                              {tier.cap}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-yellow-900/30 rounded-xl p-3 border border-yellow-400/30 text-[11px] text-yellow-100">
                  <strong>Remember:</strong> Your payout is the agreed % of your
                  receipt total, up to your current level&apos;s per-visit cap
                  at that business. Levels and percentages reset per business.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* Small helper components */

type ProfileStatProps = {
  label: string;
  value: string;
};

function ProfileStat({ label, value }: ProfileStatProps) {
  return (
    <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-white/12 flex flex-col items-center min-w-[90px]">
      <span className="text-sm font-semibold">{value}</span>
      <span className="text-[10px] text-white/55 text-center">{label}</span>
    </div>
  );
}

type SummaryCardProps = {
  title: string;
  accent: string;
  border: string;
  shadow: string;
  amount: number;
  description: string;
};

function SummaryCard({
  title,
  accent,
  border,
  shadow,
  amount,
  description,
}: SummaryCardProps) {
  return (
    <div
      className={`rounded-3xl bg-slate-950 border ${border} ${shadow} overflow-hidden`}
    >
      <div className={`h-1 bg-gradient-to-r ${accent}`} />
      <div className="px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/70">
          {title}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold">
            ${amount.toFixed(2)}
          </span>
          <span className="text-[11px] text-white/60">{description}</span>
        </div>
      </div>
    </div>
  );
}