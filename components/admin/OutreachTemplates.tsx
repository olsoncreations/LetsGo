"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { COLORS } from "@/components/admin/constants";
import { Card } from "@/components/admin/components";

interface OutreachTemplate {
  id: string;
  label: string;
  description: string | null;
  subject: string;
  body: string;
  from_name: string;
  from_email: string;
  is_active: boolean;
  updated_at: string;
}

const PLACEHOLDERS = [
  { key: "{{business_name}}", desc: "Business name" },
  { key: "{{location}}", desc: "City, State" },
  { key: "{{city}}", desc: "City only" },
  { key: "{{state}}", desc: "State only" },
  { key: "{{rating}}", desc: "Google rating" },
  { key: "{{rating_line}}", desc: "Rating mention (only shows if 4.0+)" },
  { key: "{{from_name}}", desc: "Sender name" },
  { key: "{{cta_owners_manual}}", desc: "Button: See How It Works" },
  { key: "{{cta_signup}}", desc: "Button: Sign Up Now" },
  { key: "{{cta_preview}}", desc: "Button: See Your Preview Page" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid " + COLORS.cardBorder,
  background: COLORS.cardBg,
  color: COLORS.textPrimary,
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: COLORS.textSecondary,
  marginBottom: 4,
  textTransform: "uppercase",
  fontWeight: 600,
};

export default function OutreachTemplates() {
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<OutreachTemplate>>({});
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  async function getToken(): Promise<string> {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    return session?.access_token || "";
  }

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/sales/outreach-templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  function startEdit(t: OutreachTemplate) {
    setEditingId(t.id);
    setEditForm({ ...t });
    setPreviewHtml(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
    setPreviewHtml(null);
  }

  async function saveTemplate() {
    if (!editingId) return;
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/sales/outreach-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: editingId,
          label: editForm.label,
          description: editForm.description,
          subject: editForm.subject,
          body: editForm.body,
          from_name: editForm.from_name,
          from_email: editForm.from_email,
          is_active: editForm.is_active,
        }),
      });
      if (res.ok) {
        await fetchTemplates();
        setEditingId(null);
        setEditForm({});
        setPreviewHtml(null);
      } else {
        const data = await res.json();
        alert(data.error || "Save failed");
      }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }

  function showPreview() {
    if (!editForm.body) return;
    // Replace placeholders with sample data
    let html = editForm.body
      .replace(/\{\{business_name\}\}/g, "Rosie's Diner")
      .replace(/\{\{location\}\}/g, "Omaha, NE")
      .replace(/\{\{city\}\}/g, "Omaha")
      .replace(/\{\{state\}\}/g, "NE")
      .replace(/\{\{rating\}\}/g, "4.7")
      .replace(/\{\{rating_line\}\}/g, '<p>With a 4.7-star rating, your customers clearly love what you do. LetsGo helps you reward them for coming back.</p>')
      .replace(/\{\{from_name\}\}/g, editForm.from_name || "Chris Olson")
      .replace(/\{\{cta_owners_manual\}\}/g, '<a href="#" style="display: inline-block; padding: 12px 28px; background: #ff6b35; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">See How It Works</a>')
      .replace(/\{\{cta_signup\}\}/g, '<a href="#" style="display: inline-block; padding: 12px 28px; background: #ff6b35; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Sign Up Now</a>')
      .replace(/\{\{cta_preview\}\}/g, '<a href="#" style="display: inline-block; padding: 12px 28px; background: #ff6b35; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">See Your Preview Page</a>');

    setPreviewHtml(html);
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>Loading templates...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Placeholder reference */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 12 }}>
          Available Placeholders
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PLACEHOLDERS.map((p) => (
            <div
              key={p.key}
              style={{
                padding: "4px 10px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid " + COLORS.cardBorder,
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              <code style={{ color: COLORS.neonBlue }}>{p.key}</code>
              <span style={{ color: COLORS.textSecondary, marginLeft: 6 }}>{p.desc}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Templates list */}
      {templates.map((t) => (
        <Card key={t.id}>
          {editingId === t.id ? (
            // ── Edit mode ──
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 18, color: COLORS.textPrimary }}>
                  Editing: {t.label}
                </h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={showPreview}
                    style={{
                      padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: `rgba(0,212,255,0.1)`, border: `1px solid ${COLORS.neonBlue}40`, color: COLORS.neonBlue,
                    }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={saveTemplate}
                    disabled={saving}
                    style={{
                      padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: COLORS.gradient1, border: "none", color: "#fff",
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    style={{
                      padding: "8px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                      background: "transparent", border: "1px solid " + COLORS.cardBorder, color: COLORS.textSecondary,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Label</label>
                  <input
                    value={editForm.label || ""}
                    onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Description</label>
                  <input
                    value={editForm.description || ""}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>From Name</label>
                  <input
                    value={editForm.from_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, from_name: e.target.value })}
                    style={inputStyle}
                    placeholder="Chris Olson"
                  />
                </div>
                <div>
                  <label style={labelStyle}>From Email</label>
                  <input
                    value={editForm.from_email || ""}
                    onChange={(e) => setEditForm({ ...editForm, from_email: e.target.value })}
                    style={inputStyle}
                    placeholder="chris.olson@useletsgo.com"
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Subject Line</label>
                <input
                  value={editForm.subject || ""}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  style={inputStyle}
                  placeholder="Bring repeat customers to {{business_name}}"
                />
              </div>

              <div>
                <label style={labelStyle}>Email Body (HTML)</label>
                <textarea
                  value={editForm.body || ""}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  style={{
                    ...inputStyle,
                    minHeight: 300,
                    resize: "vertical",
                    fontFamily: "'Courier New', monospace",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={editForm.is_active ?? true}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    style={{ accentColor: COLORS.neonGreen }}
                  />
                  <span style={{ fontSize: 13, color: COLORS.textPrimary }}>Active</span>
                </label>
                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                  Inactive templates cannot be sent
                </span>
              </div>

              {/* Preview panel */}
              {previewHtml && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 8 }}>
                    Preview (sample data: Rosie&apos;s Diner, Omaha, NE, 4.7 stars)
                  </div>
                  <div
                    style={{
                      padding: 24,
                      background: "#ffffff",
                      borderRadius: 8,
                      border: "1px solid " + COLORS.cardBorder,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                      Subject: {(editForm.subject || "").replace(/\{\{business_name\}\}/g, "Rosie's Diner")}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
                      From: {editForm.from_name || "Chris Olson"} &lt;{editForm.from_email || "chris.olson@useletsgo.com"}&gt;
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            // ── View mode ──
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 16, color: COLORS.textPrimary }}>{t.label}</h3>
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                    background: t.is_active ? "rgba(57,255,20,0.15)" : "rgba(255,255,255,0.05)",
                    color: t.is_active ? COLORS.neonGreen : COLORS.textSecondary,
                    border: `1px solid ${t.is_active ? COLORS.neonGreen + "30" : COLORS.cardBorder}`,
                  }}>
                    {t.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>
                  {t.description}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
                  Subject: <span style={{ color: COLORS.neonBlue }}>{t.subject}</span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                  From: {t.from_name} &lt;{t.from_email}&gt;
                </div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>
                  Last updated: {new Date(t.updated_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => startEdit(t)}
                style={{
                  padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, color: COLORS.textPrimary,
                }}
              >
                Edit
              </button>
            </div>
          )}
        </Card>
      ))}

      {templates.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
          No outreach templates found. Run the migration to seed default templates.
        </div>
      )}
    </div>
  );
}
