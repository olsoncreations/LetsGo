"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { COLORS } from "@/components/admin/constants";
import {
  Card,
  StatCard,
  SectionTitle,
  Badge,
  DataTable,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";
import { fetchTagsByCategory } from "@/lib/availableTags";
import { useStaffContext } from "@/components/admin/StaffContext";

// ==================== TYPES ====================

interface SalesLead {
  id: string;
  google_place_id: string;
  business_name: string;
  business_type: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  google_rating: number | null;
  google_price_level: number | null;
  google_total_ratings: number | null;
  status: string;
  assigned_rep_id: string | null;
  imported_by: string | null;
  last_contacted_at: string | null;
  search_query: string | null;
  search_location: string | null;
  preview_business_id: string | null;
  email: string | null;
  email_source: string | null;
  unsubscribed_at: string | null;
  scrape_attempts: number;
  outreach_status: string | null;
  outreach_sent_at: string | null;
  outreach_opened_at: string | null;
  outreach_clicked_at: string | null;
  outreach_count: number;
  created_at: string;
  updated_at: string;
}

interface OutreachEmail {
  id: string;
  template: string;
  subject: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  sent_by: string | null;
}

interface LeadNote {
  id: string;
  lead_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
}

interface SalesAppointment {
  id: string;
  lead_id: string;
  assigned_rep_id: string | null;
  scheduled_at: string;
  duration_min: number;
  location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface GooglePlaceResult {
  google_place_id: string;
  business_name: string;
  business_type: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  latitude: number | null;
  longitude: number | null;
  google_rating: number | null;
  google_total_ratings: number | null;
  google_price_level: number | null;
  google_types: string[];
}

interface SalesRep {
  id: string;
  name: string;
  zone_id: string | null;
  status: string;
}

interface ProspectingProps {
  salesReps: SalesRep[];
}

// ==================== CONSTANTS ====================

const STATUS_OPTIONS = [
  { value: "not_contacted", label: "Not Contacted" },
  { value: "contacted", label: "Contacted" },
  { value: "pitched", label: "Pitched" },
  { value: "follow_up", label: "Follow Up" },
  { value: "signed_up", label: "Signed Up" },
  { value: "declined", label: "Declined" },
  { value: "not_interested", label: "Not Interested" },
];

// Default type options — replaced by DB-driven tags on mount
const DEFAULT_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "restaurant_bar", label: "Restaurants & Bars" },
  { value: "activity", label: "Activities" },
  { value: "salon_beauty", label: "Salons & Beauty" },
  { value: "other", label: "Other" },
];

const PRICE_LABELS = ["Free", "$", "$$", "$$$", "$$$$"];

// Google Place types for comprehensive prospecting searches
// Each type becomes a unique search query to maximize coverage
const GOOGLE_PLACE_TYPES: { type: string; label: string; category: string }[] = [
  // --- Restaurants (by cuisine) ---
  { type: "american_restaurant", label: "American Restaurant", category: "Restaurant" },
  { type: "asian_restaurant", label: "Asian Restaurant", category: "Restaurant" },
  { type: "barbecue_restaurant", label: "BBQ Restaurant", category: "Restaurant" },
  { type: "brazilian_restaurant", label: "Brazilian Restaurant", category: "Restaurant" },
  { type: "breakfast_restaurant", label: "Breakfast Restaurant", category: "Restaurant" },
  { type: "brunch_restaurant", label: "Brunch Restaurant", category: "Restaurant" },
  { type: "buffet_restaurant", label: "Buffet Restaurant", category: "Restaurant" },
  { type: "cajun_restaurant", label: "Cajun Restaurant", category: "Restaurant" },
  { type: "caribbean_restaurant", label: "Caribbean Restaurant", category: "Restaurant" },
  { type: "chicken_restaurant", label: "Chicken Restaurant", category: "Restaurant" },
  { type: "chinese_restaurant", label: "Chinese Restaurant", category: "Restaurant" },
  { type: "cuban_restaurant", label: "Cuban Restaurant", category: "Restaurant" },
  { type: "diner", label: "Diner", category: "Restaurant" },
  { type: "ethiopian_restaurant", label: "Ethiopian Restaurant", category: "Restaurant" },
  { type: "family_restaurant", label: "Family Restaurant", category: "Restaurant" },
  { type: "fast_food_restaurant", label: "Fast Food", category: "Restaurant" },
  { type: "fine_dining_restaurant", label: "Fine Dining", category: "Restaurant" },
  { type: "french_restaurant", label: "French Restaurant", category: "Restaurant" },
  { type: "german_restaurant", label: "German Restaurant", category: "Restaurant" },
  { type: "greek_restaurant", label: "Greek Restaurant", category: "Restaurant" },
  { type: "hamburger_restaurant", label: "Burger Restaurant", category: "Restaurant" },
  { type: "indian_restaurant", label: "Indian Restaurant", category: "Restaurant" },
  { type: "italian_restaurant", label: "Italian Restaurant", category: "Restaurant" },
  { type: "japanese_restaurant", label: "Japanese Restaurant", category: "Restaurant" },
  { type: "korean_restaurant", label: "Korean Restaurant", category: "Restaurant" },
  { type: "latin_american_restaurant", label: "Latin American Restaurant", category: "Restaurant" },
  { type: "lebanese_restaurant", label: "Lebanese Restaurant", category: "Restaurant" },
  { type: "mediterranean_restaurant", label: "Mediterranean Restaurant", category: "Restaurant" },
  { type: "mexican_restaurant", label: "Mexican Restaurant", category: "Restaurant" },
  { type: "middle_eastern_restaurant", label: "Middle Eastern Restaurant", category: "Restaurant" },
  { type: "peruvian_restaurant", label: "Peruvian Restaurant", category: "Restaurant" },
  { type: "pizza_restaurant", label: "Pizza Restaurant", category: "Restaurant" },
  { type: "ramen_restaurant", label: "Ramen Restaurant", category: "Restaurant" },
  { type: "restaurant", label: "Restaurant (General)", category: "Restaurant" },
  { type: "seafood_restaurant", label: "Seafood Restaurant", category: "Restaurant" },
  { type: "soul_food_restaurant", label: "Soul Food Restaurant", category: "Restaurant" },
  { type: "spanish_restaurant", label: "Spanish Restaurant", category: "Restaurant" },
  { type: "steak_house", label: "Steak House", category: "Restaurant" },
  { type: "sushi_restaurant", label: "Sushi Restaurant", category: "Restaurant" },
  { type: "thai_restaurant", label: "Thai Restaurant", category: "Restaurant" },
  { type: "turkish_restaurant", label: "Turkish Restaurant", category: "Restaurant" },
  { type: "vegan_restaurant", label: "Vegan Restaurant", category: "Restaurant" },
  { type: "vegetarian_restaurant", label: "Vegetarian Restaurant", category: "Restaurant" },
  { type: "vietnamese_restaurant", label: "Vietnamese Restaurant", category: "Restaurant" },
  // --- Cafes, Bakeries, Desserts ---
  { type: "bakery", label: "Bakery", category: "Bakery" },
  { type: "cafe", label: "Cafe", category: "Coffee" },
  { type: "coffee_shop", label: "Coffee Shop", category: "Coffee" },
  { type: "dessert_restaurant", label: "Dessert Restaurant", category: "Restaurant" },
  { type: "dessert_shop", label: "Dessert Shop", category: "Bakery" },
  { type: "donut_shop", label: "Donut Shop", category: "Bakery" },
  { type: "ice_cream_shop", label: "Ice Cream Shop", category: "Ice Cream" },
  { type: "juice_shop", label: "Juice Shop", category: "Juice Bar" },
  { type: "pastry_shop", label: "Pastry Shop", category: "Bakery" },
  { type: "tea_house", label: "Tea House", category: "Coffee" },
  // --- Bars & Nightlife ---
  { type: "bar", label: "Bar", category: "Bar" },
  { type: "bar_and_grill", label: "Bar & Grill", category: "Bar" },
  { type: "beer_garden", label: "Beer Garden", category: "Bar" },
  { type: "brewery", label: "Brewery", category: "Brewery" },
  { type: "brewpub", label: "Brewpub", category: "Brewery" },
  { type: "cocktail_bar", label: "Cocktail Bar", category: "Bar" },
  { type: "gastropub", label: "Gastropub", category: "Bar" },
  { type: "hookah_bar", label: "Hookah Bar", category: "Bar" },
  { type: "irish_pub", label: "Irish Pub", category: "Pub" },
  { type: "lounge_bar", label: "Lounge", category: "Lounge" },
  { type: "night_club", label: "Nightclub", category: "Nightclub" },
  { type: "pub", label: "Pub", category: "Pub" },
  { type: "sports_bar", label: "Sports Bar", category: "Bar" },
  { type: "wine_bar", label: "Wine Bar", category: "Winery" },
  { type: "winery", label: "Winery", category: "Winery" },
  // --- Food Shops & Delis ---
  { type: "deli", label: "Deli", category: "Deli" },
  { type: "sandwich_shop", label: "Sandwich Shop", category: "Deli" },
  { type: "food_court", label: "Food Court", category: "Restaurant" },
  { type: "meal_delivery", label: "Meal Delivery", category: "Food Truck" },
  { type: "meal_takeaway", label: "Meal Takeaway", category: "Food Truck" },
  // --- Entertainment & Activities ---
  { type: "amusement_center", label: "Amusement Center", category: "Entertainment" },
  { type: "amusement_park", label: "Amusement Park", category: "Entertainment" },
  { type: "aquarium", label: "Aquarium", category: "Activity" },
  { type: "bowling_alley", label: "Bowling Alley", category: "Bowling" },
  { type: "casino", label: "Casino", category: "Entertainment" },
  { type: "comedy_club", label: "Comedy Club", category: "Comedy Club" },
  { type: "concert_hall", label: "Concert Hall", category: "Entertainment" },
  { type: "escape_room", label: "Escape Room", category: "Escape Room" },
  { type: "go_karting_venue", label: "Go Karts", category: "Entertainment" },
  { type: "karaoke", label: "Karaoke", category: "Karaoke" },
  { type: "live_music_venue", label: "Live Music Venue", category: "Entertainment" },
  { type: "miniature_golf_course", label: "Mini Golf", category: "Mini Golf" },
  { type: "movie_theater", label: "Movie Theater", category: "Theater" },
  { type: "paintball_center", label: "Paintball", category: "Entertainment" },
  { type: "tourist_attraction", label: "Tourist Attraction", category: "Activity" },
  { type: "video_arcade", label: "Arcade", category: "Arcade" },
  { type: "zoo", label: "Zoo", category: "Activity" },
  // --- Arts & Culture ---
  { type: "art_gallery", label: "Art Gallery", category: "Art Gallery" },
  { type: "museum", label: "Museum", category: "Museum" },
  // --- Beauty & Wellness ---
  { type: "barber_shop", label: "Barber Shop", category: "Salon/Beauty" },
  { type: "beauty_salon", label: "Beauty Salon", category: "Salon/Beauty" },
  { type: "hair_salon", label: "Hair Salon", category: "Salon/Beauty" },
  { type: "nail_salon", label: "Nail Salon", category: "Salon/Beauty" },
  { type: "spa", label: "Spa", category: "Spa" },
  { type: "tanning_studio", label: "Tanning Studio", category: "Salon/Beauty" },
  { type: "yoga_studio", label: "Yoga Studio", category: "Yoga Studio" },
  // --- Fitness ---
  { type: "fitness_center", label: "Fitness Center", category: "Gym" },
  { type: "gym", label: "Gym", category: "Gym" },
  { type: "sports_club", label: "Sports Club", category: "Activity" },
  { type: "swimming_pool", label: "Swimming Pool", category: "Activity" },
  // --- Venues ---
  { type: "banquet_hall", label: "Banquet Hall", category: "Entertainment" },
  { type: "event_venue", label: "Event Venue", category: "Entertainment" },
  { type: "wedding_venue", label: "Wedding Venue", category: "Entertainment" },
];

const selectStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: COLORS.cardBg,
  border: "1px solid " + COLORS.cardBorder,
  borderRadius: 8,
  color: COLORS.textPrimary,
  fontSize: 13,
  outline: "none",
  minWidth: 140,
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  minWidth: 220,
};

