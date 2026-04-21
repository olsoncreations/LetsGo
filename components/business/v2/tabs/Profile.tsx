// components/business/v2/tabs/Profile.tsx
// ============================================================================
// MODEL A: Single Hydration Architecture (FIXED TIMING + HOURS)
// - Inputs hydrate ONCE on initial load
// - Never re-hydrate unless businessId changes
// - All edits are local-only until "Publish Changes"
// ============================================================================
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { BusinessTabProps } from "@/components/business/v2/BusinessProfileV2";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { fetchTagsByCategory, getVisibleCategories, type TagCategory } from "@/lib/availableTags";
import { AlertCircle, Settings, Clock, User, Mail, Tag, X, CheckCircle, Users, Trash2, UserPlus, Shield } from "lucide-react";
import { useIsMobile } from "@/lib/useIsMobile";

// ============================================================================
// Types
// ============================================================================
type HoursDay = { open: string; close: string };
type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
type BusinessHours = Record<DayKey, HoursDay>;

type TeamMember = {
  user_id: string;
  role: "owner" | "manager" | "staff";
  created_at: string;
  email: string;
  full_name: string | null;
};

type ProfileSnapshot = {
  businessId: string;
  fields: {
    name: string;
    type: string;
    streetAddress: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    email: string;
    website: string;
    description: string;
    cuisineType: string;
    priceLevel: string;
    ageRestriction: string;
    repName: string;
    repTitle: string;
    repEmail: string;
    repPhone: string;
    loginEmail: string;
    loginPhone: string;
  };
  hours: BusinessHours;
  tags: string[];
};

// Loaded data structure (stored until form is ready)
type LoadedData = {
  fields: Record<string, string>;
  hours: BusinessHours;
  tags: string[];
} | null;

