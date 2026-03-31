// components/business/v2/tabs/Events.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { BusinessTabProps } from "@/components/business/v2/BusinessProfileV2";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { fetchAvailableTags } from "@/lib/availableTags";
import { useIsMobile } from "@/lib/useIsMobile";
import {
  Calendar,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  List,
  Tag,
  Users,
  X,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

type EventCategory =
  | "Music"
  | "Games"
  | "Food & Drink"
  | "Workshop"
  | "Special Event"
  | "Sports"
  | "Arts & Crafts"
  | "Other";

type EventResponses = { yes: number; maybe: number; no: number };

type EventRow = {
  id: string;
  title: string;
  description: string;
  category: EventCategory | string;
  startAt: string; // ISO
  endAt: string; // ISO
  dateLabel: string; // pretty
  timeLabel: string; // pretty
  price: string;
  priceLevel?: string;
  eventSize?: string;
  tags: string[];
  capacity?: number;
  viewCount: number;
  responses: EventResponses;
  imageUrl: string;
  imageBanned: boolean;
  imageBucket: string | null;
  imagePath: string | null;
  bookingUrl?: string;
  isCancelled: boolean;
  isPublished: boolean;
};

type PhotoOption = {
  id: string;
  bucket: string;
  path: string;
  url: string;
  caption: string;
  sortOrder: number;
};

type ModalMode = "create" | "edit" | "duplicate";
type ViewMode = "list" | "calendar";

const BUCKET_MEDIA = "business-media";

const PRICE_LEVELS = ["$", "$$", "$$$", "$$$$"] as const;
const PRICE_LEVEL_LABELS: Record<string, string> = { "$": "$ (Under $15/person)", "$$": "$$ ($15–$30/person)", "$$$": "$$$ ($30–$60/person)", "$$$$": "$$$$ ($60+/person)" };

const EVENT_SIZES = [
  { value: "intimate", label: "Intimate (< 25)" },
  { value: "small", label: "Small (25–75)" },
  { value: "medium", label: "Medium (75–200)" },
  { value: "large", label: "Large (200–500)" },
  { value: "massive", label: "Massive (500+)" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Music: "#a855f7",
  Games: "#f97316",
  "Food & Drink": "#14b8a6",
  Workshop: "#06b6d4",
  "Special Event": "#f59e0b",
  Sports: "#10b981",
  "Arts & Crafts": "#ec4899",
  Other: "#6b7280",
};

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] || "#6b7280";
}

// Moved outside the component so React keeps a stable reference
// (prevents unmount/remount on every state change, which resets scroll position)
function ModalOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "2rem" }}>
      {children}
    </div>
  );
}

