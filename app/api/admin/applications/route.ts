import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

async function requireStaff(req: NextRequest): Promise<Response | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return null;
}

// ── GET — List all applications (staff only) ──
export async function GET(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  const type = req.nextUrl.searchParams.get("type");
  const status = req.nextUrl.searchParams.get("status");

  let query = supabaseServer
    .from("role_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (type) query = query.eq("application_type", type);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data || [] });
}

// ── PATCH — Approve or reject an application (staff only) ──
export async function PATCH(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  // Get staff user for audit trail
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const { data: { user: staffUser } } = await supabaseServer.auth.getUser(token);
  const { data: staffProfile } = await supabaseServer
    .from("profiles")
    .select("full_name")
    .eq("id", staffUser!.id)
    .maybeSingle();

  const body = await req.json();
  const { id, action, message, assignmentData } = body;

  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Fetch the application
  const { data: app, error: fetchError } = await supabaseServer
    .from("role_applications")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (app.status !== "submitted") {
    return NextResponse.json({ error: "Application already processed" }, { status: 409 });
  }

  const staffName = staffProfile?.full_name || staffUser!.id;

  if (action === "approve") {
    // Update application status
    const { error: updateErr } = await supabaseServer
      .from("role_applications")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: staffName,
        review_message: message || null,
      })
      .eq("id", id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Create the actual role record
    if (app.application_type === "sales_rep") {
      const avatar = app.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
      const { error: repErr } = await supabaseServer.from("sales_reps").insert({
        name: app.full_name,
        email: app.email,
        phone: app.phone || null,
        role: assignmentData?.role || "sales_rep",
        division_id: assignmentData?.division_id || null,
        zone_id: assignmentData?.zone_id || null,
        county_id: assignmentData?.county_id || null,
        state: assignmentData?.state || null,
        city: app.city || null,
        supervisor_id: assignmentData?.supervisor_id || null,
        hire_date: new Date().toISOString().split("T")[0],
        status: "active",
        avatar,
        individual_quota: assignmentData?.individual_quota || 60,
      });
      if (repErr) {
        console.error("[admin/applications] sales_reps insert error:", repErr.message);
        return NextResponse.json({ error: "Failed to create sales rep record: " + repErr.message }, { status: 500 });
      }
    } else if (app.application_type === "influencer") {
      // Generate influencer code from name + year
      const namePart = app.full_name.replace(/\s+/g, "").toUpperCase().slice(0, 10);
      const year = new Date().getFullYear();
      let code = assignmentData?.code || `${namePart}${year}`;
      code = code.toUpperCase().replace(/\s/g, "");

      const { error: infErr } = await supabaseServer.from("influencers").insert({
        name: app.full_name,
        code,
        email: app.email,
        phone: app.phone || null,
        address_city: app.city || null,
        address_state: app.state || null,
        address_country: "USA",
        user_id: app.user_id,
        instagram_handle: app.payload?.instagramHandle || null,
        tiktok_handle: app.payload?.tiktokHandle || null,
        youtube_handle: app.payload?.youtubeHandle || null,
        twitter_handle: app.payload?.twitterHandle || null,
        rate_per_thousand_cents: 5000,
        ftc_agreed: true,
        ftc_agreed_at: new Date().toISOString(),
        status: "active",
        notes: `Created from application on ${new Date().toLocaleDateString()}`,
      });

      if (infErr) {
        console.error("[admin/applications] influencers insert error:", infErr.message);
        return NextResponse.json({ error: "Failed to create influencer record: " + infErr.message }, { status: 500 });
      }

      // Insert default rate tiers
      const { data: settings } = await supabaseServer
        .from("platform_settings")
        .select("default_influencer_tiers")
        .eq("id", 1)
        .maybeSingle();

      if (settings?.default_influencer_tiers) {
        const { data: newInf } = await supabaseServer
          .from("influencers")
          .select("id")
          .eq("code", code)
          .maybeSingle();

        if (newInf) {
          interface DefaultTier {
            min_signups: number;
            max_signups: number | null;
            rate_cents: number;
            label?: string;
          }
          const tiers = settings.default_influencer_tiers as DefaultTier[];
          const tierRows = tiers.map((t: DefaultTier, i: number) => ({
            influencer_id: newInf.id,
            tier_index: i + 1,
            min_signups: t.min_signups,
            max_signups: t.max_signups,
            rate_cents: t.rate_cents,
            label: t.label || `Tier ${i + 1}`,
          }));
          await supabaseServer.from("influencer_rate_tiers").insert(tierRows);
        }
      }
    }

    // Notify the applicant
    notify({
      userId: app.user_id,
      type: NOTIFICATION_TYPES.APPLICATION_APPROVED,
      title: "Application Approved!",
      body: app.application_type === "sales_rep"
        ? "Your sales rep application has been approved. Welcome to the team!"
        : "Your influencer application has been approved. Your referral code is ready!",
      metadata: { application_type: app.application_type },
    });

    return NextResponse.json({ ok: true, action: "approved" });
  }

  if (action === "reject") {
    const { error: updateErr } = await supabaseServer
      .from("role_applications")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: staffName,
        review_message: message || "Your application was not approved at this time.",
      })
      .eq("id", id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    notify({
      userId: app.user_id,
      type: NOTIFICATION_TYPES.APPLICATION_REJECTED,
      title: "Application Update",
      body: message || "Your application was not approved at this time. You may reapply in the future.",
      metadata: { application_type: app.application_type },
    });

    return NextResponse.json({ ok: true, action: "rejected" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ── PUT — Edit an application (staff only) ──
export async function PUT(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  const body = await req.json();
  const { id, full_name, email, phone, city, state, payload } = body;

  if (!id) return NextResponse.json({ error: "Application ID required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (city !== undefined) updates.city = city;
  if (state !== undefined) updates.state = state;
  if (payload !== undefined) updates.payload = payload;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("role_applications")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── DELETE — Delete an application (staff only) ──
export async function DELETE(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Application ID required" }, { status: 400 });

  // Fetch app to get document paths for cleanup
  const { data: app } = await supabaseServer
    .from("role_applications")
    .select("payload")
    .eq("id", id)
    .maybeSingle();

  // Delete uploaded documents from storage
  if (app?.payload) {
    const paths: string[] = [];
    if (app.payload.driversLicensePath) paths.push(String(app.payload.driversLicensePath));
    if (app.payload.resumePath) paths.push(String(app.payload.resumePath));
    if (paths.length > 0) {
      await supabaseServer.storage.from("documents").remove(paths);
    }
  }

  const { error } = await supabaseServer
    .from("role_applications")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
