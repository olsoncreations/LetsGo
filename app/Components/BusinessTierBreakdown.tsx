"use client";

import { useEffect, useState } from "react";

type Tier = {
  tier_index: number;
  min_visits: number;
  max_visits: number | null;
  percent_bps: number;
  label: string | null;
};

type BusinessOverview = {
  business: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    category_main: string | null;
    address_line1: string | null;
    address_line2: string | null;
    postal_code: string | null;
  };
  windowDays: number;
  visitCountThisWindow: number;
  currentTier: Tier | null;
  nextTier: Tier | null;
  tiers: Tier[];
  progressToNextPercent: number;
};

type Props = {
  businessId: string;
};

export default function BusinessTierBreakdown({ businessId }: Props) {
  const [data, setData] = useState<BusinessOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/businesses/${businessId}/overview`
        );
        if (!res.ok) {
          throw new Error("Failed to load business overview");
        }
        const json = (await res.json()) as BusinessOverview;
        if (!cancelled) {
          setData(json);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setError(
            err?.message || "Failed to load business overview"
          );
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (!businessId) return null;

  if (loading && !data) {
    return (
      <p className="text-xs text-white/60 mt-2">
        Loading payout ladder…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-red-400 mt-2">
        {error}
      </p>
    );
  }

  if (!data) return null;

  const { business, visitCountThisWindow, currentTier, nextTier, progressToNextPercent, windowDays } =
    data;

  const thisPct =
    currentTier?.percent_bps != null
      ? currentTier.percent_bps / 100
      : null;
  const nextPct =
    nextTier?.percent_bps != null
      ? nextTier.percent_bps / 100
      : thisPct;

  const tierLabel =
    currentTier?.label ??
    (currentTier
      ? `Level ${currentTier.tier_index}`
      : "Not on the ladder yet");

  const visitsRange =
    nextTier?.min_visits != null
      ? `${nextTier.min_visits}${
          nextTier.max_visits
            ? `–${nextTier.max_visits}`
            : "+"
        } visits`
      : "";

  return (
    <section className="mt-3 rounded-3xl bg-slate-950/90 border border-white/12 shadow-[0_18px_50px_rgba(15,23,42,0.9)] px-4 py-4 sm:px-5 sm:py-4 flex flex-col gap-3">
      {/* Header row – matches your older aesthetic */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">
            Your payout level at this place
          </span>
          <span className="text-[11px] text-white/55">
            {business.category_main
              ? business.category_main
              : "Place"}{" "}
            · {business.name}
          </span>
          <span className="text-[10px] text-white/45">
            {business.city && business.state
              ? `${business.city}, ${business.state}`
              : ""}
          </span>
        </div>

        <div className="text-right text-[10px] text-white/60">
          <p>
            {visitCountThisWindow} verified visit
            {visitCountThisWindow === 1 ? "" : "s"} in the
            last {windowDays} days
          </p>
          {tierLabel && (
            <p className="text-emerald-300 font-semibold mt-0.5">
              {tierLabel}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar & visits */}
      <div className="mt-1">
        <div className="flex items-center justify-between text-[10px] text-white/55 mb-1">
          <span>Progress toward next tier</span>
          {nextTier ? (
            <span>
              Next tier at level {nextTier.tier_index}
              {visitsRange ? ` · ${visitsRange}` : ""}
            </span>
          ) : (
            <span>Max tier reached</span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 to-lime-300"
            style={{ width: `${progressToNextPercent}%` }}
          />
        </div>
      </div>

      {/* Right-hand "Next visit at this place" info */}
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2.1fr)_minmax(0,1.6fr)]">
        {/* current level description */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-sky-200/80 mb-1">
            This visit at this place
          </p>
          {thisPct != null ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-semibold">
                  {thisPct}%
                </span>
                <span className="text-[11px] text-white/60">
                  back on your receipt at your current level.
                </span>
              </div>
              <p className="text-[10px] text-white/60 mt-1">
                Visit total × {thisPct}% is paid out, up to the
                agreed per-visit cap. Exact caps can vary by
                business.
              </p>
            </>
          ) : (
            <p className="text-[11px] text-white/70">
              You haven&apos;t unlocked the first tier here yet.
              Keep visiting this place to start earning % back.
            </p>
          )}
        </div>

        {/* next level teaser */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-black rounded-2xl border border-white/12 px-3 py-3 flex flex-col justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-200/80 mb-1">
              Next level if you keep going
            </p>
            {nextPct != null ? (
              <>
                <p className="text-[11px] text-emerald-300 font-semibold">
                  Up to {nextPct}% back at the next tier.
                </p>
                <p className="text-[10px] text-white/60 mt-1">
                  Hit the next visit band and your % back at this
                  place increases automatically. Your level here is
                  totally separate from other places.
                </p>
              </>
            ) : (
              <p className="text-[10px] text-white/60">
                You&apos;re already at the top tier at this place.
                Nice work.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Optional: show raw ladder rows in a subtle table */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 px-3 py-2">
        <p className="text-[9px] uppercase tracking-[0.2em] text-white/55 mb-1">
          Full payout ladder (this place)
        </p>
        <div className="grid grid-cols-[auto,1fr,auto] gap-x-3 gap-y-1 text-[9px]">
          {data.tiers.map((tier) => (
            <div key={tier.tier_index} className="contents">
              <span className="font-semibold">
                Lv {tier.tier_index}
              </span>
              <span className="text-white/80">
                {tier.label ??
                  `${tier.min_visits}${
                    tier.max_visits
                      ? `–${tier.max_visits}`
                      : "+"
                  } visits`}
              </span>
              <span className="text-right text-emerald-300 font-semibold">
                {tier.percent_bps / 100}% back
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}