// ==================== SEARCHABLE DROPDOWN ====================

function SearchableDropdown({
  label,
  value,
  onChange,
  options,
  placeholder = "Search...",
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search) return options;
    const s = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, search]);

  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>{label}</label>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); }}
        style={{
          ...selectStyle,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          cursor: "pointer", textAlign: "left", width: "100%",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
          {selectedLabel}
        </span>
        <span style={{ fontSize: 10, opacity: 0.5 }}>{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 50, marginTop: 4,
          background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 8,
          width: "100%", minWidth: 200, maxHeight: 280, display: "flex", flexDirection: "column",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <div style={{ padding: "8px 8px 4px" }}>
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: COLORS.textPrimary, outline: "none",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", maxHeight: 220, padding: "4px 0" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "12px 14px", fontSize: 12, color: COLORS.textSecondary }}>No results</div>
            ) : filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "8px 14px", fontSize: 13, cursor: "pointer",
                  background: o.value === value ? "rgba(0,212,255,0.15)" : "transparent",
                  color: o.value === value ? COLORS.neonBlue : COLORS.textPrimary,
                  border: "none", fontWeight: o.value === value ? 600 : 400,
                }}
                onMouseEnter={(e) => { if (o.value !== value) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { if (o.value !== value) e.currentTarget.style.background = "transparent"; }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "10px 20px",
  background: COLORS.gradient1,
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "8px 16px",
  background: COLORS.cardBg,
  border: "1px solid " + COLORS.cardBorder,
  borderRadius: 8,
  color: COLORS.textPrimary,
  fontSize: 12,
  cursor: "pointer",
};

// ==================== HELPERS ====================

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadXLSX(filename: string, headers: string[], rows: string[][]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.XLSX) {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => {
      const ws = w.XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = w.XLSX.utils.book_new();
      w.XLSX.utils.book_append_sheet(wb, ws, "Leads");
      w.XLSX.writeFile(wb, filename);
    };
    document.head.appendChild(script);
    return;
  }
  const ws = w.XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = w.XLSX.utils.book_new();
  w.XLSX.utils.book_append_sheet(wb, ws, "Leads");
  w.XLSX.writeFile(wb, filename);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function renderStars(rating: number | null): string {
  if (rating === null || rating === undefined) return "—";
  return `${rating.toFixed(1)} ★`;
}

// ==================== COMPONENT ====================

export default function SalesProspecting({ salesReps }: ProspectingProps) {
  const { can } = useStaffContext();
  // ---------- Search state ----------
  const locationInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [searchRadius, setSearchRadius] = useState("20");
  const [searchResults, setSearchResults] = useState<GooglePlaceResult[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [importedPlaceIds, setImportedPlaceIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [importingAll, setImportingAll] = useState(false);

  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // ---------- Staff role state ----------
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const canGenerate = staffRole === "admin" || staffRole === "manager";

  // ---------- Generate state ----------
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0, type: "", radius: 0, imported: 0, skipped: 0 });
  const generateAbortRef = React.useRef(false);

  // ---------- Business type state (DB-driven) ----------
  const [typeOptions, setTypeOptions] = useState(DEFAULT_TYPE_OPTIONS);
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({});

  // ---------- Leads state ----------
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [existingBusinessNames, setExistingBusinessNames] = useState<Set<string>>(new Set());

  // ---------- Filter state ----------
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRep, setFilterRep] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterCity, setFilterCity] = useState("all");
  const [filterState, setFilterState] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterRating, setFilterRating] = useState("all");
  const [filterHasWebsite, setFilterHasWebsite] = useState("all");
  const [filterHasPhone, setFilterHasPhone] = useState("all");
  const [filterHasPreview, setFilterHasPreview] = useState("all");
  const [filterContactFrom, setFilterContactFrom] = useState("");
  const [filterContactTo, setFilterContactTo] = useState("");
  const [filterOnApp, setFilterOnApp] = useState("all");

  // ---------- Modal state ----------
  const [selectedLead, setSelectedLead] = useState<SalesLead | null>(null);
  const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [creatingPreview, setCreatingPreview] = useState(false);

  // ---------- Email & Outreach state ----------
  const [editingContact, setEditingContact] = useState(false);
  const [editContactValues, setEditContactValues] = useState<{ phone: string; website: string; email: string; address: string; business_name: string; business_type: string }>({ phone: "", website: "", email: "", address: "", business_name: "", business_type: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [scrapingEmail, setScrapingEmail] = useState(false);
  const [outreachHistory, setOutreachHistory] = useState<OutreachEmail[]>([]);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("initial_outreach");
  const [bulkScraping, setBulkScraping] = useState(false);
  const [bulkScrapeProgress, setBulkScrapeProgress] = useState({ current: 0, total: 0, found: 0 });
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSendProgress, setBulkSendProgress] = useState({ current: 0, total: 0, sent: 0 });
  const [filterHasEmail, setFilterHasEmail] = useState("all");
  const [filterOutreach, setFilterOutreach] = useState("all");
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyProgress, setReclassifyProgress] = useState({ done: 0, total: 0, errors: 0 });

  // ---------- Appointment state ----------
  const [leadAppointment, setLeadAppointment] = useState<SalesAppointment | null>(null);
  const [apptLoading, setApptLoading] = useState(false);
  const [apptFormOpen, setApptFormOpen] = useState(false);
  const [apptSaving, setApptSaving] = useState(false);
  const [apptForm, setApptForm] = useState({ date: "", time: "", duration_min: 30, rep_id: "", location: "", notes: "" });

  // ---------- Data fetching ----------

  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/sales/prospect/leads", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      const leadsData = (data.leads || []) as SalesLead[];
      setLeads(leadsData);
      setImportedPlaceIds(new Set(leadsData.map((d) => d.google_place_id)));
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setLeadsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Fetch existing business names to flag leads already on the app
  // Excludes preview businesses (id starts with "preview-")
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabaseBrowser
          .from("business")
          .select("id, business_name, public_business_name");
        if (data) {
          const names = new Set<string>();
          data.forEach((b: { id: string; business_name?: string; public_business_name?: string }) => {
            if (b.id.startsWith("preview-")) return;
            if (b.business_name) names.add(b.business_name.trim().toLowerCase());
            if (b.public_business_name) names.add(b.public_business_name.trim().toLowerCase());
          });
          setExistingBusinessNames(names);
        }
      } catch (err) {
        console.error("Error fetching existing businesses:", err);
      }
    })();
  }, []);

  // Fetch current staff role via server-side API (bypasses RLS)
  useEffect(() => {
    async function loadStaffRole() {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const res = await fetch("/api/admin/sales/prospect/role", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.role) setStaffRole(data.role as string);
        }
      } catch (err) {
        console.error("Error fetching staff role:", err);
      }
    }
    loadStaffRole();
  }, []);

  // Google Places Autocomplete for location input (cities only)
  useEffect(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const g = (window as any).google;
    if (!g?.maps?.places?.Autocomplete || !locationInputRef.current) return;

    const ac = new g.maps.places.Autocomplete(locationInputRef.current, {
      types: ["(cities)"],
      fields: ["formatted_address", "name"],
      componentRestrictions: { country: "us" },
    });

    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const value = place?.formatted_address || place?.name || "";
      if (value) setSearchQuery(value);
    });

    return () => listener.remove();
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, []);

  // Fetch business types from DB tags table
  useEffect(() => {
    async function loadBusinessTypes() {
      try {
        const categories = await fetchTagsByCategory("business");
        const btCat = categories.find((c) => c.name === "Business Type");
        if (btCat && btCat.tags.length > 0) {
          const options = [
            { value: "all", label: "All Types" },
            ...btCat.tags.map((t) => ({ value: t.name, label: t.name })),
          ];
          const labels: Record<string, string> = {};
          btCat.tags.forEach((t) => { labels[t.name] = t.name; });
          setTypeOptions(options);
          setTypeLabels(labels);
        }
      } catch (err) {
        console.error("Error fetching business types:", err);
      }
    }
    loadBusinessTypes();
  }, []);

  const fetchNotes = useCallback(async (leadId: string) => {
    setNotesLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/sales/prospect/notes?leadId=${leadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch notes");
      const data = await res.json();
      setLeadNotes((data.notes || []) as LeadNote[]);
    } catch (err) {
      console.error("Error fetching notes:", err);
    } finally {
      setNotesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Outreach handlers ----------

  const fetchOutreachHistory = useCallback(async (leadId: string) => {
    setOutreachLoading(true);
    try {
      const token = await getAuthTokenCb();
      const res = await fetch(`/api/admin/sales/prospect/outreach?leadId=${leadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOutreachHistory((data.emails || []) as OutreachEmail[]);
      }
    } catch (err) {
      console.error("Error fetching outreach:", err);
    } finally {
      setOutreachLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getAuthTokenCb(): Promise<string> {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    return session?.access_token || "";
  }

  function startEditingContact(lead: SalesLead) {
    setEditingContact(true);
    setEditContactValues({
      phone: lead.phone || "",
      website: lead.website || "",
      email: lead.email || "",
      address: lead.address || "",
      business_name: lead.business_name || "",
      business_type: lead.business_type || "",
    });
  }

  async function handleSaveContact(leadId: string) {
    setSavingContact(true);
    try {
      const token = await getAuthTokenCb();
      const updates: Record<string, unknown> = {
        business_name: editContactValues.business_name.trim() || null,
        business_type: editContactValues.business_type.trim() || null,
        phone: editContactValues.phone.trim() || null,
        website: editContactValues.website.trim() || null,
        email: editContactValues.email.trim() || null,
        address: editContactValues.address.trim() || null,
      };
      // Track email source if email changed
      const oldEmail = selectedLead?.email || "";
      if (editContactValues.email.trim() !== oldEmail) {
        updates.email_source = editContactValues.email.trim() ? "manual" : null;
      }

      const res = await fetch("/api/admin/sales/prospect/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: leadId, updates }),
      });
      if (res.ok) {
        const updatedFields = {
          business_name: editContactValues.business_name.trim() || "",
          business_type: editContactValues.business_type.trim() || null,
          phone: editContactValues.phone.trim() || null,
          website: editContactValues.website.trim() || null,
          email: editContactValues.email.trim() || null,
          address: editContactValues.address.trim() || null,
          ...(editContactValues.email.trim() !== oldEmail ? { email_source: editContactValues.email.trim() ? "manual" : null } : {}),
        };
        setSelectedLead((prev) => prev ? { ...prev, ...updatedFields } : null);
        setLeads((prev) => prev.map((l) => l.id !== leadId ? l : { ...l, ...updatedFields }));
        setEditingContact(false);
      }
    } catch (err) {
      console.error("Save contact error:", err);
    } finally {
      setSavingContact(false);
    }
  }

  async function handleScrapeEmail(leadId: string) {
    setScrapingEmail(true);
    try {
      const token = await getAuthTokenCb();
      const res = await fetch("/api/admin/sales/prospect/scrape-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.bestEmail) {
          setSelectedLead((prev) =>
            prev ? { ...prev, email: data.bestEmail, email_source: "scraped" } : null
          );
          setLeads((prev) =>
            prev.map((l) => l.id === leadId ? { ...l, email: data.bestEmail, email_source: "scraped" } : l)
          );
        } else {
          alert("No email found on this website.");
        }
      } else {
        const data = await res.json().catch(() => ({ error: "Scrape failed" }));
        alert(data.error || "Scrape failed");
      }
    } catch (err) {
      console.error("Scrape error:", err);
    } finally {
      setScrapingEmail(false);
    }
  }

  async function handleSendOutreach(leadId: string) {
    setSendingOutreach(true);
    try {
      const token = await getAuthTokenCb();
      const res = await fetch("/api/admin/sales/prospect/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadId, template: selectedTemplate }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchOutreachHistory(leadId);
        // Update lead status in local state
        setLeads((prev) =>
          prev.map((l) => l.id === leadId && l.status === "not_contacted"
            ? { ...l, status: "contacted", last_contacted_at: new Date().toISOString() }
            : l
          )
        );
      } else {
        alert(data.error || "Send failed");
      }
    } catch (err) {
      console.error("Outreach error:", err);
    } finally {
      setSendingOutreach(false);
    }
  }

  async function handleBulkScrape() {
    const targets = filteredLeads.filter((l) => l.website && !l.email && (l.scrape_attempts || 0) < 5);
    if (targets.length === 0) { alert("No leads to scrape (all have emails, no website, or max attempts reached)"); return; }
    if (!confirm(`Scrape emails for ${targets.length} leads? This may take a few minutes.`)) return;

    setBulkScraping(true);
    setBulkScrapeProgress({ current: 0, total: targets.length, found: 0 });
    const token = await getAuthTokenCb();

    // Process in batches of 20
    let found = 0;
    for (let i = 0; i < targets.length; i += 20) {
      const batch = targets.slice(i, i + 20);
      try {
        const res = await fetch("/api/admin/sales/prospect/scrape-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ leadIds: batch.map((l) => l.id) }),
        });
        if (res.ok) {
          const data = await res.json();
          found += data.found || 0;
          // Update local state with found emails
          for (const r of (data.results || [])) {
            if (r.email) {
              setLeads((prev) =>
                prev.map((l) => l.id === r.leadId ? { ...l, email: r.email, email_source: "scraped" } : l)
              );
            }
          }
        }
      } catch (err) {
        console.error("Bulk scrape batch error:", err);
      }
      setBulkScrapeProgress({ current: Math.min(i + 20, targets.length), total: targets.length, found });
    }

    setBulkScraping(false);
    alert(`Done! Found ${found} emails out of ${targets.length} leads scraped.`);
  }

  async function handleBulkSend() {
    const targets = filteredLeads.filter((l) => l.email && !l.unsubscribed_at);
    if (targets.length === 0) { alert("No leads with email to send to"); return; }
    if (!confirm(`Send "${selectedTemplate}" to ${targets.length} leads? This uses your Resend quota.`)) return;

    setBulkSending(true);
    setBulkSendProgress({ current: 0, total: targets.length, sent: 0 });
    const token = await getAuthTokenCb();

    let sent = 0;
    for (let i = 0; i < targets.length; i += 20) {
      const batch = targets.slice(i, i + 20);
      try {
        const res = await fetch("/api/admin/sales/prospect/outreach", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ leadIds: batch.map((l) => l.id), template: selectedTemplate }),
        });
        if (res.ok) {
          const data = await res.json();
          sent += data.sent || 0;
          // Update local state
          for (const r of (data.results || [])) {
            if (r.sent) {
              setLeads((prev) =>
                prev.map((l) => l.id === r.leadId && l.status === "not_contacted"
                  ? { ...l, status: "contacted", last_contacted_at: new Date().toISOString() }
                  : l
                )
              );
            }
          }
        }
      } catch (err) {
        console.error("Bulk send batch error:", err);
      }
      setBulkSendProgress({ current: Math.min(i + 20, targets.length), total: targets.length, sent });
    }

    setBulkSending(false);
    alert(`Done! Sent ${sent} emails out of ${targets.length} leads.`);
  }

  // ---------- Cleanup / Reclassify handlers ----------

  async function handleCleanupJunk() {
    setCleanupRunning(true);
    try {
      const token = await getAuthTokenCb();

      // Preview first
      const previewRes = await fetch("/api/admin/sales/cleanup-junk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dryRun: true }),
      });
      if (!previewRes.ok) {
        const err = await previewRes.json().catch(() => ({}));
        alert(`Preview failed: ${err.error || previewRes.status}`);
        return;
      }
      const preview = await previewRes.json();
      const sampleLines = (preview.sampleNames || [])
        .slice(0, 10)
        .map((s: { business_name: string; city: string; state: string }) => `  • ${s.business_name} (${s.city}, ${s.state})`)
        .join("\n");

      const msg = `Flag ${preview.matchCount} leads as "Excluded"?\n\n` +
        `Keywords matched: ${preview.keywordCount}\n\n` +
        `Sample matches:\n${sampleLines}\n\n` +
        `This is non-destructive — rows stay in the DB but drop out of outreach.`;

      if (!confirm(msg)) return;

      // Execute
      const execRes = await fetch("/api/admin/sales/cleanup-junk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dryRun: false }),
      });
      if (!execRes.ok) {
        const err = await execRes.json().catch(() => ({}));
        alert(`Cleanup failed: ${err.error || execRes.status}`);
        return;
      }
      const result = await execRes.json();
      alert(`Flagged ${result.updated} leads as Excluded.`);
      fetchLeads();
    } catch (err) {
      console.error("Cleanup error:", err);
      alert(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setCleanupRunning(false);
    }
  }

  async function handleReclassify() {
    // Rough cost estimate: Places Essentials ~$5/1k
    const estLeads = leads.filter((l) => l.business_type !== "Excluded").length;
    const estCost = (estLeads / 1000 * 5).toFixed(2);
    if (!confirm(
      `Re-fetch business type from Google Places for up to ${estLeads} unverified leads.\n\n` +
      `Estimated cost: ~$${estCost} (Places Essentials SKU, types field only).\n\n` +
      `Safety: stops automatically if first batch has >30% errors.\n` +
      `Runs in batches of 100. You can close this tab and re-run later — it's resumable.`
    )) return;

    setReclassifying(true);
    setReclassifyProgress({ done: 0, total: estLeads, errors: 0 });

    const MAX_ITERATIONS = 200;
    const ERROR_RATE_THRESHOLD = 0.5;
    const MIN_BATCH_FOR_BREAKER = 20;
    const RATE_LIMIT_PAUSE_MS = 65_000;

    const has429 = (arr: Array<{ status: number }> | undefined) => !!(arr || []).some((e) => e.status === 429);
    const allSameStatus = (arr: Array<{ status: number }> | undefined, s: number) =>
      !!arr && arr.length > 0 && arr.every((e) => e.status === s);

    try {
      let done = 0;
      let errors = 0;
      let totalRemaining = estLeads;
      let iterations = 0;
      let rateLimitPauses = 0;

      while (iterations < MAX_ITERATIONS) {
        iterations++;
        // Refresh token every batch so hour-long runs don't die on expired auth
        const token = await getAuthTokenCb();

        const res = await fetch("/api/admin/sales/reclassify", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ batchSize: 100 }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(`Reclassify batch failed: ${err.error || res.status}`);
          break;
        }
        const data = await res.json();
        done += data.processed || 0;
        errors += data.errors || 0;
        totalRemaining = data.remaining ?? 0;
        setReclassifyProgress({
          done,
          total: done + totalRemaining,
          errors,
        });

        // Done if server has nothing more to process
        if (data.done || data.processed === 0) break;

        // Circuit breaker: bail only on meaningful batches that mostly failed with NON-429 errors
        if (
          iterations === 1 &&
          data.processed >= MIN_BATCH_FOR_BREAKER &&
          (data.errors / data.processed) > ERROR_RATE_THRESHOLD &&
          !has429(data.sampleErrors)
        ) {
          const samples = (data.sampleErrors || [])
            .map((e: { status: number; body: string }) => `  HTTP ${e.status}: ${e.body || "(no body)"}`)
            .join("\n");
          alert(
            `STOPPED: First batch had ${data.errors}/${data.processed} failures (${Math.round(data.errors / data.processed * 100)}%).\n\n` +
            `Google's response:\n${samples || "(no samples)"}`
          );
          break;
        }

        // All-errors batch: handle gracefully based on the error type
        if (data.processed > 0 && data.errors === data.processed) {
          // 429 → quota wall. Pause for the per-minute window to reset, then continue.
          if (has429(data.sampleErrors) && rateLimitPauses < 20) {
            rateLimitPauses++;
            await new Promise((r) => setTimeout(r, RATE_LIMIT_PAUSE_MS));
            continue;
          }
          // 404 cluster → dead IDs, now marked server-side as verified. Keep going.
          if (allSameStatus(data.sampleErrors, 404)) {
            continue;
          }
          // Anything else → stop and show what happened
          const samples = (data.sampleErrors || [])
            .map((e: { status: number; body: string }) => `  HTTP ${e.status}: ${e.body || "(no body)"}`)
            .join("\n");
          alert(
            `Stopped: batch ${iterations} was entirely errors (${data.errors}/${data.processed}).\n\n` +
            `Google's response:\n${samples || "(no samples)"}\n\n` +
            `Successful so far: ${done - errors} leads reclassified.`
          );
          break;
        }
      }

      if (iterations >= MAX_ITERATIONS) {
        alert(`Reached iteration cap (${MAX_ITERATIONS} batches). Processed ${done}, errors ${errors}. Re-click to continue if needed.`);
      } else {
        alert(`Reclassify complete. Processed: ${done}, errors: ${errors}.`);
      }
      fetchLeads();
    } catch (err) {
      console.error("Reclassify error:", err);
      alert(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setReclassifying(false);
    }
  }

  // ---------- Search handlers ----------

  async function getAuthToken(): Promise<string> {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    return session?.access_token || "";
  }

  async function handleSearch(loadMore = false) {
    if (!loadMore && !searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");

    try {
      const token = await getAuthToken();

      // Build the query string: prepend type if selected
      let query = searchQuery.trim();
      if (!loadMore && searchType !== "all") {
        // Use the tag name directly (e.g., "Restaurant", "Bowling", "Spa")
        const typeName = searchType.toLowerCase();
        if (!query.toLowerCase().includes(typeName)) {
          query = `${searchType} in ${query}`;
        }
      }

      const body: Record<string, unknown> = loadMore
        ? { query: searchQuery.trim(), pageToken: nextPageToken || "" }
        : { query, radiusMiles: parseInt(searchRadius) || 20 };

      const res = await fetch("/api/admin/sales/prospect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Search failed (${res.status})`);
      }

      const data = await res.json();

      if (loadMore) {
        setSearchResults((prev) => [...prev, ...data.places]);
      } else {
        setSearchResults(data.places);
      }
      setNextPageToken(data.nextPageToken);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  // ---------- Import handlers ----------

  function buildLeadRow(place: GooglePlaceResult) {
    return {
      google_place_id: place.google_place_id,
      business_name: place.business_name,
      business_type: place.business_type,
      google_types: place.google_types || [],
      phone: place.phone || null,
      address: place.address || null,
      city: place.city || null,
      state: place.state || null,
      zip: place.zip || null,
      website: place.website || null,
      latitude: place.latitude,
      longitude: place.longitude,
      google_rating: place.google_rating,
      google_price_level: place.google_price_level,
      google_total_ratings: place.google_total_ratings,
      search_query: searchQuery,
      search_location: place.city && place.state ? `${place.city}, ${place.state}` : searchQuery,
    };
  }

  async function handleImportLead(place: GooglePlaceResult) {
    if (importedPlaceIds.has(place.google_place_id)) return;
    setImporting((prev) => new Set(prev).add(place.google_place_id));

    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/sales/prospect/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ leads: [buildLeadRow(place)] }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }

      setImportedPlaceIds((prev) => new Set(prev).add(place.google_place_id));
      // Remove from search results
      setSearchResults((prev) => prev.filter((p) => p.google_place_id !== place.google_place_id));
      logAudit({
        action: "import_lead",
        tab: AUDIT_TABS.SALES,
        subTab: "Prospecting",
        targetType: "sales_lead",
        entityName: place.business_name,
        details: `Imported from Google Places: ${place.address}`,
      });
      fetchLeads();
    } catch (err) {
      console.error("Import error:", err);
      alert(`Failed to import ${place.business_name}`);
    } finally {
      setImporting((prev) => {
        const next = new Set(prev);
        next.delete(place.google_place_id);
        return next;
      });
    }
  }

  async function handleImportAll() {
    const toImport = searchResults.filter((p) => !importedPlaceIds.has(p.google_place_id));
    if (toImport.length === 0) {
      alert("All results are already imported.");
      return;
    }
    setImportingAll(true);

    try {
      const token = await getAuthToken();
      const rows = toImport.map(buildLeadRow);

      const res = await fetch("/api/admin/sales/prospect/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ leads: rows }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Bulk import failed");
      }

      const data = await res.json();
      const imported = data.imported || 0;

      // Mark all as imported and clear from search results
      setImportedPlaceIds((prev) => {
        const next = new Set(prev);
        toImport.forEach((p) => next.add(p.google_place_id));
        return next;
      });
      setSearchResults((prev) => prev.filter((p) => !toImport.some((t) => t.google_place_id === p.google_place_id)));

      logAudit({
        action: "bulk_import_leads",
        tab: AUDIT_TABS.SALES,
        subTab: "Prospecting",
        targetType: "sales_lead",
        details: `Bulk imported ${imported} leads from search: "${searchQuery}"`,
      });

      fetchLeads();
      alert(`Imported ${imported} new leads (${data.skipped || 0} skipped as duplicates).`);
    } catch (err) {
      console.error("Bulk import error:", err);
      alert("Bulk import failed. Check console for details.");
    } finally {
      setImportingAll(false);
    }
  }

  // ---------- Generate All handler ----------

  async function handleGenerate() {
    const location = searchQuery.trim();
    if (!location) {
      alert("Enter a location first (e.g., Omaha, NE)");
      return;
    }

    const totalSteps = GOOGLE_PLACE_TYPES.length;
    let totalImported = 0;
    let totalSkipped = 0;

    setGenerating(true);
    generateAbortRef.current = false;
    setGenerateProgress({ current: 0, total: totalSteps, type: "", radius: 50, imported: 0, skipped: 0 });

    try {
      const token = await getAuthToken();

      for (let i = 0; i < GOOGLE_PLACE_TYPES.length; i++) {
        if (generateAbortRef.current) break;

        const gType = GOOGLE_PLACE_TYPES[i];
        setGenerateProgress({
          current: i + 1,
          total: totalSteps,
          type: gType.label,
          radius: 50,
          imported: totalImported,
          skipped: totalSkipped,
        });

        // Use the Google type name as the search query
        const query = `${gType.label} in ${location}`;
        let pageToken: string | null = null;
        let pageCount = 0;

        // Page through results (up to 3 pages = 60 results per type)
        do {
          if (generateAbortRef.current) break;

          const body: Record<string, unknown> = pageToken
            ? { query, pageToken }
            : { query, radiusMiles: 50 };

          const searchRes = await fetch("/api/admin/sales/prospect", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          });

          if (!searchRes.ok) {
            console.error(`Search failed for "${query}":`, await searchRes.text());
            break;
          }

          const searchData = await searchRes.json();
          const places = searchData.places || [];

          if (places.length > 0) {
            // Trust the server's per-business type detection (via mapBusinessType on Google's types[] array).
            // Do NOT override with the search category — Google Text Search is fuzzy and returns non-matching
            // businesses (e.g. fire departments show up in "Restaurant" searches).
            const rows = places.map((place: GooglePlaceResult) => ({
              google_place_id: place.google_place_id,
              business_name: place.business_name,
              business_type: place.business_type,
              google_types: place.google_types || [],
              phone: place.phone || null,
              address: place.address || null,
              city: place.city || null,
              state: place.state || null,
              zip: place.zip || null,
              website: place.website || null,
              latitude: place.latitude,
              longitude: place.longitude,
              google_rating: place.google_rating,
              google_price_level: place.google_price_level,
              google_total_ratings: place.google_total_ratings,
              search_query: query,
              search_location: place.city && place.state ? `${place.city}, ${place.state}` : location,
            }));

            const importRes = await fetch("/api/admin/sales/prospect/import", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ leads: rows }),
            });

            if (importRes.ok) {
              const importData = await importRes.json();
              totalImported += importData.imported || 0;
              totalSkipped += importData.skipped || 0;
              setGenerateProgress((prev) => ({ ...prev, imported: totalImported, skipped: totalSkipped }));
            }
          }

          pageToken = searchData.nextPageToken || null;
          pageCount++;
        } while (pageToken && pageCount < 3);
      }

      logAudit({
        action: "generate_all_leads",
        tab: AUDIT_TABS.SALES,
        subTab: "Prospecting",
        targetType: "sales_lead",
        details: `Generated leads for "${location}" using ${GOOGLE_PLACE_TYPES.length} Google types: ${totalImported} imported, ${totalSkipped} duplicates skipped`,
      });

      fetchLeads();
      alert(`Done! ${totalImported} businesses imported, ${totalSkipped} duplicates skipped.`);
    } catch (err) {
      console.error("Generate error:", err);
      alert(`Generation stopped. ${totalImported} imported so far. Error: ${err instanceof Error ? err.message : "Unknown"}`);
      fetchLeads();
    } finally {
      setGenerating(false);
    }
  }

  // ---------- Lead management handlers ----------

  async function handleStatusChange(leadId: string, newStatus: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "contacted" && !lead.last_contacted_at) {
      updates.last_contacted_at = new Date().toISOString();
    }

    const token = await getAuthToken();
    const res = await fetch("/api/admin/sales/prospect/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: leadId, updates }),
    });

    if (!res.ok) {
      console.error("Status update error:", await res.text());
      return;
    }

    logAudit({
      action: "update_lead_status",
      tab: AUDIT_TABS.SALES,
      subTab: "Prospecting",
      targetType: "sales_lead",
      targetId: leadId,
      entityName: lead.business_name,
      fieldName: "status",
      oldValue: lead.status,
      newValue: newStatus,
    });

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, ...updates, status: newStatus } as SalesLead : l))
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, ...updates, status: newStatus } as SalesLead : null));
    }
  }

  async function handleAssignRep(leadId: string, repId: string | null) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const token = await getAuthToken();
    const res = await fetch("/api/admin/sales/prospect/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: leadId, updates: { assigned_rep_id: repId } }),
    });

    if (!res.ok) {
      console.error("Rep assign error:", await res.text());
      return;
    }

    const repName = repId ? salesReps.find((r) => r.id === repId)?.name || "Unknown" : "Unassigned";
    logAudit({
      action: "assign_lead_rep",
      tab: AUDIT_TABS.SALES,
      subTab: "Prospecting",
      targetType: "sales_lead",
      targetId: leadId,
      entityName: lead.business_name,
      fieldName: "assigned_rep_id",
      newValue: repName,
    });

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, assigned_rep_id: repId } : l))
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, assigned_rep_id: repId } : null));
    }
  }

  async function handleMarkContacted(leadId: string) {
    const now = new Date().toISOString();
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const token = await getAuthToken();
    const res = await fetch("/api/admin/sales/prospect/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: leadId, updates: { status: "contacted", last_contacted_at: now } }),
    });

    if (!res.ok) {
      console.error("Mark contacted error:", await res.text());
      return;
    }

    logAudit({
      action: "mark_lead_contacted",
      tab: AUDIT_TABS.SALES,
      subTab: "Prospecting",
      targetType: "sales_lead",
      targetId: leadId,
      entityName: lead.business_name,
    });

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, status: "contacted", last_contacted_at: now } : l
      )
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) =>
        prev ? { ...prev, status: "contacted", last_contacted_at: now } : null
      );
    }
  }

  async function handleAddNote() {
    if (!selectedLead || !newNote.trim()) return;

    const token = await getAuthToken();
    const res = await fetch("/api/admin/sales/prospect/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ leadId: selectedLead.id, note: newNote.trim() }),
    });

    if (!res.ok) {
      console.error("Add note error:", await res.text());
      return;
    }

    setNewNote("");
    fetchNotes(selectedLead.id);
  }

  async function handleDeleteLead() {
    if (!selectedLead) return;

    const token = await getAuthToken();
    const res = await fetch("/api/admin/sales/prospect/leads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: selectedLead.id }),
    });

    if (!res.ok) {
      console.error("Delete lead error:", await res.text());
      return;
    }

    logAudit({
      action: "delete_lead",
      tab: AUDIT_TABS.SALES,
      subTab: "Prospecting",
      targetType: "sales_lead",
      targetId: selectedLead.id,
      entityName: selectedLead.business_name,
    });

    setSelectedLead(null);
    setConfirmDelete(false);
    fetchLeads();
  }

  // ---------- Appointments ----------

  async function fetchLeadAppointment(leadId: string) {
    setApptLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/sales/appointments?lead_id=${leadId}&status=scheduled`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeadAppointment(data?.[0] || null);
      }
    } catch (err) {
      console.error("Error fetching appointment:", err);
    } finally {
      setApptLoading(false);
    }
  }

  async function handleSaveAppointment() {
    if (!selectedLead || !apptForm.date || !apptForm.time) return;
    setApptSaving(true);
    try {
      const token = await getAuthToken();
      const scheduledAt = new Date(`${apptForm.date}T${apptForm.time}:00`).toISOString();
      const isEdit = !!leadAppointment;
      const url = isEdit
        ? `/api/admin/sales/appointments/${leadAppointment.id}`
        : "/api/admin/sales/appointments";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lead_id: selectedLead.id,
          scheduled_at: scheduledAt,
          duration_min: apptForm.duration_min,
          assigned_rep_id: apptForm.rep_id || null,
          location: apptForm.location || selectedLead.address || "",
          notes: apptForm.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        alert("Error saving appointment: " + err);
        return;
      }
      const saved = await res.json();
      setLeadAppointment(saved);
      setApptFormOpen(false);
      logAudit({
        action: isEdit ? "update_sales_appointment" : "create_sales_appointment",
        tab: AUDIT_TABS.SALES ?? "Sales",
        subTab: "Appointments",
        targetType: "sales_appointment",
        targetId: saved.id,
        entityName: selectedLead.business_name,
      });
    } catch (err) {
      console.error("Error saving appointment:", err);
      alert("Error saving appointment");
    } finally {
      setApptSaving(false);
    }
  }

  async function handleCancelAppointment() {
    if (!leadAppointment) return;
    if (!confirm("Cancel this appointment?")) return;
    try {
      const token = await getAuthToken();
      await fetch(`/api/admin/sales/appointments/${leadAppointment.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeadAppointment(null);
      setApptFormOpen(false);
    } catch (err) {
      console.error("Error cancelling appointment:", err);
    }
  }

  async function handleCompleteAppointment(status: "completed" | "no_show") {
    if (!leadAppointment) return;
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/sales/appointments/${leadAppointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setLeadAppointment(null);
    } catch (err) {
      console.error("Error updating appointment:", err);
    }
  }

  function openApptForm(existing?: SalesAppointment) {
    if (existing) {
      const dt = new Date(existing.scheduled_at);
      setApptForm({
        date: dt.toISOString().slice(0, 10),
        time: dt.toTimeString().slice(0, 5),
        duration_min: existing.duration_min,
        rep_id: existing.assigned_rep_id || "",
        location: existing.location || "",
        notes: existing.notes || "",
      });
    } else {
      setApptForm({
        date: "",
        time: "",
        duration_min: 30,
        rep_id: selectedLead?.assigned_rep_id || "",
        location: selectedLead?.address || "",
        notes: "",
      });
    }
    setApptFormOpen(true);
  }

  // ---------- Create Preview ----------

  async function handleCreatePreview(recreate = false) {
    if (!selectedLead) return;
    if (recreate && !confirm("Recreate preview? This will delete the existing one and fetch fresh photos.")) return;
    setCreatingPreview(true);

    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/sales/prospect/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ leadId: selectedLead.id, recreate }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create preview");
      }

      const data = await res.json();

      logAudit({
        action: "create_preview",
        tab: AUDIT_TABS.SALES,
        subTab: "Prospecting",
        targetType: "sales_lead",
        targetId: selectedLead.id,
        entityName: selectedLead.business_name,
        details: `Preview business created: ${data.businessId} (${data.photosStored || 0} photos stored)`,
      });

      // Update local state
      setLeads((prev) =>
        prev.map((l) =>
          l.id === selectedLead.id
            ? { ...l, preview_business_id: data.businessId }
            : l
        )
      );
      setSelectedLead((prev) =>
        prev ? { ...prev, preview_business_id: data.businessId } : null
      );

      if (data.alreadyExists) {
        alert("Preview already exists for this lead.");
      }
    } catch (err) {
      console.error("Create preview error:", err);
      alert(`Failed to create preview: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setCreatingPreview(false);
    }
  }

  // ---------- Export ----------

  function handleExport(format: "csv" | "xlsx") {
    const headers = [
      "Business Name", "Type", "Phone", "Address", "City", "State", "Zip",
      "Website", "Rating", "Reviews", "Price", "Status", "Assigned Rep",
      "Last Contacted", "Imported", "Search Query",
    ];
    const rows = filteredLeads.map((l) => [
      l.business_name,
      typeLabels[l.business_type || ""] || l.business_type || "",
      l.phone || "",
      l.address || "",
      l.city || "",
      l.state || "",
      l.zip || "",
      l.website || "",
      l.google_rating !== null ? String(l.google_rating) : "",
      l.google_total_ratings !== null ? String(l.google_total_ratings) : "",
      l.google_price_level !== null ? PRICE_LABELS[l.google_price_level] || "" : "",
      l.status.replace(/_/g, " "),
      salesReps.find((r) => r.id === l.assigned_rep_id)?.name || "",
      l.last_contacted_at ? formatDate(l.last_contacted_at) : "",
      formatDate(l.created_at),
      l.search_query || "",
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      downloadCSV(`leads_${dateStr}.csv`, headers, rows);
    } else {
      downloadXLSX(`leads_${dateStr}.xlsx`, headers, rows);
    }

    logAudit({
      action: "export_leads",
      tab: AUDIT_TABS.SALES,
      subTab: "Prospecting",
      targetType: "sales_lead",
      isDownload: true,
      details: `Exported ${rows.length} leads as ${format.toUpperCase()}`,
    });
  }

  // ---------- On-app check ----------

  const isLeadOnApp = useCallback((lead: SalesLead): boolean => {
    if (existingBusinessNames.size === 0) return false;
    const name = lead.business_name.trim().toLowerCase();
    return existingBusinessNames.has(name);
  }, [existingBusinessNames]);

  // ---------- Filtered data ----------

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (filterRep !== "all" && (l.assigned_rep_id || "unassigned") !== filterRep) return false;
      if (filterType !== "all" && l.business_type !== filterType) return false;
      if (filterCity !== "all" && (l.city || "") !== filterCity) return false;
      if (filterState !== "all" && (l.state || "") !== filterState) return false;
      if (filterRating !== "all") {
        const minRating = parseFloat(filterRating);
        if (!l.google_rating || l.google_rating < minRating) return false;
      }
      if (filterHasWebsite === "yes" && !l.website) return false;
      if (filterHasWebsite === "no" && l.website) return false;
      if (filterHasPhone === "yes" && !l.phone) return false;
      if (filterHasPhone === "no" && l.phone) return false;
      if (filterHasPreview === "yes" && !l.preview_business_id) return false;
      if (filterHasPreview === "no" && l.preview_business_id) return false;
      if (filterOnApp === "yes" && !isLeadOnApp(l)) return false;
      if (filterOnApp === "no" && isLeadOnApp(l)) return false;
      if (filterHasEmail === "yes" && !l.email) return false;
      if (filterHasEmail === "no" && l.email) return false;
      if (filterOutreach === "not_sent" && l.outreach_count > 0) return false;
      if (filterOutreach === "sent" && l.outreach_status !== "sent") return false;
      if (filterOutreach === "opened" && l.outreach_status !== "opened") return false;
      if (filterOutreach === "clicked" && l.outreach_status !== "clicked") return false;
      if (filterOutreach === "any_sent" && l.outreach_count === 0) return false;
      if (filterContactFrom) {
        if (!l.last_contacted_at) return false;
        if (l.last_contacted_at.slice(0, 10) < filterContactFrom) return false;
      }
      if (filterContactTo) {
        if (!l.last_contacted_at) return false;
        if (l.last_contacted_at.slice(0, 10) > filterContactTo) return false;
      }
      if (filterSearch) {
        const s = filterSearch.toLowerCase();
        const match =
          l.business_name.toLowerCase().includes(s) ||
          (l.address || "").toLowerCase().includes(s) ||
          (l.city || "").toLowerCase().includes(s) ||
          (l.phone || "").includes(s) ||
          (l.website || "").toLowerCase().includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [leads, filterStatus, filterRep, filterType, filterCity, filterState, filterSearch, filterRating, filterHasWebsite, filterHasPhone, filterHasPreview, filterContactFrom, filterContactTo, filterOnApp, isLeadOnApp, filterHasEmail, filterOutreach]);

  // City options for filter (derived from leads data)
  const cityOptions = useMemo(() => {
    const cities = new Map<string, number>();
    leads.forEach((l) => {
      if (filterState !== "all" && (l.state || "") !== filterState) return;
      const city = l.city || "Unknown";
      cities.set(city, (cities.get(city) || 0) + 1);
    });
    return Array.from(cities.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([city, count]) => ({ value: city, label: `${city} (${count})` }));
  }, [leads, filterState]);

  // State options for filter (derived from leads data)
  const stateOptions = useMemo(() => {
    const states = new Map<string, number>();
    leads.forEach((l) => {
      const st = l.state || "Unknown";
      states.set(st, (states.get(st) || 0) + 1);
    });
    return Array.from(states.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([st, count]) => ({ value: st, label: `${st} (${count})` }));
  }, [leads]);

  // Reset city filter when the selected state no longer contains the chosen city
  useEffect(() => {
    if (filterCity === "all") return;
    const stillValid = cityOptions.some((o) => o.value === filterCity);
    if (!stillValid) setFilterCity("all");
  }, [filterState, cityOptions, filterCity]);

  // Active filter count (for clear-all button)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterStatus !== "all") count++;
    if (filterRep !== "all") count++;
    if (filterType !== "all") count++;
    if (filterCity !== "all") count++;
    if (filterState !== "all") count++;
    if (filterRating !== "all") count++;
    if (filterHasWebsite !== "all") count++;
    if (filterHasPhone !== "all") count++;
    if (filterHasPreview !== "all") count++;
    if (filterOnApp !== "all") count++;
    if (filterHasEmail !== "all") count++;
    if (filterOutreach !== "all") count++;
    if (filterContactFrom) count++;
    if (filterContactTo) count++;
    if (filterSearch) count++;
    return count;
  }, [filterStatus, filterRep, filterType, filterCity, filterState, filterRating, filterHasWebsite, filterHasPhone, filterHasPreview, filterOnApp, filterHasEmail, filterOutreach, filterContactFrom, filterContactTo, filterSearch]);

  const clearAllFilters = () => {
    setFilterStatus("all");
    setFilterRep("all");
    setFilterType("all");
    setFilterCity("all");
    setFilterState("all");
    setFilterRating("all");
    setFilterHasWebsite("all");
    setFilterHasPhone("all");
    setFilterHasPreview("all");
    setFilterOnApp("all");
    setFilterHasEmail("all");
    setFilterOutreach("all");
    setFilterContactFrom("");
    setFilterContactTo("");
    setFilterSearch("");
  };

  // Stats
  const stats = useMemo(() => {
    const total = leads.length;
    const notContacted = leads.filter((l) => l.status === "not_contacted").length;
    const inPipeline = leads.filter((l) =>
      ["contacted", "pitched", "follow_up"].includes(l.status)
    ).length;
    const signedUp = leads.filter((l) => l.status === "signed_up").length;
    const convRate = total > 0 ? ((signedUp / total) * 100).toFixed(1) : "0.0";
    const withEmail = leads.filter((l) => l.email).length;
    const emailsSent = leads.filter((l) => l.outreach_count > 0).length;
    const emailsOpened = leads.filter((l) => l.outreach_status === "opened" || l.outreach_status === "clicked" || l.outreach_status === "replied").length;
    const emailsClicked = leads.filter((l) => l.outreach_status === "clicked" || l.outreach_status === "replied").length;
    const openRate = emailsSent > 0 ? ((emailsOpened / emailsSent) * 100).toFixed(1) : "0.0";
    const clickRate = emailsSent > 0 ? ((emailsClicked / emailsSent) * 100).toFixed(1) : "0.0";
    return { total, notContacted, inPipeline, signedUp, convRate, withEmail, emailsSent, emailsOpened, emailsClicked, openRate, clickRate };
  }, [leads]);

  // Breakdown stats: by type and by city
  const breakdownByType = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => {
      const type = l.business_type || "Unknown";
      map.set(type, (map.get(type) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const breakdownByCity = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => {
      const city = l.city && l.state ? `${l.city}, ${l.state}` : l.city || "Unknown";
      map.set(city, (map.get(city) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  // ---------- Search results columns ----------

  const searchColumns = [
    {
      key: "business_name",
      label: "Business",
      render: (v: unknown) => (
        <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>{String(v)}</span>
      ),
    },
    {
      key: "business_type",
      label: "Type",
      render: (v: unknown) => (
        <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>
          {typeLabels[String(v)] || String(v)}
        </span>
      ),
    },
    {
      key: "address",
      label: "Address",
      render: (v: unknown) => (
        <span style={{ color: COLORS.textSecondary, fontSize: 12, maxWidth: 250, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {String(v || "—")}
        </span>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (v: unknown) => (
        <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>
          {v ? String(v) : "—"}
        </span>
      ),
    },
    {
      key: "google_rating",
      label: "Rating",
      align: "center" as const,
      render: (v: unknown, row: Record<string, unknown>) => (
        <span style={{ color: COLORS.neonYellow, fontSize: 12 }}>
          {renderStars(v as number | null)}
          {row.google_total_ratings ? (
            <span style={{ color: COLORS.textSecondary, marginLeft: 4 }}>
              ({String(row.google_total_ratings)})
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "google_price_level",
      label: "Price",
      align: "center" as const,
      render: (v: unknown) => (
        <span style={{ color: COLORS.neonGreen, fontSize: 12 }}>
          {v !== null && v !== undefined ? PRICE_LABELS[v as number] || "—" : "—"}
        </span>
      ),
    },
    {
      key: "google_place_id",
      label: "Action",
      align: "center" as const,
      render: (v: unknown) => {
        const placeId = String(v);
        const isImported = importedPlaceIds.has(placeId);
        const isImportingThis = importing.has(placeId);
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const place = searchResults.find((p) => p.google_place_id === placeId);
              if (place) handleImportLead(place);
            }}
            disabled={isImported || isImportingThis}
            style={{
              ...btnSecondary,
              padding: "4px 12px",
              fontSize: 11,
              background: isImported
                ? "linear-gradient(135deg, #39ff14, #00d4ff)"
                : isImportingThis
                ? COLORS.cardBorder
                : COLORS.cardBg,
              color: isImported ? "#000" : COLORS.textPrimary,
              cursor: isImported ? "default" : "pointer",
              opacity: isImportingThis ? 0.6 : 1,
            }}
          >
            {isImported ? "✓ Imported" : isImportingThis ? "..." : "Import"}
          </button>
        );
      },
    },
  ];

  // ---------- Leads pipeline columns ----------

  const leadsColumns = [
    {
      key: "business_name",
      label: "Business",
      render: (v: unknown, row: Record<string, unknown>) => {
        const onApp = isLeadOnApp(row as unknown as SalesLead);
        return (
          <span style={{ fontWeight: 600, color: COLORS.textPrimary, display: "flex", alignItems: "center", gap: 6 }}>
            {String(v)}
            {onApp && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                background: "rgba(57,255,20,0.15)", color: COLORS.neonGreen,
                border: `1px solid rgba(57,255,20,0.3)`, whiteSpace: "nowrap",
              }}>
                ON APP
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "business_type",
      label: "Type",
      render: (v: unknown) => (
        <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>
          {typeLabels[String(v)] || String(v || "—")}
        </span>
      ),
    },
    {
      key: "address",
      label: "Address",
      render: (v: unknown) => (
        <span style={{ color: COLORS.textSecondary, fontSize: 12, maxWidth: 220, display: "inline-block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {String(v || "—")}
        </span>
      ),
    },
    {
      key: "city",
      label: "City/State",
      render: (_v: unknown, row: Record<string, unknown>) => (
        <span style={{ color: COLORS.textSecondary, fontSize: 12, whiteSpace: "nowrap" }}>
          {row.city && row.state ? `${String(row.city)}, ${String(row.state)}` : String(row.city || row.state || "—")}
        </span>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (v: unknown) =>
        v ? (
          <a
            href={`tel:${String(v)}`}
            style={{ color: COLORS.neonBlue, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}
            onClick={(e) => e.stopPropagation()}
          >
            {String(v)}
          </a>
        ) : (
          <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>—</span>
        ),
    },
    {
      key: "website",
      label: "Website",
      render: (v: unknown) =>
        v ? (
          <a
            href={String(v)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: COLORS.neonGreen, fontSize: 12, textDecoration: "none", maxWidth: 160, display: "inline-block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            onClick={(e) => e.stopPropagation()}
          >
            {String(v).replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        ) : (
          <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>—</span>
        ),
    },
    {
      key: "email",
      label: "Email",
      render: (v: unknown) =>
        v ? (
          <a
            href={`mailto:${String(v)}`}
            style={{ color: COLORS.neonGreen, fontSize: 12, textDecoration: "none", maxWidth: 160, display: "inline-block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            onClick={(e) => e.stopPropagation()}
          >
            {String(v)}
          </a>
        ) : (
          <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>—</span>
        ),
    },
    {
      key: "google_rating",
      label: "Rating",
      align: "center" as const,
      render: (v: unknown, row: Record<string, unknown>) => (
        <span style={{ color: COLORS.neonYellow, fontSize: 12, whiteSpace: "nowrap" }}>
          {renderStars(v as number | null)}
          {row.google_total_ratings ? <span style={{ color: COLORS.textSecondary, marginLeft: 4 }}>({String(row.google_total_ratings)})</span> : null}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      align: "center" as const,
      render: (v: unknown, row: Record<string, unknown>) => {
        const contacted = !!row.last_contacted_at;
        return (
          <span style={{ whiteSpace: "nowrap", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <Badge status={String(v)} />
            {contacted && (
              <span style={{
                fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                background: "rgba(0,212,255,0.15)", color: COLORS.neonBlue,
                border: "1px solid rgba(0,212,255,0.3)",
              }}>
                EMAILED
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "assigned_rep_id",
      label: "Rep",
      render: (v: unknown) => {
        const rep = v ? salesReps.find((r) => r.id === String(v)) : null;
        return (
          <span style={{ color: rep ? COLORS.textPrimary : COLORS.textSecondary, fontSize: 12, whiteSpace: "nowrap" }}>
            {rep?.name || "Unassigned"}
          </span>
        );
      },
    },
    {
      key: "outreach_status",
      label: "Outreach",
      align: "center" as const,
      render: (v: unknown, row: Record<string, unknown>) => {
        if (!v) return <span style={{ color: COLORS.textSecondary, fontSize: 11 }}>—</span>;
        const status = String(v);
        const colors: Record<string, string> = {
          sent: COLORS.neonYellow,
          opened: COLORS.neonGreen,
          clicked: COLORS.neonBlue,
          replied: COLORS.neonPurple,
          bounced: COLORS.neonRed,
          unsubscribed: COLORS.textSecondary,
        };
        const color = colors[status] || COLORS.textSecondary;
        return (
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3,
              background: `${color}20`, color, border: `1px solid ${color}40`,
              textTransform: "uppercase",
            }}>
              {status}
            </span>
            {(row.outreach_count as number) > 1 && (
              <span style={{ fontSize: 9, color: COLORS.textSecondary }}>
                ×{String(row.outreach_count)}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "preview_business_id",
      label: "Preview",
      align: "center" as const,
      render: (v: unknown) =>
        v ? (
          <a
            href={`/preview/${String(v)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: COLORS.neonGreen, fontSize: 11, fontWeight: 600, textDecoration: "none" }}
          >
            View
          </a>
        ) : (
          <span style={{ color: COLORS.textSecondary, fontSize: 11 }}>—</span>
        ),
    },
    {
      key: "last_contacted_at",
      label: "Last Contact",
      render: (v: unknown) => (
        <span style={{ color: COLORS.textSecondary, fontSize: 12, whiteSpace: "nowrap" }}>
          {formatDate(v as string | null)}
        </span>
      ),
    },
  ];

  // ---------- RENDER ----------

  return (
    <div>
      {/* ========== SECTION A: SEARCH ========== */}
      <Card title="Search Businesses" actions={
        searchResults.length > 0 ? (
          <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>
            {searchResults.length} results found
          </span>
        ) : undefined
      }>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>
              Location / Search
            </label>
            <input
              ref={locationInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder='e.g. "Omaha, NE" or "downtown Austin, TX"'
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>
              Business Type
            </label>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              style={selectStyle}
            >
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>
              Radius
            </label>
            <select
              value={searchRadius}
              onChange={(e) => setSearchRadius(e.target.value)}
              style={selectStyle}
            >
              <option value="5">5 miles</option>
              <option value="10">10 miles</option>
              <option value="20">20 miles</option>
              <option value="50">50 miles</option>
            </select>
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={searching || generating || !searchQuery.trim()}
            style={{ ...btnPrimary, opacity: searching || generating || !searchQuery.trim() ? 0.6 : 1 }}
          >
            {searching ? "Searching..." : "🔍 Search"}
          </button>
          {can("manage_sales") && (
            <button
              onClick={handleGenerate}
              disabled={generating || searching || !searchQuery.trim()}
              style={{
                ...btnPrimary,
                background: generating ? COLORS.cardBorder : `linear-gradient(135deg, ${COLORS.neonGreen}, ${COLORS.neonBlue})`,
                opacity: generating || searching || !searchQuery.trim() ? 0.6 : 1,
              }}
            >
              {generating ? "Generating..." : "⚡ Generate Businesses"}
            </button>
          )}
          {generating && (
            <button
              onClick={() => { generateAbortRef.current = true; }}
              style={{ ...btnSecondary, color: COLORS.neonRed, borderColor: COLORS.neonRed }}
            >
              ✕ Stop
            </button>
          )}
        </div>

        {/* Generate progress */}
        {generating && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: COLORS.textSecondary }}>
              <span>
                Searching <strong style={{ color: COLORS.neonGreen }}>{generateProgress.type}</strong> at <strong style={{ color: COLORS.neonBlue }}>{generateProgress.radius} miles</strong>
              </span>
              <span>{generateProgress.current} / {generateProgress.total} steps</span>
            </div>
            <div style={{ width: "100%", height: 8, background: COLORS.cardBorder, borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  width: `${generateProgress.total > 0 ? (generateProgress.current / generateProgress.total) * 100 : 0}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${COLORS.neonGreen}, ${COLORS.neonBlue})`,
                  borderRadius: 4,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: COLORS.textSecondary }}>
              <span style={{ color: COLORS.neonGreen, fontWeight: 600 }}>{generateProgress.imported}</span> imported
              {" · "}
              <span style={{ color: COLORS.neonYellow }}>{generateProgress.skipped}</span> duplicates skipped
            </div>
          </div>
        )}

        {searchError && (
          <div style={{ marginTop: 12, padding: "10px 16px", background: "rgba(255,49,49,0.15)", border: "1px solid rgba(255,49,49,0.3)", borderRadius: 8, color: "#ff6b6b", fontSize: 13 }}>
            {searchError}
          </div>
        )}
      </Card>

      {/* ========== SECTION B: SEARCH RESULTS ========== */}
      {searchResults.length > 0 && (
        <Card
          title={`Search Results (${searchResults.length})`}
          style={{ marginTop: 24 }}
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleImportAll}
                disabled={importingAll}
                style={{ ...btnPrimary, fontSize: 12, padding: "8px 16px", opacity: importingAll ? 0.6 : 1 }}
              >
                {importingAll ? "Importing..." : `Import All (${searchResults.filter((p) => !importedPlaceIds.has(p.google_place_id)).length})`}
              </button>
            </div>
          }
        >
          <DataTable columns={searchColumns} data={searchResults} />

          {nextPageToken && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                onClick={() => handleSearch(true)}
                disabled={searching}
                style={{ ...btnSecondary, opacity: searching ? 0.6 : 1 }}
              >
                {searching ? "Loading..." : "Load More Results"}
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ========== SECTION C: LEADS PIPELINE ========== */}
      <div style={{ marginTop: 40 }}>
        <SectionTitle>Leads Pipeline</SectionTitle>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Leads" value={String(stats.total)} />
        <StatCard label="Not Contacted" value={String(stats.notContacted)} />
        <StatCard label="In Pipeline" value={String(stats.inPipeline)} />
        <StatCard label="Signed Up" value={String(stats.signedUp)} />
        <StatCard label="Conversion" value={`${stats.convRate}%`} />
        <StatCard label="Has Email" value={String(stats.withEmail)} />
        <StatCard label="Emails Sent" value={String(stats.emailsSent)} />
        <StatCard label="Opens" value={`${stats.emailsOpened} (${stats.openRate}%)`} />
        <StatCard label="Clicks" value={`${stats.emailsClicked} (${stats.clickRate}%)`} />
      </div>

      {/* Breakdown stats — collapsible */}
      <div
        onClick={() => setBreakdownOpen(!breakdownOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          marginBottom: breakdownOpen ? 16 : 24,
          userSelect: "none",
        }}
      >
        <span style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
          Breakdown by Type & City
        </span>
        <span style={{ color: COLORS.textSecondary, fontSize: 11, transition: "transform 0.2s", display: "inline-block", transform: breakdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
          ▼
        </span>
      </div>
      {breakdownOpen && (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card title="By Business Type">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {breakdownByType.map(([type, count]) => (
              <span
                key={type}
                onClick={() => setFilterType(filterType === type ? "all" : type)}
                style={{
                  padding: "4px 10px",
                  background: filterType === type ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${filterType === type ? COLORS.neonBlue : COLORS.cardBorder}`,
                  borderRadius: 6,
                  fontSize: 12,
                  color: COLORS.textPrimary,
                  cursor: "pointer",
                }}
              >
                {typeLabels[type] || type} <strong style={{ color: COLORS.neonBlue }}>{count}</strong>
              </span>
            ))}
          </div>
        </Card>
        <Card title="By City">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {breakdownByCity.map(([city, count]) => (
              <span
                key={city}
                onClick={() => { const c = city.split(",")[0].trim(); setFilterCity(filterCity === c ? "all" : c); }}
                style={{
                  padding: "4px 10px",
                  background: filterCity === city.split(",")[0].trim() ? "rgba(57,255,20,0.2)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${filterCity === city.split(",")[0].trim() ? COLORS.neonGreen : COLORS.cardBorder}`,
                  borderRadius: 6,
                  fontSize: 12,
                  color: COLORS.textPrimary,
                  cursor: "pointer",
                }}
              >
                {city} <strong style={{ color: COLORS.neonGreen }}>{count}</strong>
              </span>
            ))}
          </div>
        </Card>
      </div>
      )}

      {/* Filters + Export */}
      <Card>
        {/* Row 1: Primary filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Assigned Rep</label>
            <select value={filterRep} onChange={(e) => setFilterRep(e.target.value)} style={selectStyle}>
              <option value="all">All Reps</option>
              <option value="unassigned">Unassigned</option>
              {salesReps.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <SearchableDropdown
            label="Type"
            value={filterType}
            onChange={setFilterType}
            options={typeOptions}
            placeholder="Search types..."
          />
          <SearchableDropdown
            label="City"
            value={filterCity}
            onChange={setFilterCity}
            options={[{ value: "all", label: "All Cities" }, ...cityOptions]}
            placeholder="Search cities..."
          />
          <SearchableDropdown
            label="State"
            value={filterState}
            onChange={setFilterState}
            options={[{ value: "all", label: "All States" }, ...stateOptions]}
            placeholder="Search states..."
          />
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Search</label>
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Name, address, phone, website..."
              style={inputStyle}
            />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => handleExport("csv")} style={btnSecondary}>CSV</button>
            <button onClick={() => handleExport("xlsx")} style={btnSecondary}>XLSX</button>
          </div>
        </div>

        {/* Row 2: Secondary filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.cardBorder}` }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Min Rating</label>
            <select value={filterRating} onChange={(e) => setFilterRating(e.target.value)} style={{ ...selectStyle, minWidth: 110 }}>
              <option value="all">Any Rating</option>
              <option value="3.0">3.0+</option>
              <option value="3.5">3.5+</option>
              <option value="4.0">4.0+</option>
              <option value="4.5">4.5+</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Has Website</label>
            <select value={filterHasWebsite} onChange={(e) => setFilterHasWebsite(e.target.value)} style={{ ...selectStyle, minWidth: 110 }}>
              <option value="all">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Has Phone</label>
            <select value={filterHasPhone} onChange={(e) => setFilterHasPhone(e.target.value)} style={{ ...selectStyle, minWidth: 110 }}>
              <option value="all">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Has Preview</label>
            <select value={filterHasPreview} onChange={(e) => setFilterHasPreview(e.target.value)} style={{ ...selectStyle, minWidth: 110 }}>
              <option value="all">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>On App</label>
            <select value={filterOnApp} onChange={(e) => setFilterOnApp(e.target.value)} style={{ ...selectStyle, minWidth: 110 }}>
              <option value="all">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Has Email</label>
            <select value={filterHasEmail} onChange={(e) => setFilterHasEmail(e.target.value)} style={{ ...selectStyle, minWidth: 110 }}>
              <option value="all">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Outreach</label>
            <select value={filterOutreach} onChange={(e) => setFilterOutreach(e.target.value)} style={{ ...selectStyle, minWidth: 120 }}>
              <option value="all">Any</option>
              <option value="not_sent">Not Sent</option>
              <option value="any_sent">Sent (any)</option>
              <option value="sent">Sent (not opened)</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Last Contact From</label>
            <input
              type="date"
              value={filterContactFrom}
              onChange={(e) => setFilterContactFrom(e.target.value)}
              style={{ ...selectStyle, minWidth: 140, colorScheme: "dark" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Last Contact To</label>
            <input
              type="date"
              value={filterContactTo}
              onChange={(e) => setFilterContactTo(e.target.value)}
              style={{ ...selectStyle, minWidth: 140, colorScheme: "dark" }}
            />
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              style={{
                padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "rgba(255,45,120,0.1)", border: `1px solid rgba(255,45,120,0.3)`,
                color: COLORS.neonPink, cursor: "pointer",
              }}
            >
              Clear All Filters ({activeFilterCount})
            </button>
          )}
          <div style={{ marginLeft: "auto", fontSize: 12, color: COLORS.textSecondary, alignSelf: "center" }}>
            Showing <strong style={{ color: COLORS.textPrimary }}>{filteredLeads.length}</strong> of {leads.length} leads
          </div>
        </div>
      </Card>

      {/* Bulk Actions */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={handleBulkScrape}
          disabled={bulkScraping}
          style={{
            ...btnPrimary,
            background: bulkScraping ? COLORS.cardBorder : `linear-gradient(135deg, ${COLORS.neonGreen}, ${COLORS.neonBlue})`,
            color: "#000",
            opacity: bulkScraping ? 0.6 : 1,
          }}
        >
          {bulkScraping
            ? `Scraping... ${bulkScrapeProgress.current}/${bulkScrapeProgress.total} (${bulkScrapeProgress.found} found)`
            : `Bulk Scrape Emails (${filteredLeads.filter((l) => l.website && !l.email && (l.scrape_attempts || 0) < 5).length} leads)`}
        </button>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          style={{ ...selectStyle, minWidth: 160 }}
        >
          <option value="initial_outreach">Initial Outreach</option>
          <option value="follow_up">Follow Up</option>
          <option value="preview_share">Preview Share</option>
        </select>
        <button
          onClick={handleBulkSend}
          disabled={bulkSending}
          style={{
            ...btnPrimary,
            background: bulkSending ? COLORS.cardBorder : `linear-gradient(135deg, ${COLORS.neonOrange}, ${COLORS.neonPink})`,
            opacity: bulkSending ? 0.6 : 1,
          }}
        >
          {bulkSending
            ? `Sending... ${bulkSendProgress.current}/${bulkSendProgress.total} (${bulkSendProgress.sent} sent)`
            : `Bulk Send Email (${filteredLeads.filter((l) => l.email && !l.unsubscribed_at).length} leads)`}
        </button>
        <button
          onClick={handleCleanupJunk}
          disabled={cleanupRunning || reclassifying}
          style={{
            ...btnPrimary,
            background: cleanupRunning ? COLORS.cardBorder : `linear-gradient(135deg, ${COLORS.neonYellow}, ${COLORS.neonOrange})`,
            color: "#000",
            opacity: cleanupRunning ? 0.6 : 1,
          }}
          title="Scan lead names for obvious non-targets (fire departments, churches, medical, etc.) and flag as Excluded"
        >
          {cleanupRunning ? "Scanning..." : "Flag Junk Leads"}
        </button>
        <button
          onClick={handleReclassify}
          disabled={reclassifying || cleanupRunning}
          style={{
            ...btnPrimary,
            background: reclassifying ? COLORS.cardBorder : `linear-gradient(135deg, ${COLORS.neonBlue}, ${COLORS.neonPurple})`,
            opacity: reclassifying ? 0.6 : 1,
          }}
          title="Re-fetch each lead's business type from Google Places API (costs ~$5 per 1000 leads)"
        >
          {reclassifying
            ? `Reclassifying... ${reclassifyProgress.done}/${reclassifyProgress.total}${reclassifyProgress.errors ? ` (${reclassifyProgress.errors} err)` : ""}`
            : "Reclassify Types"}
        </button>
      </div>

      {/* Leads Table */}
      <Card style={{ marginTop: 16 }} title={`Leads (${filteredLeads.length})`}>
        {leadsLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>Loading leads...</div>
        ) : (
          <DataTable
            columns={leadsColumns}
            data={filteredLeads}
            onRowClick={(row) => {
              setSelectedLead(row as unknown as SalesLead);
              fetchNotes(row.id as string);
              fetchOutreachHistory(row.id as string);
              fetchLeadAppointment(row.id as string);
            }}
          />
        )}
      </Card>

      {/* ========== LEAD DETAIL MODAL ========== */}
      {selectedLead && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
          onClick={() => { setSelectedLead(null); setConfirmDelete(false); setLeadAppointment(null); setApptFormOpen(false); }}
        >
          <div
            style={{
              background: COLORS.darkBg,
              border: "1px solid " + COLORS.cardBorder,
              borderRadius: 16,
              width: "100%",
              maxWidth: 700,
              maxHeight: "90vh",
              overflow: "auto",
              padding: 32,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, color: COLORS.textPrimary }}>
                  {selectedLead.business_name}
                </h2>
                <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center" }}>
                  <Badge status={selectedLead.status} />
                  <span style={{ color: COLORS.neonYellow, fontSize: 13 }}>
                    {renderStars(selectedLead.google_rating)}
                    {selectedLead.google_total_ratings ? ` (${selectedLead.google_total_ratings})` : ""}
                  </span>
                  {selectedLead.google_price_level !== null && (
                    <span style={{ color: COLORS.neonGreen, fontSize: 13 }}>
                      {PRICE_LABELS[selectedLead.google_price_level]}
                    </span>
                  )}
                  <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                    {typeLabels[selectedLead.business_type || ""] || selectedLead.business_type}
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setSelectedLead(null); setConfirmDelete(false); setLeadAppointment(null); setApptFormOpen(false); }}
                style={{ background: "none", border: "none", color: COLORS.textSecondary, cursor: "pointer", fontSize: 20 }}
              >
                ✕
              </button>
            </div>

            {/* Contact Info */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>Contact Info</span>
                {!editingContact ? (
                  <button
                    onClick={() => startEditingContact(selectedLead)}
                    style={{ fontSize: 11, color: COLORS.neonBlue, cursor: "pointer", background: "none", border: "none", fontWeight: 600 }}
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    onClick={() => setEditingContact(false)}
                    style={{ fontSize: 11, color: COLORS.textSecondary, cursor: "pointer", background: "none", border: "none" }}
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {/* Business Name & Type (only in edit mode) */}
                {editingContact && (
                  <>
                    <div style={{ padding: 16, background: COLORS.cardBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, gridColumn: "1 / 3" }}>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Business Name</div>
                      <input
                        type="text" value={editContactValues.business_name}
                        onChange={(e) => setEditContactValues({ ...editContactValues, business_name: e.target.value })}
                        placeholder="Business name"
                        style={{ width: "100%", padding: "6px 10px", borderRadius: 6, fontSize: 13, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: COLORS.textPrimary, outline: "none" }}
                      />
                    </div>
                    <div style={{ padding: 16, background: COLORS.cardBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder }}>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Business Type</div>
                      <select
                        value={editContactValues.business_type}
                        onChange={(e) => setEditContactValues({ ...editContactValues, business_type: e.target.value })}
                        style={{ width: "100%", padding: "6px 10px", borderRadius: 6, fontSize: 13, background: COLORS.cardBg, border: "1px solid rgba(255,255,255,0.1)", color: COLORS.textPrimary, outline: "none" }}
                      >
                        <option value="">Select type...</option>
                        {typeOptions.filter(o => o.value !== "all").map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Phone */}
                <div style={{ padding: 16, background: COLORS.cardBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Phone</div>
                  {editingContact ? (
                    <input
                      type="tel" value={editContactValues.phone}
                      onChange={(e) => setEditContactValues({ ...editContactValues, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 6, fontSize: 13, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: COLORS.textPrimary, outline: "none" }}
                    />
                  ) : selectedLead.phone ? (
                    <a href={`tel:${selectedLead.phone}`} style={{ color: COLORS.neonBlue, textDecoration: "none", fontSize: 14 }}>{selectedLead.phone}</a>
                  ) : (
                    <span style={{ color: COLORS.textSecondary, fontSize: 14 }}>No phone listed</span>
                  )}
                </div>

                {/* Website */}
                <div style={{ padding: 16, background: COLORS.cardBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Website</div>
                  {editingContact ? (
                    <input
                      type="url" value={editContactValues.website}
                      onChange={(e) => setEditContactValues({ ...editContactValues, website: e.target.value })}
                      placeholder="https://example.com"
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 6, fontSize: 13, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: COLORS.textPrimary, outline: "none" }}
                    />
                  ) : selectedLead.website ? (
                    <a href={selectedLead.website} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.neonBlue, textDecoration: "none", fontSize: 14, wordBreak: "break-all" }}>
                      {selectedLead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  ) : (
                    <span style={{ color: COLORS.textSecondary, fontSize: 14 }}>No website listed</span>
                  )}
                </div>

                {/* Email */}
                <div style={{ padding: 16, background: COLORS.cardBg, borderRadius: 10, border: `1px solid ${selectedLead.email ? COLORS.neonGreen + "30" : COLORS.cardBorder}` }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                    <span>Email</span>
                    {selectedLead.email_source && !editingContact && (
                      <span style={{ fontSize: 9, color: COLORS.neonBlue, fontWeight: 400, textTransform: "none" }}>
                        {selectedLead.email_source}
                      </span>
                    )}
                  </div>
                  {editingContact ? (
                    <input
                      type="email" value={editContactValues.email}
                      onChange={(e) => setEditContactValues({ ...editContactValues, email: e.target.value })}
                      placeholder="email@example.com"
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 6, fontSize: 13, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: COLORS.textPrimary, outline: "none" }}
                    />
                  ) : selectedLead.email ? (
                    <a href={`mailto:${selectedLead.email}`} style={{ color: COLORS.neonGreen, textDecoration: "none", fontSize: 14, wordBreak: "break-all" }}>
                      {selectedLead.email}
                    </a>
                  ) : selectedLead.website ? (
                    <button
                      onClick={() => handleScrapeEmail(selectedLead.id)}
                      disabled={scrapingEmail}
                      style={{
                        padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        background: scrapingEmail ? COLORS.cardBorder : "rgba(0,255,135,0.1)",
                        border: `1px solid ${COLORS.neonGreen}40`, color: COLORS.neonGreen,
                      }}
                    >
                      {scrapingEmail ? "Scraping..." : "Scrape Email"}
                    </button>
                  ) : (
                    <span style={{ color: COLORS.textSecondary, fontSize: 14 }}>No website to scrape</span>
                  )}
                  {selectedLead.unsubscribed_at && !editingContact && (
                    <div style={{ fontSize: 11, color: COLORS.neonRed, marginTop: 4 }}>Unsubscribed</div>
                  )}
                </div>

                {/* Address */}
                <div style={{ padding: 16, background: COLORS.cardBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Address</div>
                  {editingContact ? (
                    <input
                      type="text" value={editContactValues.address}
                      onChange={(e) => setEditContactValues({ ...editContactValues, address: e.target.value })}
                      placeholder="123 Main St, City, State"
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 6, fontSize: 13, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: COLORS.textPrimary, outline: "none" }}
                    />
                  ) : (
                    <span style={{ color: COLORS.textPrimary, fontSize: 14 }}>
                      {selectedLead.address || "No address listed"}
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Status + Rep */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Status</label>
                <select
                  value={selectedLead.status}
                  onChange={(e) => handleStatusChange(selectedLead.id, e.target.value)}
                  style={selectStyle}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Assigned Rep</label>
                <select
                  value={selectedLead.assigned_rep_id || ""}
                  onChange={(e) => handleAssignRep(selectedLead.id, e.target.value || null)}
                  style={selectStyle}
                >
                  <option value="">Unassigned</option>
                  {salesReps.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  onClick={() => handleMarkContacted(selectedLead.id)}
                  style={{
                    ...btnPrimary,
                    background: COLORS.gradient2,
                    color: "#000",
                    width: "100%",
                  }}
                >
                  📞 Mark Contacted
                </button>
              </div>
            </div>

            {/* Last contacted */}
            {selectedLead.last_contacted_at && (
              <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 16 }}>
                Last contacted: {formatDate(selectedLead.last_contacted_at)}
              </div>
            )}

            {/* Appointment */}
            <div style={{
              marginBottom: 24,
              padding: 16,
              background: leadAppointment
                ? `linear-gradient(135deg, ${COLORS.neonBlue}08, ${COLORS.neonPurple}08)`
                : COLORS.cardBg,
              border: `1px solid ${leadAppointment ? COLORS.neonBlue + "30" : COLORS.cardBorder}`,
              borderRadius: 12,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 10 }}>
                Appointment
              </div>

              {apptLoading ? (
                <div style={{ fontSize: 13, color: COLORS.textSecondary }}>Loading...</div>
              ) : apptFormOpen ? (
                /* Appointment form */
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Date</label>
                      <input type="date" value={apptForm.date} onChange={(e) => setApptForm((p) => ({ ...p, date: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Time</label>
                      <input type="time" value={apptForm.time} onChange={(e) => setApptForm((p) => ({ ...p, time: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Duration</label>
                      <select value={apptForm.duration_min} onChange={(e) => setApptForm((p) => ({ ...p, duration_min: Number(e.target.value) }))} style={selectStyle}>
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                        <option value={120}>2 hours</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Assigned Rep</label>
                      <select value={apptForm.rep_id} onChange={(e) => setApptForm((p) => ({ ...p, rep_id: e.target.value }))} style={selectStyle}>
                        <option value="">Unassigned</option>
                        {salesReps.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Location</label>
                    <input type="text" value={apptForm.location} onChange={(e) => setApptForm((p) => ({ ...p, location: e.target.value }))} placeholder="Business address" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Notes</label>
                    <input type="text" value={apptForm.notes} onChange={(e) => setApptForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button onClick={handleSaveAppointment} disabled={apptSaving || !apptForm.date || !apptForm.time} style={{ ...btnPrimary, background: apptSaving ? COLORS.cardBorder : `linear-gradient(135deg, ${COLORS.neonBlue}, ${COLORS.neonPurple})`, opacity: (apptSaving || !apptForm.date || !apptForm.time) ? 0.5 : 1 }}>
                      {apptSaving ? "Saving..." : leadAppointment ? "Update Appointment" : "Schedule Appointment"}
                    </button>
                    <button onClick={() => setApptFormOpen(false)} style={btnSecondary}>Cancel</button>
                  </div>
                </div>
              ) : leadAppointment ? (
                /* Existing appointment display */
                <div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.neonBlue }}>
                      {new Date(leadAppointment.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {" at "}
                      {new Date(leadAppointment.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </div>
                    <span style={{ fontSize: 12, color: COLORS.textSecondary, background: COLORS.cardBg, padding: "2px 8px", borderRadius: 6 }}>
                      {leadAppointment.duration_min} min
                    </span>
                  </div>
                  {leadAppointment.assigned_rep_id && (
                    <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>
                      Rep: {salesReps.find((r) => r.id === leadAppointment.assigned_rep_id)?.name || "Unknown"}
                    </div>
                  )}
                  {leadAppointment.location && (
                    <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>
                      {leadAppointment.location}
                    </div>
                  )}
                  {leadAppointment.notes && (
                    <div style={{ fontSize: 13, color: COLORS.textSecondary, fontStyle: "italic", marginBottom: 8 }}>
                      {leadAppointment.notes}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => openApptForm(leadAppointment)} style={btnSecondary}>Edit</button>
                    <button onClick={() => handleCompleteAppointment("completed")} style={{ ...btnSecondary, color: COLORS.neonGreen, borderColor: COLORS.neonGreen + "50" }}>Mark Complete</button>
                    <button onClick={() => handleCompleteAppointment("no_show")} style={{ ...btnSecondary, color: COLORS.neonOrange, borderColor: COLORS.neonOrange + "50" }}>No Show</button>
                    <button onClick={handleCancelAppointment} style={{ ...btnSecondary, color: COLORS.neonRed, borderColor: COLORS.neonRed + "50" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                /* No appointment */
                <button onClick={() => openApptForm()} style={{ ...btnPrimary, background: `linear-gradient(135deg, ${COLORS.neonBlue}, ${COLORS.neonPurple})` }}>
                  Schedule Appointment
                </button>
              )}
            </div>

            {/* Preview */}
            <div style={{
              marginBottom: 24,
              padding: 16,
              background: selectedLead.preview_business_id
                ? `linear-gradient(135deg, ${COLORS.neonGreen}08, ${COLORS.neonBlue}08)`
                : COLORS.cardBg,
              border: `1px solid ${selectedLead.preview_business_id ? COLORS.neonGreen + "30" : COLORS.cardBorder}`,
              borderRadius: 12,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>
                Sales Preview
              </div>
              <div style={{
                fontSize: 11, color: COLORS.neonYellow, marginBottom: 12,
                padding: "6px 10px", borderRadius: 6,
                background: `${COLORS.neonYellow}08`,
                border: `1px solid ${COLORS.neonYellow}25`,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span>{"\u26A0\uFE0F"}</span>
                <span>Each Create/Recreate fetches Google Places data and costs LetsGo money. Use sparingly — only for leads you plan to actually pitch.</span>
              </div>
              {selectedLead.preview_business_id ? (
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <a
                    href={`/preview/${selectedLead.preview_business_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      ...btnPrimary,
                      background: `linear-gradient(135deg, ${COLORS.neonGreen}, ${COLORS.neonBlue})`,
                      color: "#000",
                      textDecoration: "none",
                      display: "inline-block",
                    }}
                  >
                    View Preview
                  </a>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/preview/${selectedLead.preview_business_id}`;
                      navigator.clipboard.writeText(url);
                      alert("Preview link copied!");
                    }}
                    style={btnSecondary}
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => handleCreatePreview(true)}
                    disabled={creatingPreview}
                    style={{
                      ...btnSecondary,
                      fontSize: 11,
                      opacity: creatingPreview ? 0.5 : 1,
                    }}
                  >
                    {creatingPreview ? "Recreating..." : "Recreate"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button
                    onClick={() => handleCreatePreview(false)}
                    disabled={creatingPreview}
                    style={{
                      ...btnPrimary,
                      background: creatingPreview
                        ? COLORS.cardBorder
                        : `linear-gradient(135deg, ${COLORS.neonPink}, ${COLORS.neonOrange})`,
                      opacity: creatingPreview ? 0.6 : 1,
                    }}
                  >
                    {creatingPreview ? "Creating Preview..." : "Create Preview"}
                  </button>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                    Fetches Google photos, creates a live preview page
                  </span>
                </div>
              )}
            </div>

            {/* Email Outreach */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 12 }}>Email Outreach</div>

              {/* Send outreach controls */}
              {selectedLead.email && !selectedLead.unsubscribed_at && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    style={{ ...selectStyle, minWidth: 180 }}
                  >
                    <option value="initial_outreach">Initial Outreach</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="preview_share">Preview Share</option>
                  </select>
                  <button
                    onClick={() => handleSendOutreach(selectedLead.id)}
                    disabled={sendingOutreach}
                    style={{
                      ...btnPrimary,
                      background: sendingOutreach ? COLORS.cardBorder : `linear-gradient(135deg, ${COLORS.neonOrange}, ${COLORS.neonPink})`,
                      opacity: sendingOutreach ? 0.6 : 1,
                    }}
                  >
                    {sendingOutreach ? "Sending..." : "Send Email"}
                  </button>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                    to {selectedLead.email}
                  </span>
                </div>
              )}
              {!selectedLead.email && (
                <div style={{ fontSize: 13, color: COLORS.textSecondary, fontStyle: "italic", marginBottom: 12 }}>
                  No email address — scrape one from the website first
                </div>
              )}
              {selectedLead.unsubscribed_at && (
                <div style={{ fontSize: 13, color: COLORS.neonRed, marginBottom: 12 }}>
                  This business has unsubscribed from outreach emails
                </div>
              )}

              {/* Outreach history */}
              {outreachLoading ? (
                <div style={{ color: COLORS.textSecondary, fontSize: 13 }}>Loading outreach history...</div>
              ) : outreachHistory.length === 0 ? (
                <div style={{ color: COLORS.textSecondary, fontSize: 13, fontStyle: "italic" }}>No outreach emails sent yet</div>
              ) : (
                <div style={{ maxHeight: 200, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {outreachHistory.map((oe) => (
                    <div
                      key={oe.id}
                      style={{
                        padding: "10px 14px",
                        background: COLORS.cardBg,
                        border: "1px solid " + COLORS.cardBorder,
                        borderRadius: 8,
                        fontSize: 13,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ color: COLORS.textPrimary, fontWeight: 600 }}>{oe.subject}</div>
                        <div style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>
                          {oe.template.replace(/_/g, " ")} — {oe.sent_at ? new Date(oe.sent_at).toLocaleDateString() : "pending"}
                          {oe.sent_by && ` — by ${oe.sent_by}`}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <Badge status={oe.status} />
                        {oe.opened_at && (
                          <span style={{ fontSize: 10, color: COLORS.neonGreen }}>
                            opened {new Date(oe.opened_at).toLocaleDateString()}
                          </span>
                        )}
                        {oe.clicked_at && (
                          <span style={{ fontSize: 10, color: COLORS.neonBlue }}>
                            clicked {new Date(oe.clicked_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 12 }}>Notes</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                  placeholder="Add a note..."
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={handleAddNote} disabled={!newNote.trim()} style={{ ...btnPrimary, opacity: newNote.trim() ? 1 : 0.5 }}>
                  Add
                </button>
              </div>
              {notesLoading ? (
                <div style={{ color: COLORS.textSecondary, fontSize: 13 }}>Loading notes...</div>
              ) : leadNotes.length === 0 ? (
                <div style={{ color: COLORS.textSecondary, fontSize: 13, fontStyle: "italic" }}>No notes yet</div>
              ) : (
                <div style={{ maxHeight: 200, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {leadNotes.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        padding: "10px 14px",
                        background: COLORS.cardBg,
                        border: "1px solid " + COLORS.cardBorder,
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    >
                      <div style={{ color: COLORS.textPrimary }}>{note.note}</div>
                      <div style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 4 }}>
                        {note.created_by} — {formatDate(note.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Meta info */}
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>Imported: {formatDate(selectedLead.created_at)}</span>
              {selectedLead.imported_by && <span>By: {selectedLead.imported_by}</span>}
              {selectedLead.search_query && <span>Search: &quot;{selectedLead.search_query}&quot;</span>}
            </div>

            {/* Footer: Delete + Save All */}
            <div style={{ borderTop: "1px solid " + COLORS.cardBorder, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {confirmDelete ? (
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ color: COLORS.neonRed, fontSize: 13 }}>Delete this lead permanently?</span>
                    <button onClick={handleDeleteLead} style={{ ...btnSecondary, borderColor: COLORS.neonRed, color: COLORS.neonRed }}>
                      Yes, Delete
                    </button>
                    <button onClick={() => setConfirmDelete(false)} style={btnSecondary}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} style={{ ...btnSecondary, color: COLORS.textSecondary, fontSize: 12 }}>
                    Delete Lead
                  </button>
                )}
              </div>
              {editingContact && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setEditingContact(false)}
                    style={{
                      padding: "10px 20px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                      background: "transparent", border: "1px solid " + COLORS.cardBorder, color: COLORS.textSecondary,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveContact(selectedLead.id)}
                    disabled={savingContact}
                    style={{
                      padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      background: COLORS.gradient1, border: "none", color: "#fff",
                      opacity: savingContact ? 0.6 : 1,
                    }}
                  >
                    {savingContact ? "Saving..." : "Save All"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
