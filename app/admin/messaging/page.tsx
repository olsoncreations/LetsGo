"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { COLORS, formatDateTime } from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";

// ==================== TYPES ====================
interface Message {
  id: string;
  sender_id: string;
  sender_type: "staff" | "user" | "business";
  sender_name: string;
  body: string;
  created_at: string;
  attachment_url?: string | null;
}

interface Conversation {
  id: string;
  participant_id: string | null;
  business_id: string | null;
  participant_name: string;
  participant_email: string;
  type: "dm" | "channel";
  category: "user" | "business" | "influencer" | "staff";
  status: "active" | "closed";
  unread_count: number;
  last_message: string;
  last_message_at: string;
  messages: Message[];
  closed_at: string | null;
  closed_by: string | null;
  closed_by_name: string;
  created_at: string;
}

// ==================== MESSAGING PAGE ====================
export default function MessagingPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageFilters, setMessageFilters] = useState({ search: "", type: "all", readStatus: "all", status: "active" });
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastData, setBroadcastData] = useState({ audience: "all", subject: "", message: "" });
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [currentStaffName, setCurrentStaffName] = useState("You");
  const [replyAttachment, setReplyAttachment] = useState<File | null>(null);
  const [replyAttachmentPreview, setReplyAttachmentPreview] = useState<string | null>(null);
  const [replyUploading, setReplyUploading] = useState(false);

  // New Conversation modal state
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [newConvoType, setNewConvoType] = useState<"user" | "business" | "influencer" | "staff">("user");
  const [newConvoSearch, setNewConvoSearch] = useState("");
  const [newConvoResults, setNewConvoResults] = useState<Array<{ id: string; label: string; sublabel: string }>>([]);
  const [newConvoSelectedId, setNewConvoSelectedId] = useState<string | null>(null);
  const [newConvoSelectedName, setNewConvoSelectedName] = useState("");
  const [newConvoMessage, setNewConvoMessage] = useState("");
  const [newConvoSending, setNewConvoSending] = useState(false);
  const [newConvoSearching, setNewConvoSearching] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Get current staff user
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (user) {
        setCurrentStaffId(user.id);
        const { data: staffData } = await supabaseBrowser
          .from("staff_users")
          .select("name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (staffData?.name) setCurrentStaffName(`${staffData.name} • #${user.id.slice(-6).toUpperCase()}`);
      }

      // 1. Fetch conversations
      const { data: convoRows, error } = await supabaseBrowser
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      // 2. Fetch messages for all conversations
      const convoIds = (convoRows || []).map(c => c.id);
      let messagesMap = new Map<string, Array<Record<string, unknown>>>();
      if (convoIds.length > 0) {
        const { data: messageRows } = await supabaseBrowser
          .from("messages")
          .select("*")
          .in("conversation_id", convoIds)
          .order("created_at", { ascending: true });

        // Group messages by conversation_id
        (messageRows || []).forEach(m => {
          const msgs = messagesMap.get(m.conversation_id) || [];
          msgs.push(m);
          messagesMap.set(m.conversation_id, msgs);
        });
      }

      // 3. Collect all unique user IDs (participants, senders, closed_by)
      const allUserIds = new Set<string>();
      (convoRows || []).forEach(c => {
        if (c.participant_id) allUserIds.add(c.participant_id);
        if (c.created_by) allUserIds.add(c.created_by);
        if (c.closed_by) allUserIds.add(c.closed_by);
      });
      messagesMap.forEach(msgs => {
        msgs.forEach(m => { if (m.sender_id) allUserIds.add(m.sender_id as string); });
      });

      // 4. Fetch profiles for all user IDs
      let profileMap = new Map<string, { full_name: string; email: string }>();
      const userIdArr = [...allUserIds].filter(Boolean);
      if (userIdArr.length > 0) {
        const { data: profiles } = await supabaseBrowser
          .from("profiles")
          .select("id, full_name, first_name, last_name, email")
          .in("id", userIdArr);

        profileMap = new Map((profiles || []).map(p => [
          p.id,
          {
            full_name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
            email: p.email || "",
          },
        ]));
      }

      // 5. Fetch staff user IDs via server API (bypasses RLS on staff_users)
      let staffRows: { user_id: string; name: string }[] = [];
      try {
        const staffRes = await fetch("/api/admin/staff");
        if (staffRes.ok) {
          const { staff } = await staffRes.json();
          staffRows = (staff || []).map((s: Record<string, unknown>) => ({ user_id: s.user_id as string, name: s.name as string }));
        }
      } catch { /* silent */ }
      const staffSet = new Set(staffRows.map(s => s.user_id));
      // Clean staff name (for participant display) and formatted name (for message bubbles)
      const staffCleanNameMap = new Map(staffRows.map(s => [s.user_id, s.name || "Staff"]));
      const staffNameMap = new Map(staffRows.map(s => [s.user_id, `${s.name || "Staff"} • #${s.user_id.slice(-6).toUpperCase()}`]));

      // 6. Fetch business names for business-type conversations
      const businessIds = [...new Set((convoRows || []).map(c => c.business_id).filter(Boolean))];
      let businessMap = new Map<string, string>();
      if (businessIds.length > 0) {
        const { data: businesses } = await supabaseBrowser
          .from("business")
          .select("id, business_name, public_business_name")
          .in("id", businessIds);

        businessMap = new Map((businesses || []).map(b => [
          b.id,
          b.public_business_name || b.business_name || "Unknown Business",
        ]));
      }

      // 6b. Fetch influencer names for influencer-type conversations
      const influencerIds = [...new Set((convoRows || []).map(c => c.influencer_id).filter(Boolean))];
      let influencerMap = new Map<string, { name: string; email: string }>();
      if (influencerIds.length > 0) {
        const { data: influencers } = await supabaseBrowser
          .from("influencers")
          .select("id, name, email")
          .in("id", influencerIds);

        influencerMap = new Map((influencers || []).map(i => [
          i.id,
          { name: i.name || "Unknown Influencer", email: i.email || "" },
        ]));
      }

      // 7. Map conversations with resolved data
      const mappedConvos: Conversation[] = (convoRows || []).map(c => {
        // Determine participant name
        let participantName = c.name || "Unknown";
        let participantEmail = "";

        if (c.business_id) {
          participantName = businessMap.get(c.business_id) || c.name || "Unknown Business";
          if (c.participant_id) {
            const profile = profileMap.get(c.participant_id);
            participantEmail = profile?.email || "";
          }
        } else if (c.influencer_id) {
          const inf = influencerMap.get(c.influencer_id);
          participantName = inf?.name || c.name || "Unknown Influencer";
          participantEmail = inf?.email || "";
        } else if (c.participant_id) {
          // If the current user IS the participant, show the OTHER person's name
          if (c.participant_id === user?.id) {
            // Try created_by first
            let otherPersonId: string | null = (c.created_by && c.created_by !== c.participant_id) ? c.created_by : null;
            // Fallback: find a message sender who isn't the current user
            if (!otherPersonId) {
              const rawMsgs = messagesMap.get(c.id) || [];
              const otherSender = rawMsgs.find(m => m.sender_id !== user?.id);
              if (otherSender) otherPersonId = otherSender.sender_id as string;
            }
            if (otherPersonId) {
              const otherStaffName = staffCleanNameMap.get(otherPersonId);
              const otherProfile = profileMap.get(otherPersonId);
              participantName = otherStaffName || otherProfile?.full_name || c.name || "Unknown";
              participantEmail = otherProfile?.email || "";
            } else {
              participantName = c.name || "Unknown";
            }
          } else {
            const profile = profileMap.get(c.participant_id);
            const staffName = staffCleanNameMap.get(c.participant_id);
            participantName = staffName || profile?.full_name || c.name || "Unknown";
            participantEmail = profile?.email || "";
          }
        }

        // Resolve closed_by name
        const closedByName = c.closed_by
          ? staffNameMap.get(c.closed_by) || `Staff • #${c.closed_by.slice(-6).toUpperCase()}`
          : "";

        // Map messages with sender info
        const rawMessages = messagesMap.get(c.id) || [];
        const mappedMessages: Message[] = rawMessages.map(m => {
          const senderId = m.sender_id as string;
          const isStaff = staffSet.has(senderId);
          const senderProfile = profileMap.get(senderId);
          const senderStaffName = staffNameMap.get(senderId);

          // Use sender_role from DB if available, otherwise fall back to staff lookup
          const role = m.sender_role as string | null;
          const derivedIsStaff = role ? role === "staff" : isStaff;

          return {
            id: m.id as string,
            sender_id: senderId,
            sender_type: derivedIsStaff ? "staff" as const : c.business_id ? "business" as const : "user" as const,
            sender_name: derivedIsStaff
              ? senderStaffName || `Staff • #${senderId.slice(-6).toUpperCase()}`
              : c.business_id
                ? businessMap.get(c.business_id) || senderProfile?.full_name || "Unknown"
                : senderProfile?.full_name || "Unknown",
            body: m.body as string || "",
            created_at: m.created_at as string,
            attachment_url: (m.attachment_url as string) || null,
          };
        });

        // Derive category from data — staff if participant is a staff member
        const isStaffConvo = !c.business_id && !c.influencer_id && c.participant_id && staffSet.has(c.participant_id);
        const category: "user" | "business" | "influencer" | "staff" = c.business_id ? "business" : c.influencer_id ? "influencer" : isStaffConvo ? "staff" : "user";

        return {
          id: c.id,
          participant_id: c.participant_id,
          business_id: c.business_id,
          participant_name: participantName,
          participant_email: participantEmail,
          type: c.type || "dm",
          category,
          status: c.status || "active",
          unread_count: c.unread_count || 0,
          last_message: c.last_message || mappedMessages[mappedMessages.length - 1]?.body || "",
          last_message_at: c.last_message_at || c.updated_at || c.created_at,
          messages: mappedMessages,
          closed_at: c.closed_at,
          closed_by: c.closed_by,
          closed_by_name: closedByName,
          created_at: c.created_at,
        };
      });

      setConversations(mappedConvos);
    } catch (err) {
      console.error("Error fetching conversations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredConversations = conversations.filter(c => {
    if (messageFilters.search && !c.participant_name.toLowerCase().includes(messageFilters.search.toLowerCase()) && !c.participant_email.toLowerCase().includes(messageFilters.search.toLowerCase())) return false;
    if (messageFilters.type !== "all" && c.category !== messageFilters.type) return false;
    if (messageFilters.readStatus === "unread" && c.unread_count === 0) return false;
    if (messageFilters.readStatus === "read" && c.unread_count > 0) return false;
    if (messageFilters.status !== "all" && messageFilters.status !== c.status) return false;
    return true;
  }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

  const uploadReplyAttachment = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `support-chat/admin/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabaseBrowser.storage.from("business-media").upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data: urlData } = supabaseBrowser.storage.from("business-media").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Only image files are supported."); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Image must be under 10 MB."); return; }
    setReplyAttachment(file);
    setReplyAttachmentPreview(URL.createObjectURL(file));
  };

  const clearReplyAttachment = () => {
    if (replyAttachmentPreview) URL.revokeObjectURL(replyAttachmentPreview);
    setReplyAttachment(null);
    setReplyAttachmentPreview(null);
  };

  const sendReply = async () => {
    if ((!replyText.trim() && !replyAttachment) || !selectedConversation || !currentStaffId) return;
    setSending(true);
    try {
      // 1. Upload attachment if present
      let attachmentUrl: string | null = null;
      if (replyAttachment) {
        setReplyUploading(true);
        attachmentUrl = await uploadReplyAttachment(replyAttachment);
        setReplyUploading(false);
      }

      // 2. Insert message into messages table
      const insertPayload: Record<string, string> = {
        conversation_id: selectedConversation.id,
        sender_id: currentStaffId,
        sender_role: "staff",
        body: replyText.trim(),
      };
      if (attachmentUrl) insertPayload.attachment_url = attachmentUrl;

      const { data: newMsg, error: msgError } = await supabaseBrowser
        .from("messages")
        .insert(insertPayload)
        .select("id, created_at")
        .single();

      if (msgError) throw msgError;

      // 3. Update conversation's last_message and timestamp
      const lastMsgPreview = replyText.trim() || (attachmentUrl ? "📷 Image" : "");
      const { error: convoError } = await supabaseBrowser
        .from("conversations")
        .update({
          last_message: lastMsgPreview,
          last_message_at: newMsg.created_at,
          updated_at: newMsg.created_at,
        })
        .eq("id", selectedConversation.id);

      if (convoError) throw convoError;

      logAudit({
        action: "send_message",
        tab: AUDIT_TABS.MESSAGING,
        subTab: "Conversations",
        targetType: "conversation",
        targetId: selectedConversation.id,
        entityName: selectedConversation.participant_name,
        details: `Sent reply in conversation with ${selectedConversation.participant_name}`,
      });

      // 3.5 Notify the participant about the new message
      if (selectedConversation.participant_id) {
        const { data: { session: staffSession } } = await supabaseBrowser.auth.getSession();
        if (staffSession?.access_token) {
          fetch("/api/notifications/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${staffSession.access_token}`,
            },
            body: JSON.stringify({
              userId: selectedConversation.participant_id,
              type: "new_message",
              title: "New Message from LetsGo",
              body: lastMsgPreview.length > 80 ? lastMsgPreview.slice(0, 80) + "..." : lastMsgPreview || "You have a new message.",
              metadata: {
                preview: lastMsgPreview.slice(0, 100),
                conversationId: selectedConversation.id,
                href: "/profile",
              },
            }),
          }).catch(() => {}); // fire-and-forget
        }
      }

      // 4. Update local state
      const newMessage: Message = {
        id: newMsg.id,
        sender_id: currentStaffId,
        sender_type: "staff",
        sender_name: currentStaffName,
        body: replyText.trim(),
        created_at: newMsg.created_at,
        attachment_url: attachmentUrl,
      };

      setSelectedConversation(prev => prev ? {
        ...prev,
        messages: [...prev.messages, newMessage],
        last_message: lastMsgPreview,
        last_message_at: newMsg.created_at,
      } : prev);

      setConversations(prev => prev.map(c =>
        c.id === selectedConversation.id
          ? { ...c, messages: [...c.messages, newMessage], last_message: lastMsgPreview, last_message_at: newMsg.created_at }
          : c
      ));

      setReplyText("");
      clearReplyAttachment();
    } catch (err) {
      console.error("Error sending reply:", err);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Search for recipients when creating a new conversation
  const searchRecipients = useCallback(async (query: string, type: "user" | "business" | "influencer" | "staff") => {
    if (query.length < 2) {
      setNewConvoResults([]);
      return;
    }
    setNewConvoSearching(true);
    try {
      if (type === "business") {
        const { data } = await supabaseBrowser
          .from("business")
          .select("id, business_name, public_business_name")
          .or(`business_name.ilike.%${query}%,public_business_name.ilike.%${query}%`)
          .limit(10);

        setNewConvoResults((data || []).map(b => ({
          id: b.id,
          label: b.public_business_name || b.business_name || "Unknown",
          sublabel: b.business_name || "",
        })));
      } else if (type === "influencer") {
        const { data } = await supabaseBrowser
          .from("influencers")
          .select("id, name, code, email")
          .or(`name.ilike.%${query}%,code.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(10);

        setNewConvoResults((data || []).map(i => ({
          id: i.id,
          label: i.name || "Unknown",
          sublabel: i.code ? `Code: ${i.code}` : i.email || "",
        })));
      } else if (type === "staff") {
        const res = await fetch("/api/admin/staff");
        if (res.ok) {
          const { staff } = await res.json();
          const q = query.toLowerCase();
          const filtered = (staff || [])
            .filter((s: Record<string, unknown>) => s.user_id !== currentStaffId && ((s.name as string) || "").toLowerCase().includes(q))
            .slice(0, 10);
          setNewConvoResults(filtered.map((s: Record<string, unknown>) => ({
            id: s.user_id as string,
            label: (s.name as string) || "Staff",
            sublabel: (s.role as string) || "staff",
          })));
        }
      } else {
        const { data } = await supabaseBrowser
          .from("profiles")
          .select("id, full_name, first_name, last_name, email")
          .or(`full_name.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(10);

        setNewConvoResults((data || []).map(p => ({
          id: p.id,
          label: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
          sublabel: p.email || "",
        })));
      }
    } catch (err) {
      console.error("Error searching recipients:", err);
    } finally {
      setNewConvoSearching(false);
    }
  }, [currentStaffId]);

  // Debounced search
  useEffect(() => {
    if (!showNewConvo) return;
    const timer = setTimeout(() => {
      searchRecipients(newConvoSearch, newConvoType);
    }, 300);
    return () => clearTimeout(timer);
  }, [newConvoSearch, newConvoType, showNewConvo, searchRecipients]);

  // Start a new conversation
  const startNewConversation = async () => {
    if (!newConvoSelectedId || !newConvoMessage.trim() || !currentStaffId) return;
    setNewConvoSending(true);
    try {
      const now = new Date().toISOString();

      // Check for existing conversation with this recipient
      let existingQuery = supabaseBrowser.from("conversations").select("id, status");
      if (newConvoType === "business") {
        existingQuery = existingQuery.eq("business_id", newConvoSelectedId);
      } else if (newConvoType === "influencer") {
        existingQuery = existingQuery.eq("influencer_id", newConvoSelectedId);
      } else {
        existingQuery = existingQuery.eq("participant_id", newConvoSelectedId).is("business_id", null).is("influencer_id", null);
      }
      const { data: existingConvo } = await existingQuery.limit(1).maybeSingle();

      let convoId: string;

      if (existingConvo) {
        // Conversation already exists — reopen if closed and add the new message
        convoId = existingConvo.id;
        const updates: Record<string, unknown> = {
          last_message: newConvoMessage.trim(),
          last_message_at: now,
          updated_at: now,
          unread_count: 1,
        };
        if (existingConvo.status === "closed") {
          updates.status = "active";
        }
        await supabaseBrowser.from("conversations").update(updates).eq("id", convoId);
      } else {
        // No existing conversation — create a new one
        const convoPayload: Record<string, unknown> = {
          participant_id: null,
          business_id: null,
          influencer_id: null,
          type: "dm",
          name: `Message from ${currentStaffName}`,
          created_by: currentStaffId,
          status: "active",
          last_message: newConvoMessage.trim(),
          last_message_at: now,
          updated_at: now,
          unread_count: 1,
        };

        if (newConvoType === "business") {
          convoPayload.business_id = newConvoSelectedId;
          // Find the owner as participant
          const { data: owner } = await supabaseBrowser
            .from("business_users")
            .select("user_id")
            .eq("business_id", newConvoSelectedId)
            .eq("role", "owner")
            .limit(1)
            .maybeSingle();
          if (owner) {
            convoPayload.participant_id = owner.user_id;
          }
        } else if (newConvoType === "influencer") {
          convoPayload.influencer_id = newConvoSelectedId;
        } else {
          convoPayload.participant_id = newConvoSelectedId;
        }

        const { data: newConvo, error: convoErr } = await supabaseBrowser
          .from("conversations")
          .insert(convoPayload)
          .select("id")
          .single();

        if (convoErr) throw convoErr;
        convoId = newConvo.id;
      }

      // Insert the message into the conversation
      const { error: msgErr } = await supabaseBrowser
        .from("messages")
        .insert({
          conversation_id: convoId,
          sender_id: currentStaffId,
          sender_role: "staff",
          body: newConvoMessage.trim(),
        });

      if (msgErr) throw msgErr;

      logAudit({
        action: "start_conversation",
        tab: AUDIT_TABS.MESSAGING,
        subTab: "Conversations",
        targetType: "conversation",
        targetId: convoId,
        entityName: newConvoSelectedName,
        details: `Started ${existingConvo ? "reopened" : "new"} ${newConvoType} conversation with ${newConvoSelectedName}`,
      });

      // Reset and close modal
      setShowNewConvo(false);
      setNewConvoSearch("");
      setNewConvoResults([]);
      setNewConvoSelectedId(null);
      setNewConvoSelectedName("");
      setNewConvoMessage("");

      // Refresh conversations list
      await fetchData();
    } catch (err) {
      console.error("Error creating conversation:", err);
      alert("Failed to start conversation. Please try again.");
    } finally {
      setNewConvoSending(false);
    }
  };

  const toggleReadStatus = async () => {
    if (!selectedConversation) return;
    const newUnread = selectedConversation.unread_count > 0 ? 0 : 1;
    try {
      const { error } = await supabaseBrowser
        .from("conversations")
        .update({ unread_count: newUnread, updated_at: new Date().toISOString() })
        .eq("id", selectedConversation.id);

      if (error) throw error;

      logAudit({
        action: newUnread === 0 ? "mark_conversation_read" : "mark_conversation_unread",
        tab: AUDIT_TABS.MESSAGING,
        subTab: "Conversations",
        targetType: "conversation",
        targetId: selectedConversation.id,
        entityName: selectedConversation.participant_name,
        fieldName: "unread_count",
        oldValue: String(selectedConversation.unread_count),
        newValue: String(newUnread),
        details: `Marked conversation with ${selectedConversation.participant_name} as ${newUnread === 0 ? "read" : "unread"}`,
      });

      setSelectedConversation(prev => prev ? { ...prev, unread_count: newUnread } : prev);
      setConversations(prev => prev.map(c => c.id === selectedConversation.id ? { ...c, unread_count: newUnread } : c));
    } catch (err) {
      console.error("Error updating read status:", err);
    }
  };

  const toggleStatus = async () => {
    if (!selectedConversation) return;
    const newStatus = selectedConversation.status === "closed" ? "active" : "closed";
    const now = new Date().toISOString();

    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: now,
      };

      if (newStatus === "closed") {
        updateData.closed_at = now;
        updateData.closed_by = currentStaffId;
      } else {
        updateData.closed_at = null;
        updateData.closed_by = null;
      }

      const { error } = await supabaseBrowser
        .from("conversations")
        .update(updateData)
        .eq("id", selectedConversation.id);

      if (error) throw error;

      logAudit({
        action: newStatus === "closed" ? "close_conversation" : "reopen_conversation",
        tab: AUDIT_TABS.MESSAGING,
        subTab: "Conversations",
        targetType: "conversation",
        targetId: selectedConversation.id,
        entityName: selectedConversation.participant_name,
        fieldName: "status",
        oldValue: selectedConversation.status,
        newValue: newStatus,
        details: `${newStatus === "closed" ? "Closed" : "Reopened"} conversation with ${selectedConversation.participant_name}`,
      });

      const updates = {
        status: newStatus as "active" | "closed",
        closed_at: newStatus === "closed" ? now : null,
        closed_by: newStatus === "closed" ? currentStaffId : null,
        closed_by_name: newStatus === "closed" ? currentStaffName : "",
      };

      setSelectedConversation(prev => prev ? { ...prev, ...updates } : prev);
      setConversations(prev => prev.map(c => c.id === selectedConversation.id ? { ...c, ...updates } : c));

      if (newStatus === "closed") setMessageFilters(prev => ({ ...prev, status: "closed" }));
    } catch (err) {
      console.error("Error updating conversation status:", err);
      alert("Failed to update conversation. Please try again.");
    }
  };

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>Loading messages...</div>;

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Conversations List */}
      <div style={{ width: 380, background: COLORS.cardBg, borderRight: "1px solid " + COLORS.cardBorder, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 20, borderBottom: "1px solid " + COLORS.cardBorder }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>💬 Messages</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowNewConvo(true)} style={{ padding: "8px 14px", background: COLORS.gradient2, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✉️ New Message</button>
              <button onClick={() => setShowBroadcast(true)} style={{ padding: "8px 14px", background: COLORS.gradient1, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>📢 Broadcast</button>
            </div>
          </div>
          <input type="text" placeholder="Search conversations..." value={messageFilters.search} onChange={e => setMessageFilters({ ...messageFilters, search: e.target.value })} style={{ width: "100%", padding: "10px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 8, fontSize: 13, background: COLORS.darkBg, color: COLORS.textPrimary, marginBottom: 12 }} />

          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { key: "all", label: "All" },
              { key: "user", label: "Users" },
              { key: "business", label: "Businesses" },
              { key: "influencer", label: "🌟 Influencers" },
              { key: "staff", label: "Staff" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setMessageFilters({ ...messageFilters, type: key })} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, background: messageFilters.type === key ? COLORS.gradient1 : COLORS.darkBg, color: messageFilters.type === key ? "#fff" : COLORS.textSecondary, whiteSpace: "nowrap" }}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[{ key: "all", label: "All" }, { key: "unread", label: "🔴 Unread" }, { key: "read", label: "✓ Read" }].map(rs => (
              <button key={rs.key} onClick={() => setMessageFilters({ ...messageFilters, readStatus: rs.key })} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, background: messageFilters.readStatus === rs.key ? COLORS.gradient3 : COLORS.darkBg, color: messageFilters.readStatus === rs.key ? "#fff" : COLORS.textSecondary }}>{rs.label}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {[{ key: "all", label: "📋 All", count: conversations.length }, { key: "active", label: "📬 Active", count: conversations.filter(c => c.status === "active").length }, { key: "closed", label: "📁 Closed", count: conversations.filter(c => c.status === "closed").length }].map(st => (
              <button key={st.key} onClick={() => setMessageFilters({ ...messageFilters, status: st.key })} style={{ flex: 1, padding: "7px", borderRadius: 6, cursor: "pointer", fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: messageFilters.status === st.key ? (st.key === "all" ? "rgba(0,212,255,0.2)" : st.key === "active" ? "rgba(57,255,20,0.2)" : "rgba(160,160,176,0.2)") : COLORS.darkBg, color: messageFilters.status === st.key ? (st.key === "all" ? COLORS.neonBlue : st.key === "active" ? COLORS.neonGreen : COLORS.textSecondary) : COLORS.textSecondary, border: messageFilters.status === st.key ? "1px solid " + (st.key === "all" ? COLORS.neonBlue : st.key === "active" ? COLORS.neonGreen : COLORS.textSecondary) : "1px solid transparent" }}>
                {st.label} <span style={{ background: COLORS.cardBg, padding: "2px 6px", borderRadius: 4, fontSize: 9 }}>{st.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredConversations.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}><div style={{ fontSize: 32, marginBottom: 12 }}>📭</div><div>No conversations found</div></div>
          ) : filteredConversations.map(conv => (
            <div key={conv.id} onClick={() => setSelectedConversation(conv)} style={{ padding: 16, borderBottom: "1px solid " + COLORS.cardBorder, cursor: "pointer", background: selectedConversation?.id === conv.id ? "rgba(255,45,146,0.1)" : "transparent", opacity: conv.status === "closed" ? 0.7 : 1 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ position: "relative" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: COLORS.gradient1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, border: conv.unread_count > 0 ? "2px solid " + COLORS.neonPink : "2px solid transparent" }}>{conv.participant_name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                  {conv.unread_count > 0 && <span style={{ position: "absolute", top: -4, right: -4, width: 20, height: 20, background: COLORS.neonPink, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{conv.unread_count}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: conv.unread_count > 0 ? 700 : 500, fontSize: 14, color: conv.unread_count > 0 ? COLORS.textPrimary : COLORS.textSecondary }}>{conv.participant_name}</span>
                      {conv.unread_count > 0 ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.neonPink }} /> : <span style={{ fontSize: 10, color: COLORS.neonGreen }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 10, color: COLORS.textSecondary }}>{formatDateTime(conv.last_message_at)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: conv.category === "user" ? "rgba(0,212,255,0.2)" : conv.category === "influencer" ? "rgba(255,107,53,0.2)" : conv.category === "staff" ? "rgba(191,95,255,0.2)" : "rgba(57,255,20,0.2)", color: conv.category === "user" ? COLORS.neonBlue : conv.category === "influencer" ? COLORS.neonOrange : conv.category === "staff" ? COLORS.neonPurple : COLORS.neonGreen, textTransform: "uppercase", fontWeight: 600 }}>
                      {conv.category === "influencer" ? "🌟 influencer" : conv.category}
                    </span>
                    {conv.status === "closed" && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(160,160,176,0.2)", color: COLORS.textSecondary, fontWeight: 600 }}>CLOSED</span>}
                  </div>
                  <div style={{ fontSize: 12, color: conv.unread_count > 0 ? COLORS.textPrimary : COLORS.textSecondary, fontWeight: conv.unread_count > 0 ? 500 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{conv.last_message}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message View */}
      {selectedConversation ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: COLORS.darkBg }}>
          <div style={{ padding: 20, background: COLORS.cardBg, borderBottom: "1px solid " + COLORS.cardBorder, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: COLORS.gradient1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>{selectedConversation.participant_name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{selectedConversation.participant_name}</span>
                  {selectedConversation.unread_count > 0 ? <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(255,45,146,0.2)", color: COLORS.neonPink, fontSize: 10, fontWeight: 600 }}>UNREAD ({selectedConversation.unread_count})</span> : <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(57,255,20,0.2)", color: COLORS.neonGreen, fontSize: 10, fontWeight: 600 }}>READ</span>}
                  {selectedConversation.status === "closed" && <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(160,160,176,0.2)", color: COLORS.textSecondary, fontSize: 10, fontWeight: 600 }}>CLOSED</span>}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{selectedConversation.participant_email}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={toggleReadStatus} style={{ padding: "8px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{selectedConversation.unread_count > 0 ? "✓ Mark Read" : "🔴 Mark Unread"}</button>
              <button onClick={toggleStatus} style={{ padding: "8px 14px", background: selectedConversation.status === "closed" ? "rgba(57,255,20,0.2)" : "rgba(160,160,176,0.2)", border: "1px solid " + (selectedConversation.status === "closed" ? COLORS.neonGreen : COLORS.textSecondary), borderRadius: 8, color: selectedConversation.status === "closed" ? COLORS.neonGreen : COLORS.textSecondary, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{selectedConversation.status === "closed" ? "📬 Reopen" : "📁 Close"}</button>
              <button onClick={() => { const cat = selectedConversation.category; window.location.href = cat === "business" ? "/admin/businesses" : cat === "influencer" ? `/admin/referrals?search=${encodeURIComponent(selectedConversation.participant_name)}` : cat === "staff" ? "/admin/settings" : "/admin/users"; }} style={{ padding: "8px 14px", background: COLORS.gradient1, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{selectedConversation.category === "staff" ? "View Staff →" : "View Profile →"}</button>
            </div>
          </div>

          {selectedConversation.status === "closed" && (
            <div style={{ padding: "12px 20px", background: "rgba(160,160,176,0.1)", borderBottom: "1px solid " + COLORS.cardBorder, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 16 }}>📁</span>
              <span style={{ color: COLORS.textSecondary, fontSize: 13 }}>This conversation was closed by <strong>{selectedConversation.closed_by_name || "Staff"}</strong> on {formatDateTime(selectedConversation.closed_at || "")}</span>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {selectedConversation.messages.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary, fontSize: 14 }}>No messages yet. Start the conversation below.</div>
            ) : selectedConversation.messages.map(msg => {
              const isMe = msg.sender_type === "staff";
              return (
              <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "70%", padding: 14, borderRadius: 16, background: isMe ? COLORS.gradient1 : COLORS.cardBg, color: isMe ? "#fff" : COLORS.textPrimary }}>
                  <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 4, fontWeight: 600 }}>{msg.sender_name}</div>
                  {msg.attachment_url && (
                    <a href={msg.attachment_url as string} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginBottom: 8 }}>
                      <img src={msg.attachment_url as string} alt="Attachment" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, cursor: "pointer" }} />
                    </a>
                  )}
                  {msg.body && <div style={{ fontSize: 14, lineHeight: 1.5 }}>{msg.body}</div>}
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 6, textAlign: "right" }}>{formatDateTime(msg.created_at)}</div>
                </div>
              </div>
              );
            })}
          </div>

          <div style={{ padding: 20, background: COLORS.cardBg, borderTop: "1px solid " + COLORS.cardBorder }}>
            {selectedConversation.status === "closed" ? (
              <div style={{ textAlign: "center", color: COLORS.textSecondary, padding: 10 }}>
                <span>This conversation is closed. </span>
                <button onClick={toggleStatus} style={{ background: "none", border: "none", color: COLORS.neonBlue, cursor: "pointer", textDecoration: "underline" }}>Reopen to reply</button>
              </div>
            ) : (
              <div>
                {replyAttachmentPreview && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "8px 12px", background: COLORS.darkBg, borderRadius: 8, border: "1px solid " + COLORS.cardBorder }}>
                    <img src={replyAttachmentPreview} alt="Preview" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />
                    <span style={{ flex: 1, fontSize: 12, color: COLORS.textSecondary }}>{replyAttachment?.name}</span>
                    <button onClick={clearReplyAttachment} style={{ background: "none", border: "none", color: COLORS.neonRed || "#ff3131", cursor: "pointer", fontSize: 18, fontWeight: 700, lineHeight: 1 }}>×</button>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 12, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, display: "flex", alignItems: "center", justifyContent: "center" }} title="Attach image">
                    <input type="file" accept="image/*" onChange={handleReplyFileSelect} style={{ display: "none" }} />
                    <span style={{ fontSize: 18 }}>📎</span>
                  </label>
                  <input type="text" placeholder="Type your reply..." value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === "Enter" && !sending && sendReply()} style={{ flex: 1, padding: "14px 16px", border: "1px solid " + COLORS.cardBorder, borderRadius: 12, fontSize: 14, background: COLORS.darkBg, color: COLORS.textPrimary }} />
                  <button onClick={sendReply} disabled={(!replyText.trim() && !replyAttachment) || sending} style={{ padding: "14px 24px", background: (replyText.trim() || replyAttachment) && !sending ? COLORS.gradient1 : COLORS.cardBorder, border: "none", borderRadius: 12, color: "#fff", cursor: (replyText.trim() || replyAttachment) && !sending ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 14 }}>{replyUploading ? "Uploading..." : sending ? "Sending..." : "Send →"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.darkBg }}>
          <div style={{ textAlign: "center", color: COLORS.textSecondary }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>💬</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Select a Conversation</div>
            <div style={{ fontSize: 14 }}>Choose a conversation from the list to start messaging</div>
          </div>
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewConvo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowNewConvo(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 540, width: "90%", border: "1px solid " + COLORS.cardBorder, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, background: COLORS.gradient2, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>✉️ New Conversation</h2>
              <button onClick={() => setShowNewConvo(false)} style={{ background: "none", border: "none", color: COLORS.textSecondary, fontSize: 24, cursor: "pointer" }}>×</button>
            </div>

            {/* Recipient Type */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 8, fontWeight: 600 }}>Recipient Type</label>
              <div style={{ display: "flex", gap: 8 }}>
                {([
                  { key: "user" as const, label: "User", color: COLORS.neonBlue },
                  { key: "business" as const, label: "Business", color: COLORS.neonGreen },
                  { key: "influencer" as const, label: "Influencer", color: COLORS.neonOrange },
                  { key: "staff" as const, label: "Staff", color: COLORS.neonPurple },
                ]).map(t => (
                  <button
                    key={t.key}
                    onClick={() => { setNewConvoType(t.key); setNewConvoSearch(""); setNewConvoResults([]); setNewConvoSelectedId(null); setNewConvoSelectedName(""); }}
                    style={{ flex: 1, padding: "10px", borderRadius: 8, border: newConvoType === t.key ? `2px solid ${t.color}` : "1px solid " + COLORS.cardBorder, background: newConvoType === t.key ? `${t.color}15` : COLORS.darkBg, color: newConvoType === t.key ? t.color : COLORS.textSecondary, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Search */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 8, fontWeight: 600 }}>
                {newConvoSelectedId ? "Recipient" : `Search ${newConvoType === "business" ? "Businesses" : newConvoType === "influencer" ? "Influencers" : newConvoType === "staff" ? "Staff" : "Users"}`}
              </label>

              {newConvoSelectedId ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, background: COLORS.darkBg, borderRadius: 10, border: "1px solid " + COLORS.neonGreen }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{newConvoSelectedName}</div>
                  </div>
                  <button
                    onClick={() => { setNewConvoSelectedId(null); setNewConvoSelectedName(""); setNewConvoSearch(""); }}
                    style={{ background: "rgba(255,49,49,0.15)", border: "none", borderRadius: 6, color: COLORS.neonRed, cursor: "pointer", padding: "6px 12px", fontSize: 11, fontWeight: 600 }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={newConvoSearch}
                    onChange={e => setNewConvoSearch(e.target.value)}
                    placeholder={newConvoType === "business" ? "Search by business name..." : newConvoType === "influencer" ? "Search by name, code, or email..." : newConvoType === "staff" ? "Search by staff name..." : "Search by name or email..."}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }}
                  />
                  {newConvoSearching && (
                    <div style={{ padding: 12, textAlign: "center", color: COLORS.textSecondary, fontSize: 12 }}>Searching...</div>
                  )}
                  {!newConvoSearching && newConvoResults.length > 0 && (
                    <div style={{ marginTop: 8, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, maxHeight: 200, overflowY: "auto", background: COLORS.darkBg }}>
                      {newConvoResults.map(r => (
                        <button
                          key={r.id}
                          onClick={() => { setNewConvoSelectedId(r.id); setNewConvoSelectedName(r.label); setNewConvoResults([]); }}
                          style={{ display: "block", width: "100%", padding: "10px 14px", background: "transparent", border: "none", borderBottom: "1px solid " + COLORS.cardBorder, cursor: "pointer", textAlign: "left" }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.textPrimary }}>{r.label}</div>
                          {r.sublabel && <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{r.sublabel}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!newConvoSearching && newConvoSearch.length >= 2 && newConvoResults.length === 0 && (
                    <div style={{ padding: 12, textAlign: "center", color: COLORS.textSecondary, fontSize: 12 }}>No results found</div>
                  )}
                </>
              )}
            </div>

            {/* Message */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 8, fontWeight: 600 }}>Message *</label>
              <textarea
                value={newConvoMessage}
                onChange={e => setNewConvoMessage(e.target.value)}
                placeholder="Write your message..."
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14, minHeight: 100, resize: "vertical" }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNewConvo(false)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textSecondary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button
                onClick={startNewConversation}
                disabled={!newConvoSelectedId || !newConvoMessage.trim() || newConvoSending}
                style={{ padding: "12px 24px", background: newConvoSelectedId && newConvoMessage.trim() && !newConvoSending ? COLORS.gradient2 : COLORS.cardBorder, border: "none", borderRadius: 10, color: newConvoSelectedId && newConvoMessage.trim() ? "#000" : COLORS.textSecondary, cursor: newConvoSelectedId && newConvoMessage.trim() && !newConvoSending ? "pointer" : "not-allowed", fontWeight: 700 }}
              >
                {newConvoSending ? "Sending..." : "Send Message →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {showBroadcast && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowBroadcast(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 540, width: "90%", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>📢 Broadcast Message</h2>
              <button onClick={() => setShowBroadcast(false)} style={{ background: "none", border: "none", color: COLORS.textSecondary, fontSize: 24, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Audience</label>
                <select
                  value={broadcastData.audience}
                  onChange={(e) => setBroadcastData({ ...broadcastData, audience: e.target.value })}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }}
                >
                  <option value="all">All Users</option>
                  <option value="users">Users Only</option>
                  <option value="businesses">Businesses Only</option>
                  <option value="influencers">🌟 Influencers Only</option>
                  <option value="active_influencers">🌟 Active Influencers Only</option>
                </select>
                <div style={{ marginTop: 6, fontSize: 11, color: COLORS.textSecondary }}>
                  {broadcastData.audience === "influencers" || broadcastData.audience === "active_influencers"
                    ? "Broadcasts to influencers are sent to their email addresses on file."
                    : "Message will appear as a new conversation in recipients' inboxes."}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Subject / Title</label>
                <input
                  value={broadcastData.subject}
                  onChange={(e) => setBroadcastData({ ...broadcastData, subject: e.target.value })}
                  placeholder="e.g. Important update about your account"
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Message</label>
                <textarea
                  value={broadcastData.message}
                  onChange={(e) => setBroadcastData({ ...broadcastData, message: e.target.value })}
                  placeholder="Write your broadcast message here..."
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14, minHeight: 120, resize: "vertical" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => setShowBroadcast(false)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button
                disabled={broadcastSending || !broadcastData.message.trim() || !broadcastData.subject.trim()}
                onClick={async () => {
                  if (!broadcastData.message.trim() || !broadcastData.subject.trim()) { alert("Please fill in subject and message."); return; }
                  if (!currentStaffId) { alert("Not authenticated. Please log in again."); return; }
                  setBroadcastSending(true);
                  try {
                    // Determine which profiles to broadcast to
                    let recipientIds: string[] = [];
                    const audience = broadcastData.audience;

                    if (audience === "influencers" || audience === "active_influencers") {
                      // Fetch influencer user IDs
                      const query = supabaseBrowser.from("influencers").select("user_id");
                      if (audience === "active_influencers") query.eq("status", "active");
                      const { data: influencers } = await query;
                      recipientIds = (influencers || []).map(i => i.user_id).filter(Boolean);
                    } else if (audience === "businesses") {
                      // Fetch business owner user IDs
                      const { data: owners } = await supabaseBrowser
                        .from("business_users")
                        .select("user_id")
                        .eq("role", "owner");
                      recipientIds = (owners || []).map(o => o.user_id).filter(Boolean);
                    } else if (audience === "users") {
                      // Fetch all non-staff, non-business profiles
                      const { data: allProfiles } = await supabaseBrowser
                        .from("profiles")
                        .select("id")
                        .limit(1000);
                      const { data: staffIds } = await supabaseBrowser.from("staff_users").select("user_id");
                      const staffIdSet = new Set((staffIds || []).map(s => s.user_id));
                      recipientIds = (allProfiles || []).map(p => p.id).filter(id => !staffIdSet.has(id));
                    } else {
                      // "all" — all profiles except staff
                      const { data: allProfiles } = await supabaseBrowser
                        .from("profiles")
                        .select("id")
                        .limit(1000);
                      const { data: staffIds } = await supabaseBrowser.from("staff_users").select("user_id");
                      const staffIdSet = new Set((staffIds || []).map(s => s.user_id));
                      recipientIds = (allProfiles || []).map(p => p.id).filter(id => !staffIdSet.has(id));
                    }

                    if (recipientIds.length === 0) {
                      alert("No recipients found for the selected audience.");
                      setBroadcastSending(false);
                      return;
                    }

                    // Create a conversation + message for each recipient
                    // Batch insert conversations
                    const convoInserts = recipientIds.map(uid => ({
                      participant_id: uid,
                      type: "dm" as const,
                      name: broadcastData.subject,
                      created_by: currentStaffId,
                      status: "active",
                      last_message: broadcastData.message,
                      last_message_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      unread_count: 1,
                    }));

                    const { data: newConvos, error: convoErr } = await supabaseBrowser
                      .from("conversations")
                      .insert(convoInserts)
                      .select("id");

                    if (convoErr) throw convoErr;

                    // Insert a message for each new conversation
                    if (newConvos && newConvos.length > 0) {
                      const msgInserts = newConvos.map(c => ({
                        conversation_id: c.id,
                        sender_id: currentStaffId,
                        sender_role: "staff" as const,
                        body: broadcastData.message,
                      }));

                      const { error: msgErr } = await supabaseBrowser
                        .from("messages")
                        .insert(msgInserts);

                      if (msgErr) throw msgErr;
                    }

                    // Notify each recipient about the broadcast message
                    const { data: { session: broadcastStaffSession } } = await supabaseBrowser.auth.getSession();
                    if (broadcastStaffSession?.access_token) {
                      const preview = broadcastData.message.length > 80
                        ? broadcastData.message.slice(0, 80) + "..."
                        : broadcastData.message;

                      for (const uid of recipientIds) {
                        fetch("/api/notifications/send", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${broadcastStaffSession.access_token}`,
                          },
                          body: JSON.stringify({
                            userId: uid,
                            type: "new_message",
                            title: broadcastData.subject,
                            body: preview || "You have a new message from LetsGo.",
                            metadata: {
                              preview: broadcastData.message.slice(0, 100),
                              href: "/profile",
                            },
                          }),
                        }).catch(() => {}); // fire-and-forget
                      }
                    }

                    logAudit({
                      action: "send_broadcast",
                      tab: AUDIT_TABS.MESSAGING,
                      subTab: "Broadcasts",
                      targetType: "message",
                      targetId: broadcastData.audience,
                      entityName: broadcastData.subject,
                      details: `Broadcast "${broadcastData.subject}" sent to ${recipientIds.length} ${broadcastData.audience} recipient(s)`,
                    });

                    alert(`Broadcast sent to ${recipientIds.length} recipient(s).`);
                    setShowBroadcast(false);
                    setBroadcastData({ audience: "all", subject: "", message: "" });
                    fetchData(); // Refresh conversations
                  } catch (err) {
                    console.error("Error sending broadcast:", err);
                    alert("Failed to send broadcast. Please try again.");
                  } finally {
                    setBroadcastSending(false);
                  }
                }}
                style={{ padding: "12px 24px", background: broadcastSending ? COLORS.cardBorder : COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: broadcastSending ? "not-allowed" : "pointer", fontWeight: 700 }}
              >
                {broadcastSending ? "Sending..." : "📢 Send Broadcast"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