// Extract HH:MM from an ISO timestamp for <input type="time">
function isoToTimeValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "19:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Events({ businessId, isPremium }: BusinessTabProps) {
  const isMobile = useIsMobile();
  const colors = useMemo(
    () => ({
      primary: "#14b8a6",
      secondary: "#f97316",
      accent: "#06b6d4",
      success: "#10b981",
      warning: "#f59e0b",
      danger: "#ef4444",
      purple: "#a855f7",
    }),
    []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [photos, setPhotos] = useState<PhotoOption[]>([]);
  const [payoutRange, setPayoutRange] = useState("");

  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showDuplicateEventModal, setShowDuplicateEventModal] = useState(false);

  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  // View toggle (List vs Calendar)
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // New form state for controlled fields
  const [formPriceLevel, setFormPriceLevel] = useState("$$");
  const [formEventSize, setFormEventSize] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [availableTagList, setAvailableTagList] = useState<string[]>([]);

  // Uncontrolled refs (keeps typing stable)
  const titleRef = useRef<HTMLInputElement | null>(null);
  const categoryRef = useRef<HTMLSelectElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const startTimeRef = useRef<HTMLInputElement | null>(null);
  const endTimeRef = useRef<HTMLInputElement | null>(null);
  const priceRef = useRef<HTMLInputElement | null>(null);
  const capacityRef = useRef<HTMLInputElement | null>(null);
  const bookingUrlRef = useRef<HTMLInputElement | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);

  // Tag suggestions filtered by input
  const tagSuggestions = useMemo(() => {
    const q = tagInput.toLowerCase().trim();
    if (!q) return [];
    const formTagsLower = formTags.map(t => t.toLowerCase());
    return availableTagList.filter(
      (t) => t.toLowerCase().includes(q) && !formTagsLower.includes(t.toLowerCase())
    ).slice(0, 12);
  }, [tagInput, formTags, availableTagList]);

  // Fetch available tags from DB
  useEffect(() => { fetchAvailableTags().then(setAvailableTagList); }, []);

  // Close modals on ESC
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (showCreateEventModal) setShowCreateEventModal(false);
      if (showDuplicateEventModal) setShowDuplicateEventModal(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCreateEventModal, showDuplicateEventModal]);

  const headerDisabledStyle = useMemo(
    () => ({
      opacity: isPremium ? 1 : 0.55,
      filter: isPremium ? "none" : "grayscale(1)",
      cursor: isPremium ? "pointer" : "not-allowed",
    }),
    [isPremium]
  );

  function normalizeErr(e: unknown): string {
    if (!e) return "Unknown error.";
    if (typeof e === "string") return e;
    if (e instanceof Error) return e.message || "Unknown error.";
    try {
      const anyE = e as Record<string, unknown>;
      const parts = [
        anyE?.message ? `message=${anyE.message}` : null,
        anyE?.details ? `details=${anyE.details}` : null,
        anyE?.hint ? `hint=${anyE.hint}` : null,
        anyE?.code ? `code=${anyE.code}` : null,
      ].filter(Boolean);
      return parts.length ? parts.join(" | ") : JSON.stringify(e);
    } catch {
      return "Unknown error (non-serializable).";
    }
  }

  function toDateISO(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDateLabel(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function formatTimeLabel(startIso: string, endIso: string) {
    const s = new Date(startIso);
    const e = new Date(endIso);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
    const sLabel = s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const eLabel = e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${sLabel} - ${eLabel}`;
  }

  function buildStartEnd(dateISO: string, startTime: string, endTime: string): { start_at: string; end_at: string } {
    const baseDate = dateISO ? new Date(`${dateISO}T00:00:00`) : new Date();
    const [sh, sm] = (startTime || "19:00").split(":").map(Number);
    const [eh, em] = (endTime || "22:00").split(":").map(Number);

    const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), sh, sm, 0);
    let end = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), eh, em, 0);

    // If end is before start, assume it crosses midnight
    if (end.getTime() <= start.getTime()) {
      end = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 1, eh, em, 0);
    }

    return { start_at: start.toISOString(), end_at: end.toISOString() };
  }

  async function getBestUrl(bucket: string, path: string): Promise<string> {
    const pub = supabaseBrowser.storage.from(bucket).getPublicUrl(path);
    const publicUrl = pub?.data?.publicUrl ?? "";
    if (publicUrl) return publicUrl;

    const { data, error } = await supabaseBrowser.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (error) return "";
    return data?.signedUrl ?? "";
  }

  async function loadPhotoOptions() {
    const { data, error } = await supabaseBrowser
      .from("business_media")
      .select("id,business_id,bucket,path,media_type,sort_order,caption,is_active,meta,created_at")
      .eq("business_id", businessId)
      .eq("bucket", BUCKET_MEDIA)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const options: PhotoOption[] = [];

    for (const r of rows) {
      const mediaType = String(r.media_type ?? "").toLowerCase();
      const isPhoto = mediaType.includes("photo") || mediaType.includes("image") || mediaType === "img";
      if (!isPhoto) continue;

      const meta = (r.meta || {}) as Record<string, unknown>;
      if (meta.admin_status === "banned") continue;

      const bucket = String(r.bucket ?? BUCKET_MEDIA);
      const path = String(r.path ?? "");
      if (!path) continue;

      const sortOrder = Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 9999;
      const caption = String(r.caption ?? "(photo)");
      const url = await getBestUrl(bucket, path);

      options.push({ id: String(r.id), bucket, path, url, caption, sortOrder });
    }

    options.sort((a, b) => a.sortOrder - b.sortOrder);
    setPhotos(options);
  }

  async function loadEvents() {
    const { data, error } = await supabaseBrowser
      .from("business_events")
      .select("*")
      .eq("business_id", businessId);

    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const eventIds = rows.map((r) => String(r.id)).filter(Boolean);

    const [viewsRes, rsvpsRes, bannedMediaRes] = await Promise.all([
      eventIds.length > 0
        ? supabaseBrowser.from("event_views").select("event_id").in("event_id", eventIds)
        : Promise.resolve({ data: [] as { event_id: string }[], error: null }),
      eventIds.length > 0
        ? supabaseBrowser.from("event_rsvps").select("event_id, response").in("event_id", eventIds)
        : Promise.resolve({ data: [] as { event_id: string; response: string }[], error: null }),
      supabaseBrowser
        .from("business_media")
        .select("path, meta")
        .eq("business_id", businessId)
        .eq("is_active", true),
    ]);

    const bannedPaths = new Set<string>();
    for (const row of bannedMediaRes.data ?? []) {
      const r = row as Record<string, unknown>;
      const meta = (r.meta || {}) as Record<string, unknown>;
      if (meta.admin_status === "banned") bannedPaths.add(String(r.path));
    }

    const viewCounts = new Map<string, number>();
    for (const v of viewsRes.data ?? []) {
      const eid = String(v.event_id);
      viewCounts.set(eid, (viewCounts.get(eid) || 0) + 1);
    }

    const rsvpCounts = new Map<string, { yes: number; maybe: number; no: number }>();
    for (const r of rsvpsRes.data ?? []) {
      const eid = String(r.event_id);
      if (!rsvpCounts.has(eid)) rsvpCounts.set(eid, { yes: 0, maybe: 0, no: 0 });
      const c = rsvpCounts.get(eid)!;
      if (r.response === "yes") c.yes++;
      else if (r.response === "maybe") c.maybe++;
      else if (r.response === "no") c.no++;
    }

    const mapped: EventRow[] = [];

    for (const r of rows) {
      const id = String(r.id ?? "");
      if (!id) continue;

      const startAt = String(r.start_at ?? "");
      const endAt = String(r.end_at ?? startAt);

      const imageBucket = r.image_bucket ? String(r.image_bucket) : null;
      const imagePath = r.image_path ? String(r.image_path) : null;
      const isBannedImage = imagePath ? bannedPaths.has(imagePath) : false;
      const imageUrl =
        imageBucket && imagePath && !isBannedImage ? await getBestUrl(imageBucket, imagePath) : "";

      // Parse tags — handle both text[] and null/undefined
      const rawTags = r.tags;
      const tags: string[] = Array.isArray(rawTags) ? rawTags.map(String) : [];

      mapped.push({
        id,
        title: String(r.title ?? ""),
        description: String(r.description ?? ""),
        category: String(r.category ?? "Other"),
        startAt,
        endAt,
        dateLabel: startAt ? formatDateLabel(startAt) : "",
        timeLabel: startAt && endAt ? formatTimeLabel(startAt, endAt) : "",
        price: String(r.price_text ?? r.price ?? ""),
        priceLevel: r.price_level ? String(r.price_level) : undefined,
        eventSize: r.event_size ? String(r.event_size) : undefined,
        tags,
        capacity: r.capacity === null || r.capacity === undefined ? undefined : Number(r.capacity),
        viewCount: viewCounts.get(id) || 0,
        responses: rsvpCounts.get(id) || { yes: 0, maybe: 0, no: 0 },
        imageUrl,
        imageBanned: isBannedImage,
        imageBucket,
        imagePath,
        bookingUrl: r.external_booking_url ? String(r.external_booking_url) : undefined,
        isCancelled: Boolean(r.is_cancelled ?? false),
        isPublished: Boolean(r.is_published ?? true),
      });
    }

    mapped.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    setEvents(mapped);
  }

  async function loadPayoutRange() {
    // Try business_payout_tiers first, fall back to config.payoutBps
    const { data: tiers } = await supabaseBrowser
      .from("business_payout_tiers")
      .select("percent_bps")
      .eq("business_id", businessId)
      .order("tier_index", { ascending: true });

    let bpsValues: number[] = [];

    if (tiers && tiers.length > 0) {
      bpsValues = tiers.map((t) => Number(t.percent_bps) || 0).filter((v) => v > 0);
    } else {
      // Fall back to config.payoutBps
      const { data: biz } = await supabaseBrowser
        .from("business")
        .select("config")
        .eq("id", businessId)
        .maybeSingle();
      const cfg = (biz?.config || {}) as Record<string, unknown>;
      if (Array.isArray(cfg.payoutBps)) {
        bpsValues = (cfg.payoutBps as number[]).filter((v) => v > 0);
      }
    }

    if (bpsValues.length > 0) {
      const minPct = (Math.min(...bpsValues) / 100).toFixed(0);
      const maxPct = (Math.max(...bpsValues) / 100).toFixed(0);
      setPayoutRange(minPct === maxPct ? `${minPct}%` : `${minPct}% – ${maxPct}%`);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function boot() {
      if (!businessId) return;
      setLoading(true);
      setLoadError(null);
      try {
        await Promise.all([loadPhotoOptions(), loadEvents(), loadPayoutRange()]);
      } catch (e) {
        console.error("Events load error:", e);
        if (mounted) setLoadError(normalizeErr(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => { mounted = false; };
  }, [businessId]);

  const nowMs = Date.now();
  const upcomingEvents = useMemo(
    () => events.filter((e) => !e.isCancelled && new Date(e.startAt).getTime() >= nowMs),
    [events, nowMs]
  );
  const pastEvents = useMemo(
    () => events.filter((e) => e.isCancelled || new Date(e.startAt).getTime() < nowMs),
    [events, nowMs]
  );

  const stats = useMemo(() => {
    const upcomingCount = upcomingEvents.length;
    const totalYes = events.reduce((sum, e) => sum + (e.responses?.yes ?? 0), 0);
    const totalViews = events.reduce((sum, e) => sum + e.viewCount, 0);
    const thisMonth = upcomingEvents.filter((e) => {
      const d = new Date(e.startAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const pastCount = pastEvents.length;
    return { upcomingCount, totalYes, totalViews, thisMonth, pastCount };
  }, [events, upcomingEvents, pastEvents]);

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    let startDay = firstOfMonth.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), inMonth: false });
    }
    for (let d = 1; d <= lastOfMonth.getDate(); d++) {
      days.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (days.length < 42) {
      const nextDay = days.length - startDay - lastOfMonth.getDate() + 1;
      days.push({ date: new Date(year, month + 1, nextDay), inMonth: false });
    }
    return days;
  }, [calendarMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const ev of events) {
      if (ev.isCancelled) continue;
      const d = new Date(ev.startAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const calendarMonthLabel = useMemo(() => {
    const d = new Date(calendarMonth.year, calendarMonth.month, 1);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
  }, [calendarMonth]);

  function requirePremium(action: () => void) {
    if (!isPremium) return;
    action();
  }

  function requireWritable(action: () => void) {
    action();
  }

  function openCreateEvent() {
    requireWritable(() => {
      setModalMode("create");
      setEditingEventId(null);
      setSelectedPhotoId(photos.length ? photos[0].id : null);
      setFormPriceLevel("$$");
      setFormEventSize("");
      setFormTags([]);
      setTagInput("");
      setShowCreateEventModal(true);

      setTimeout(() => {
        if (titleRef.current) titleRef.current.value = "";
        if (categoryRef.current) categoryRef.current.value = "";
        if (descriptionRef.current) descriptionRef.current.value = "";
        if (dateRef.current) dateRef.current.value = toDateISO(new Date());
        if (startTimeRef.current) startTimeRef.current.value = "19:00";
        if (endTimeRef.current) endTimeRef.current.value = "22:00";
        if (priceRef.current) priceRef.current.value = "Free";
        if (capacityRef.current) capacityRef.current.value = "";
        if (bookingUrlRef.current) bookingUrlRef.current.value = "";
        titleRef.current?.focus();
      }, 0);
    });
  }

  function openEditEvent(ev: EventRow) {
    requireWritable(() => {
      setModalMode("edit");
      setEditingEventId(ev.id);
      setSelectedPhotoId(findPhotoId(ev.imageBucket, ev.imagePath));
      setFormPriceLevel(ev.priceLevel || "$$");
      setFormEventSize(ev.eventSize || "");
      setFormTags(ev.tags || []);
      setTagInput("");
      setShowCreateEventModal(true);

      const d = new Date(ev.startAt);
      setTimeout(() => {
        if (titleRef.current) titleRef.current.value = ev.title;
        if (categoryRef.current) categoryRef.current.value = String(ev.category ?? "");
        if (descriptionRef.current) descriptionRef.current.value = ev.description;
        if (dateRef.current) dateRef.current.value = toDateISO(d);
        if (startTimeRef.current) startTimeRef.current.value = isoToTimeValue(ev.startAt);
        if (endTimeRef.current) endTimeRef.current.value = isoToTimeValue(ev.endAt);
        if (priceRef.current) priceRef.current.value = ev.price;
        if (capacityRef.current) capacityRef.current.value = ev.capacity ? String(ev.capacity) : "";
        if (bookingUrlRef.current) bookingUrlRef.current.value = ev.bookingUrl ?? "";
        titleRef.current?.focus();
      }, 0);
    });
  }

  function openDuplicateFrom(ev: EventRow) {
    requireWritable(() => {
      setModalMode("duplicate");
      setEditingEventId(null);
      setSelectedPhotoId(findPhotoId(ev.imageBucket, ev.imagePath) ?? (photos.length ? photos[0].id : null));
      setFormPriceLevel(ev.priceLevel || "$$");
      setFormEventSize(ev.eventSize || "");
      setFormTags(ev.tags || []);
      setTagInput("");
      setShowCreateEventModal(true);

      const d = new Date(ev.startAt);
      setTimeout(() => {
        if (titleRef.current) titleRef.current.value = ev.title;
        if (categoryRef.current) categoryRef.current.value = String(ev.category ?? "");
        if (descriptionRef.current) descriptionRef.current.value = ev.description;
        if (dateRef.current) dateRef.current.value = toDateISO(d);
        if (startTimeRef.current) startTimeRef.current.value = isoToTimeValue(ev.startAt);
        if (endTimeRef.current) endTimeRef.current.value = isoToTimeValue(ev.endAt);
        if (priceRef.current) priceRef.current.value = ev.price;
        if (capacityRef.current) capacityRef.current.value = ev.capacity ? String(ev.capacity) : "";
        if (bookingUrlRef.current) bookingUrlRef.current.value = ev.bookingUrl ?? "";
        titleRef.current?.focus();
      }, 0);
    });
  }

  function findPhotoId(bucket: string | null, path: string | null): string | null {
    if (!bucket || !path) return null;
    const match = photos.find((p) => p.bucket === bucket && p.path === path);
    return match ? match.id : null;
  }

  async function handleCancelEvent(ev: EventRow) {
    if (!isPremium) return;
    if (!confirm(`Cancel "${ev.title}"?`)) return;

    try {
      setSaving(true);
      const { error } = await supabaseBrowser
        .from("business_events")
        .update({ is_cancelled: true })
        .eq("id", ev.id)
        .eq("business_id", businessId);
      if (error) throw error;
      await loadEvents();
      alert("(Saved) Event cancelled.");
    } catch (e) {
      alert(normalizeErr(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEvent() {
    if (!isPremium) return;
    const title = titleRef.current?.value?.trim() ?? "";
    const category = categoryRef.current?.value?.trim() ?? "";
    const description = descriptionRef.current?.value?.trim() ?? "";
    const dateISO = dateRef.current?.value?.trim() ?? "";
    const startTime = startTimeRef.current?.value?.trim() ?? "19:00";
    const endTime = endTimeRef.current?.value?.trim() ?? "22:00";
    const price = priceRef.current?.value?.trim() ?? "";
    const capacityRaw = capacityRef.current?.value?.trim() ?? "";
    const bookingUrl = bookingUrlRef.current?.value?.trim() ?? "";

    if (!title) return alert("Event Title is required.");
    if (!category) return alert("Category is required.");
    if (!description) return alert("Description is required.");
    if (!dateISO) return alert("Event Date is required.");
    if (!startTime) return alert("Start Time is required.");
    if (!endTime) return alert("End Time is required.");
    if (!price) return alert("Price is required.");
    if (!selectedPhotoId) return alert("Please select an event image.");

    const photo = photos.find((p) => p.id === selectedPhotoId);
    if (!photo) return alert("Selected image not found.");

    const { start_at, end_at } = buildStartEnd(dateISO, startTime, endTime);
    const capacityVal = capacityRaw ? Number(capacityRaw) : null;
    if (capacityVal !== null && !Number.isFinite(capacityVal)) return alert("Capacity must be a number.");

    try {
      setSaving(true);

      const u = await supabaseBrowser.auth.getUser();
      const userId = u.data.user?.id ?? null;

      const payload: Record<string, unknown> = {
        business_id: businessId,
        title,
        description,
        category,
        start_at,
        end_at,
        price_text: price,
        price_level: formPriceLevel || null,
        event_size: formEventSize || null,
        tags: formTags,
        capacity: capacityVal,
        external_booking_url: bookingUrl || null,
        image_bucket: photo.bucket,
        image_path: photo.path,
        is_published: true,
        is_cancelled: false,
        created_by_user_id: userId,
      };

      if (modalMode === "edit" && editingEventId) {
        const { error } = await supabaseBrowser
          .from("business_events")
          .update(payload)
          .eq("id", editingEventId)
          .eq("business_id", businessId);
        if (error) throw error;

        alert("(Saved) Event updated.");
      } else {
        const { data: inserted, error } = await supabaseBrowser
          .from("business_events")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;

        // Notify followers of this business about the new event
        if (inserted?.id) {
          const sess = await supabaseBrowser.auth.getSession();
          const accessToken = sess.data.session?.access_token;
          if (accessToken) {
            fetch("/api/events/notify-followers", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ eventId: inserted.id, businessId }),
            }).catch(() => {});  // fire-and-forget
          }
        }

        alert("(Saved) Event created.");
      }

      setShowCreateEventModal(false);
      await loadEvents();
    } catch (e) {
      alert(normalizeErr(e));
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {loading && <div style={banner("rgba(255,255,255,0.03)", "1px solid rgba(255,255,255,0.08)", "rgba(255,255,255,0.75)")}>Loading events…</div>}
      {loadError && <div style={banner("rgba(239,68,68,0.10)", "1px solid rgba(239,68,68,0.30)", "rgba(255,255,255,0.9)")}>Events load failed: {loadError}</div>}

      {/* Banned image alert */}
      {events.some(e => e.imageBanned && !e.isCancelled) && (
        <div style={{
          marginBottom: "1.5rem",
          padding: "1rem 1.25rem",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          color: "rgba(255,255,255,0.9)",
          fontSize: "0.875rem",
          lineHeight: 1.5,
        }}>
          <AlertTriangle size={20} style={{ color: "#ef4444", flexShrink: 0 }} />
          <div>
            <strong style={{ color: "#ef4444" }}>Action Required:</strong>{" "}
            {events.filter(e => e.imageBanned && !e.isCancelled).length === 1 ? "One of your events has" : `${events.filter(e => e.imageBanned && !e.isCancelled).length} of your events have`}{" "}
            a photo that was removed by LetsGo staff. Please edit {events.filter(e => e.imageBanned && !e.isCancelled).length === 1 ? "the event" : "those events"} and select a new image.
          </div>
        </div>
      )}

      {/* ─── Header ─── */}
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 auto" }}>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>Event Management</div>
          <div style={{ fontSize: "0.9375rem", color: "rgba(255, 255, 255, 0.6)" }}>Create and manage events to engage your customers</div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* List / Calendar toggle */}
          <div style={{
            display: "flex",
            background: "rgba(255,255,255,0.05)",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "3px",
          }}>
            {([
              { key: "list" as ViewMode, icon: <List size={16} />, label: "List" },
              { key: "calendar" as ViewMode, icon: <CalendarDays size={16} />, label: "Calendar" },
            ]).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setViewMode(opt.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: viewMode === opt.key ? `${colors.primary}25` : "transparent",
                  color: viewMode === opt.key ? colors.primary : "rgba(255,255,255,0.5)",
                }}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>

          <button type="button" onClick={() => requirePremium(() => requireWritable(() => setShowDuplicateEventModal(true)))} style={{ padding: "0.875rem 1.75rem", background: `${colors.accent}20`, border: `1px solid ${colors.accent}`, borderRadius: "12px", color: colors.accent, fontSize: "0.9375rem", fontWeight: 700, transition: "all 0.3s ease", ...headerDisabledStyle }}>
            Duplicate Event
          </button>

          <button type="button" onClick={() => requirePremium(openCreateEvent)} style={{ padding: "0.875rem 1.75rem", background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`, border: "none", borderRadius: "12px", color: "white", fontSize: "0.9375rem", fontWeight: 800, transition: "all 0.3s ease", boxShadow: `0 4px 20px ${colors.primary}40`, ...headerDisabledStyle }}>
            + Create New Event
          </button>
        </div>
      </div>

      {/* ─── Stats ─── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        {[
          { label: "Total Views", value: stats.totalViews.toLocaleString(), icon: <Eye size={24} />, color: colors.purple },
          { label: "Upcoming Events", value: stats.upcomingCount, icon: <Calendar size={24} />, color: colors.primary },
          { label: "Going (Yes)", value: stats.totalYes.toLocaleString(), icon: <Users size={24} />, color: colors.success },
          { label: "This Month", value: stats.thisMonth, icon: <CalendarDays size={24} />, color: colors.warning },
          { label: "Past Events", value: stats.pastCount, icon: <Clock size={24} />, color: colors.accent },
        ].map((stat, idx) => (
          <div key={idx} style={{
            background: "rgba(255, 255, 255, 0.03)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            padding: "1.5rem",
            position: "relative",
            overflow: "hidden",
            transition: "all 0.3s ease",
          }}>
            <div style={{ position: "absolute", top: "-50%", right: "-20%", width: "150px", height: "150px", background: `radial-gradient(circle, ${stat.color}40 0%, transparent 70%)`, borderRadius: "50%", pointerEvents: "none" }} />
            <div style={{ width: "48px", height: "48px", background: `${stat.color}20`, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem", color: stat.color, position: "relative" }}>
              {stat.icon}
            </div>
            <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.6)", marginBottom: "0.5rem", position: "relative" }}>{stat.label}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, fontFamily: '"Space Mono", monospace', position: "relative" }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* ─── Upcoming Events (List or Calendar view) ─── */}
      <div style={panel()}>
        <div style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "1.5rem" }}>
          {viewMode === "calendar" ? "Event Calendar" : "Upcoming Events"}
        </div>

        {viewMode === "list" ? (
          upcomingEvents.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {upcomingEvents.map((event) => {
                const catColor = getCategoryColor(event.category);
                const dateParts = (() => {
                  const d = new Date(event.startAt);
                  if (Number.isNaN(d.getTime())) return { month: "---", day: 0, weekday: "---" };
                  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
                  return { month: months[d.getMonth()], day: d.getDate(), weekday: days[d.getDay()] };
                })();

                return (
                  <div key={event.id} style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "16px",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    minHeight: isMobile ? undefined : "480px",
                  }}>
                    {/* ── Left 50%: Live View (Events page color scheme) ── */}
                    <div style={{ width: isMobile ? "100%" : "50%", flexShrink: 0, display: "flex", flexDirection: "column", borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)", borderBottom: isMobile ? "1px solid rgba(255,255,255,0.06)" : "none", background: "#0C0C14" }}>
                      {/* Hero Image */}
                      <div style={{ position: "relative", height: "280px", background: "#0C0C14", overflow: "hidden", flexShrink: 0 }}>
                        {event.imageBanned ? (
                          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.08)", gap: "0.5rem", padding: "1rem" }}>
                            <AlertTriangle size={28} style={{ color: "#ef4444" }} />
                            <div style={{ color: "#ef4444", fontWeight: 700, fontSize: "0.8rem" }}>Photo Removed</div>
                            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", lineHeight: 1.4, textAlign: "center" }}>Removed by LetsGo staff.</div>
                            <button onClick={(e) => { e.stopPropagation(); openEditEvent(event); }} style={{ marginTop: "0.25rem", padding: "0.4rem 1rem", background: "#D050FF", border: "none", borderRadius: "6px", color: "#fff", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
                              Replace Photo
                            </button>
                          </div>
                        ) : event.imageUrl ? (
                          <img src={event.imageUrl} alt={event.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.875rem" }}>No Image</div>
                        )}

                        {/* Bottom gradient fade */}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "80px", background: "linear-gradient(transparent, #0C0C14)", pointerEvents: "none" }} />

                        {/* Category badge (top-left) */}
                        <div style={{ position: "absolute", top: "12px", left: "12px", zIndex: 2, padding: "4px 10px", borderRadius: "3px", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "rgba(208,80,255,0.2)", color: "#D050FF", border: "1px solid rgba(208,80,255,0.3)", backdropFilter: "blur(8px)" }}>
                          {event.category}
                        </div>

                        {/* Date badge + time (bottom-left, over gradient) */}
                        <div style={{ position: "absolute", bottom: "12px", left: "14px", display: "flex", alignItems: "center", gap: "10px", zIndex: 5 }}>
                          <div style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(208,80,255,0.25)", borderRadius: "6px", padding: "8px 12px", textAlign: "center", minWidth: "52px" }}>
                            <div style={{ fontSize: "9px", fontWeight: 700, color: "#D050FF", letterSpacing: "0.1em" }}>{dateParts.month}</div>
                            <div style={{ fontSize: "22px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>{dateParts.day}</div>
                            <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", marginTop: "2px" }}>{dateParts.weekday}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{event.timeLabel}</div>
                          </div>
                        </div>
                      </div>

                      {/* Card body (below image) — Events page colors */}
                      <div style={{ padding: "16px 18px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
                        {/* Title */}
                        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: "8px", fontFamily: "'DM Sans', sans-serif" }}>
                          {event.title}
                        </h3>

                        {/* Description */}
                        {event.description && (
                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.55, marginBottom: "12px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: "'DM Sans', sans-serif" }}>
                            {event.description}
                          </p>
                        )}

                        {/* Tags + Price pill */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                          {event.tags.slice(0, 4).map((tag) => (
                            <span key={tag} style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.04em", padding: "4px 10px", borderRadius: "12px", color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              {tag}
                            </span>
                          ))}
                          <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.04em", padding: "4px 10px", borderRadius: "12px", color: event.price.toLowerCase() === "free" ? "#00FF87" : "#D050FF", background: event.price.toLowerCase() === "free" ? "rgba(0,255,135,0.1)" : "rgba(208,80,255,0.1)", border: `1px solid ${event.price.toLowerCase() === "free" ? "rgba(0,255,135,0.2)" : "rgba(208,80,255,0.2)"}` }}>
                            {event.price}
                          </span>
                        </div>

                        {/* Attendance row */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                          <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", whiteSpace: "nowrap", flexShrink: 0 }}>Attending?</span>
                          <div style={{ display: "flex", gap: "6px", flex: 1 }}>
                            {[
                              { label: "Yes", icon: "\u2713", count: event.responses.yes },
                              { label: "Maybe", icon: "?", count: event.responses.maybe },
                              { label: "No", icon: "\u2715", count: event.responses.no },
                            ].map((opt) => (
                              <div key={opt.label} style={{ flex: 1, padding: "5px 0", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                                <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>{opt.icon}</span>
                                <span style={{ fontSize: "8px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>{opt.label}</span>
                                <span style={{ fontSize: "7px", color: "rgba(255,255,255,0.2)" }}>{opt.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Booking link (if exists) */}
                        {event.bookingUrl && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px 0", borderRadius: "3px", border: "1px solid rgba(208,80,255,0.2)", background: "rgba(208,80,255,0.04)", marginBottom: "12px" }}>
                            <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#D050FF" }}>External Booking</span>
                          </div>
                        )}

                        {/* Spacer */}
                        <div style={{ flex: 1 }} />

                        {/* Divider + Payout + Details (matches Events page bottom bar) */}
                        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 -18px 14px" }} />

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {payoutRange ? (
                              <>
                                <span style={{ fontSize: "12px" }}>{"\uD83D\uDCB0"}</span>
                                <span style={{ fontSize: "9px", fontWeight: 700, color: "#00FF87", letterSpacing: "0.04em" }}>
                                  Earn up to {payoutRange}
                                </span>
                              </>
                            ) : (
                              <span style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(208,80,255,0.35)" }}>Live View</span>
                            )}
                          </div>
                          <div style={{
                            display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "3px",
                            border: "1px solid rgba(208,80,255,0.2)", background: "transparent",
                          }}>
                            <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Details</span>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                              <path d="M3 8h10M9 4l4 4-4 4" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Right 50%: Analytics + Setup + Actions ── */}
                    <div style={{ width: isMobile ? "100%" : "50%", display: "flex", flexDirection: "column", padding: isMobile ? "1rem" : "1.5rem" }}>
                      {/* Event details summary */}
                      <div style={{ marginBottom: "1.25rem" }}>
                        <div style={{ fontSize: "1.125rem", fontWeight: 800, marginBottom: "0.5rem", lineHeight: 1.3 }}>{event.title}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "rgba(255,255,255,0.7)" }}>
                            <Calendar size={13} style={{ color: colors.primary, flexShrink: 0 }} />
                            {event.dateLabel}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "rgba(255,255,255,0.7)" }}>
                            <Clock size={13} style={{ color: colors.accent, flexShrink: 0 }} />
                            {event.timeLabel}
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", marginBottom: "1.25rem" }} />

                      {/* Analytics grid */}
                      <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Analytics</div>

                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
                        {/* Views */}
                        <div style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: "10px", padding: "0.875rem", textAlign: "center" }}>
                          <Eye size={18} style={{ color: "#a855f7", margin: "0 auto 0.375rem" }} />
                          <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#a855f7", fontFamily: '"Space Mono", monospace' }}>{event.viewCount.toLocaleString()}</div>
                          <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginTop: "0.125rem" }}>Views</div>
                        </div>

                        {/* Total RSVPs */}
                        <div style={{ background: `${colors.success}10`, border: `1px solid ${colors.success}30`, borderRadius: "10px", padding: "0.875rem", textAlign: "center" }}>
                          <Users size={18} style={{ color: colors.success, margin: "0 auto 0.375rem" }} />
                          <div style={{ fontSize: "1.25rem", fontWeight: 900, color: colors.success, fontFamily: '"Space Mono", monospace' }}>{event.responses.yes + event.responses.maybe}</div>
                          <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginTop: "0.125rem" }}>Interested</div>
                        </div>
                      </div>

                      {/* RSVP breakdown */}
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "0.75rem", marginBottom: "1.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
                          <div>
                            <div style={{ fontSize: "1rem", fontWeight: 900, color: colors.success, fontFamily: '"Space Mono", monospace' }}>{event.responses.yes}</div>
                            <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>Yes</div>
                          </div>
                          <div style={{ width: "1px", background: "rgba(255,255,255,0.08)" }} />
                          <div>
                            <div style={{ fontSize: "1rem", fontWeight: 900, color: colors.warning, fontFamily: '"Space Mono", monospace' }}>{event.responses.maybe}</div>
                            <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>Maybe</div>
                          </div>
                          <div style={{ width: "1px", background: "rgba(255,255,255,0.08)" }} />
                          <div>
                            <div style={{ fontSize: "1rem", fontWeight: 900, color: "rgba(255,255,255,0.5)", fontFamily: '"Space Mono", monospace' }}>{event.responses.no}</div>
                            <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>No</div>
                          </div>
                        </div>
                      </div>

                      {/* Event metadata pills */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
                        {event.priceLevel && (
                          <div style={{ background: `${colors.warning}15`, border: `1px solid ${colors.warning}30`, padding: "0.3rem 0.625rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 900, color: colors.warning }}>
                            {event.priceLevel}
                          </div>
                        )}
                        {event.eventSize && (
                          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "0.3rem 0.625rem", borderRadius: "6px", fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "capitalize" }}>
                            {event.eventSize}
                          </div>
                        )}
                        {event.capacity && (
                          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "0.3rem 0.625rem", borderRadius: "6px", fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
                            Cap: {event.capacity}
                          </div>
                        )}
                        <div style={{ background: `${catColor}15`, border: `1px solid ${catColor}30`, padding: "0.3rem 0.625rem", borderRadius: "6px", fontSize: "0.7rem", fontWeight: 700, color: catColor }}>
                          {event.category}
                        </div>
                      </div>

                      {/* Spacer pushes actions to bottom */}
                      <div style={{ flex: 1 }} />

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: "0.75rem" }}>
                        <button type="button" onClick={() => requirePremium(() => openEditEvent(event))} style={{ flex: 1, padding: "0.75rem", background: `${colors.primary}15`, border: `1px solid ${colors.primary}`, borderRadius: "8px", color: colors.primary, fontSize: "0.8125rem", fontWeight: 800, cursor: isPremium ? "pointer" : "not-allowed", opacity: isPremium ? 1 : 0.55 }}>
                          Edit Event
                        </button>
                        <button type="button" onClick={() => requirePremium(() => openDuplicateFrom(event))} style={{ flex: 1, padding: "0.75rem", background: `${colors.accent}15`, border: `1px solid ${colors.accent}`, borderRadius: "8px", color: colors.accent, fontSize: "0.8125rem", fontWeight: 800, cursor: isPremium ? "pointer" : "not-allowed", opacity: isPremium ? 1 : 0.55 }}>
                          Duplicate
                        </button>
                        <button type="button" onClick={() => requirePremium(() => handleCancelEvent(event))} style={{ padding: "0.75rem 1rem", background: `${colors.danger}15`, border: `1px solid ${colors.danger}`, borderRadius: "8px", color: colors.danger, fontSize: "0.8125rem", fontWeight: 800, cursor: isPremium ? "pointer" : "not-allowed", opacity: isPremium ? 1 : 0.55 }} disabled={saving}>
                          {saving ? "..." : "Cancel"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "3rem", textAlign: "center", color: "rgba(255, 255, 255, 0.5)" }}>
              <Calendar size={48} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
              <div style={{ fontSize: "1.125rem", marginBottom: "0.5rem", fontWeight: 800 }}>No upcoming events</div>
              <div style={{ fontSize: "0.875rem" }}>Create your first event to engage customers!</div>
            </div>
          )
        ) : (
          /* ─── Calendar View ─── */
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1.5rem", marginBottom: "1.5rem" }}>
              <button type="button" onClick={() => setCalendarMonth(prev => { const d = new Date(prev.year, prev.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.7)" }}>
                <ChevronLeft size={18} />
              </button>
              <div style={{ fontSize: "1.125rem", fontWeight: 800, minWidth: "180px", textAlign: "center" }}>{calendarMonthLabel}</div>
              <button type="button" onClick={() => setCalendarMonth(prev => { const d = new Date(prev.year, prev.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.7)" }}>
                <ChevronRight size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", marginBottom: "4px" }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} style={{ textAlign: "center", fontSize: "0.75rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", padding: "0.5rem 0", letterSpacing: "0.05em" }}>{day}</div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
              {calendarDays.map((cell, idx) => {
                const today = new Date();
                const isToday = cell.date.getDate() === today.getDate() && cell.date.getMonth() === today.getMonth() && cell.date.getFullYear() === today.getFullYear();
                const dateKey = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
                const dayEvents = eventsByDate.get(dateKey) || [];

                return (
                  <div key={idx} style={{ minHeight: "80px", padding: "0.375rem", background: isToday ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.01)", borderTop: isToday ? `2px solid ${colors.primary}` : "2px solid transparent", opacity: cell.inMonth ? 1 : 0.3, transition: "background 0.2s ease" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: isToday ? 900 : 600, color: isToday ? colors.primary : "rgba(255,255,255,0.6)", marginBottom: "0.25rem", fontFamily: '"Space Mono", monospace' }}>
                      {cell.date.getDate()}
                    </div>
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div key={ev.id} onClick={() => requirePremium(() => openEditEvent(ev))} style={{ fontSize: "0.6rem", fontWeight: 700, padding: "2px 4px", marginBottom: "2px", borderRadius: "4px", background: `${getCategoryColor(ev.category)}25`, color: getCategoryColor(ev.category), cursor: isPremium ? "pointer" : "default", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={ev.title}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Past Events ─── */}
      <div style={panel()}>
        <div style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "1.5rem" }}>Past Events</div>

        {pastEvents.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
            {pastEvents.map((event) => (
              <div key={event.id} style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "16px", padding: "1rem", opacity: event.isCancelled ? 0.85 : 1 }}>
                <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                  {event.imageBanned ? (
                    <div style={{ width: "120px", height: "90px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px dashed rgba(239,68,68,0.4)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.2rem", flexShrink: 0 }}>
                      <AlertTriangle size={16} style={{ color: "#ef4444" }} />
                      <div style={{ color: "#ef4444", fontSize: "0.55rem", fontWeight: 700 }}>Removed</div>
                    </div>
                  ) : event.imageUrl ? (
                    <img src={event.imageUrl} alt={event.title} style={{ width: "120px", height: "90px", objectFit: "cover", borderRadius: "10px", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: "120px", height: "90px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", flexShrink: 0 }}>No Image</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, marginBottom: "0.5rem" }}>{event.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span>{event.dateLabel} • {event.timeLabel}</span>
                      {event.isCancelled && (
                        <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "2px 8px", borderRadius: "6px", fontSize: "0.65rem", fontWeight: 800 }}>Cancelled</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.375rem", fontSize: "0.7rem" }}>
                      <span style={{ color: "#a855f7", fontWeight: 800 }}><Eye size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{event.viewCount.toLocaleString()} views</span>
                      <span style={{ color: colors.success, fontWeight: 800 }}>{event.responses.yes} going</span>
                      <span style={{ color: colors.warning, fontWeight: 800 }}>{event.responses.maybe} maybe</span>
                    </div>
                    {/* Tags on past events */}
                    {event.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.375rem" }}>
                        {event.tags.slice(0, 4).map((tag) => (
                          <span key={tag} style={{ background: `${colors.primary}10`, color: `${colors.primary}cc`, padding: "1px 6px", borderRadius: "4px", fontSize: "0.6rem", fontWeight: 700 }}>{tag}</span>
                        ))}
                        {event.tags.length > 4 && <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>+{event.tags.length - 4}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => requirePremium(() => openDuplicateFrom(event))} style={{ width: "100%", padding: "0.5rem", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", color: "white", fontSize: "0.75rem", fontWeight: 800, cursor: isPremium ? "pointer" : "not-allowed", opacity: isPremium ? 1 : 0.55 }}>
                  Duplicate
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.875rem" }}>No past events yet.</div>
        )}
      </div>

      {/* ─── Duplicate Modal ─── */}
      {showDuplicateEventModal && (
        <ModalOverlay>
          <div style={modalCard()} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader()}>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "0.5rem" }}>Duplicate Event</div>
                <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.6)" }}>Select an event to duplicate with new dates</div>
              </div>
              <button type="button" onClick={() => setShowDuplicateEventModal(false)} style={modalX()} aria-label="Close" title="Close"><X size={20} /></button>
            </div>

            <div style={{ padding: "1.5rem 2rem" }}>
              {events.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.65)" }}>No events yet.</div>
              ) : (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {[...upcomingEvents, ...pastEvents].map((ev) => (
                    <div key={ev.id} onClick={() => { if (!isPremium) return; setShowDuplicateEventModal(false); openDuplicateFrom(ev); }} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", cursor: !isPremium ? "not-allowed" : "pointer", opacity: !isPremium ? 0.55 : 1 }}>
                      {ev.imageBanned ? (
                        <div style={{ width: "80px", height: "60px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px dashed rgba(239,68,68,0.4)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.15rem" }}>
                          <AlertTriangle size={14} style={{ color: "#ef4444" }} /><div style={{ color: "#ef4444", fontSize: "0.5rem", fontWeight: 700 }}>Removed</div>
                        </div>
                      ) : ev.imageUrl ? (
                        <img src={ev.imageUrl} alt={ev.title} style={{ width: "80px", height: "60px", borderRadius: "8px", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "80px", height: "60px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.5rem" }}>No Image</div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900 }}>{ev.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}>{ev.dateLabel} • {ev.timeLabel}</div>
                      </div>
                      <div style={{ padding: "0.5rem 1rem", background: `${colors.primary}20`, border: `1px solid ${colors.primary}`, borderRadius: "6px", color: colors.primary, fontSize: "0.75rem", fontWeight: 900 }}>Select</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: "1.5rem 2rem", borderTop: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowDuplicateEventModal(false)} style={ghostBtn()}>Cancel</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ─── Create/Edit Modal ─── */}
      {showCreateEventModal && (
        <ModalOverlay>
          <div style={modalCardSmall()} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader()}>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "0.5rem" }}>
                  {modalMode === "duplicate" ? "Duplicate Event" : modalMode === "edit" ? "Edit Event" : "Create New Event"}
                </div>
                <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.6)" }}>Fill in event details below.</div>
              </div>
              <button type="button" onClick={() => setShowCreateEventModal(false)} style={modalX()} aria-label="Close" title="Close"><X size={20} /></button>
            </div>

            <div style={{ padding: "2rem" }}>
              {/* Event Image */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={label()}>Event Image (Flyer/Poster) <span style={{ color: colors.danger }}>*</span></label>
                <div style={subLabel()}>Select an image from your Media Gallery</div>
                <div style={photoGrid()}>
                  {photos.map((p) => (
                    <div key={p.id} onClick={() => setSelectedPhotoId(p.id)} style={{ position: "relative", aspectRatio: "1", borderRadius: "8px", overflow: "hidden", cursor: "pointer", border: selectedPhotoId === p.id ? `3px solid ${colors.primary}` : "3px solid transparent" }}>
                      {p.url ? (
                        <img src={p.url} alt={p.caption} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.5rem" }}>?</div>
                      )}
                      {selectedPhotoId === p.id && (
                        <div style={{ position: "absolute", top: 4, right: 4, background: colors.primary, borderRadius: "50%", padding: 2 }}>
                          <CheckCircle size={14} style={{ color: "white" }} />
                        </div>
                      )}
                      <div style={photoCaptionOverlay()}>{p.caption}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={label()}>Event Title *</label>
                <input ref={titleRef} style={input()} />
              </div>

              {/* Category */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={label()}>Category *</label>
                <select ref={categoryRef} style={input()}>
                  <option value="" style={{ color: "#1a2332", background: "#fff" }}>Select a category</option>
                  <option value="Music" style={{ color: "#1a2332", background: "#fff" }}>Music</option>
                  <option value="Games" style={{ color: "#1a2332", background: "#fff" }}>Games</option>
                  <option value="Food & Drink" style={{ color: "#1a2332", background: "#fff" }}>Food & Drink</option>
                  <option value="Workshop" style={{ color: "#1a2332", background: "#fff" }}>Workshop</option>
                  <option value="Special Event" style={{ color: "#1a2332", background: "#fff" }}>Special Event</option>
                  <option value="Sports" style={{ color: "#1a2332", background: "#fff" }}>Sports</option>
                  <option value="Arts & Crafts" style={{ color: "#1a2332", background: "#fff" }}>Arts & Crafts</option>
                  <option value="Other" style={{ color: "#1a2332", background: "#fff" }}>Other</option>
                </select>
              </div>

              {/* Description */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={label()}>Description *</label>
                <textarea ref={descriptionRef} rows={4} style={textarea()} />
              </div>

              {/* Date + Start Time + End Time */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label style={label()}>Event Date *</label>
                  <input ref={dateRef} type="date" style={input()} />
                </div>
                <div>
                  <label style={label()}>Start Time *</label>
                  <input ref={startTimeRef} type="time" style={input()} />
                </div>
                <div>
                  <label style={label()}>End Time *</label>
                  <input ref={endTimeRef} type="time" style={input()} />
                </div>
              </div>

              {/* Price + Price Level */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label style={label()}>Price *</label>
                  <input ref={priceRef} placeholder="Free, $10, $5 per card" style={input()} />
                </div>
                <div>
                  <label style={label()}>Price Level</label>
                  <select value={formPriceLevel} onChange={(e) => setFormPriceLevel(e.target.value)} style={input()}>
                    {PRICE_LEVELS.map((p) => (
                      <option key={p} value={p} style={{ color: "#1a2332", background: "#fff" }}>{PRICE_LEVEL_LABELS[p] || p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Event Size + Capacity */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label style={label()}>Event Size</label>
                  <select value={formEventSize} onChange={(e) => setFormEventSize(e.target.value)} style={input()}>
                    <option value="" style={{ color: "#1a2332", background: "#fff" }}>Select size</option>
                    {EVENT_SIZES.map((s) => (
                      <option key={s.value} value={s.value} style={{ color: "#1a2332", background: "#fff" }}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={label()}>Capacity (Optional)</label>
                  <input ref={capacityRef} placeholder="Max attendees" style={input()} />
                </div>
              </div>

              {/* Booking URL */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={label()}>External Booking URL (Optional)</label>
                <input ref={bookingUrlRef} placeholder="https://example.com/tickets" style={input()} />
              </div>

              {/* Tags */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={label()}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <Tag size={14} />
                    Tags
                  </span>
                </label>
                <div style={subLabel()}>Add tags to help users discover this event</div>

                {/* Selected tags */}
                {formTags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "0.75rem" }}>
                    {formTags.map((tag) => (
                      <span key={tag} style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        background: `${colors.primary}20`,
                        color: colors.primary,
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}>
                        {tag}
                        <button
                          type="button"
                          onClick={() => setFormTags(formTags.filter((t) => t !== tag))}
                          style={{ background: "none", border: "none", color: colors.primary, cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Tag search input */}
                <div style={{ position: "relative" }}>
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInput}
                    onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    placeholder="Type to search tags..."
                    style={input()}
                  />

                  {/* Suggestions dropdown */}
                  {showTagSuggestions && tagSuggestions.length > 0 && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#1e293b",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "8px",
                      marginTop: "4px",
                      maxHeight: "200px",
                      overflowY: "auto",
                      zIndex: 10,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                    }}>
                      {tagSuggestions.map((tag) => (
                        <div
                          key={tag}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFormTags([...formTags, tag]);
                            setTagInput("");
                            setShowTagSuggestions(false);
                            tagInputRef.current?.focus();
                          }}
                          style={{
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.8125rem",
                            color: "rgba(255,255,255,0.8)",
                            cursor: "pointer",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
                        >
                          {tag}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {!isPremium && (
                <div style={{ marginTop: "0.5rem", padding: "0.75rem 1rem", background: "rgba(249, 115, 22, 0.12)", border: "1px solid rgba(249, 115, 22, 0.35)", borderRadius: "10px", color: "rgba(255,255,255,0.9)", fontSize: "0.85rem", fontWeight: 900, display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <AlertCircle size={18} style={{ color: colors.warning, marginTop: 1 }} />
                  Events are a Premium feature. Upgrade to create or manage events.
                </div>
              )}
            </div>

            <div style={{ padding: isMobile ? "1rem" : "1.5rem 2rem", borderTop: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowCreateEventModal(false)} style={ghostBtn()} disabled={saving}>Cancel</button>
              <button type="button" onClick={handleSaveEvent} disabled={!isPremium || saving} style={{
                padding: "0.75rem 1.5rem",
                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                border: "none", borderRadius: "8px", color: "white", fontSize: "0.875rem", fontWeight: 900,
                cursor: !isPremium || saving ? "not-allowed" : "pointer",
                boxShadow: `0 4px 20px ${colors.primary}60`,
                opacity: !isPremium || saving ? 0.55 : 1,
              }}>
                {saving ? "Saving…" : modalMode === "edit" ? "Update Event" : "Create Event"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );

  // ─── Helper Components & Style Functions ─────────────────────────────────────

  function banner(bg: string, border: string, color: string): React.CSSProperties {
    return { padding: "1rem", marginBottom: "1rem", background: bg, border, borderRadius: "12px", color, fontWeight: 900 };
  }

  function panel(): React.CSSProperties {
    return { background: "rgba(255, 255, 255, 0.03)", backdropFilter: "blur(20px)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "16px", padding: "2rem", marginBottom: "2rem" };
  }

  function RowStat({ label, value, bg, color }: { label: string; value: number; bg: string; color: string }) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem", padding: "0.375rem 0.5rem", background: bg, borderRadius: "4px" }}>
        <div style={{ fontSize: "0.75rem", color, fontWeight: 900 }}>{label}</div>
        <div style={{ fontSize: "0.875rem", fontWeight: 900, color, fontFamily: '"Space Mono", monospace' }}>{value}</div>
      </div>
    );
  }

  function smallBtn(bg: string, color: string, enabled: boolean): React.CSSProperties {
    return { padding: "0.5rem 0.75rem", background: bg, border: `1px solid ${color}`, borderRadius: "6px", color, fontSize: "0.75rem", fontWeight: 900, cursor: enabled ? "pointer" : "not-allowed", opacity: enabled ? 1 : 0.55 };
  }

  function modalCard(): React.CSSProperties {
    return { background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", borderRadius: "20px", maxWidth: "700px", width: "100%", maxHeight: "80vh", overflow: "auto", border: "1px solid rgba(255,255,255,0.1)" };
  }

  function modalCardSmall(): React.CSSProperties {
    return { ...modalCard(), maxWidth: "650px", maxHeight: "90vh" };
  }

  function modalHeader(): React.CSSProperties {
    return { padding: isMobile ? "1rem" : "2rem", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" };
  }

  function modalX(): React.CSSProperties {
    return { background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" };
  }

  function ghostBtn(): React.CSSProperties {
    return { padding: "0.75rem 1.5rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "0.875rem", fontWeight: 900, cursor: "pointer" };
  }

  function label(): React.CSSProperties {
    return { display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 900 };
  }

  function subLabel(): React.CSSProperties {
    return { fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.75rem" };
  }

  function input(): React.CSSProperties {
    return { width: "100%", padding: "0.75rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "0.875rem", fontFamily: "inherit" };
  }

  function textarea(): React.CSSProperties {
    return { ...input(), resize: "vertical" as const };
  }

  function photoGrid(): React.CSSProperties {
    return { display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: "0.75rem", padding: "1rem", background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "180px", overflowY: "auto" };
  }

  function photoCaptionOverlay(): React.CSSProperties {
    return { position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.8))", padding: "0.5rem 0.25rem 0.25rem", fontSize: "0.6rem", color: "white", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  }
}
