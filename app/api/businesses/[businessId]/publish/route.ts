import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Verify caller is business owner/manager or admin staff
async function requireBusinessAccess(req: NextRequest, businessId: string): Promise<Response | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: bizAccess } = await supabaseServer
    .from("business_users").select("role").eq("business_id", businessId)
    .eq("user_id", user.id).in("role", ["owner", "manager"]).maybeSingle();
  if (bizAccess) return null;
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (staff) return null;
  return NextResponse.json({ error: "Business access required" }, { status: 403 });
}

// Map full day names (from Profile tab) → short DB column prefixes
const DAY_MAP: Record<string, string> = {
  monday: "mon",
  tuesday: "tue",
  wednesday: "wed",
  thursday: "thu",
  friday: "fri",
  saturday: "sat",
  sunday: "sun",
};

// Convert "10:00 AM" / "06:00 PM" → "10:00" / "18:00" (24h for DB)
// Also handles already-24h values like "10:00" or "18:00"
function to24h(time: string): string {
  if (!time || time === "Closed") return "";
  // Already 24h format (no AM/PM)
  if (!/[ap]m/i.test(time)) return time.replace(/:\d{2}$/, ""); // strip seconds if present

  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();

  if (period === "AM" && hours === 12) hours = 0;
  if (period === "PM" && hours !== 12) hours += 12;

  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

/**
 * POST /api/businesses/[businessId]/publish
 * Updates the business row with profile changes from the business dashboard.
 * Uses supabaseServer (service role) to bypass RLS.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
): Promise<Response> {
  const { businessId } = await context.params;

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  const denied = await requireBusinessAccess(req, businessId);
  if (denied) return denied;

  let body: {
    business: Record<string, string | null>;
    config: Record<string, string | null>;
    hours: Record<string, { open: string; close: string }>;
    tags: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 1) Load existing row to merge config
  const { data: existing, error: loadErr } = await supabaseServer
    .from("business")
    .select("config")
    .eq("id", businessId)
    .maybeSingle();

  if (loadErr) {
    console.error("publish load error:", loadErr.message);
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // 2) Convert hours from Profile format → config.hours format (short keys + enabled flag)
  const configHours: Record<string, { enabled: boolean; open: string; close: string }> = {};
  const hours = body.hours ?? {};

  for (const [fullDay, shortDay] of Object.entries(DAY_MAP)) {
    const dayHours = hours[fullDay];
    if (!dayHours || dayHours.open === "Closed" || !dayHours.open) {
      configHours[shortDay] = { enabled: false, open: "", close: "" };
    } else {
      configHours[shortDay] = {
        enabled: true,
        open: to24h(dayHours.open),
        close: to24h(dayHours.close),
      };
    }
  }

  // 3) Merge config: keep existing config, overlay rep/login fields + tags
  //    Hours are written to standalone day columns only (single source of truth)
  const existingConfig = (existing.config ?? {}) as Record<string, unknown>;
  const mergedConfig = {
    ...existingConfig,
    ...body.config,
    tags: body.tags ?? existingConfig.tags ?? [],
  };

  // 4) Build the update — business columns + merged config + standalone hour columns
  const update: Record<string, unknown> = {
    ...body.business,
    config: mergedConfig,
  };

  // Dual-write columns so admin and profile always stay in sync.
  // Profile uses: business_phone, blurb, category_main
  // Admin uses:   contact_phone, description, cuisine_type
  const biz = body.business ?? {};
  if (biz.business_phone !== undefined) update.contact_phone = biz.business_phone;
  if (biz.blurb !== undefined) update.description = biz.blurb;
  if (biz.category_main !== undefined) update.cuisine_type = biz.category_main;

  // Login credentials: profile writes to config, admin reads top-level columns
  const cfg = body.config ?? {};
  if (cfg.loginEmail !== undefined) update.login_email = cfg.loginEmail;
  if (cfg.loginPhone !== undefined) update.login_phone = cfg.loginPhone;

  // Rep fields: profile writes to config, ensure top-level columns also updated
  if (cfg.repName !== undefined) update.rep_name = cfg.repName;
  if (cfg.repTitle !== undefined) update.rep_title = cfg.repTitle;
  if (cfg.repEmail !== undefined) update.rep_email = cfg.repEmail;
  if (cfg.repPhone !== undefined) update.rep_phone = cfg.repPhone;

  // Tags: profile writes to config.tags, admin reads top-level tags column
  if (body.tags) update.tags = body.tags;

  // Write standalone hour columns (DB source of truth for admin pages)
  for (const [fullDay, shortDay] of Object.entries(DAY_MAP)) {
    const ch = configHours[shortDay];
    if (ch && ch.enabled && ch.open) {
      update[`${shortDay}_open`] = ch.open;
      update[`${shortDay}_close`] = ch.close;
    } else {
      update[`${shortDay}_open`] = null;
      update[`${shortDay}_close`] = null;
    }
  }

  const { error: updateErr } = await supabaseServer
    .from("business")
    .update(update)
    .eq("id", businessId);

  if (updateErr) {
    console.error("publish update error:", updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
