"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  created_at: string;
  updated_at: string;
}

interface LeadNote {
  id: string;
  lead_id: string;
  note: string;
  created_by: string | null;
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
  // ---------- Search state ----------
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

  // ---------- Filter state ----------
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRep, setFilterRep] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");

  // ---------- Modal state ----------
  const [selectedLead, setSelectedLead] = useState<SalesLead | null>(null);
  const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      business_type: searchType !== "all" ? searchType : place.business_type,
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

    const types = typeOptions.filter((o) => o.value !== "all");
    const radii = [5, 10, 20, 50];
    const totalSteps = types.length * radii.length;
    let totalImported = 0;
    let totalSkipped = 0;

    setGenerating(true);
    generateAbortRef.current = false;
    setGenerateProgress({ current: 0, total: totalSteps, type: "", radius: 0, imported: 0, skipped: 0 });

    try {
      const token = await getAuthToken();
      let stepIndex = 0;

      for (const radius of radii) {
        for (const typeOpt of types) {
          if (generateAbortRef.current) break;

          stepIndex++;
          setGenerateProgress({ current: stepIndex, total: totalSteps, type: typeOpt.label, radius, imported: totalImported, skipped: totalSkipped });

          // Search this type + radius combo
          const query = `${typeOpt.value} in ${location}`;
          let pageToken: string | null = null;
          let pageCount = 0;

          // Page through results (up to 3 pages = 60 results)
          do {
            if (generateAbortRef.current) break;

            const body: Record<string, unknown> = pageToken
              ? { query, pageToken }
              : { query, radiusMiles: radius };

            const searchRes = await fetch("/api/admin/sales/prospect", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(body),
            });

            if (!searchRes.ok) {
              console.error(`Search failed for "${query}" at ${radius}mi:`, await searchRes.text());
              break;
            }

            const searchData = await searchRes.json();
            const places = searchData.places || [];

            if (places.length > 0) {
              // Build lead rows with the correct type
              const rows = places.map((place: GooglePlaceResult) => ({
                google_place_id: place.google_place_id,
                business_name: place.business_name,
                business_type: typeOpt.value,
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

              // Import via API
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
        if (generateAbortRef.current) break;
      }

      logAudit({
        action: "generate_all_leads",
        tab: AUDIT_TABS.SALES,
        subTab: "Prospecting",
        targetType: "sales_lead",
        details: `Generated leads for "${location}": ${totalImported} imported, ${totalSkipped} duplicates skipped`,
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

  // ---------- Filtered data ----------

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (filterRep !== "all" && (l.assigned_rep_id || "unassigned") !== filterRep) return false;
      if (filterType !== "all" && l.business_type !== filterType) return false;
      if (filterSearch) {
        const s = filterSearch.toLowerCase();
        const match =
          l.business_name.toLowerCase().includes(s) ||
          (l.address || "").toLowerCase().includes(s) ||
          (l.city || "").toLowerCase().includes(s) ||
          (l.phone || "").includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [leads, filterStatus, filterRep, filterType, filterSearch]);

  // Stats
  const stats = useMemo(() => {
    const total = leads.length;
    const notContacted = leads.filter((l) => l.status === "not_contacted").length;
    const inPipeline = leads.filter((l) =>
      ["contacted", "pitched", "follow_up"].includes(l.status)
    ).length;
    const signedUp = leads.filter((l) => l.status === "signed_up").length;
    const convRate = total > 0 ? ((signedUp / total) * 100).toFixed(1) : "0.0";
    return { total, notContacted, inPipeline, signedUp, convRate };
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
      render: (v: unknown) => (
        <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>{String(v)}</span>
      ),
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
        <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>
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
            style={{ color: COLORS.neonBlue, fontSize: 12, textDecoration: "none" }}
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
      key: "google_rating",
      label: "Rating",
      align: "center" as const,
      render: (v: unknown, row: Record<string, unknown>) => (
        <span style={{ color: COLORS.neonYellow, fontSize: 12 }}>
          {renderStars(v as number | null)}
          {row.google_total_ratings ? <span style={{ color: COLORS.textSecondary, marginLeft: 4 }}>({String(row.google_total_ratings)})</span> : null}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      align: "center" as const,
      render: (v: unknown) => <Badge status={String(v)} />,
    },
    {
      key: "assigned_rep_id",
      label: "Rep",
      render: (v: unknown) => {
        const rep = v ? salesReps.find((r) => r.id === String(v)) : null;
        return (
          <span style={{ color: rep ? COLORS.textPrimary : COLORS.textSecondary, fontSize: 12 }}>
            {rep?.name || "Unassigned"}
          </span>
        );
      },
    },
    {
      key: "last_contacted_at",
      label: "Last Contact",
      render: (v: unknown) => (
        <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>
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
      </div>

      {/* Filters + Export */}
      <Card>
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
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selectStyle}>
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Search</label>
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Name, address, phone..."
              style={inputStyle}
            />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => handleExport("csv")} style={btnSecondary}>CSV</button>
            <button onClick={() => handleExport("xlsx")} style={btnSecondary}>XLSX</button>
          </div>
        </div>
      </Card>

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
          onClick={() => { setSelectedLead(null); setConfirmDelete(false); }}
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
                onClick={() => { setSelectedLead(null); setConfirmDelete(false); }}
                style={{ background: "none", border: "none", color: COLORS.textSecondary, cursor: "pointer", fontSize: 20 }}
              >
                ✕
              </button>
            </div>

            {/* Contact Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ padding: 16, background: COLORS.cardBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Phone</div>
                {selectedLead.phone ? (
                  <a href={`tel:${selectedLead.phone}`} style={{ color: COLORS.neonBlue, textDecoration: "none", fontSize: 14 }}>
                    {selectedLead.phone}
                  </a>
                ) : (
                  <span style={{ color: COLORS.textSecondary, fontSize: 14 }}>No phone listed</span>
                )}
              </div>
              <div style={{ padding: 16, background: COLORS.cardBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Website</div>
                {selectedLead.website ? (
                  <a href={selectedLead.website} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.neonBlue, textDecoration: "none", fontSize: 14, wordBreak: "break-all" }}>
                    {selectedLead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                ) : (
                  <span style={{ color: COLORS.textSecondary, fontSize: 14 }}>No website listed</span>
                )}
              </div>
              <div style={{ padding: 16, background: COLORS.cardBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Address</div>
                <span style={{ color: COLORS.textPrimary, fontSize: 14 }}>
                  {selectedLead.address || "No address listed"}
                </span>
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

            {/* Delete */}
            <div style={{ borderTop: "1px solid " + COLORS.cardBorder, paddingTop: 16 }}>
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
          </div>
        </div>
      )}
    </div>
  );
}
