import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/support-tickets
 * Creates a new support ticket. Requires authentication via Bearer token.
 *
 * Body: { subject, body, category?, priority?, business_id? }
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Authenticate via Bearer token
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = user.id;

    const body = await req.json();

    const subject = String(body.subject || "").trim();
    const ticketBody = String(body.body || "").trim();
    const category = String(body.category || "general").trim();
    const priority = String(body.priority || "normal").trim();
    const businessId = body.business_id ? String(body.business_id).trim() : null;
    const rawAttachmentUrl = body.attachment_url ? String(body.attachment_url).trim() : null;
    const attachmentUrl = rawAttachmentUrl && /^https:\/\/.{3,2000}$/.test(rawAttachmentUrl) ? rawAttachmentUrl : null;

    // Validation
    if (!subject) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!ticketBody) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }
    if (subject.length > 200) {
      return NextResponse.json({ error: "Subject must be under 200 characters" }, { status: 400 });
    }

    const validCategories = ["payout", "receipt", "account", "billing", "general"];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const validPriorities = ["urgent", "high", "normal", "low"];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }

    // If business_id provided, verify it exists
    if (businessId) {
      const { data: biz, error: bizErr } = await supabaseServer
        .from("business")
        .select("id")
        .eq("id", businessId)
        .maybeSingle();

      if (bizErr || !biz) {
        return NextResponse.json({ error: "Business not found" }, { status: 404 });
      }
    }

    // Create the ticket
    const insertPayload: Record<string, string | null> = {
      user_id: userId,
      business_id: businessId,
      subject,
      body: ticketBody,
      category,
      priority,
      status: "open",
    };
    if (attachmentUrl) insertPayload.attachment_url = attachmentUrl;

    const { data: ticket, error: insertErr } = await supabaseServer
      .from("support_tickets")
      .insert(insertPayload)
      .select("id, subject, status, priority, category, created_at")
      .single();

    if (insertErr) {
      console.error("[support-tickets] Insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to create ticket" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, ticket }, { status: 201 });
  } catch (err) {
    console.error("[support-tickets] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
