// app/businessprofile/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type BusinessRow = {
  id: string;
  created_at: string;
  updated_at: string;

  is_active: boolean | null;

  business_name: string | null;
  public_business_name: string | null;

  type_line: string | null;
  blurb: string | null;
  vibe: string | null;

  tags: string[]; // NOT NULL in your schema
  price_level: string | null;

  business_type: string | null;
  age_restriction: string | null;

  // location/contact
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;

  website: string | null;
  business_phone: string | null;
  customer_email: string | null;

  // billing-ish
  billing_plan: string | null;
  platform_fee_bps: number | null;
  monthly_fee_cents: number | null;
  billing_notes: string | null;

  // ownership link
  contact_email: string | null; // we use this to find the business for the logged-in user

  // hours (time without time zone)
  mon_open: string | null;
  mon_close: string | null;
  tue_open: string | null;
  tue_close: string | null;
  wed_open: string | null;
  wed_close: string | null;
  thu_open: string | null;
  thu_close: string | null;
  fri_open: string | null;
  fri_close: string | null;
  sat_open: string | null;
  sat_close: string | null;
  sun_open: string | null;
  sun_close: string | null;

  // config jsonb
  config: any;
};

type MediaItem = {
  id: string;
  url: string;
  kind: "image" | "video";
  title?: string;
  is_active: boolean;
  sort: number;
};

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function toMoney(cents: number | null | undefined) {
  if (!cents && cents !== 0) return "";
  return (cents / 100).toFixed(2);
}

