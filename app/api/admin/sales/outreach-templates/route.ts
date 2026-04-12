import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

async function requireStaff(req: NextRequest): Promise<Response | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return null;
}

/** GET — Fetch all outreach templates */
export async function GET(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  const { data, error } = await supabaseServer
    .from("outreach_templates")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data || [] });
}

/** PATCH — Update a template */
export async function PATCH(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "Template id required" }, { status: 400 });

  // Only allow updating specific fields
  const allowed: Record<string, unknown> = {};
  if (updates.label !== undefined) allowed.label = updates.label;
  if (updates.description !== undefined) allowed.description = updates.description;
  if (updates.subject !== undefined) allowed.subject = updates.subject;
  if (updates.body !== undefined) allowed.body = updates.body;
  if (updates.from_name !== undefined) allowed.from_name = updates.from_name;
  if (updates.from_email !== undefined) allowed.from_email = updates.from_email;
  if (updates.is_active !== undefined) allowed.is_active = updates.is_active;

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("outreach_templates")
    .update(allowed)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** POST — Create a new template */
export async function POST(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  const body = await req.json();
  const { id, label, subject, body: htmlBody, from_name, from_email, description } = body;

  if (!id || !label || !subject || !htmlBody) {
    return NextResponse.json({ error: "id, label, subject, and body are required" }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("outreach_templates")
    .insert({
      id,
      label,
      description: description || null,
      subject,
      body: htmlBody,
      from_name: from_name || "Chris Olson",
      from_email: from_email || "chris.olson@useletsgo.com",
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE — Delete a template */
export async function DELETE(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Template id required" }, { status: 400 });

  const { error } = await supabaseServer
    .from("outreach_templates")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
