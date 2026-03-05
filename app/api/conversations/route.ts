import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/conversations
 * Creates a new conversation with an initial message. Requires authentication.
 *
 * Body: { message, business_id?, subject? }
 * - If business_id is provided, creates a "business" type conversation
 * - Otherwise creates a "user" type conversation
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Authenticate the user
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const body = await req.json();

    const message = String(body.message || "").trim();
    const businessId = body.business_id ? String(body.business_id).trim() : null;
    const subject = String(body.subject || "Support Request").trim();

    // Validation
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: "Message must be under 5000 characters" }, { status: 400 });
    }

    // Verify business if provided
    if (businessId) {
      const { data: biz, error: bizErr } = await supabaseServer
        .from("business")
        .select("id")
        .eq("id", businessId)
        .single();

      if (bizErr || !biz) {
        return NextResponse.json({ error: "Business not found" }, { status: 404 });
      }
    }

    // Conversation type is always "dm" (1-on-1); business context indicated by business_id
    const convoType = "dm";

    // Check for existing active conversation to avoid duplicates
    const existingQuery = supabaseServer
      .from("conversations")
      .select("id")
      .eq("participant_id", user.id)
      .eq("status", "active");

    if (businessId) {
      existingQuery.eq("business_id", businessId);
    }

    const { data: existing } = await existingQuery.limit(1).single();

    if (existing) {
      // Add message to existing conversation instead
      const now = new Date().toISOString();

      const { error: msgErr } = await supabaseServer
        .from("messages")
        .insert({
          conversation_id: existing.id,
          sender_id: user.id,
          sender_role: "participant",
          body: message,
        });

      if (msgErr) {
        console.error("[conversations] Message insert error:", msgErr);
        return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
      }

      // Update conversation metadata
      await supabaseServer
        .from("conversations")
        .update({
          last_message: message,
          last_message_at: now,
          updated_at: now,
          unread_count: 1, // Mark unread for staff
        })
        .eq("id", existing.id);

      return NextResponse.json({
        ok: true,
        conversation_id: existing.id,
        reused_existing: true,
      }, { status: 200 });
    }

    // Create new conversation
    const now = new Date().toISOString();

    const { data: convo, error: convoErr } = await supabaseServer
      .from("conversations")
      .insert({
        participant_id: user.id,
        business_id: businessId,
        type: convoType,
        name: subject,
        created_by: user.id,
        status: "active",
        last_message: message,
        last_message_at: now,
        updated_at: now,
        unread_count: 1,
      })
      .select("id")
      .single();

    if (convoErr) {
      console.error("[conversations] Insert error:", convoErr);
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
    }

    // Insert the initial message
    const { error: msgErr } = await supabaseServer
      .from("messages")
      .insert({
        conversation_id: convo.id,
        sender_id: user.id,
        sender_role: "participant",
        body: message,
      });

    if (msgErr) {
      console.error("[conversations] Initial message insert error:", msgErr);
      // Conversation was created but message failed — clean up
      await supabaseServer.from("conversations").delete().eq("id", convo.id);
      return NextResponse.json({ error: "Failed to send initial message" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      conversation_id: convo.id,
      reused_existing: false,
    }, { status: 201 });
  } catch (err) {
    console.error("[conversations] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
