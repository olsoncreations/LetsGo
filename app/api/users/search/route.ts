import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// ─── Helper: authenticate request ───

async function authenticate(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * GET /api/users/search?q=john
 * Search profiles by name or username. Excludes the requesting user.
 */
export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const pattern = `%${q}%`;
  const { data, error: searchErr } = await supabaseServer
    .from("profiles")
    .select("id, full_name, first_name, last_name, username, avatar_url, email")
    .or(
      `full_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},username.ilike.${pattern},email.ilike.${pattern}`
    )
    .neq("id", user.id)
    .limit(10);

  if (searchErr) {
    return NextResponse.json({ error: searchErr.message }, { status: 500 });
  }

  // Enrich with auth metadata for users with poor name data
  const searchResults = data ?? [];
  const resultMap = new Map<string, Record<string, unknown>>();
  for (const p of searchResults) {
    resultMap.set(p.id as string, p as Record<string, unknown>);
  }

  const needsEnrichment = searchResults.filter(p => {
    const first = (p.first_name as string) || "";
    const last = (p.last_name as string) || "";
    const full = (p.full_name as string) || "";
    if (first && last) return false;
    if (full && !full.includes("@")) return false;
    return true;
  });

  if (needsEnrichment.length > 0) {
    await Promise.all(needsEnrichment.map(async (p) => {
      try {
        const { data: { user: authUser } } = await supabaseServer.auth.admin.getUserById(p.id as string);
        if (!authUser) return;
        const rec: Record<string, unknown> = { ...(resultMap.get(p.id as string) || {}) };
        const meta = authUser.user_metadata || {};
        if (meta.full_name && typeof meta.full_name === "string" && !meta.full_name.includes("@")) {
          rec.full_name = meta.full_name;
        }
        if (meta.first_name) rec.first_name = meta.first_name;
        if (meta.last_name) rec.last_name = meta.last_name;
        if (meta.name && typeof meta.name === "string" && !meta.name.includes("@")) {
          if (!rec.full_name || (rec.full_name as string).includes("@")) rec.full_name = meta.name;
        }
        if (!rec.email) rec.email = authUser.email || "";
        resultMap.set(p.id as string, rec);
      } catch { /* ignore */ }
    }));
  }

  // Format as "First L." (first name + last initial)
  function formatDisplayName(p: Record<string, unknown>): string {
    const first = (p.first_name as string) || "";
    const last = (p.last_name as string) || "";
    const full = (p.full_name as string) || "";
    if (first && last) return `${first} ${last[0].toUpperCase()}.`;
    if (full && !full.includes("@")) {
      const parts = full.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
      return parts[0];
    }
    if (first) return first;
    const email = (p.email as string) || (full.includes("@") ? full : "");
    if (email) {
      const local = email.split("@")[0].replace(/\d+$/g, "").replace(/[._-]/g, " ").trim();
      if (!local) return "Unknown";
      const words = local.split(/\s+/);
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    return "Unknown";
  }

  const results = searchResults.map(p => {
    const enriched = resultMap.get(p.id as string) ?? (p as Record<string, unknown>);
    return {
      id: p.id,
      name: formatDisplayName(enriched),
      username: (p.username as string) || null,
      avatarUrl: (p.avatar_url as string) || null,
    };
  });

  return NextResponse.json({ users: results });
}