// Extend window for snapshot getter
declare global {
  interface Window {
    __LG_BP_PROFILE_GET_SNAPSHOT?: (businessId: string) => ProfileSnapshot | null;
    google?: any;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================
function normalizeErr(e: unknown): string {
  if (!e) return "Unknown error.";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || "Unknown error.";
  try {
    const anyE = e as any;
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

function asStr(v: any, fallback = ""): string {
  if (v === undefined || v === null) return fallback;
  const s = String(v);
  return s.length ? s : fallback;
}

function pick<T = any>(obj: Record<string, any> | null | undefined, keys: string[], fallback: T): T {
  if (!obj) return fallback;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return fallback;
}

// Normalize business_type from legacy Title Case → snake_case (DB format)
const BUSINESS_TYPE_NORMALIZE: Record<string, string> = {
  "Restaurant/Bar": "restaurant_bar",
  "Salon/Beauty": "salon_beauty",
  "Retail": "retail",
  "Activity": "activity",
  "Event Venue": "event_venue",
  "Other": "other",
};

function normalizeBusinessType(raw: string): string {
  if (!raw) return "restaurant_bar";
  // Already snake_case — pass through
  if (raw.includes("_") || raw === raw.toLowerCase()) return raw;
  return BUSINESS_TYPE_NORMALIZE[raw] ?? raw.toLowerCase().replace(/[/ ]/g, "_");
}

// Normalize age_restriction from legacy formats → DB format
function normalizeAgeRestriction(raw: string): string {
  if (!raw) return "all";
  const map: Record<string, string> = { None: "all", "18+": "18", "21+": "21" };
  return map[raw] ?? raw;
}

function toTimeOrClosed(openVal: any, closeVal: any): HoursDay {
  const open = asStr(openVal, "");
  const close = asStr(closeVal, "");
  if (!open || open === "Closed") return { open: "Closed", close: "" };
  return { open, close };
}

// Format phone as (XXX) XXX-XXXX
function formatPhone(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");
  
  // Limit to 10 digits
  const limited = digits.slice(0, 10);
  
  // Format based on length
  if (limited.length === 0) return "";
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

// Handle phone input change
function handlePhoneChange(ref: React.RefObject<HTMLInputElement | null>) {
  if (ref.current) {
    ref.current.value = formatPhone(ref.current.value);
  }
}

// ============================================================================
// Constants
// ============================================================================
const DAYS: { key: DayKey; label: string; shortKey: string }[] = [
  { key: "monday", label: "Monday", shortKey: "mon" },
  { key: "tuesday", label: "Tuesday", shortKey: "tue" },
  { key: "wednesday", label: "Wednesday", shortKey: "wed" },
  { key: "thursday", label: "Thursday", shortKey: "thu" },
  { key: "friday", label: "Friday", shortKey: "fri" },
  { key: "saturday", label: "Saturday", shortKey: "sat" },
  { key: "sunday", label: "Sunday", shortKey: "sun" },
];

const DEFAULT_HOURS: BusinessHours = {
  monday: { open: "09:00", close: "17:00" },
  tuesday: { open: "09:00", close: "17:00" },
  wednesday: { open: "09:00", close: "17:00" },
  thursday: { open: "09:00", close: "17:00" },
  friday: { open: "09:00", close: "17:00" },
  saturday: { open: "10:00", close: "15:00" },
  sunday: { open: "Closed", close: "" },
};

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

// ============================================================================
// Main Component
// ============================================================================
export default function Profile({ businessId, isPremium }: BusinessTabProps) {
  const isMobile = useIsMobile();
  const colors = useMemo(() => ({
    primary: "#14b8a6",
    secondary: "#f97316",
    accent: "#06b6d4",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
  }), []);

  // ============================================================================
  // State
  // ============================================================================
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Hours and tags are controlled state
  const [hours, setHours] = useState<BusinessHours>({ ...DEFAULT_HOURS });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagInputFocused, setTagInputFocused] = useState(false);
  const [selectedBusinessType, setSelectedBusinessType] = useState("restaurant_bar");
  const [tagCategories, setTagCategories] = useState<TagCategory[]>([]);

  // Password change state (inline per-member)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [showPasswordFor, setShowPasswordFor] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Team management state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [callerRole, setCallerRole] = useState<string>("staff");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"manager" | "staff">("staff");
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);
  const [teamActionLoading, setTeamActionLoading] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Chain affiliation state
  const [chainId, setChainId] = useState<string | null>(null);
  const [storeNumber, setStoreNumber] = useState<string | null>(null);
  const [chainBrandName, setChainBrandName] = useState<string | null>(null);
  const [chainCodeInput, setChainCodeInput] = useState("");
  const [storeNumberInput, setStoreNumberInput] = useState("");
  const [chainLinkStatus, setChainLinkStatus] = useState<string | null>(null);
  const [chainLinkError, setChainLinkError] = useState<string | null>(null);
  const [chainLinkLoading, setChainLinkLoading] = useState(false);

  // Store loaded data until form is ready to receive it
  const [loadedData, setLoadedData] = useState<LoadedData>(null);

  // ============================================================================
  // Refs for uncontrolled inputs
  // ============================================================================
  const nameRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);
  const streetRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLSelectElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const cuisineRef = useRef<HTMLSelectElement>(null);
  const priceRef = useRef<HTMLSelectElement>(null);
  const ageRef = useRef<HTMLSelectElement>(null);
  const repNameRef = useRef<HTMLInputElement>(null);
  const repTitleRef = useRef<HTMLInputElement>(null);
  const repEmailRef = useRef<HTMLInputElement>(null);
  const repPhoneRef = useRef<HTMLInputElement>(null);

  // Track if we've applied loaded data to refs
  const hydratedBusinessIdRef = useRef<string | null>(null);
  const googleAutoInitRef = useRef(false);

  // ============================================================================
  // Apply Fields to Refs
  // ============================================================================
  const applyFieldsToRefs = useCallback((fields: Record<string, string>) => {
    if (nameRef.current) nameRef.current.value = fields.name ?? "";
    if (typeRef.current) typeRef.current.value = fields.type ?? "restaurant_bar";
    setSelectedBusinessType(fields.type ?? "restaurant_bar");
    if (streetRef.current) streetRef.current.value = fields.streetAddress ?? "";
    if (cityRef.current) cityRef.current.value = fields.city ?? "";
    if (stateRef.current) stateRef.current.value = fields.state ?? "NE";
    if (zipRef.current) zipRef.current.value = fields.zip ?? "";
    if (phoneRef.current) phoneRef.current.value = formatPhone(fields.phone ?? "");
    if (emailRef.current) emailRef.current.value = fields.email ?? "";
    if (websiteRef.current) websiteRef.current.value = fields.website ?? "";
    if (descRef.current) descRef.current.value = fields.description ?? "";
    if (cuisineRef.current) cuisineRef.current.value = fields.cuisineType ?? "Other";
    if (priceRef.current) priceRef.current.value = fields.priceLevel ?? "$$";
    if (ageRef.current) ageRef.current.value = fields.ageRestriction ?? "all";
    if (repNameRef.current) repNameRef.current.value = fields.repName ?? "";
    if (repTitleRef.current) repTitleRef.current.value = fields.repTitle ?? "";
    if (repEmailRef.current) repEmailRef.current.value = fields.repEmail ?? "";
    if (repPhoneRef.current) repPhoneRef.current.value = formatPhone(fields.repPhone ?? "");
  }, []);

  // ============================================================================
  // Effect: Apply loaded data AFTER form renders
  // ============================================================================
  useEffect(() => {
    if (!loadedData) return;
    if (loading) return; // Wait until loading is false (form is rendered)
    if (hydratedBusinessIdRef.current === businessId) return; // Already hydrated

    // Form should now be rendered, apply the data
    hydratedBusinessIdRef.current = businessId;
    applyFieldsToRefs(loadedData.fields);
    setHours(loadedData.hours);
    setTags(loadedData.tags);
  }, [loadedData, loading, businessId, applyFieldsToRefs]);

  // ============================================================================
  // Snapshot Getter (for Publish button)
  // ============================================================================
  function buildSnapshot(): ProfileSnapshot {
    return {
      businessId,
      fields: {
        name: nameRef.current?.value ?? "",
        type: typeRef.current?.value ?? "restaurant_bar",
        streetAddress: streetRef.current?.value ?? "",
        city: cityRef.current?.value ?? "",
        state: stateRef.current?.value ?? "",
        zip: zipRef.current?.value ?? "",
        phone: phoneRef.current?.value ?? "",
        email: emailRef.current?.value ?? "",
        website: websiteRef.current?.value ?? "",
        description: descRef.current?.value ?? "",
        cuisineType: cuisineRef.current?.value ?? "Other",
        priceLevel: priceRef.current?.value ?? "$$",
        ageRestriction: ageRef.current?.value ?? "all",
        repName: repNameRef.current?.value ?? "",
        repTitle: repTitleRef.current?.value ?? "",
        repEmail: repEmailRef.current?.value ?? "",
        repPhone: repPhoneRef.current?.value ?? "",
        loginEmail: "",
        loginPhone: "",
      },
      hours,
      tags,
    };
  }

  useEffect(() => {
    window.__LG_BP_PROFILE_GET_SNAPSHOT = (bid: string) => {
      if (bid !== businessId) return null;
      return buildSnapshot();
    };
    return () => {
      delete window.__LG_BP_PROFILE_GET_SNAPSHOT;
    };
  }, [businessId, hours, tags]);

  // ============================================================================
  // Load Data from Supabase
  // ============================================================================
  useEffect(() => {
    if (!businessId) return;
    if (hydratedBusinessIdRef.current === businessId) return;

    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setLoadError(null);
      setLoadedData(null);

      try {
        const { data: biz, error } = await supabaseBrowser
          .from("business")
          .select("*")
          .eq("id", businessId)
          .maybeSingle();

        if (error) throw error;
        if (cancelled) return;

        const row = (biz ?? {}) as Record<string, any>;
        const cfg = (row.config ?? {}) as Record<string, any>;

        // Parse tags
        const tagsRaw = row.tags ?? cfg.tags ?? [];
        const tagsFromDb = Array.isArray(tagsRaw) ? tagsRaw.map(String) : [];

        // Parse hours from individual day columns (single source of truth)
        const hoursFromDb: BusinessHours = {
          monday: toTimeOrClosed(row.mon_open ?? "", row.mon_close ?? ""),
          tuesday: toTimeOrClosed(row.tue_open ?? "", row.tue_close ?? ""),
          wednesday: toTimeOrClosed(row.wed_open ?? "", row.wed_close ?? ""),
          thursday: toTimeOrClosed(row.thu_open ?? "", row.thu_close ?? ""),
          friday: toTimeOrClosed(row.fri_open ?? "", row.fri_close ?? ""),
          saturday: toTimeOrClosed(row.sat_open ?? "", row.sat_close ?? ""),
          sunday: toTimeOrClosed(row.sun_open ?? "", row.sun_close ?? ""),
        };

        // Parse fields
        const baseFields: Record<string, string> = {
          name: asStr(pick(row, ["business_name", "public_business_name", "name"], "")),
          type: normalizeBusinessType(asStr(pick(row, ["business_type", "type_line", "type"], "restaurant_bar"))),
          streetAddress: asStr(pick(row, ["street_address", "address_line1"], "")),
          city: asStr(row.city ?? ""),
          state: asStr(row.state ?? "NE"),
          zip: asStr(pick(row, ["zip", "postal_code"], "")),
          phone: asStr(pick(row, ["business_phone", "phone_number", "contact_phone"], "")),
          email: asStr(pick(row, ["contact_email", "customer_email"], "")),
          website: asStr(pick(row, ["website", "website_url"], "")),
          description: asStr(pick(row, ["blurb", "vibe", "description"], "")),
          cuisineType: asStr(row.category_main ?? "Other"),
          priceLevel: asStr(row.price_level ?? "$$"),
          ageRestriction: normalizeAgeRestriction(asStr(row.age_restriction ?? "all")),
          repName: asStr(cfg.repName ?? cfg.rep_name ?? ""),
          repTitle: asStr(cfg.repTitle ?? cfg.rep_title ?? cfg.role ?? ""),
          repEmail: asStr(cfg.repEmail ?? cfg.rep_email ?? ""),
          repPhone: asStr(cfg.repPhone ?? cfg.rep_phone ?? ""),
          loginEmail: asStr(cfg.loginEmail ?? cfg.login_email ?? cfg.email ?? ""),
          loginPhone: asStr(cfg.loginPhone ?? cfg.login_phone ?? cfg.phone ?? ""),
        };

        // Fill login email from authenticated session if config doesn't have it
        if (!baseFields.loginEmail) {
          const { data: authData } = await supabaseBrowser.auth.getUser();
          if (authData?.user?.email) {
            baseFields.loginEmail = authData.user.email;
          }
        }

        if (cancelled) return;

        // Load chain affiliation
        const bizChainId = row.chain_id as string | null;
        const bizStoreNumber = row.store_number as string | null;
        setChainId(bizChainId);
        setStoreNumber(bizStoreNumber);
        if (bizChainId) {
          const { data: chainRow } = await supabaseBrowser
            .from("chains")
            .select("brand_name")
            .eq("id", bizChainId)
            .maybeSingle();
          setChainBrandName(chainRow?.brand_name || bizChainId);
        }

        // Check for pending link requests
        const { data: pendingLink } = await supabaseBrowser
          .from("chain_link_requests")
          .select("id, chain_id, store_number, status")
          .eq("business_id", businessId)
          .eq("status", "pending")
          .maybeSingle();
        if (pendingLink) {
          setChainLinkStatus("pending");
        }

        // Store data and set loading false - effect will apply when form renders
        setLoadedData({ fields: baseFields, hours: hoursFromDb, tags: tagsFromDb });
        setLoading(false);

      } catch (e) {
        if (cancelled) return;
        console.error("[Profile] Load error:", e);
        setLoadError(normalizeErr(e));
        setLoading(false);
      }
    }

    loadProfile();
    return () => { cancelled = true; };
  }, [businessId]);

  // Fetch available tags from DB (grouped by category)
  useEffect(() => {
    fetchTagsByCategory("business").then(setTagCategories);
  }, []);

  // ============================================================================
  // Google Places Autocomplete
  // ============================================================================
  async function ensureGooglePlacesLoaded(): Promise<void> {
    if (typeof window === "undefined") return;
    if (window.google?.maps?.places) return;

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const existing = document.querySelector("script[data-lg-google='1']") as HTMLScriptElement | null;
      if (existing) {
        if (window.google?.maps?.places) resolve();
        else {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Google Maps failed")));
        }
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.setAttribute("data-lg-google", "1");
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps failed"));
      document.head.appendChild(script);
    });
  }

  function parsePlaceToAddress(place: any) {
    const comps: any[] = place?.address_components ?? [];
    const get = (type: string, mode: "long_name" | "short_name" = "long_name") => {
      const c = comps.find((x) => x.types?.includes(type));
      return c ? String(c[mode] ?? "") : "";
    };

    const streetNumber = get("street_number");
    const route = get("route");
    const street = [streetNumber, route].filter(Boolean).join(" ").trim();

    return {
      street: street || (place?.formatted_address?.split(",")[0] ?? ""),
      city: get("locality") || get("sublocality") || get("postal_town"),
      state: get("administrative_area_level_1", "short_name"),
      zip: get("postal_code"),
    };
  }

  async function initGoogleAutocomplete() {
    if (googleAutoInitRef.current) return;
    googleAutoInitRef.current = true;

    try {
      await ensureGooglePlacesLoaded();
      if (!streetRef.current || !window.google?.maps?.places) return;

      const autocomplete = new window.google.maps.places.Autocomplete(streetRef.current, {
        types: ["address"],
        componentRestrictions: { country: ["us"] },
        fields: ["address_components", "formatted_address"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const parsed = parsePlaceToAddress(place);
        if (streetRef.current && parsed.street) streetRef.current.value = parsed.street;
        if (cityRef.current && parsed.city) cityRef.current.value = parsed.city;
        if (stateRef.current && parsed.state) stateRef.current.value = parsed.state;
        if (zipRef.current && parsed.zip) zipRef.current.value = parsed.zip;
      });
    } catch (e) {
      // Google Places init failed — autocomplete unavailable
    }
  }

  // ============================================================================
  // Hours Handlers
  // ============================================================================
  function updateHours(day: DayKey, field: "open" | "close", value: string) {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function toggleDayClosed(day: DayKey) {
    setHours((prev) => {
      const current = prev[day];
      if (current.open === "Closed") {
        return { ...prev, [day]: { open: "09:00", close: "17:00" } };
      } else {
        return { ...prev, [day]: { open: "Closed", close: "" } };
      }
    });
  }

  // ============================================================================
  // Tag Handlers
  // ============================================================================
  async function handleChangePassword() {
    setPasswordMsg(null);
    if (!currentPassword) {
      setPasswordMsg("Error: Current password is required.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg("Error: Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("Error: Passwords do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      // Verify current password by re-authenticating
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const userEmail = session?.user?.email;
      if (!userEmail) throw new Error("No session found");

      const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });
      if (signInError) {
        setPasswordMsg("Error: Current password is incorrect.");
        setPasswordSaving(false);
        return;
      }

      const { error } = await supabaseBrowser.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMsg("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordFor(null);
    } catch (e: unknown) {
      setPasswordMsg(`Error: ${normalizeErr(e)}`);
    } finally {
      setPasswordSaving(false);
    }
  }

  function addTag(tag: string) {
    const normalized = tag.toLowerCase().trim();
    if (normalized && !tags.includes(normalized)) {
      setTags((prev) => [...prev, normalized]);
    }
    setTagInput("");
  }

  function removeTag(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  // Smart visibility: determine which categories to show based on business type
  const visibleCategories = useMemo(() => {
    if (!tagCategories.length) return [];
    // Resolve the business_type value (e.g. "restaurant_bar") back to the Business Type tag name
    const bt = tagCategories.find(c => c.name === "Business Type");
    const matchingTag = bt?.tags.find(t =>
      t.name.toLowerCase().replace(/[/ ]/g, "_") === selectedBusinessType ||
      t.slug === selectedBusinessType
    );
    const businessTypeTags = matchingTag ? [matchingTag.name] : [];
    return getVisibleCategories(tagCategories, businessTypeTags);
  }, [tagCategories, selectedBusinessType]);

  // DB-driven Business Type options
  const businessTypeOptions = useMemo(() => {
    const bt = tagCategories.find(c => c.name === "Business Type");
    if (!bt || bt.tags.length === 0) {
      return [
        { value: "restaurant_bar", label: "Restaurant / Bar" },
        { value: "activity", label: "Activity" },
        { value: "salon_beauty", label: "Salon / Beauty" },
        { value: "retail", label: "Retail" },
        { value: "event_venue", label: "Event Venue" },
        { value: "other", label: "Other" },
      ];
    }
    return bt.tags.map(t => ({
      value: t.name.toLowerCase().replace(/[/ ]/g, "_"),
      label: `${t.icon || ""} ${t.name}`.trim(),
    }));
  }, [tagCategories]);

  // DB-driven Cuisine/Category options
  const cuisineOptions = useMemo(() => {
    const cu = tagCategories.find(c => c.name === "Cuisine");
    if (!cu || cu.tags.length === 0) {
      return [
        { value: "American", label: "American" },
        { value: "Italian", label: "Italian" },
        { value: "Mexican", label: "Mexican" },
        { value: "Asian", label: "Asian" },
        { value: "Seafood", label: "Seafood" },
        { value: "Bakery", label: "Bakery" },
        { value: "Coffee", label: "Coffee" },
        { value: "Bar", label: "Bar" },
        { value: "Other", label: "Other" },
      ];
    }
    return cu.tags.map(t => ({
      value: t.name,
      label: `${t.icon || ""} ${t.name}`.trim(),
    }));
  }, [tagCategories]);

  // Re-apply type & cuisine when DB-driven options load (race condition fix)
  useEffect(() => {
    if (!loadedData) return;
    if (typeRef.current && loadedData.fields.type) {
      typeRef.current.value = loadedData.fields.type;
    }
    if (cuisineRef.current && loadedData.fields.cuisineType) {
      cuisineRef.current.value = loadedData.fields.cuisineType;
    }
  }, [businessTypeOptions, cuisineOptions, loadedData]);

  // Grouped suggestions filtered by input text (show all when focused with empty input)
  const groupedSuggestions = useMemo(() => {
    if (!tagInputFocused || !visibleCategories.length) return [] as { category: string; icon: string; tags: string[] }[];
    const lower = tagInput.toLowerCase();
    const tagsLower = new Set(tags.map(t => t.toLowerCase()));
    const groups: { category: string; icon: string; tags: string[] }[] = [];
    for (const cat of visibleCategories) {
      const matching = cat.tags
        .filter(t => {
          if (tagsLower.has(t.name.toLowerCase())) return false; // already added
          if (!lower) return true; // no filter text — show all
          return t.name.toLowerCase().includes(lower);
        })
        .map(t => t.name);
      if (matching.length > 0) {
        groups.push({ category: cat.name, icon: cat.icon, tags: matching.slice(0, 8) });
      }
    }
    return groups;
  }, [tagInput, tagInputFocused, tags, visibleCategories]);

  const hasSuggestions = groupedSuggestions.some(g => g.tags.length > 0);

  // ============================================================================
  // Team Members
  // ============================================================================
  const fetchTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) return;
      setCurrentUserId(session.user?.id ?? null);
      const res = await fetch(`/api/businesses/${businessId}/team`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.members ?? []);
        setCallerRole(data.caller_role ?? "staff");
      }
    } catch {
      // silent — non-critical
    } finally {
      setTeamLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleAddMember = async () => {
    if (!addEmail.trim()) return;
    setTeamActionLoading(true);
    setTeamError(null);
    setTeamSuccess(null);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(`/api/businesses/${businessId}/team`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: addEmail.trim(), role: addRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTeamError(data.error || "Failed to add member.");
        return;
      }
      setTeamSuccess(`${addEmail.trim()} added as ${addRole}.`);
      setAddEmail("");
      setAddRole("staff");
      fetchTeam();
    } catch {
      setTeamError("Something went wrong. Please try again.");
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: "manager" | "staff") => {
    setTeamActionLoading(true);
    setTeamError(null);
    setTeamSuccess(null);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(`/api/businesses/${businessId}/team`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTeamError(data.error || "Failed to update role.");
        return;
      }
      setTeamSuccess("Role updated.");
      fetchTeam();
    } catch {
      setTeamError("Something went wrong. Please try again.");
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setTeamActionLoading(true);
    setTeamError(null);
    setTeamSuccess(null);
    setConfirmRemoveId(null);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(`/api/businesses/${businessId}/team`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTeamError(data.error || "Failed to remove member.");
        return;
      }
      setTeamSuccess("Team member removed.");
      fetchTeam();
    } catch {
      setTeamError("Something went wrong. Please try again.");
    } finally {
      setTeamActionLoading(false);
    }
  };

  // Chain link request handler
  const handleChainLinkRequest = async () => {
    if (!chainCodeInput.trim() || !storeNumberInput.trim()) {
      setChainLinkError("Both chain code and store number are required");
      return;
    }
    setChainLinkLoading(true);
    setChainLinkError(null);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/chains/link-request", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, chainCode: chainCodeInput.trim(), storeNumber: storeNumberInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChainLinkError(data.error || "Failed to submit request");
        return;
      }
      setChainLinkStatus("pending");
      setChainCodeInput("");
      setStoreNumberInput("");
    } catch {
      setChainLinkError("Something went wrong. Please try again.");
    } finally {
      setChainLinkLoading(false);
    }
  };

  const isOwner = callerRole === "owner" || callerRole === "admin";

  // ============================================================================
  // Styles
  // ============================================================================
  const cardStyle: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.03)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "16px",
    padding: "2rem",
  };

  const cardTitleStyle: React.CSSProperties = {
    fontSize: "1.25rem",
    fontWeight: 900,
    marginBottom: "1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.875rem",
    fontWeight: 600,
    marginBottom: "0.5rem",
    color: "rgba(255, 255, 255, 0.7)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.875rem",
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    color: "white",
    fontSize: "0.875rem",
    fontFamily: "inherit",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
  };

  const optionStyle: React.CSSProperties = {
    background: "#0f172a",
    color: "white",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: "100px",
    resize: "vertical",
  };

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Info Banner */}
      <div
        style={{
          padding: "0.9rem 1rem",
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.10)",
          borderRadius: "12px",
          color: "rgba(255,255,255,0.9)",
          fontSize: "0.875rem",
          fontWeight: 600,
          lineHeight: 1.5,
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
        }}
      >
        <AlertCircle size={16} style={{ color: colors.warning, flexShrink: 0 }} />
        <span>
          Edits are local-only. Nothing is saved until you click <strong>"Publish Changes"</strong> in the header.
        </span>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ ...cardStyle, textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
          Loading business profile…
        </div>
      )}

      {/* Error State */}
      {loadError && (
        <div
          style={{
            ...cardStyle,
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(239, 68, 68, 0.30)",
            color: "rgba(255,255,255,0.9)",
          }}
        >
          <strong>Error:</strong> {loadError}
        </div>
      )}

      {/* Form - ALWAYS render when not loading (so refs exist) */}
      {!loading && !loadError && (
        <>
          <div style={cardStyle}>
            <div style={cardTitleStyle}>
              <Settings size={20} style={{ color: colors.primary }} />
              Business Information
            </div>

            <div style={{ display: "grid", gap: "1.5rem" }}>
              {/* Name & Type */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1.5rem" }}>
                <div>
                  <label style={labelStyle}>Business Name</label>
                  <input
                    ref={nameRef}
                    defaultValue=""
                    readOnly
                    style={{
                      ...inputStyle,
                      opacity: 0.6,
                      cursor: "not-allowed",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  />
                  <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.45)" }}>
                    To change your business name, please contact LetsGo customer service.
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Business Type</label>
                  <select ref={typeRef} defaultValue="restaurant_bar" onChange={(e) => setSelectedBusinessType(e.target.value)} style={selectStyle}>
                    {businessTypeOptions.map(opt => (
                      <option key={opt.value} style={optionStyle} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label style={labelStyle}>Street Address</label>
                <input
                  ref={streetRef}
                  defaultValue=""
                  placeholder="Start typing for suggestions..."
                  onFocus={() => initGoogleAutocomplete()}
                  style={inputStyle}
                />
                <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                  Google Places autocomplete will fill City/State/Zip when you select an address.
                </div>
              </div>

              {/* City / State / Zip */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: "1.5rem" }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input ref={cityRef} defaultValue="" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <select ref={stateRef} defaultValue="NE" style={selectStyle}>
                    {STATES.map((abbr) => (
                      <option key={abbr} style={optionStyle} value={abbr}>{abbr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Zip Code</label>
                  <input ref={zipRef} defaultValue="" style={inputStyle} />
                </div>
              </div>

              {/* Phone / Email / Website */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "1.5rem" }}>
                <div>
                  <label style={labelStyle}>Business Phone</label>
                  <input 
                    ref={phoneRef} 
                    defaultValue="" 
                    placeholder="(555) 123-4567" 
                    style={inputStyle}
                    onChange={() => handlePhoneChange(phoneRef)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Contact Email</label>
                  <input ref={emailRef} defaultValue="" placeholder="info@business.com" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Website</label>
                  <input ref={websiteRef} defaultValue="" placeholder="https://..." style={inputStyle} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description / Vibe</label>
                <textarea
                  ref={descRef}
                  defaultValue=""
                  placeholder="Tell customers what makes your business special..."
                  style={textareaStyle}
                />
              </div>

              {/* Cuisine / Price / Age */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "1.5rem" }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select ref={cuisineRef} defaultValue="Other" style={selectStyle}>
                    {cuisineOptions.map(opt => (
                      <option key={opt.value} style={optionStyle} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Price Level</label>
                  <select ref={priceRef} defaultValue="$$" style={selectStyle}>
                    <option style={optionStyle} value="$">$ (Under $15/person)</option>
                    <option style={optionStyle} value="$$">$$ ($15–$30/person)</option>
                    <option style={optionStyle} value="$$$">$$$ ($30–$60/person)</option>
                    <option style={optionStyle} value="$$$$">$$$$ ($60+/person)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Age Restriction</label>
                  <select ref={ageRef} defaultValue="all" style={selectStyle}>
                    <option style={optionStyle} value="all">All Ages</option>
                    <option style={optionStyle} value="18">18+</option>
                    <option style={optionStyle} value="21">21+</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Hours Card */}
          <div style={cardStyle}>
            <div style={cardTitleStyle}>
              <Clock size={20} style={{ color: colors.accent }} />
              Operating Hours
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              {DAYS.map(({ key, label }) => {
                const dayHours = hours[key];
                const isClosed = dayHours.open === "Closed";

                return (
                  <div
                    key={key}
                    style={isMobile ? {
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                      padding: "0.75rem",
                      background: "rgba(255,255,255,0.02)",
                      borderRadius: "8px",
                    } : {
                      display: "grid",
                      gridTemplateColumns: "120px 100px 1fr",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "0.75rem",
                      background: "rgba(255,255,255,0.02)",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontWeight: 600, minWidth: isMobile ? "80px" : undefined }}>{label}</span>
                      {isMobile && (
                        <button
                          type="button"
                          onClick={() => toggleDayClosed(key)}
                          style={{
                            padding: "0.5rem 0.75rem",
                            background: isClosed ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                            border: `1px solid ${isClosed ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)"}`,
                            borderRadius: "6px",
                            color: "white",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {isClosed ? "Closed" : "Open"}
                        </button>
                      )}
                    </div>
                    {!isMobile && (
                      <button
                        type="button"
                        onClick={() => toggleDayClosed(key)}
                        style={{
                          padding: "0.5rem 0.75rem",
                          background: isClosed ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                          border: `1px solid ${isClosed ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)"}`,
                          borderRadius: "6px",
                          color: "white",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {isClosed ? "Closed" : "Open"}
                      </button>
                    )}
                    {!isClosed && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input
                          type="time"
                          value={dayHours.open}
                          onChange={(e) => updateHours(key, "open", e.target.value)}
                          style={{ ...inputStyle, width: "auto", padding: "0.5rem" }}
                        />
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>to</span>
                        <input
                          type="time"
                          value={dayHours.close}
                          onChange={(e) => updateHours(key, "close", e.target.value)}
                          style={{ ...inputStyle, width: "auto", padding: "0.5rem" }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tags Card */}
          <div style={{ ...cardStyle, overflow: "visible", position: "relative", zIndex: 10 }}>
            <div style={cardTitleStyle}>
              <Tag size={20} style={{ color: colors.secondary }} />
              Tags & Keywords
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 0.75rem",
                    background: `${colors.primary}20`,
                    border: `1px solid ${colors.primary}40`,
                    borderRadius: "20px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(idx)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                    }}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.875rem" }}>
                  No tags yet. Add some below.
                </span>
              )}
            </div>

            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onFocus={() => setTagInputFocused(true)}
                onBlur={() => setTimeout(() => setTagInputFocused(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder="Click to browse tags or type to search..."
                style={inputStyle}
              />
              {hasSuggestions && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    marginTop: "4px",
                    zIndex: 50,
                    overflow: "hidden",
                    maxHeight: "350px",
                    overflowY: "auto",
                  }}
                >
                  {groupedSuggestions.map((group) => (
                    <div key={group.category}>
                      <div
                        style={{
                          padding: "0.5rem 1rem",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "rgba(255,255,255,0.45)",
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {group.icon} {group.category}
                      </div>
                      {group.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addTag(tag)}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "0.6rem 1rem 0.6rem 1.5rem",
                            background: "transparent",
                            border: "none",
                            color: "white",
                            textAlign: "left",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Representative Info Card */}
          <div style={cardStyle}>
            <div style={cardTitleStyle}>
              <User size={20} style={{ color: colors.success }} />
              Business Representative
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1.5rem" }}>
              <div>
                <label style={labelStyle}>Representative Name</label>
                <input ref={repNameRef} defaultValue="" placeholder="John Smith" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Title / Role</label>
                <input ref={repTitleRef} defaultValue="" placeholder="General Manager" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Representative Email</label>
                <input ref={repEmailRef} defaultValue="" placeholder="john@business.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Representative Phone</label>
                <input 
                  ref={repPhoneRef} 
                  defaultValue="" 
                  placeholder="(555) 123-4567" 
                  style={inputStyle}
                  onChange={() => handlePhoneChange(repPhoneRef)}
                />
              </div>
            </div>
          </div>

          {/* Chain Affiliation Card */}
          <div style={cardStyle}>
            <div style={cardTitleStyle}>
              <Settings size={20} style={{ color: colors.accent }} />
              Chain Affiliation
            </div>

            {chainId ? (
              // Already linked to a chain
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "12px" }}>
                  <CheckCircle size={20} style={{ color: colors.success, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Linked to {chainBrandName}</div>
                    <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Store #{storeNumber} &bull; {chainId}</div>
                  </div>
                </div>
              </div>
            ) : chainLinkStatus === "pending" ? (
              // Pending request
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "12px" }}>
                <AlertCircle size={20} style={{ color: colors.warning, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Link request pending</div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Waiting for corporate approval</div>
                </div>
              </div>
            ) : (
              // No chain — show link form (owners only)
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>
                  If your business belongs to a chain, enter the chain code provided by corporate to request linking.
                </div>
                {isOwner && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <div>
                        <label style={labelStyle}>Chain Code</label>
                        <input
                          value={chainCodeInput}
                          onChange={(e) => setChainCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                          placeholder="e.g. SCOOTERS"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Store Number</label>
                        <input
                          value={storeNumberInput}
                          onChange={(e) => setStoreNumberInput(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="e.g. 147"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    {chainLinkError && (
                      <div style={{ padding: "0.5rem 0.75rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: "0.8rem", color: colors.danger }}>
                        {chainLinkError}
                      </div>
                    )}
                    <button
                      onClick={handleChainLinkRequest}
                      disabled={chainLinkLoading || !chainCodeInput || !storeNumberInput}
                      style={{
                        padding: "0.75rem 1.25rem", borderRadius: 10, border: "none", fontWeight: 700, fontSize: "0.85rem",
                        background: chainCodeInput && storeNumberInput ? `linear-gradient(135deg, ${colors.accent}, ${colors.primary})` : "rgba(255,255,255,0.05)",
                        color: chainCodeInput && storeNumberInput ? "#fff" : "rgba(255,255,255,0.3)",
                        cursor: chainCodeInput && storeNumberInput ? "pointer" : "not-allowed",
                        width: "fit-content",
                      }}
                    >
                      {chainLinkLoading ? "Submitting..." : "Request Chain Link"}
                    </button>
                  </>
                )}
                {!isOwner && (
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>
                    Only business owners can request chain linking.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Team Members Card */}
          <div style={cardStyle}>
            <div style={cardTitleStyle}>
              <Users size={20} style={{ color: colors.accent }} />
              Team Members
            </div>

            {teamLoading ? (
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem" }}>Loading team...</div>
            ) : (
              <div style={{ display: "grid", gap: "1rem" }}>
                {/* Error / Success messages */}
                {teamError && (
                  <div style={{
                    padding: "0.75rem 1rem",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "8px",
                    color: "#fca5a5",
                    fontSize: "0.875rem",
                  }}>
                    {teamError}
                  </div>
                )}
                {teamSuccess && (
                  <div style={{
                    padding: "0.75rem 1rem",
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: "8px",
                    color: "#6ee7b7",
                    fontSize: "0.875rem",
                  }}>
                    {teamSuccess}
                  </div>
                )}

                {/* Member list */}
                {teamMembers.length === 0 ? (
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem" }}>
                    No team members found.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    {teamMembers.map((m) => {
                      const isMe = m.user_id === currentUserId;
                      const pwOpen = showPasswordFor === m.user_id;
                      return (
                        <div
                          key={m.user_id}
                          style={{
                            background: "rgba(255, 255, 255, 0.02)",
                            borderRadius: "8px",
                            border: "1px solid rgba(255, 255, 255, 0.06)",
                          }}
                        >
                          {/* Main row */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: isMobile ? "flex-start" : "center",
                              flexDirection: isMobile ? "column" : "row",
                              gap: isMobile ? "0.5rem" : "1rem",
                              padding: "0.875rem 1rem",
                            }}
                          >
                            {/* Name & Email */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "white", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                {m.full_name || m.email}
                                {isMe && (
                                  <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>(you)</span>
                                )}
                              </div>
                              {m.full_name && (
                                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                                  {m.email}
                                </div>
                              )}
                            </div>

                            {/* Role badge / selector */}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              {m.role === "owner" ? (
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                  padding: "0.25rem 0.75rem",
                                  borderRadius: "9999px",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  background: `${colors.accent}22`,
                                  color: colors.accent,
                                  border: `1px solid ${colors.accent}44`,
                                }}>
                                  <Shield size={12} /> Owner
                                </span>
                              ) : isOwner ? (
                                <select
                                  value={m.role}
                                  onChange={(e) => handleChangeRole(m.user_id, e.target.value as "manager" | "staff")}
                                  disabled={teamActionLoading}
                                  style={{
                                    ...selectStyle,
                                    width: "auto",
                                    padding: "0.25rem 0.5rem",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  <option value="manager" style={optionStyle}>Manager</option>
                                  <option value="staff" style={optionStyle}>Staff</option>
                                </select>
                              ) : (
                                <span style={{
                                  padding: "0.25rem 0.75rem",
                                  borderRadius: "9999px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  background: m.role === "manager"
                                    ? `${colors.primary}22`
                                    : `${colors.secondary}22`,
                                  color: m.role === "manager" ? colors.primary : colors.secondary,
                                  border: `1px solid ${m.role === "manager" ? colors.primary : colors.secondary}44`,
                                }}>
                                  {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                                </span>
                              )}

                              {/* Date added */}
                              <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
                                {m.created_at ? new Date(m.created_at).toLocaleDateString() : ""}
                              </span>

                              {/* Change password toggle (only for current user) */}
                              {isMe && (
                                <button
                                  onClick={() => {
                                    setShowPasswordFor(pwOpen ? null : m.user_id);
                                    setCurrentPassword("");
                                    setNewPassword("");
                                    setConfirmPassword("");
                                    setPasswordMsg(null);
                                  }}
                                  title="Change password"
                                  style={{
                                    padding: "0.25rem 0.5rem",
                                    borderRadius: "6px",
                                    border: `1px solid ${pwOpen ? colors.warning : "rgba(255,255,255,0.15)"}`,
                                    background: pwOpen ? `${colors.warning}15` : "transparent",
                                    color: pwOpen ? colors.warning : "rgba(255,255,255,0.4)",
                                    fontSize: "0.7rem",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {pwOpen ? "Cancel" : "Password"}
                                </button>
                              )}

                              {/* Remove button */}
                              {isOwner && m.role !== "owner" && (
                                <>
                                  {confirmRemoveId === m.user_id ? (
                                    <div style={{ display: "flex", gap: "0.25rem" }}>
                                      <button
                                        onClick={() => handleRemoveMember(m.user_id)}
                                        disabled={teamActionLoading}
                                        style={{
                                          padding: "0.25rem 0.5rem",
                                          borderRadius: "6px",
                                          border: "none",
                                          background: colors.danger,
                                          color: "white",
                                          fontSize: "0.7rem",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                        }}
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setConfirmRemoveId(null)}
                                        style={{
                                          padding: "0.25rem 0.5rem",
                                          borderRadius: "6px",
                                          border: "1px solid rgba(255,255,255,0.15)",
                                          background: "transparent",
                                          color: "rgba(255,255,255,0.6)",
                                          fontSize: "0.7rem",
                                          cursor: "pointer",
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmRemoveId(m.user_id)}
                                      title="Remove member"
                                      style={{
                                        padding: "0.25rem",
                                        borderRadius: "6px",
                                        border: "none",
                                        background: "transparent",
                                        color: "rgba(255,255,255,0.3)",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Inline password change (expands below row) */}
                          {isMe && pwOpen && (
                            <div style={{
                              padding: "0.75rem 1rem 1rem",
                              borderTop: "1px solid rgba(255,255,255,0.06)",
                            }}>
                              <div style={{
                                display: "grid",
                                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr auto",
                                gap: "0.75rem",
                                alignItems: "end",
                              }}>
                                <div>
                                  <label style={{ ...labelStyle, fontSize: "0.75rem", marginBottom: "0.25rem" }}>Current Password</label>
                                  <input
                                    type="password"
                                    placeholder="Current"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    style={{ ...inputStyle, padding: "0.625rem 0.75rem", fontSize: "0.8rem" }}
                                  />
                                </div>
                                <div>
                                  <label style={{ ...labelStyle, fontSize: "0.75rem", marginBottom: "0.25rem" }}>New Password</label>
                                  <input
                                    type="password"
                                    placeholder="New (min 6 chars)"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    style={{ ...inputStyle, padding: "0.625rem 0.75rem", fontSize: "0.8rem" }}
                                  />
                                </div>
                                <div>
                                  <label style={{ ...labelStyle, fontSize: "0.75rem", marginBottom: "0.25rem" }}>Confirm New</label>
                                  <input
                                    type="password"
                                    placeholder="Repeat new"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    style={{ ...inputStyle, padding: "0.625rem 0.75rem", fontSize: "0.8rem" }}
                                  />
                                </div>
                                <button
                                  type="button"
                                  disabled={passwordSaving || !currentPassword || !newPassword}
                                  onClick={handleChangePassword}
                                  style={{
                                    padding: "0.625rem 1rem",
                                    borderRadius: "8px",
                                    border: "none",
                                    background: passwordSaving || !currentPassword || !newPassword ? "rgba(255,255,255,0.1)" : colors.warning,
                                    color: passwordSaving || !currentPassword || !newPassword ? "rgba(255,255,255,0.4)" : "#000",
                                    fontWeight: 700,
                                    fontSize: "0.8rem",
                                    cursor: passwordSaving || !currentPassword || !newPassword ? "not-allowed" : "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {passwordSaving ? "Saving..." : "Update"}
                                </button>
                              </div>
                              {passwordMsg && (
                                <div style={{
                                  marginTop: "0.5rem",
                                  fontSize: "0.75rem",
                                  color: passwordMsg.startsWith("Error") ? colors.danger : colors.success,
                                }}>
                                  {passwordMsg}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Member Form (owners only) */}
                {isOwner && (
                  <div style={{
                    marginTop: "0.5rem",
                    padding: "1rem",
                    background: "rgba(255, 255, 255, 0.02)",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <UserPlus size={16} /> Add Team Member
                    </div>
                    <div style={{
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      gap: "0.75rem",
                      alignItems: isMobile ? "stretch" : "flex-end",
                    }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Email Address</label>
                        <input
                          type="email"
                          value={addEmail}
                          onChange={(e) => { setAddEmail(e.target.value); setTeamError(null); setTeamSuccess(null); }}
                          placeholder="team@example.com"
                          style={inputStyle}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddMember(); }}
                        />
                      </div>
                      <div style={{ width: isMobile ? "100%" : "140px" }}>
                        <label style={labelStyle}>Role</label>
                        <select
                          value={addRole}
                          onChange={(e) => setAddRole(e.target.value as "manager" | "staff")}
                          style={selectStyle}
                        >
                          <option value="staff" style={optionStyle}>Staff</option>
                          <option value="manager" style={optionStyle}>Manager</option>
                        </select>
                      </div>
                      <button
                        onClick={handleAddMember}
                        disabled={teamActionLoading || !addEmail.trim()}
                        style={{
                          padding: "0.875rem 1.5rem",
                          borderRadius: "8px",
                          border: "none",
                          background: teamActionLoading || !addEmail.trim() ? "rgba(255,255,255,0.1)" : colors.accent,
                          color: "white",
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          cursor: teamActionLoading || !addEmail.trim() ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {teamActionLoading ? "Adding..." : "Add Member"}
                      </button>
                    </div>
                    <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
                      The person must already have a LetsGo account.
                    </div>
                  </div>
                )}

                {/* Solo owner empty state */}
                {teamMembers.length === 1 && teamMembers[0].role === "owner" && isOwner && (
                  <div style={{
                    fontSize: "0.8rem",
                    color: "rgba(255,255,255,0.4)",
                    fontStyle: "italic",
                  }}>
                    You&apos;re the only team member. Add others to give them access to this dashboard.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Account Actions Card */}
          <div style={cardStyle}>
            <div style={{ ...cardTitleStyle, color: colors.danger }}>
              <AlertCircle size={20} style={{ color: colors.danger }} />
              Account Actions
            </div>

            {/* Warning Box */}
            <div
              style={{
                background: "rgba(239, 68, 68, 0.05)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "12px",
                padding: "1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "rgba(255, 255, 255, 0.7)" }}>
                <strong>Warning:</strong> These actions will affect your account status. Please review carefully before proceeding.
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  padding: "0.875rem 1.5rem",
                  background: `${colors.success}20`,
                  border: `1px solid ${colors.success}`,
                  borderRadius: "8px",
                  color: colors.success,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.success;
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${colors.success}20`;
                  e.currentTarget.style.color = colors.success;
                }}
                onClick={() => alert("Reinstate account functionality coming soon!")}
              >
                <CheckCircle size={16} />
                Reinstate Account
              </button>

              <button
                type="button"
                style={{
                  padding: "0.875rem 1.5rem",
                  background: `${colors.warning}20`,
                  border: `1px solid ${colors.warning}`,
                  borderRadius: "8px",
                  color: colors.warning,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.warning;
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${colors.warning}20`;
                  e.currentTarget.style.color = colors.warning;
                }}
                onClick={() => alert("Put account on hold functionality coming soon!")}
              >
                <Clock size={16} />
                Put Account on Hold
              </button>

              <button
                type="button"
                style={{
                  padding: "0.875rem 1.5rem",
                  background: `${colors.danger}20`,
                  border: `1px solid ${colors.danger}`,
                  borderRadius: "8px",
                  color: colors.danger,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.danger;
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${colors.danger}20`;
                  e.currentTarget.style.color = colors.danger;
                }}
                onClick={() => alert("Delete account functionality coming soon!")}
              >
                <AlertCircle size={16} />
                Delete Account
              </button>
            </div>

            {/* Help Text */}
            <div
              style={{
                fontSize: "0.75rem",
                color: "rgba(255, 255, 255, 0.5)",
                marginTop: "1rem",
                lineHeight: 1.5,
              }}
            >
              <strong>Put on Hold:</strong> Temporarily pause your account. Your profile will be hidden from users until reactivated.
              <br />
              <strong>Delete Account:</strong> Permanently delete your account and all associated data. This action cannot be undone.
            </div>
          </div>
        </>
      )}
    </div>
  );
}