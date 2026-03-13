"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import type { BusinessTabProps } from "@/components/business/v2/BusinessProfileV2";
import { AlertCircle, Bell, Check, HelpCircle, Image as ImageIcon, Mail, MessageSquare, Paperclip, Phone, Send, X, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type FAQ = { q: string; a: string };

type EmailNotifKey =
  | "newReceipts"
  | "receiptApprovals"
  | "campaignUpdates"
  | "weeklyReports"
  | "monthlyInvoices";

type SmsNotifKey = "urgentAlerts" | "receiptReminders" | "campaignStart";

type TicketStatus = "idle" | "submitting" | "success" | "error";

interface ChatMessage {
  id: string;
  sender_type: "staff" | "business";
  sender_name: string;
  body: string;
  created_at: string;
  attachment_url?: string | null;
}

export default function Support({ businessId, isPremium }: BusinessTabProps) {
  const colors = useMemo(
    () => ({
      primary: "#14b8a6",
      secondary: "#f97316",
      accent: "#06b6d4",
      success: "#10b981",
      warning: "#f59e0b",
      danger: "#ef4444",
    }),
    []
  );

  // Notification preferences (loaded from DB)
  const [emailNotifs, setEmailNotifs] = useState<Record<EmailNotifKey, boolean>>({
    newReceipts: true,
    receiptApprovals: true,
    campaignUpdates: true,
    weeklyReports: false,
    monthlyInvoices: true,
  });

  const [smsNotifs, setSmsNotifs] = useState<Record<SmsNotifKey, boolean>>({
    urgentAlerts: true,
    receiptReminders: false,
    campaignStart: true,
  });

  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Ticket form state
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketCategory, setTicketCategory] = useState("general");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>("idle");
  const [ticketError, setTicketError] = useState("");

  // Live chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatConvoId, setChatConvoId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  // Ticket attachment state
  const [ticketAttachment, setTicketAttachment] = useState<File | null>(null);
  const [ticketAttachmentPreview, setTicketAttachmentPreview] = useState<string | null>(null);
  const [ticketUploading, setTicketUploading] = useState(false);

  // Chat attachment state
  const [chatAttachment, setChatAttachment] = useState<File | null>(null);
  const [chatAttachmentPreview, setChatAttachmentPreview] = useState<string | null>(null);
  const [chatUploading, setChatUploading] = useState(false);

  // Upload image to Supabase Storage and return public URL
  async function uploadAttachment(file: File, folder: string): Promise<string> {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${folder}/${businessId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabaseBrowser.storage
      .from("business-media")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: urlData } = supabaseBrowser.storage
      .from("business-media")
      .getPublicUrl(path);

    return urlData.publicUrl;
  }

  function handleTicketFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Only image files are supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be under 10MB.");
      return;
    }
    setTicketAttachment(file);
    setTicketAttachmentPreview(URL.createObjectURL(file));
  }

  function clearTicketAttachment() {
    setTicketAttachment(null);
    if (ticketAttachmentPreview) URL.revokeObjectURL(ticketAttachmentPreview);
    setTicketAttachmentPreview(null);
  }

  function handleChatFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Only image files are supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be under 10MB.");
      return;
    }
    setChatAttachment(file);
    setChatAttachmentPreview(URL.createObjectURL(file));
  }

  function clearChatAttachment() {
    setChatAttachment(null);
    if (chatAttachmentPreview) URL.revokeObjectURL(chatAttachmentPreview);
    setChatAttachmentPreview(null);
  }

  // Load notification preferences from config
  useEffect(() => {
    async function loadPrefs() {
      if (!businessId) return;
      setLoading(true);
      try {
        const { data, error } = await supabaseBrowser
          .from("business")
          .select("config")
          .eq("id", businessId)
          .single();

        if (error) throw error;

        const cfg = (data?.config ?? {}) as Record<string, unknown>;

        if (cfg.emailNotifs && typeof cfg.emailNotifs === "object") {
          setEmailNotifs((prev) => ({ ...prev, ...(cfg.emailNotifs as Record<string, boolean>) }));
        }

        if (cfg.smsNotifs && typeof cfg.smsNotifs === "object") {
          setSmsNotifs((prev) => ({ ...prev, ...(cfg.smsNotifs as Record<string, boolean>) }));
        }
      } catch (e) {
        console.error("[Support] Failed to load notification prefs:", e);
      } finally {
        setLoading(false);
      }
    }
    loadPrefs();
  }, [businessId]);

  // Save notification preferences to config
  async function savePrefs(newEmailNotifs: Record<EmailNotifKey, boolean>, newSmsNotifs: Record<SmsNotifKey, boolean>) {
    if (!businessId) return;
    setSaveStatus("saving");

    try {
      const { data: existing, error: fetchErr } = await supabaseBrowser
        .from("business")
        .select("config")
        .eq("id", businessId)
        .single();

      if (fetchErr) throw fetchErr;

      const cfg = (existing?.config ?? {}) as Record<string, unknown>;

      const updatedConfig = {
        ...cfg,
        emailNotifs: newEmailNotifs,
        smsNotifs: newSmsNotifs,
      };

      const { error: updateErr } = await supabaseBrowser
        .from("business")
        .update({ config: updatedConfig })
        .eq("id", businessId);

      if (updateErr) throw updateErr;

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      console.error("[Support] Failed to save notification prefs:", e);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  function handleEmailToggle(key: EmailNotifKey, checked: boolean) {
    const newEmailNotifs = { ...emailNotifs, [key]: checked };
    setEmailNotifs(newEmailNotifs);
    savePrefs(newEmailNotifs, smsNotifs);
  }

  function handleSmsToggle(key: SmsNotifKey, checked: boolean) {
    const newSmsNotifs = { ...smsNotifs, [key]: checked };
    setSmsNotifs(newSmsNotifs);
    savePrefs(emailNotifs, newSmsNotifs);
  }

  // Submit support ticket
  async function submitTicket() {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      setTicketError("Please fill in the subject and message.");
      return;
    }

    setTicketStatus("submitting");
    setTicketError("");

    try {
      // Upload attachment if present
      let attachmentUrl: string | null = null;
      if (ticketAttachment) {
        setTicketUploading(true);
        attachmentUrl = await uploadAttachment(ticketAttachment, "support-tickets");
        setTicketUploading(false);
      }

      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          subject: ticketSubject.trim(),
          body: ticketMessage.trim(),
          category: ticketCategory,
          priority: "normal",
          business_id: businessId,
          attachment_url: attachmentUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail = data.details ? ` (${data.details})` : "";
        throw new Error((data.error || "Failed to submit ticket") + detail);
      }

      setTicketStatus("success");
      setTicketSubject("");
      setTicketCategory("general");
      setTicketMessage("");
      clearTicketAttachment();
      setTimeout(() => setTicketStatus("idle"), 4000);
    } catch (e) {
      console.error("[Support] Ticket submission error:", e);
      setTicketError(e instanceof Error ? e.message : "Failed to submit ticket");
      setTicketStatus("error");
    }
  }

  // Load existing chat conversation
  const loadChat = useCallback(async () => {
    setChatLoading(true);
    try {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (!user) return;

      // Look for an existing active conversation for this business
      const { data: convo } = await supabaseBrowser
        .from("conversations")
        .select("id")
        .eq("participant_id", user.id)
        .eq("business_id", businessId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (convo) {
        setChatConvoId(convo.id);

        // Load messages (include sender_role for reliable alignment)
        const { data: msgs } = await supabaseBrowser
          .from("messages")
          .select("id, sender_id, sender_role, body, created_at, attachment_url")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: true });

        // Use sender_role from DB when available, fall back to sender_id comparison
        // sender_role='staff' → left side (LetsGo Staff)
        // sender_role='participant' → right side (You)
        const mapped: ChatMessage[] = (msgs || []).map(m => {
          const isStaff = m.sender_role
            ? m.sender_role === "staff"
            : m.sender_id !== user.id;
          return {
            id: m.id,
            sender_type: isStaff ? "staff" as const : "business" as const,
            sender_name: isStaff ? "LetsGo Staff" : "You",
            body: m.body,
            created_at: m.created_at,
            attachment_url: m.attachment_url,
          };
        });

        setChatMessages(mapped);
      }
    } catch (e) {
      console.error("[Support] Failed to load chat:", e);
    } finally {
      setChatLoading(false);
    }
  }, [businessId]);

  // Send a chat message (with optional image attachment)
  async function sendChatMessage() {
    if (!chatInput.trim() && !chatAttachment) return;
    setChatSending(true);

    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) {
        alert("You must be logged in to send messages.");
        setChatSending(false);
        return;
      }

      // Upload attachment if present
      let attachmentUrl: string | null = null;
      if (chatAttachment) {
        setChatUploading(true);
        attachmentUrl = await uploadAttachment(chatAttachment, "chat-attachments");
        setChatUploading(false);
      }

      const messageBody = chatInput.trim();
      const displayBody = messageBody || (attachmentUrl ? "[Image]" : "");

      if (!chatConvoId) {
        // Create new conversation via API
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: displayBody,
            business_id: businessId,
            subject: "Live Chat Support",
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start conversation");

        setChatConvoId(data.conversation_id);

        // If we have an attachment, update the first message with the URL
        if (attachmentUrl && data.message_id) {
          await supabaseBrowser
            .from("messages")
            .update({ attachment_url: attachmentUrl })
            .eq("id", data.message_id);
        }

        setChatMessages([{
          id: "local_" + Date.now(),
          sender_type: "business",
          sender_name: "You",
          body: displayBody,
          created_at: new Date().toISOString(),
          attachment_url: attachmentUrl,
        }]);
      } else {
        // Add message to existing conversation
        const insertPayload: Record<string, string> = {
          conversation_id: chatConvoId,
          sender_id: session.user.id,
          sender_role: "participant",
          body: displayBody,
        };
        if (attachmentUrl) insertPayload.attachment_url = attachmentUrl;

        const { data: newMsg, error } = await supabaseBrowser
          .from("messages")
          .insert(insertPayload)
          .select("id, created_at")
          .single();

        if (error) throw error;

        // Update conversation metadata
        const now = new Date().toISOString();
        await supabaseBrowser
          .from("conversations")
          .update({
            last_message: displayBody,
            last_message_at: now,
            updated_at: now,
            unread_count: 1,
          })
          .eq("id", chatConvoId);

        setChatMessages(prev => [...prev, {
          id: newMsg.id,
          sender_type: "business",
          sender_name: "You",
          body: displayBody,
          created_at: newMsg.created_at,
          attachment_url: attachmentUrl,
        }]);
      }

      setChatInput("");
      clearChatAttachment();
    } catch (e) {
      console.error("[Support] Chat send error:", e);
      const errMsg = e instanceof Error ? e.message : String(e);
      alert(`Failed to send message: ${errMsg}`);
    } finally {
      setChatSending(false);
      setChatUploading(false);
    }
  }

  function openLiveChat() {
    setShowChat(true);
    loadChat();
  }

  const faqs: FAQ[] = [
    {
      q: "How do I approve customer receipts?",
      a: "Go to Receipt Redemption, review the receipt image, then click Approve or Deny. You'll have a time window before auto-approval can occur (policy depends on your settings).",
    },
    {
      q: "What happens if I don't approve a receipt in time?",
      a: "If auto-approval is enabled, receipts may be approved automatically after the configured time window. If disabled, they remain pending until approved/denied by your team.",
    },
    {
      q: "Can I cancel an advertising campaign?",
      a: "Campaign cancellation depends on timing. In the future we'll enforce the policy shown in the UI (e.g., cancel up to 24 hours before start for full refund).",
    },
    {
      q: "How does the progressive payout system work?",
      a: "Only verified receipts count toward visit totals & progressive payouts. Payout is agreed upon and unique to each business as well as each user. Payout is based on the receipt subtotal before tax & tip.",
    },
    {
      q: "What's the difference between Basic and Premium?",
      a: "Basic has no monthly subscription fee and uses per-verified-transaction fees. Premium adds subscription benefits (videos, priority placement, etc.) and removes certain Basic fees depending on your model.",
    },
    {
      q: "How do I update my payment information?",
      a: "Go to Plans & Billing. We'll wire this to Stripe (or another processor) so you can safely update card/bank info while only seeing masked details.",
    },
  ];

  function cardStyle(bg: string, border: string) {
    return {
      background: bg,
      border: border,
      borderRadius: "12px",
      padding: "1.5rem",
      cursor: "pointer",
      transition: "all 0.25s ease",
    } as React.CSSProperties;
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Quick Actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "1rem",
        }}
      >
        <div
          role="button"
          tabIndex={0}
          style={cardStyle(
            `linear-gradient(135deg, ${colors.primary}20 0%, ${colors.primary}05 100%)`,
            `1px solid ${colors.primary}40`
          )}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          }}
          onClick={() => window.location.href = "mailto:support@letsgo.com"}
          onKeyDown={(e) => {
            if (e.key === "Enter") window.location.href = "mailto:support@letsgo.com";
          }}
        >
          <Mail size={32} style={{ color: colors.primary, marginBottom: "1rem" }} />
          <div style={{ fontSize: "1.125rem", fontWeight: 800, marginBottom: "0.5rem" }}>Email Support</div>
          <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.75)" }}>support@letsgo.com</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "0.5rem" }}>
            Response within 24 hours
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          style={cardStyle(
            `linear-gradient(135deg, ${colors.secondary}20 0%, ${colors.secondary}05 100%)`,
            `1px solid ${colors.secondary}40`
          )}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          }}
          onClick={() => window.location.href = "tel:+18005387461"}
          onKeyDown={(e) => {
            if (e.key === "Enter") window.location.href = "tel:+18005387461";
          }}
        >
          <Phone size={32} style={{ color: colors.secondary, marginBottom: "1rem" }} />
          <div style={{ fontSize: "1.125rem", fontWeight: 800, marginBottom: "0.5rem" }}>Phone Support</div>
          <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.75)" }}>1-800-LETSGO-1</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "0.5rem" }}>
            Mon–Fri 9AM–6PM CST
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          style={cardStyle(
            `linear-gradient(135deg, ${colors.accent}20 0%, ${colors.accent}05 100%)`,
            `1px solid ${colors.accent}40`
          )}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          }}
          onClick={openLiveChat}
          onKeyDown={(e) => {
            if (e.key === "Enter") openLiveChat();
          }}
        >
          <MessageSquare size={32} style={{ color: colors.accent, marginBottom: "1rem" }} />
          <div style={{ fontSize: "1.125rem", fontWeight: 800, marginBottom: "0.5rem" }}>Live Chat</div>
          <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.75)" }}>Chat with our team</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "0.5rem" }}>
            Available now
          </div>
        </div>
      </div>

      {/* Submit a Ticket */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
        }}
      >
        <div
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Send size={20} style={{ color: colors.secondary }} />
          Submit a Support Ticket
        </div>

        {ticketStatus === "success" ? (
          <div
            style={{
              padding: "1.5rem",
              background: `${colors.success}15`,
              border: `1px solid ${colors.success}40`,
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <Check size={32} style={{ color: colors.success, marginBottom: "0.75rem" }} />
            <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.25rem", color: colors.success }}>
              Ticket Submitted Successfully
            </div>
            <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.65)" }}>
              Our team will review your ticket and respond within 24 hours.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: 600 }}>
                Subject
              </label>
              <input
                type="text"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Brief description of your issue"
                maxLength={200}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "0.875rem",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: 600 }}>
                Category
              </label>
              <select
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "0.875rem",
                  outline: "none",
                }}
              >
                <option value="general" style={{ background: "#1a1a2e", color: "#fff" }}>General</option>
                <option value="payout" style={{ background: "#1a1a2e", color: "#fff" }}>Payout</option>
                <option value="receipt" style={{ background: "#1a1a2e", color: "#fff" }}>Receipt</option>
                <option value="account" style={{ background: "#1a1a2e", color: "#fff" }}>Account</option>
                <option value="billing" style={{ background: "#1a1a2e", color: "#fff" }}>Billing</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: 600 }}>
                Message
              </label>
              <textarea
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Describe your issue in detail..."
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "0.875rem",
                  minHeight: "100px",
                  resize: "vertical",
                  outline: "none",
                }}
              />
            </div>

            {/* Attachment */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: 600 }}>
                Attachment (optional)
              </label>
              {ticketAttachmentPreview ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ position: "relative" }}>
                    <img
                      src={ticketAttachmentPreview}
                      alt="Attachment preview"
                      style={{
                        width: "80px",
                        height: "80px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.15)",
                      }}
                    />
                    <button
                      onClick={clearTicketAttachment}
                      style={{
                        position: "absolute",
                        top: "-6px",
                        right: "-6px",
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: colors.danger,
                        border: "none",
                        color: "white",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
                    {ticketAttachment?.name}
                  </span>
                </div>
              ) : (
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.6rem 1rem",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px dashed rgba(255,255,255,0.2)",
                    borderRadius: "8px",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLLabelElement).style.borderColor = colors.accent; (e.currentTarget as HTMLLabelElement).style.color = colors.accent; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLLabelElement).style.borderColor = "rgba(255,255,255,0.2)"; (e.currentTarget as HTMLLabelElement).style.color = "rgba(255,255,255,0.6)"; }}
                >
                  <ImageIcon size={16} />
                  Attach Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleTicketFileSelect}
                    style={{ display: "none" }}
                  />
                </label>
              )}
            </div>

            {ticketError && (
              <div style={{ fontSize: "0.875rem", color: colors.danger, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AlertCircle size={14} /> {ticketError}
              </div>
            )}

            <button
              onClick={submitTicket}
              disabled={ticketStatus === "submitting" || ticketUploading}
              style={{
                padding: "0.75rem 1.5rem",
                background: ticketStatus === "submitting" ? "rgba(255,255,255,0.1)" : `linear-gradient(135deg, ${colors.secondary}, ${colors.primary})`,
                border: "none",
                borderRadius: "10px",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 700,
                cursor: ticketStatus === "submitting" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                transition: "all 0.2s",
              }}
            >
              {ticketStatus === "submitting" ? (
                <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> {ticketUploading ? "Uploading image..." : "Submitting..."}</>
              ) : (
                <><Send size={16} /> Submit Ticket</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* FAQ */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
        }}
      >
        <div
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <HelpCircle size={20} style={{ color: colors.primary }} />
          Frequently Asked Questions
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          {faqs.map((f, idx) => (
            <div
              key={idx}
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "1.5rem",
              }}
            >
              <div style={{ fontSize: "1rem", fontWeight: 900, marginBottom: "0.75rem", color: colors.primary }}>
                {f.q}
              </div>
              <div style={{ fontSize: "0.875rem", lineHeight: 1.65, color: "rgba(255,255,255,0.82)" }}>
                {f.a}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notification Preferences */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Bell size={20} style={{ color: colors.secondary }} />
            <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>Notification Preferences</div>
          </div>
          {saveStatus === "saving" && (
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>Saving...</div>
          )}
          {saveStatus === "saved" && (
            <div style={{ fontSize: "0.75rem", color: colors.success, display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Check size={14} /> Saved
            </div>
          )}
          {saveStatus === "error" && (
            <div style={{ fontSize: "0.75rem", color: colors.danger }}>Failed to save</div>
          )}
        </div>

        <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.65)", marginBottom: "2rem" }}>
          Manage how you receive updates and alerts. Changes are saved automatically.
        </div>

        {/* Email */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "1rem", color: colors.primary }}>
            <Mail size={16} style={{ display: "inline", marginRight: "0.5rem" }} />
            Email Notifications
          </div>

          <div style={{ display: "grid", gap: "1rem" }}>
            {(
              [
                { id: "newReceipts", label: "New Receipt Submissions" },
                { id: "receiptApprovals", label: "Receipt Approval Confirmations" },
                { id: "campaignUpdates", label: "Advertising Campaign Updates" },
                { id: "weeklyReports", label: "Weekly Performance Reports" },
                { id: "monthlyInvoices", label: "Monthly Invoices" },
              ] as Array<{ id: EmailNotifKey; label: string }>
            ).map((item) => (
              <label
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "1rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLLabelElement).style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLLabelElement).style.background = "rgba(255,255,255,0.02)")}
              >
                <input
                  type="checkbox"
                  checked={!!emailNotifs[item.id]}
                  onChange={(e) => handleEmailToggle(item.id, e.target.checked)}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <span style={{ fontSize: "0.875rem" }}>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* SMS */}
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "1rem", color: colors.secondary }}>
            <MessageSquare size={16} style={{ display: "inline", marginRight: "0.5rem" }} />
            SMS Notifications
          </div>

          <div style={{ display: "grid", gap: "1rem" }}>
            {(
              [
                { id: "urgentAlerts", label: "Urgent Account Alerts" },
                { id: "receiptReminders", label: "Receipt Approval Reminders" },
                { id: "campaignStart", label: "Campaign Start Notifications" },
              ] as Array<{ id: SmsNotifKey; label: string }>
            ).map((item) => (
              <label
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "1rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLLabelElement).style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLLabelElement).style.background = "rgba(255,255,255,0.02)")}
              >
                <input
                  type="checkbox"
                  checked={!!smsNotifs[item.id]}
                  onChange={(e) => handleSmsToggle(item.id, e.target.checked)}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <span style={{ fontSize: "0.875rem" }}>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Always-on note */}
        <div
          style={{
            marginTop: "2rem",
            padding: "1rem",
            background: "rgba(6, 182, 212, 0.1)",
            border: "1px solid rgba(6, 182, 212, 0.3)",
            borderRadius: "8px",
            fontSize: "0.875rem",
            lineHeight: 1.5,
            color: "rgba(255, 255, 255, 0.85)",
          }}
        >
          <strong>Note:</strong> You&apos;ll always receive critical notifications related to account security, payment
          issues, and terms updates regardless of these settings.
          <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>
            Business ID: <span style={{ fontFamily: '"Space Mono", monospace' }}>{businessId}</span>
            {" • "}
            Plan: <span style={{ fontFamily: '"Space Mono", monospace' }}>{isPremium ? "premium" : "basic"}</span>
          </div>
        </div>
      </div>

      {/* Small premium callout (optional, non-blocking) */}
      {!isPremium ? (
        <div
          style={{
            marginTop: "0.25rem",
            padding: "0.9rem 1rem",
            background: "rgba(249, 115, 22, 0.12)",
            border: "1px solid rgba(249, 115, 22, 0.35)",
            borderRadius: "12px",
            color: "rgba(255,255,255,0.9)",
            fontSize: "0.875rem",
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          <AlertCircle size={16} style={{ marginRight: "0.5rem", verticalAlign: "text-bottom" }} />
          You&apos;re on <span style={{ color: colors.secondary }}>Basic</span>. Events + Advertising stay visible but locked
          elsewhere to encourage upgrading.
        </div>
      ) : null}

      {/* Live Chat Modal */}
      {showChat && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowChat(false)}
        >
          <div
            style={{
              background: "#1a1a2e",
              borderRadius: "20px",
              width: 480,
              maxWidth: "95%",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              border: "1px solid rgba(255,255,255,0.1)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Chat Header */}
            <div style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${colors.accent}, ${colors.primary})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <MessageSquare size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>LetsGo Support</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>Usually responds within minutes</div>
                </div>
              </div>
              <button
                onClick={() => setShowChat(false)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Chat Messages */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              minHeight: 300,
              maxHeight: 400,
            }}>
              {chatLoading ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)" }}>
                  <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : chatMessages.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "2rem" }}>
                  <div>
                    <MessageSquare size={32} style={{ marginBottom: "0.75rem", opacity: 0.5 }} />
                    <div style={{ fontSize: "0.875rem" }}>Start a conversation with our support team.</div>
                    <div style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Type your message below to get started.</div>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", justifyContent: msg.sender_type === "business" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "80%",
                      padding: "0.75rem 1rem",
                      borderRadius: "14px",
                      background: msg.sender_type === "business"
                        ? `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`
                        : "rgba(255,255,255,0.08)",
                      color: "#fff",
                    }}>
                      {msg.sender_type === "staff" && (
                        <div style={{ fontSize: "0.65rem", opacity: 0.7, marginBottom: "0.25rem" }}>{msg.sender_name}</div>
                      )}
                      {msg.attachment_url && (
                        <img
                          src={msg.attachment_url}
                          alt="Attachment"
                          style={{
                            maxWidth: "100%",
                            maxHeight: "200px",
                            borderRadius: "8px",
                            marginBottom: msg.body && msg.body !== "[Image]" ? "0.5rem" : 0,
                            cursor: "pointer",
                          }}
                          onClick={() => window.open(msg.attachment_url!, "_blank")}
                        />
                      )}
                      {msg.body && msg.body !== "[Image]" && (
                        <div style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>{msg.body}</div>
                      )}
                      <div style={{ fontSize: "0.65rem", opacity: 0.5, marginTop: "0.375rem", textAlign: "right" }}>{formatTime(msg.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Attachment Preview */}
            {chatAttachmentPreview && (
              <div style={{
                padding: "0.5rem 1.25rem",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                background: "rgba(255,255,255,0.02)",
              }}>
                <div style={{ position: "relative" }}>
                  <img
                    src={chatAttachmentPreview}
                    alt="Attachment preview"
                    style={{
                      width: "48px",
                      height: "48px",
                      objectFit: "cover",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  />
                  <button
                    onClick={clearChatAttachment}
                    style={{
                      position: "absolute",
                      top: "-5px",
                      right: "-5px",
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      background: colors.danger,
                      border: "none",
                      color: "white",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                  {chatAttachment?.name}
                </span>
              </div>
            )}

            {/* Chat Input */}
            <div style={{
              padding: "1rem 1.25rem",
              borderTop: chatAttachmentPreview ? "none" : "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
            }}>
              <label
                style={{
                  padding: "0.75rem",
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
                  borderRadius: "10px",
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLLabelElement).style.color = colors.accent; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLLabelElement).style.color = "rgba(255,255,255,0.5)"; }}
              >
                <Paperclip size={18} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleChatFileSelect}
                  style={{ display: "none" }}
                />
              </label>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !chatSending && sendChatMessage()}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: "0.75rem 1rem",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px",
                  color: "#fff",
                  fontSize: "0.875rem",
                  outline: "none",
                }}
              />
              <button
                onClick={sendChatMessage}
                disabled={(!chatInput.trim() && !chatAttachment) || chatSending}
                style={{
                  padding: "0.75rem",
                  background: (chatInput.trim() || chatAttachment) && !chatSending ? `linear-gradient(135deg, ${colors.primary}, ${colors.accent})` : "rgba(255,255,255,0.1)",
                  border: "none",
                  borderRadius: "10px",
                  color: "#fff",
                  cursor: (chatInput.trim() || chatAttachment) && !chatSending ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {chatSending ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
