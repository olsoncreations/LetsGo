import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resend, isResendConfigured } from "@/lib/resend";
import { generateEmail } from "@/lib/outreachTemplates";

// Verify caller is authenticated staff
async function requireStaff(req: NextRequest): Promise<{ error: Response | null; staffName: string | null }> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }), staffName: null };
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }), staffName: null };
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return { error: NextResponse.json({ error: "Staff access required" }, { status: 403 }), staffName: null };

  // Get staff name from profiles
  const { data: profile } = await supabaseServer
    .from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  return { error: null, staffName: profile?.full_name || user.email || "Staff" };
}

/**
 * POST /api/admin/sales/prospect/outreach
 * Send an outreach email to a lead.
 *
 * Body: { leadId: string, template: TemplateKey, previewId?: string }
 *    or { leadIds: string[], template: TemplateKey } — batch (max 50)
 */
export async function POST(req: NextRequest) {
  const { error: authError, staffName } = await requireStaff(req);
  if (authError) return authError;

  if (!isResendConfigured) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  const body = await req.json();
  const template = body.template as string;

  if (!template) {
    return NextResponse.json({ error: "Template is required" }, { status: 400 });
  }

  // ── Single send ──
  if (body.leadId) {
    const result = await sendToLead(body.leadId, template, staffName!, body.previewId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }
    return NextResponse.json(result);
  }

  // ── Batch send ──
  if (body.leadIds && Array.isArray(body.leadIds)) {
    const leadIds = body.leadIds.slice(0, 50);
    const results: { leadId: string; sent: boolean; error?: string }[] = [];

    for (const leadId of leadIds) {
      const result = await sendToLead(leadId, template, staffName!);
      results.push({
        leadId,
        sent: !result.error,
        error: result.error || undefined,
      });

      // Rate limit: small delay between sends
      if (!result.error) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    const sent = results.filter((r) => r.sent).length;
    const skipped = results.filter((r) => !r.sent).length;
    return NextResponse.json({ results, sent, skipped, total: results.length });
  }

  return NextResponse.json({ error: "Provide leadId or leadIds" }, { status: 400 });
}

async function sendToLead(
  leadId: string,
  template: string,
  staffName: string,
  previewId?: string
): Promise<{ error?: string; status?: number; outreachId?: string }> {
  // Fetch lead
  const { data: lead, error: leadErr } = await supabaseServer
    .from("sales_leads")
    .select("id, business_name, city, state, business_type, google_rating, email, unsubscribed_at, preview_business_id")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr || !lead) return { error: "Lead not found", status: 404 };
  if (!lead.email) return { error: "Lead has no email address" };
  if (lead.unsubscribed_at) return { error: "Lead has unsubscribed" };

  // Check for duplicate (same template within 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabaseServer
    .from("outreach_emails")
    .select("id")
    .eq("lead_id", leadId)
    .eq("template", template)
    .neq("status", "bounced")
    .neq("status", "unsubscribed")
    .gte("sent_at", thirtyDaysAgo)
    .maybeSingle();

  if (existing) return { error: "Already sent this template within 30 days" };

  // Create outreach record first (to get ID for tracking)
  const { data: outreach, error: insertErr } = await supabaseServer
    .from("outreach_emails")
    .insert({
      lead_id: leadId,
      email_to: lead.email,
      template,
      subject: "", // Will update after generating
      body: "",
      status: "pending",
      sent_by: staffName,
    })
    .select("id")
    .single();

  if (insertErr || !outreach) {
    console.error("[outreach] Insert error:", insertErr?.message);
    return { error: "Failed to create outreach record" };
  }

  // Generate email content with tracking from DB template
  const generated = await generateEmail(
    template,
    lead,
    outreach.id,
    lead.email,
    previewId || lead.preview_business_id || undefined
  );

  if (!generated) {
    await supabaseServer.from("outreach_emails").delete().eq("id", outreach.id);
    return { error: "Template not found or inactive" };
  }

  const { subject, html, fromName, fromEmail } = generated;

  // Send via Resend
  try {
    const { data: sendResult, error: sendErr } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: lead.email,
      subject,
      html,
    });

    if (sendErr) {
      console.error("[outreach] Resend error:", sendErr);
      await supabaseServer
        .from("outreach_emails")
        .update({ status: "bounced", subject, body: html })
        .eq("id", outreach.id);
      return { error: `Send failed: ${sendErr.message}` };
    }

    // Update with sent status
    await supabaseServer
      .from("outreach_emails")
      .update({
        subject,
        body: html,
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_id: sendResult?.id || null,
      })
      .eq("id", outreach.id);

    // Also update the lead's last_contacted_at
    await supabaseServer
      .from("sales_leads")
      .update({ last_contacted_at: new Date().toISOString(), status: "contacted" })
      .eq("id", leadId)
      .eq("status", "not_contacted");

    return { outreachId: outreach.id };
  } catch (err) {
    console.error("[outreach] Unexpected error:", err);
    await supabaseServer
      .from("outreach_emails")
      .update({ status: "bounced", subject, body: html })
      .eq("id", outreach.id);
    return { error: "Send failed unexpectedly" };
  }
}

/**
 * GET /api/admin/sales/prospect/outreach?leadId=xxx
 * Get outreach history for a lead.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const { data, error: fetchErr } = await supabaseServer
    .from("outreach_emails")
    .select("id, template, subject, status, sent_at, opened_at, clicked_at, sent_by")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  return NextResponse.json({ emails: data || [] });
}
