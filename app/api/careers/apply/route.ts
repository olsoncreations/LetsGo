import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// ── POST — Public (unauthenticated) role application ──
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Multipart form data required" }, { status: 400 });
  }

  const formData = await req.formData();

  const application_type = formData.get("application_type") as string;
  const full_name = formData.get("full_name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string | null;
  const city = formData.get("city") as string | null;
  const state = formData.get("state") as string | null;
  const payloadRaw = formData.get("payload") as string;
  const dlFile = formData.get("drivers_license") as File | null;
  const resumeFile = formData.get("resume") as File | null;

  // ── Validation ──
  if (!["sales_rep", "influencer"].includes(application_type)) {
    return NextResponse.json({ error: "Invalid application type" }, { status: 400 });
  }
  if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(payloadRaw || "{}");
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // ── Check for duplicate by email + type ──
  const { data: existing } = await supabaseServer
    .from("role_applications")
    .select("id, status")
    .eq("email", email.trim().toLowerCase())
    .eq("application_type", application_type)
    .eq("status", "submitted")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "An application with this email is already pending" },
      { status: 409 }
    );
  }

  // ── Upload files (using a unique guest identifier) ──
  const guestId = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let dlPath: string | null = null;
  if (dlFile && dlFile.size > 0) {
    if (dlFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Driver's license file must be under 10MB" }, { status: 400 });
    }
    const ext = dlFile.name.split(".").pop() || "jpg";
    const path = `sales-rep-applications/${guestId}/drivers-license-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await dlFile.arrayBuffer());
    const { error: uploadErr } = await supabaseServer.storage
      .from("documents")
      .upload(path, buffer, { contentType: dlFile.type, upsert: true });
    if (uploadErr) {
      console.error("[careers/apply] DL upload error:", uploadErr.message);
      return NextResponse.json({ error: "Failed to upload driver's license" }, { status: 500 });
    }
    dlPath = path;
  }

  let resumePath: string | null = null;
  if (resumeFile && resumeFile.size > 0) {
    if (resumeFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Resume file must be under 10MB" }, { status: 400 });
    }
    const ext = resumeFile.name.split(".").pop() || "pdf";
    const path = `sales-rep-applications/${guestId}/resume-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await resumeFile.arrayBuffer());
    const { error: uploadErr } = await supabaseServer.storage
      .from("documents")
      .upload(path, buffer, { contentType: resumeFile.type, upsert: true });
    if (uploadErr) {
      console.error("[careers/apply] Resume upload error:", uploadErr.message);
      return NextResponse.json({ error: "Failed to upload resume" }, { status: 500 });
    }
    resumePath = path;
  }

  // ── Insert application (user_id is null for public submissions) ──
  const { data, error } = await supabaseServer
    .from("role_applications")
    .insert({
      user_id: null,
      application_type,
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      payload: {
        ...payload,
        driversLicensePath: dlPath,
        resumePath: resumePath,
        source: "careers_page",
      },
    })
    .select("id")
    .single();

  if (error) {
    console.error("[careers/apply] Insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, status: "submitted" });
}