function fromMoneyToCents(s: string) {
  const cleaned = (s || "").replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function safeArray<T>(v: any, fallback: T[] = []) {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

function normalizeUrl(u: string) {
  const raw = (u || "").trim();
  if (!raw) return "";
  // allow https://, http://, or bare domains
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function guessKind(url: string): "image" | "video" {
  const u = url.toLowerCase();
  if (u.includes(".mp4") || u.includes(".mov") || u.includes(".webm")) return "video";
  return "image";
}

export default function BusinessProfilePage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string>("");
  const [toast, setToast] = useState<string>("");

  const [row, setRow] = useState<BusinessRow | null>(null);

  // editable fields
  const [publicName, setPublicName] = useState("");
  const [typeLine, setTypeLine] = useState("");
  const [blurb, setBlurb] = useState("");
  const [vibe, setVibe] = useState("");
  const [tagsText, setTagsText] = useState(""); // comma-separated
  const [priceLevel, setPriceLevel] = useState("");

  const [businessType, setBusinessType] = useState("");
  const [ageRestriction, setAgeRestriction] = useState("");

  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [zip, setZip] = useState("");

  const [website, setWebsite] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [billingPlan, setBillingPlan] = useState("");
  const [platformFeeBps, setPlatformFeeBps] = useState<string>("");
  const [monthlyFee, setMonthlyFee] = useState<string>("");
  const [billingNotes, setBillingNotes] = useState("");

  const [hours, setHours] = useState<Record<DayKey, { open: string; close: string }>>({
    mon: { open: "", close: "" },
    tue: { open: "", close: "" },
    wed: { open: "", close: "" },
    thu: { open: "", close: "" },
    fri: { open: "", close: "" },
    sat: { open: "", close: "" },
    sun: { open: "", close: "" },
  });

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaTitle, setNewMediaTitle] = useState("");

  const businessId = row?.id ?? null;

  useEffect(() => {
    let alive = true;

    (async () => {
      setCheckingAuth(true);
      setError("");
      setToast("");

      const { data, error } = await supabaseBrowser.auth.getUser();
      if (!alive) return;

      if (error) {
        setCheckingAuth(false);
        setSignedInEmail(null);
        return;
      }

      const email = data.user?.email ?? null;
      setSignedInEmail(email);
      setCheckingAuth(false);

      if (!email) return;

      await loadBusinessForEmail(email);
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBusinessForEmail(email: string) {
    setLoading(true);
    setError("");
    try {
      // Find the business row for this logged-in business user.
      // IMPORTANT: this assumes public.business.contact_email is set to the business owner login email.
      const { data, error } = await supabaseBrowser
        .from("business")
        .select("*")
        .eq("contact_email", email)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setRow(null);
        setError(
          "No business profile found for this login. (We look up public.business by contact_email.)"
        );
        return;
      }

      const r = data as BusinessRow;
      setRow(r);

      // hydrate form
      setPublicName(r.public_business_name ?? "");
      setTypeLine(r.type_line ?? "");
      setBlurb(r.blurb ?? "");
      setVibe(r.vibe ?? "");
      setTagsText((r.tags ?? []).join(", "));
      setPriceLevel(r.price_level ?? "");

      setBusinessType(r.business_type ?? "");
      setAgeRestriction(r.age_restriction ?? "");

      setStreet(r.street_address ?? "");
      setCity(r.city ?? "");
      setStateVal(r.state ?? "");
      setZip(r.zip ?? "");

      setWebsite(r.website ?? "");
      setBusinessPhone(r.business_phone ?? "");
      setCustomerEmail(r.customer_email ?? "");

      setBillingPlan(r.billing_plan ?? "");
      setPlatformFeeBps(r.platform_fee_bps == null ? "" : String(r.platform_fee_bps));
      setMonthlyFee(toMoney(r.monthly_fee_cents));
      setBillingNotes(r.billing_notes ?? "");

      setHours({
        mon: { open: r.mon_open ?? "", close: r.mon_close ?? "" },
        tue: { open: r.tue_open ?? "", close: r.tue_close ?? "" },
        wed: { open: r.wed_open ?? "", close: r.wed_close ?? "" },
        thu: { open: r.thu_open ?? "", close: r.thu_close ?? "" },
        fri: { open: r.fri_open ?? "", close: r.fri_close ?? "" },
        sat: { open: r.sat_open ?? "", close: r.sat_close ?? "" },
        sun: { open: r.sun_open ?? "", close: r.sun_close ?? "" },
      });

      // media is stored temporarily in config.media
      const cfg = r.config ?? {};
      const cfgMedia = safeArray<MediaItem>(cfg?.media, []);
      const normalized = cfgMedia
        .map((m) => ({
          id: String(m.id ?? crypto.randomUUID()),
          url: String(m.url ?? ""),
          kind: (m.kind === "video" ? "video" : "image") as "image" | "video",
          title: m.title ? String(m.title) : "",
          is_active: m.is_active !== false,
          sort: Number.isFinite(Number(m.sort)) ? Number(m.sort) : 0,
        }))
        .sort((a, b) => a.sort - b.sort);

      setMedia(normalized);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to load business profile.");
    } finally {
      setLoading(false);
    }
  }

  const tags = useMemo(() => {
    return tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 30);
  }, [tagsText]);

  function addMedia() {
    setToast("");
    const url = normalizeUrl(newMediaUrl);
    if (!url) {
      setToast("Enter a media URL first.");
      return;
    }
    const kind = guessKind(url);
    const nextSort = media.length ? Math.max(...media.map((m) => m.sort)) + 1 : 0;
    const item: MediaItem = {
      id: crypto.randomUUID(),
      url,
      kind,
      title: newMediaTitle.trim() || undefined,
      is_active: true,
      sort: nextSort,
    };
    setMedia((prev) => [...prev, item].sort((a, b) => a.sort - b.sort));
    setNewMediaUrl("");
    setNewMediaTitle("");
  }

  function removeMedia(id: string) {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }

  function moveMedia(id: string, dir: "up" | "down") {
    setMedia((prev) => {
      const list = [...prev].sort((a, b) => a.sort - b.sort);
      const idx = list.findIndex((m) => m.id === id);
      if (idx < 0) return prev;

      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= list.length) return prev;

      const a = list[idx];
      const b = list[swapWith];

      const tmp = a.sort;
      a.sort = b.sort;
      b.sort = tmp;

      return [...list].sort((x, y) => x.sort - y.sort);
    });
  }

  async function saveAll() {
    if (!businessId) return;
    setSaving(true);
    setError("");
    setToast("");

    try {
      const cents = fromMoneyToCents(monthlyFee);
      const platformBps = platformFeeBps.trim() ? Number(platformFeeBps.trim()) : null;

      const updatedConfig = {
        ...(row?.config ?? {}),
        media: media
          .map((m, idx) => ({
            ...m,
            sort: idx, // rewrite sort sequentially
          }))
          .sort((a, b) => a.sort - b.sort),
      };

      const payload: Partial<BusinessRow> = {
        public_business_name: publicName.trim() || null,
        type_line: typeLine.trim() || null,
        blurb: blurb.trim() || null,
        vibe: vibe.trim() || null,
        tags: tags,
        price_level: priceLevel.trim() || null,

        business_type: businessType.trim() || null,
        age_restriction: ageRestriction.trim() || null,

        street_address: street.trim() || null,
        city: city.trim() || null,
        state: stateVal.trim() || null,
        zip: zip.trim() || null,

        website: website.trim() || null,
        business_phone: businessPhone.trim() || null,
        customer_email: customerEmail.trim() || null,

        billing_plan: billingPlan.trim() || null,
        platform_fee_bps: Number.isFinite(platformBps as any) ? (platformBps as any) : null,
        monthly_fee_cents: cents,
        billing_notes: billingNotes.trim() || null,

        mon_open: hours.mon.open || null,
        mon_close: hours.mon.close || null,
        tue_open: hours.tue.open || null,
        tue_close: hours.tue.close || null,
        wed_open: hours.wed.open || null,
        wed_close: hours.wed.close || null,
        thu_open: hours.thu.open || null,
        thu_close: hours.thu.close || null,
        fri_open: hours.fri.open || null,
        fri_close: hours.fri.close || null,
        sat_open: hours.sat.open || null,
        sat_close: hours.sat.close || null,
        sun_open: hours.sun.open || null,
        sun_close: hours.sun.close || null,

        config: updatedConfig,
      };

      const { error } = await supabaseBrowser.from("business").update(payload).eq("id", businessId);
      if (error) throw error;

      setToast("Saved!");
      // refresh row
      if (signedInEmail) await loadBusinessForEmail(signedInEmail);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabaseBrowser.auth.signOut({ scope: "local" }).catch(() => {});
    window.location.href = "/";
  }

  if (checkingAuth) {
    return (
      <main className="min-h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/50 p-6 text-center">
          <div className="text-[12px] text-white/70">Loading…</div>
          <div className="text-[11px] text-white/45 mt-1">Checking your session.</div>
        </div>
      </main>
    );
  }

  if (!signedInEmail) {
    return (
      <main className="min-h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/50 p-6">
          <div className="text-lg font-semibold mb-2">Please sign in</div>
          <div className="text-white/70 text-sm mb-4">
            You must be signed in as a business user to view your Business Profile.
          </div>
          <Link
            href="/admin/login"
            className="inline-flex items-center justify-center w-full px-4 py-2 rounded-xl bg-sky-500 text-black font-semibold hover:bg-sky-400"
          >
            Go to Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white">
      {/* glow */}
      <div className="pointer-events-none fixed inset-0 opacity-60 mix-blend-screen">
        <div className="absolute -top-20 -left-16 w-64 h-64 bg-pink-500/30 blur-3xl rounded-full" />
        <div className="absolute -top-10 right-0 w-64 h-64 bg-sky-500/30 blur-3xl rounded-full" />
        <div className="absolute bottom-[-4rem] left-12 w-72 h-72 bg-purple-500/30 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">LetsGo</div>
            <div className="text-lg font-semibold">Business Profile</div>
            <div className="text-[12px] text-white/55 mt-1">Signed in as {signedInEmail}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/swipe" className="px-3 py-2 rounded-xl bg-white/5 border border-white/15 hover:bg-white/10 text-[12px]">
              View Swipe
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/15 hover:bg-white/10 text-[12px]"
            >
              Sign out
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-red-200 mb-4">
            {error}
          </div>
        ) : null}

        {toast ? (
          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-emerald-100 mb-4 text-[12px]">
            {toast}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/35 p-6 text-white/70">
            Loading business profile…
          </div>
        ) : !row ? (
          <div className="rounded-2xl border border-white/10 bg-black/35 p-6 text-white/70">
            No business found for this login.
            <div className="text-[12px] text-white/50 mt-2">
              (We match <span className="font-semibold">public.business.contact_email</span> to your login email.)
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {/* Basic */}
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <div className="text-[11px] uppercase tracking-[0.25em] text-white/55 mb-3">Basic</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Public Business Name" value={publicName} onChange={setPublicName} placeholder="Shown in the app" />
                <Field label="Type line" value={typeLine} onChange={setTypeLine} placeholder="Restaurant • Sushi • Drinks" />

                <TextArea label="Blurb" value={blurb} onChange={setBlurb} placeholder="Short description shown in details" />
                <Field label="Vibe" value={vibe} onChange={setVibe} placeholder="Sushi / Japanese" />

                <Field label="Tags (comma separated)" value={tagsText} onChange={setTagsText} placeholder="kid-friendly, happy hour, patio" />
                <Field label="Price level" value={priceLevel} onChange={setPriceLevel} placeholder="$ (<$15), $$ ($15-$30), $$$ ($30-$60), $$$$ ($60+)" />

                <Field label="Business type" value={businessType} onChange={setBusinessType} placeholder="restaurant_bar / activity / ..." />
                <Field label="Age restriction" value={ageRestriction} onChange={setAgeRestriction} placeholder="all / 18 / 21" />
              </div>
            </div>

            {/* Location + Contact */}
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <div className="text-[11px] uppercase tracking-[0.25em] text-white/55 mb-3">Location & Contact</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Street address" value={street} onChange={setStreet} placeholder="123 Main St" />
                <Field label="City" value={city} onChange={setCity} placeholder="Omaha" />

                <Field label="State" value={stateVal} onChange={setStateVal} placeholder="NE" />
                <Field label="ZIP" value={zip} onChange={setZip} placeholder="68102" />

                <Field label="Business phone" value={businessPhone} onChange={setBusinessPhone} placeholder="(402) 555-1234" />
                <Field label="Customer email" value={customerEmail} onChange={setCustomerEmail} placeholder="info@business.com" />

                <Field label="Website" value={website} onChange={setWebsite} placeholder="https://yourbusiness.com" />
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Meta</div>
                  <div className="text-[12px] text-white/70 mt-2 break-all">
                    Business ID: <span className="text-white/90 font-semibold">{row.id}</span>
                  </div>
                  <div className="text-[12px] text-white/60 mt-1">
                    Active: <span className="text-white/85 font-semibold">{row.is_active ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hours */}
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-white/55">Hours</div>
                <div className="text-[11px] text-white/45">
                  No “open before close” rule — supports late-night schedules.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DAYS.map((d) => (
                  <div key={d.key} className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="text-[12px] font-semibold text-white/85 mb-2">{d.label}</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={hours[d.key].open}
                        onChange={(e) =>
                          setHours((p) => ({ ...p, [d.key]: { ...p[d.key], open: e.target.value } }))
                        }
                        className="flex-1 rounded-lg bg-black/50 border border-white/15 px-2 py-2 text-[12px] outline-none focus:border-sky-400/60"
                      />
                      <span className="text-white/40 text-[12px]">to</span>
                      <input
                        type="time"
                        value={hours[d.key].close}
                        onChange={(e) =>
                          setHours((p) => ({ ...p, [d.key]: { ...p[d.key], close: e.target.value } }))
                        }
                        className="flex-1 rounded-lg bg-black/50 border border-white/15 px-2 py-2 text-[12px] outline-none focus:border-sky-400/60"
                      />
                    </div>
                    <div className="text-[10px] text-white/40 mt-2">
                      Leave blank for “—”.
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Media */}
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <div className="text-[11px] uppercase tracking-[0.25em] text-white/55 mb-3">Media</div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-3 mb-3">
                <div className="text-[12px] text-white/70">
                  For now, media is stored in <span className="font-semibold">public.business.config.media</span> as URLs.
                  Later we’ll wire this to Supabase Storage + a proper <span className="font-semibold">business_media</span> table.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="md:col-span-2">
                  <Field label="New media URL" value={newMediaUrl} onChange={setNewMediaUrl} placeholder="https://..." />
                </div>
                <div className="md:col-span-1">
                  <Field label="Optional title" value={newMediaTitle} onChange={setNewMediaTitle} placeholder="Hero photo, promo video..." />
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={addMedia}
                  className="px-4 py-2 rounded-xl bg-sky-500 text-black font-semibold hover:bg-sky-400 text-[12px]"
                >
                  Add media
                </button>
              </div>

              {media.length === 0 ? (
                <div className="text-[12px] text-white/55">No media yet.</div>
              ) : (
                <div className="space-y-3">
                  {media
                    .slice()
                    .sort((a, b) => a.sort - b.sort)
                    .map((m, idx) => (
                      <div key={m.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold text-white/85">
                              {idx === 0 ? "Slide 0 (Hero)" : `Slide ${idx}`}
                              <span className="ml-2 text-[11px] text-white/50">({m.kind})</span>
                            </div>
                            {m.title ? <div className="text-[12px] text-white/70 mt-1">{m.title}</div> : null}
                            <div className="text-[11px] text-white/50 break-all mt-1">{m.url}</div>
                          </div>

                          <div className="flex flex-col gap-2 items-end">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => moveMedia(m.id, "up")}
                                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-[11px]"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveMedia(m.id, "down")}
                                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-[11px]"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => removeMedia(m.id)}
                                className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-300/25 hover:bg-red-500/20 text-[11px] text-red-200"
                              >
                                Remove
                              </button>
                            </div>
                            <label className="flex items-center gap-2 text-[11px] text-white/60 select-none">
                              <input
                                type="checkbox"
                                checked={m.is_active}
                                onChange={(e) =>
                                  setMedia((prev) =>
                                    prev.map((x) => (x.id === m.id ? { ...x, is_active: e.target.checked } : x))
                                  )
                                }
                              />
                              Active
                            </label>
                          </div>
                        </div>

                        <div className="mt-3">
                          {m.kind === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.url}
                              alt={m.title || "Business media"}
                              className="w-full max-w-xl rounded-xl border border-white/10"
                            />
                          ) : (
                            <video
                              src={m.url}
                              controls
                              className="w-full max-w-xl rounded-xl border border-white/10"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Billing / Plan */}
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <div className="text-[11px] uppercase tracking-[0.25em] text-white/55 mb-3">Plan & Billing (internal)</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Billing plan" value={billingPlan} onChange={setBillingPlan} placeholder="basic / premium / ..." />
                <Field label="Platform fee (BPS)" value={platformFeeBps} onChange={setPlatformFeeBps} placeholder="e.g. 1000 = 10.00%" />

                <Field label="Monthly fee ($)" value={monthlyFee} onChange={setMonthlyFee} placeholder="e.g. 100.00" />
                <TextArea label="Billing notes" value={billingNotes} onChange={setBillingNotes} placeholder="Internal notes..." />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pb-10">
              <button
                type="button"
                onClick={saveAll}
                disabled={saving}
                className="px-5 py-3 rounded-2xl bg-sky-500 text-black font-semibold hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40 mb-2">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-black/50 border border-white/15 px-3 py-2 text-[13px] outline-none focus:border-sky-400/60"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40 mb-2">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-lg bg-black/50 border border-white/15 px-3 py-2 text-[13px] outline-none focus:border-sky-400/60 resize-none"
      />
    </div>
  );
}
