"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  COLORS,
  Card,
  StatCard,
  formatDateTime,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";

// ==================== TYPES ====================
interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

interface RuleAction {
  type: string;
  message?: string;
  target?: string;
}

interface TriggerConfig {
  cron?: string;
  threshold?: number;
  window_hours?: number;
  [key: string]: unknown;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: TriggerConfig;
  conditions: RuleCondition[];
  actions: RuleAction[];
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string | null;
}

type RuleFormState = {
  name: string;
  trigger_type: "event" | "schedule" | "condition";
  event_name: string;
  description: string;
  scope: string;
  scopeTarget: string;
  trigger_config: TriggerConfig;
  conditions: RuleCondition[];
  actions: RuleAction[];
};

const EMPTY_FORM: RuleFormState = {
  name: "",
  trigger_type: "event",
  event_name: "receipt_submitted",
  description: "",
  scope: "platform",
  scopeTarget: "",
  trigger_config: {},
  conditions: [],
  actions: [],
};

const TRIGGER_TYPE_OPTIONS: Array<{ value: "event" | "schedule" | "condition"; label: string; desc: string }> = [
  { value: "event", label: "Event-Based", desc: "Fires when a specific event occurs" },
  { value: "schedule", label: "Scheduled", desc: "Runs on a cron schedule" },
  { value: "condition", label: "Condition-Based", desc: "Fires when conditions are met" },
];

const EVENT_NAME_OPTIONS = [
  { value: "receipt_submitted", label: "Receipt Submitted" },
  { value: "receipt_approved", label: "Receipt Approved" },
  { value: "receipt_rejected", label: "Receipt Rejected" },
  { value: "first_receipt_approved", label: "First Receipt Approved" },
  { value: "payout_requested", label: "Payout Requested" },
  { value: "user_registered", label: "User Registered" },
  { value: "user_inactive", label: "User Inactive" },
  { value: "business_registered", label: "Business Registered" },
];

const CONDITION_FIELDS = [
  "receipt_total_cents",
  "payout_cents",
  "visit_count",
  "user_tier",
  "business_type",
  "days_inactive",
];

const CONDITION_OPERATORS = [
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "equals", label: "=" },
  { value: "not_equals", label: "≠" },
  { value: "greater_or_equal", label: "≥" },
  { value: "less_or_equal", label: "≤" },
];

const ACTION_TYPES = [
  "send_notification",
  "send_email",
  "auto_approve",
  "auto_reject",
  "flag_for_review",
  "create_fraud_alert",
  "update_status",
  "assign_to_staff",
];

// ==================== AUTOMATION PAGE ====================
export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffId, setStaffId] = useState<string | null>(null);

  // Filters
  const [rulesFilters, setRulesFilters] = useState({
    search: "",
    trigger: "all",
    enabled: "all",
  });

  // Modal states
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [formState, setFormState] = useState<RuleFormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Get current staff user
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (user) setStaffId(user.id);
    })();
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: rulesData, error: rulesErr }, { data: staffData }] = await Promise.all([
        supabaseBrowser
          .from("automation_rules")
          .select("*")
          .order("created_at", { ascending: false }),
        supabaseBrowser
          .from("staff_users")
          .select("user_id, name"),
      ]);

      if (rulesErr) throw rulesErr;

      // Build staff name lookup
      const staffMap = new Map<string, string>();
      (staffData || []).forEach((s: { user_id: string; name: string }) => {
        staffMap.set(s.user_id, s.name);
      });

      const mapped: AutomationRule[] = (rulesData || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name as string) || "",
        description: (r.description as string) || "",
        trigger_type: (r.trigger_type as string) || "",
        trigger_config: (r.trigger_config as TriggerConfig) || {},
        conditions: (r.conditions as RuleCondition[]) || [],
        actions: (r.actions as RuleAction[]) || [],
        is_active: (r.is_active as boolean) ?? true,
        run_count: (r.run_count as number) || 0,
        last_run_at: (r.last_run_at as string) || null,
        created_by: (r.created_by as string) || null,
        created_by_name: r.created_by ? staffMap.get(r.created_by as string) || "Unknown" : "System",
        created_at: r.created_at as string,
        updated_at: (r.updated_at as string) || null,
      }));

      setRules(mapped);
    } catch (err) {
      console.error("Error fetching automation rules:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle rule active status
  const toggleRule = async (ruleId: string, currentActive: boolean) => {
    try {
      const { error } = await supabaseBrowser
        .from("automation_rules")
        .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
        .eq("id", ruleId);

      if (error) throw error;

      const toggledRule = rules.find(r => r.id === ruleId);
      logAudit({
        action: "toggle_rule",
        tab: AUDIT_TABS.AUTOMATION,
        subTab: "Rules",
        targetType: "automation_rule",
        targetId: ruleId,
        entityName: toggledRule?.name || ruleId,
        fieldName: "is_active",
        oldValue: String(currentActive),
        newValue: String(!currentActive),
        details: `Rule ${!currentActive ? "enabled" : "disabled"}`,
      });

      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: !currentActive } : r));
    } catch (err) {
      console.error("Error toggling rule:", err);
      alert("Failed to toggle rule. Please try again.");
    }
  };

  // Delete rule
  const deleteRule = async (rule: AutomationRule) => {
    if (!confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabaseBrowser
        .from("automation_rules")
        .delete()
        .eq("id", rule.id);

      if (error) throw error;

      logAudit({
        action: "delete_rule",
        tab: AUDIT_TABS.AUTOMATION,
        subTab: "Rules",
        targetType: "automation_rule",
        targetId: rule.id,
        entityName: rule.name,
        details: `Deleted automation rule "${rule.name}" (trigger: ${rule.trigger_type})`,
      });

      setRules(prev => prev.filter(r => r.id !== rule.id));
    } catch (err) {
      console.error("Error deleting rule:", err);
      alert("Failed to delete rule. Please try again.");
    }
  };

  // Open create modal
  const openCreateModal = () => {
    setEditingRule(null);
    setFormState({ ...EMPTY_FORM });
    setShowRuleModal(true);
  };

  // Open edit modal
  const openEditModal = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormState({
      name: rule.name,
      trigger_type: rule.trigger_type as "event" | "schedule" | "condition",
      event_name: (rule.trigger_config.event_name as string) || "receipt_submitted",
      description: rule.description,
      scope: rule.trigger_config.scope as string || "platform",
      scopeTarget: rule.trigger_config.scope_target as string || "",
      trigger_config: { ...rule.trigger_config },
      conditions: [...rule.conditions],
      actions: [...rule.actions],
    });
    setShowRuleModal(true);
  };

  // Save rule (create or update)
  const saveRule = async () => {
    if (!formState.name.trim()) {
      alert("Rule name is required");
      return;
    }
    if (!formState.trigger_type) {
      alert("Trigger event is required");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();

      // Build trigger_config from form fields
      const triggerConfig: TriggerConfig = {
        ...formState.trigger_config,
        scope: formState.scope,
      };
      if (formState.scope !== "platform" && formState.scopeTarget) {
        triggerConfig.scope_target = formState.scopeTarget;
      }
      if (formState.trigger_type === "event") {
        triggerConfig.event_name = formState.event_name;
      }

      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        trigger_type: formState.trigger_type,
        trigger_config: triggerConfig,
        conditions: formState.conditions.length > 0 ? formState.conditions : null,
        actions: formState.actions,
        updated_at: now,
      };

      if (editingRule) {
        // Update existing
        const { error } = await supabaseBrowser
          .from("automation_rules")
          .update(payload)
          .eq("id", editingRule.id);

        if (error) {
          console.error("Supabase update error:", error.message, error.code);
          alert(`Failed to save: ${error.message}`);
          return;
        }

        logAudit({
          action: "update_rule",
          tab: AUDIT_TABS.AUTOMATION,
          subTab: "Rules",
          targetType: "automation_rule",
          targetId: editingRule.id,
          entityName: formState.name.trim(),
          fieldName: "automation_rule",
          oldValue: JSON.stringify({ name: editingRule.name, trigger_type: editingRule.trigger_type, description: editingRule.description }),
          newValue: JSON.stringify({ name: formState.name.trim(), trigger_type: formState.trigger_type, description: formState.description.trim() }),
          details: `Updated automation rule "${formState.name.trim()}" (trigger: ${formState.trigger_type})`,
        });
      } else {
        // Insert new
        const { error } = await supabaseBrowser
          .from("automation_rules")
          .insert({
            ...payload,
            is_active: true,
            run_count: 0,
            created_by: staffId,
          });

        if (error) {
          console.error("Supabase insert error:", error.message, error.code);
          alert(`Failed to save: ${error.message}`);
          return;
        }

        logAudit({
          action: "create_rule",
          tab: AUDIT_TABS.AUTOMATION,
          subTab: "Rules",
          targetType: "automation_rule",
          targetId: formState.name.trim(),
          entityName: formState.name.trim(),
          details: `Created automation rule "${formState.name.trim()}" (trigger: ${formState.trigger_type})`,
        });
      }

      setShowRuleModal(false);
      setEditingRule(null);
      setFormState({ ...EMPTY_FORM });
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("Error saving rule:", msg, err);
      alert("Failed to save rule: " + msg);
    } finally {
      setSaving(false);
    }
  };

  // Add condition to form
  const addCondition = () => {
    setFormState(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: "receipt_total_cents", operator: "greater_than", value: "" }],
    }));
  };

  // Remove condition from form
  const removeCondition = (index: number) => {
    setFormState(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  // Update condition in form
  const updateCondition = (index: number, key: keyof RuleCondition, value: string) => {
    setFormState(prev => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => i === index ? { ...c, [key]: value } : c),
    }));
  };

  // Add action to form
  const addAction = () => {
    setFormState(prev => ({
      ...prev,
      actions: [...prev.actions, { type: "send_notification", message: "" }],
    }));
  };

  // Remove action from form
  const removeAction = (index: number) => {
    setFormState(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  // Update action in form
  const updateAction = (index: number, key: keyof RuleAction, value: string) => {
    setFormState(prev => ({
      ...prev,
      actions: prev.actions.map((a, i) => i === index ? { ...a, [key]: value } : a),
    }));
  };

  // Filter rules
  const filteredRules = rules.filter(r => {
    if (rulesFilters.search && !r.name.toLowerCase().includes(rulesFilters.search.toLowerCase()) && !r.description.toLowerCase().includes(rulesFilters.search.toLowerCase())) return false;
    if (rulesFilters.trigger !== "all" && r.trigger_type !== rulesFilters.trigger) return false;
    if (rulesFilters.enabled !== "all" && (rulesFilters.enabled === "enabled" ? !r.is_active : r.is_active)) return false;
    return true;
  });

  // Get unique triggers for filter dropdown
  const triggerTypes = [...new Set(rules.map(r => r.trigger_type).filter(Boolean))];

  // Stats
  const activeCount = rules.filter(r => r.is_active).length;
  const disabledCount = rules.filter(r => !r.is_active).length;
  const totalTriggers = rules.reduce((acc, r) => acc + r.run_count, 0);
  const autoApproveCount = rules.filter(r => r.is_active && r.actions.some(a => a.type === "auto_approve")).length;

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>
        Loading automation rules...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>⚡ Automation Rules</h1>
        <button onClick={openCreateModal} style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>+ Create Rule</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon="⚡" value={activeCount.toString()} label="Active Rules" gradient={COLORS.gradient2} />
        <StatCard icon="⏸️" value={disabledCount.toString()} label="Disabled" gradient={COLORS.gradient4} />
        <StatCard icon="🎯" value={totalTriggers.toLocaleString()} label="Total Triggers" gradient={COLORS.gradient1} />
        <StatCard icon="✅" value={autoApproveCount.toString()} label="Auto-Approve Rules" gradient={COLORS.gradient2} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search rules..."
          value={rulesFilters.search}
          onChange={e => setRulesFilters({ ...rulesFilters, search: e.target.value })}
          style={{ flex: 1, padding: "12px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}
        />
        <select
          value={rulesFilters.trigger}
          onChange={e => setRulesFilters({ ...rulesFilters, trigger: e.target.value })}
          style={{ padding: "12px 16px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}
        >
          <option value="all">All Triggers</option>
          {triggerTypes.map(t => (
            <option key={t} value={t}>{t === "event" ? "Event-Based" : t === "schedule" ? "Scheduled" : t === "condition" ? "Condition-Based" : t}</option>
          ))}
        </select>
        <select
          value={rulesFilters.enabled}
          onChange={e => setRulesFilters({ ...rulesFilters, enabled: e.target.value })}
          style={{ padding: "12px 16px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}
        >
          <option value="all">All Status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* Rules List */}
      {filteredRules.length === 0 ? (
        <Card>
          <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
            <div style={{ fontSize: 16, marginBottom: 8 }}>No automation rules found</div>
            <div style={{ fontSize: 13 }}>Create your first rule to get started</div>
          </div>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {filteredRules.map(rule => (
            <Card key={rule.id} style={{ opacity: rule.is_active ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 24 }}>⚡</span>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{rule.name}</h3>
                    {rule.is_active ? (
                      <span style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(57,255,20,0.2)", color: COLORS.neonGreen, fontSize: 10, fontWeight: 600 }}>ACTIVE</span>
                    ) : (
                      <span style={{ padding: "4px 10px", borderRadius: 6, background: COLORS.darkBg, color: COLORS.textSecondary, fontSize: 10, fontWeight: 600 }}>DISABLED</span>
                    )}
                  </div>
                  <p style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 16 }}>{rule.description || "No description"}</p>
                  <div style={{ display: "flex", gap: 20, fontSize: 12, flexWrap: "wrap" }}>
                    <div><span style={{ color: COLORS.textSecondary }}>Trigger:</span> <span style={{ color: COLORS.neonBlue, fontWeight: 600 }}>{rule.trigger_type}{rule.trigger_config.event_name ? ` → ${String(rule.trigger_config.event_name).replace(/_/g, " ")}` : ""}</span></div>
                    <div><span style={{ color: COLORS.textSecondary }}>Times triggered:</span> <span style={{ fontWeight: 600 }}>{rule.run_count.toLocaleString()}</span></div>
                    <div><span style={{ color: COLORS.textSecondary }}>Created by:</span> <span style={{ fontWeight: 600 }}>{rule.created_by_name}</span></div>
                    {rule.last_run_at && (
                      <div><span style={{ color: COLORS.textSecondary }}>Last run:</span> <span style={{ fontWeight: 600 }}>{formatDateTime(rule.last_run_at)}</span></div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => toggleRule(rule.id, rule.is_active)}
                    style={{ padding: "8px 16px", background: rule.is_active ? "rgba(255,49,49,0.2)" : "rgba(57,255,20,0.2)", border: "none", borderRadius: 8, color: rule.is_active ? COLORS.neonRed : COLORS.neonGreen, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                  >
                    {rule.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => openEditModal(rule)}
                    style={{ padding: "8px 16px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteRule(rule)}
                    style={{ padding: "8px 16px", background: "rgba(255,49,49,0.1)", border: "1px solid rgba(255,49,49,0.3)", borderRadius: 8, color: COLORS.neonRed, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Conditions & Actions */}
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 600 }}>CONDITIONS</div>
                  {rule.conditions.length === 0 ? (
                    <span style={{ fontSize: 12, color: COLORS.textSecondary }}>No conditions (always triggers)</span>
                  ) : rule.conditions.map((c, i) => (
                    <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: COLORS.neonBlue }}>{c.field}</span> {c.operator.replace(/_/g, " ")} <span style={{ color: COLORS.neonGreen, fontWeight: 600 }}>{c.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 600 }}>ACTIONS</div>
                  {rule.actions.length === 0 ? (
                    <span style={{ fontSize: 12, color: COLORS.textSecondary }}>No actions defined</span>
                  ) : rule.actions.map((a, i) => (
                    <div key={i} style={{ fontSize: 12, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: COLORS.neonPink }}>→</span> {a.type.replace(/_/g, " ")} {a.message && <span style={{ color: COLORS.textSecondary }}>&quot;{a.message}&quot;</span>}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Rule Modal */}
      {showRuleModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => { setShowRuleModal(false); setEditingRule(null); }}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 700, maxWidth: "95%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
              ⚡ {editingRule ? "Edit" : "Create"} Automation Rule
            </h2>

            {/* Rule Name */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Rule Name *</label>
              <input
                type="text"
                value={formState.name}
                onChange={e => setFormState({ ...formState, name: e.target.value })}
                placeholder="e.g., High Value Receipt Alert"
                style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}
              />
            </div>

            {/* Trigger Type Selection */}
            <div style={{ marginBottom: 20, padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 12, textTransform: "uppercase", fontWeight: 600 }}>Trigger Type *</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {TRIGGER_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFormState({ ...formState, trigger_type: opt.value })}
                    style={{ padding: 14, borderRadius: 12, border: formState.trigger_type === opt.value ? "2px solid " + COLORS.neonBlue : "1px solid " + COLORS.cardBorder, background: formState.trigger_type === opt.value ? "rgba(0,212,255,0.1)" : COLORS.cardBg, cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ fontWeight: 600, color: formState.trigger_type === opt.value ? COLORS.neonBlue : COLORS.textPrimary, marginBottom: 4 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              {/* Event name dropdown (shown for event type) */}
              {formState.trigger_type === "event" && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Event Name *</label>
                  <select
                    value={formState.event_name}
                    onChange={e => setFormState({ ...formState, event_name: e.target.value })}
                    style={{ width: "100%", padding: 14, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}
                  >
                    {EVENT_NAME_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Description</label>
              <input
                type="text"
                value={formState.description}
                onChange={e => setFormState({ ...formState, description: e.target.value })}
                placeholder="What does this rule do?"
                style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}
              />
            </div>

            {/* Trigger Config (shown for schedule) */}
            {formState.trigger_type === "schedule" && (
              <div style={{ marginBottom: 20, padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Cron Schedule</label>
                <input
                  type="text"
                  value={formState.trigger_config.cron || ""}
                  onChange={e => setFormState({ ...formState, trigger_config: { ...formState.trigger_config, cron: e.target.value } })}
                  placeholder="e.g., 0 9 * * * (daily at 9am)"
                  style={{ width: "100%", padding: 14, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}
                />
              </div>
            )}

            {/* Scope Selection */}
            <div style={{ marginBottom: 20, padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 12, textTransform: "uppercase", fontWeight: 600 }}>Rule Scope</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { id: "platform", icon: "🌐", label: "Platform-Wide", desc: "Applies to all users & businesses" },
                  { id: "business", icon: "🏢", label: "Specific Business", desc: "Applies only to one business" },
                  { id: "user", icon: "👤", label: "Specific User", desc: "Applies only to one user" },
                ].map(scope => (
                  <button
                    key={scope.id}
                    onClick={() => setFormState({ ...formState, scope: scope.id, scopeTarget: "" })}
                    style={{ padding: 16, borderRadius: 12, border: formState.scope === scope.id ? "2px solid " + COLORS.neonPink : "1px solid " + COLORS.cardBorder, background: formState.scope === scope.id ? "rgba(255,45,146,0.1)" : COLORS.cardBg, cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{scope.icon}</div>
                    <div style={{ fontWeight: 600, color: formState.scope === scope.id ? COLORS.neonPink : COLORS.textPrimary, marginBottom: 4 }}>{scope.label}</div>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{scope.desc}</div>
                  </button>
                ))}
              </div>
              {formState.scope !== "platform" && (
                <input
                  type="text"
                  value={formState.scopeTarget}
                  onChange={e => setFormState({ ...formState, scopeTarget: e.target.value })}
                  placeholder={formState.scope === "business" ? "Business ID" : "User ID"}
                  style={{ width: "100%", marginTop: 12, padding: 14, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}
                />
              )}
            </div>

            {/* Conditions Builder */}
            <div style={{ marginBottom: 20, padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600 }}>Conditions</label>
                <button
                  onClick={addCondition}
                  style={{ padding: "6px 14px", background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.3)", borderRadius: 8, color: COLORS.neonBlue, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                >
                  + Add Condition
                </button>
              </div>
              {formState.conditions.length === 0 ? (
                <div style={{ fontSize: 12, color: COLORS.textSecondary, padding: 12, textAlign: "center" }}>No conditions — rule will always trigger</div>
              ) : formState.conditions.map((cond, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select
                    value={cond.field}
                    onChange={e => updateCondition(i, "field", e.target.value)}
                    style={{ flex: 1, padding: 10, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 12 }}
                  >
                    {CONDITION_FIELDS.map(f => (
                      <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={e => updateCondition(i, "operator", e.target.value)}
                    style={{ width: 80, padding: 10, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 12 }}
                  >
                    {CONDITION_OPERATORS.map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={cond.value}
                    onChange={e => updateCondition(i, "value", e.target.value)}
                    placeholder="Value"
                    style={{ flex: 1, padding: 10, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 12 }}
                  />
                  <button
                    onClick={() => removeCondition(i)}
                    style={{ padding: "8px 10px", background: "rgba(255,49,49,0.15)", border: "none", borderRadius: 8, color: COLORS.neonRed, cursor: "pointer", fontSize: 14 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Actions Builder */}
            <div style={{ marginBottom: 24, padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600 }}>Actions</label>
                <button
                  onClick={addAction}
                  style={{ padding: "6px 14px", background: "rgba(255,45,146,0.15)", border: "1px solid rgba(255,45,146,0.3)", borderRadius: 8, color: COLORS.neonPink, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                >
                  + Add Action
                </button>
              </div>
              {formState.actions.length === 0 ? (
                <div style={{ fontSize: 12, color: COLORS.textSecondary, padding: 12, textAlign: "center" }}>No actions — add at least one action</div>
              ) : formState.actions.map((act, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select
                    value={act.type}
                    onChange={e => updateAction(i, "type", e.target.value)}
                    style={{ flex: 1, padding: 10, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 12 }}
                  >
                    {ACTION_TYPES.map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={act.message || ""}
                    onChange={e => updateAction(i, "message", e.target.value)}
                    placeholder="Message / details (optional)"
                    style={{ flex: 2, padding: 10, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 12 }}
                  />
                  <button
                    onClick={() => removeAction(i)}
                    style={{ padding: "8px 10px", background: "rgba(255,49,49,0.15)", border: "none", borderRadius: 8, color: COLORS.neonRed, cursor: "pointer", fontSize: 14 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowRuleModal(false); setEditingRule(null); }}
                style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textSecondary, cursor: "pointer", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={saveRule}
                disabled={saving}
                style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Saving..." : editingRule ? "Save Changes" : "Create Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
