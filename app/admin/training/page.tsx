"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";
import {
  COLORS,
  Card,
  SectionTitle,
  Badge,
} from "@/components/admin/components";

// ==================== TYPES ====================
interface TrainingStep {
  title: string;
  detail: string;
}

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  required: boolean;
  videoUrl?: string;
  content: TrainingStep[];
}

interface TrainingProgress {
  moduleId: string;
  completed: boolean;
  completedAt?: string;
  score?: number;
}

interface StaffMember {
  user_id: string;
  name: string;
  role: string;
}

interface StaffTrainingRecord {
  user_id: string;
  module_id: string;
  completed: boolean;
  completed_at: string | null;
  score: number | null;
}

// ==================== TRAINING DATA ====================
const trainingModules: TrainingModule[] = [
  {
    id: "onboarding_101",
    title: "Partner Onboarding Process",
    description: "Learn how to review and approve new business partner applications",
    category: "Onboarding",
    duration: "15 min",
    difficulty: "beginner",
    required: true,
    content: [
      {
        title: "Navigate to the Onboarding Queue",
        detail: "From the admin sidebar, click \"Onboarding.\" You will see a list of all submitted partner applications. Each shows the business name, submission date, and current status (pending_review, submitted, approved, or rejected). The badge on the sidebar shows how many are waiting.",
      },
      {
        title: "Review the Application Details",
        detail: "Click on any submission to expand it. Check the following fields carefully: Business Name and Public Name (should be a real business), Business Type (restaurant_bar, activity, or salon_beauty), Contact Info (valid email and phone), Address (use Google to verify it's a real location), and Hours of Operation (make sure they filled in at least some days).",
      },
      {
        title: "Verify Uploaded Documents",
        detail: "Scroll down to the Documents section. Every business must upload: a business license or EIN verification, a logo image, and a photo of the storefront or interior. Open each document — make sure nothing looks doctored, the business name matches, and documents are not expired. If documents are missing or unreadable, use 'Request Changes' instead of rejecting outright.",
      },
      {
        title: "Check the Payout Configuration",
        detail: "Review their chosen payout plan. The 4 presets are Standard (5%-20%), Conservative (3%-10%), Aggressive (8%-20%), and Custom. For Custom plans, verify the tier percentages are reasonable — no tier should exceed 25%, and tiers should increase progressively. Also check that they selected a payment method (bank account or card on file).",
      },
      {
        title: "Approve, Request Changes, or Reject",
        detail: "If everything checks out, click 'Approve.' This sets is_active = true and the business appears in the discovery feed immediately. If something needs fixing (missing doc, bad photo, etc.), click 'Request Changes' and write a clear note explaining what's needed — the partner gets an email. Only reject if the submission is clearly fraudulent, a duplicate, or the business doesn't qualify (e.g., not a real business). Always add an internal note explaining your decision.",
      },
    ],
  },
  {
    id: "receipts_101",
    title: "Receipt Approval Workflow",
    description: "Master the receipt review and approval process",
    category: "Receipts",
    duration: "20 min",
    difficulty: "beginner",
    required: true,
    content: [
      {
        title: "Open the Receipts Queue",
        detail: "Navigate to \"Receipts\" in the sidebar. The default view shows Pending receipts. Each row shows the receipt ID, business name, user, amount, submission date, and an image thumbnail. The sidebar badge shows the pending count. Use the status filter tabs to switch between Pending, Approved, and Rejected.",
      },
      {
        title: "Examine the Receipt Image",
        detail: "Click on a receipt to open the detail view. The receipt image shows on the left. Verify: the business name on the receipt matches the selected business, the date is within a reasonable window (not more than 30 days old by default — check Settings for max_receipt_age_days), the total amount matches what the user entered, and the receipt looks authentic (not a screenshot of a screenshot, no obvious edits).",
      },
      {
        title: "Understand the Payout Calculation",
        detail: "The system automatically calculates two values. User Payout: receipt total × tier percentage (based on visit count in the 365-day window). There is NO cap on user payouts. LetsGo Fee: 10% of receipt total, capped at $5.00 max. Example: $50 receipt at Tier 3 (10%) = $5.00 user payout + $5.00 LetsGo fee. The tier is determined by counting the user's approved receipts for this business in the last 365 days.",
      },
      {
        title: "Approve or Reject the Receipt",
        detail: "Click 'Approve' if the receipt is legitimate. This triggers the payout calculation and the user sees the reward in their profile balance. Click 'Reject' if: the image is unreadable, the amount doesn't match, it's a duplicate submission, the business doesn't match, or the receipt is clearly fraudulent. Always select a rejection reason — the user sees this. If you're unsure, flag it for a second opinion rather than rejecting.",
      },
      {
        title: "Handle Edge Cases",
        detail: "Partial receipts (only part visible): reject and ask for a full photo. Split checks: only the user's portion should be submitted. Gift cards or prepaid: these are valid receipts. Tips: the receipt total should include pre-tip subtotal only — LetsGo payouts are based on the subtotal. Duplicate submissions: check if the same receipt image or amount+date+business combo was already submitted by this user. If a business has auto-approval enabled (check their profile), receipts under their max auto-approval amount will skip the queue.",
      },
    ],
  },
  {
    id: "fraud_detection",
    title: "Fraud Detection & Prevention",
    description: "Identify and handle suspicious activity",
    category: "Security",
    duration: "30 min",
    difficulty: "intermediate",
    required: true,
    content: [
      {
        title: "Access the Fraud Center",
        detail: "Navigate to \"Fraud Center\" in the sidebar. The dashboard shows active alerts organized by severity (Critical, High, Medium, Low). Each alert includes the user ID, business ID, alert type, a details summary, and when it was created. Alerts are generated automatically by the system's fraud detection rules, or can be created manually by staff.",
      },
      {
        title: "Recognize Common Fraud Patterns",
        detail: "Watch for these red flags: Velocity abuse — a user submitting many receipts for the same business in a short window to jump tiers quickly. Fake receipts — edited images, screenshots of other people's receipts, or generated receipts. Collusion — a business owner submitting receipts for their own business through fake user accounts. Amount manipulation — inflating the receipt total to get a larger payout. Multi-account abuse — same person using multiple email accounts to reset their 365-day visit window.",
      },
      {
        title: "Investigate an Alert",
        detail: "Click an alert to see full details. Check the user's receipt history: how many receipts in the last 7/30/90 days? Are they all at the same business? Compare receipt images — do they look similar or templated? Check the user's profile: when was the account created, do they have a real name and profile info? Check the business: is it a real active business? If the alert involves amount manipulation, compare the receipt image total to the submitted amount_cents.",
      },
      {
        title: "Take Action on Fraud",
        detail: "For confirmed fraud: Reject all fraudulent receipts (change status to 'rejected'). Ban the user account from the Users page (temporary or permanent). Add detailed resolution notes to the alert explaining what you found. If the business is involved, flag it for review on the Businesses tab. For false positives: Mark the alert as 'resolved' with a note explaining why. This helps train the system. For suspicious but unconfirmed: Mark as 'investigating' and monitor. Set up an automation rule to flag future submissions from this user.",
      },
      {
        title: "Document Everything",
        detail: "Every fraud action is logged in the Audit Log automatically. But you should also: Add resolution notes directly on the fraud alert with specific evidence (e.g., 'Receipt image identical to submission #XYZ from different user'). If you ban a user, include the fraud alert ID in the ban reason. If you escalate to management, use the internal notes field. Never discuss fraud details with the affected user beyond 'your submission was flagged for review.' Direct them to support if they have questions.",
      },
    ],
  },
  {
    id: "billing_basics",
    title: "Billing & Invoicing",
    description: "Understand the billing system and invoice management",
    category: "Billing",
    duration: "25 min",
    difficulty: "intermediate",
    required: false,
    content: [
      {
        title: "Navigate to the Billing Dashboard",
        detail: "Click \"Billing\" in the sidebar. The dashboard shows summary cards: Total Outstanding, Overdue Invoices, Paid This Month, and Processing. Below that, the invoice list shows all invoices with their status (pending, paid, overdue, failed). Use the status filter tabs and date range picker to narrow results. The sidebar badge shows pending invoice count.",
      },
      {
        title: "Understand the Revenue Model",
        detail: "LetsGo charges businesses a 10% platform fee on every approved receipt, capped at $5.00 per receipt. This is calculated automatically: letsgo_fee_cents = min(receipt_total × 0.10, 500). Businesses also pay for their subscription plan (Basic or Premium) and any advertising add-ons (Spotlights, Pushes, etc.). Invoices are generated to collect these fees. User payouts are separate — they come from the business's payout obligation, not from LetsGo.",
      },
      {
        title: "Review and Process an Invoice",
        detail: "Click an invoice to see the breakdown: line items (platform fees, subscription, ad campaigns), the billing period, payment method on file, and any previous failed attempts. To process: verify the amount looks correct given the business's activity. Check their payment method is still valid. Click 'Process Payment' to charge. If it fails, the invoice moves to 'failed' status and the business gets notified. You can retry or mark it for manual follow-up.",
      },
      {
        title: "Handle Billing Disputes",
        detail: "If a business contacts support about a charge: Pull up their invoice in the Billing tab. Cross-reference with their receipt history — the platform fee should match 10% of their approved receipts (capped at $5 each). If there's a legitimate error, you can issue a credit or adjustment. Never issue refunds without manager approval. Document the dispute and resolution in the invoice notes. If the business wants to cancel, direct them through the proper offboarding process — don't just set is_active to false.",
      },
      {
        title: "Monitor Payment Health",
        detail: "Check the Billing dashboard regularly for: Overdue invoices (more than 30 days) — these need outreach. Repeatedly failed payments — the business may need to update their card. Businesses with large outstanding balances — consider pausing their account until payment is resolved. The Business Health page also flags businesses with billing issues. Use the Automation tab to set up rules like 'auto-pause businesses with 60+ days overdue.'",
      },
    ],
  },
  {
    id: "support_essentials",
    title: "Customer Support Essentials",
    description: "Handle support tickets and customer inquiries effectively",
    category: "Support",
    duration: "35 min",
    difficulty: "beginner",
    required: true,
    content: [
      {
        title: "Open the Support Dashboard",
        detail: "Navigate to \"Support\" in the sidebar. The dashboard shows ticket stats: Open, In Progress, Resolved, and average resolution time. Tickets are sorted by priority (urgent, high, medium, low). Each ticket shows the subject, submitter (user or business), category, assigned staff member, and age. Unassigned tickets appear at the top. Click any ticket to view the full conversation thread.",
      },
      {
        title: "Claim and Categorize a Ticket",
        detail: "Click an unassigned ticket to open it. Read the full message. Assign it to yourself by selecting your name from the 'Assigned To' dropdown. Set the correct category: account (login issues, profile problems), receipt (receipt questions, payout disputes), billing (business billing questions), technical (app bugs, errors), and general (everything else). Set priority: urgent for account lockouts or payment failures, high for payout discrepancies, medium for general questions, low for feature requests.",
      },
      {
        title: "Investigate Before Responding",
        detail: "Before replying, gather context. If it's a user ticket: check their profile in the Users tab, look at their receipt history, check for any fraud alerts or bans. If it's a business ticket: check their business profile, billing status, and payout history. If it's about a specific receipt: pull it up in the Receipts tab and check the image, amount, and status. Having this context prevents back-and-forth and shows the customer you take their issue seriously.",
      },
      {
        title: "Write an Effective Response",
        detail: "Use a professional but friendly tone. Structure your response: acknowledge the issue ('I see that your receipt from March 5th is showing as rejected'), explain what happened or what you found, tell them exactly what action you've taken or what they need to do next, and provide a timeline if applicable. Never share internal notes, other users' information, or system details. If you can't resolve it immediately, let them know you're working on it and when they'll hear back. Use specific details — don't say 'your receipt' when you can say 'your $42.50 receipt from Restaurant ABC on March 5th.'",
      },
      {
        title: "Resolve and Close Tickets",
        detail: "Once the issue is fixed: update the ticket status to 'resolved.' If the customer confirms they're satisfied, mark it 'closed.' Add internal notes summarizing what the issue was and how it was resolved — this helps other staff if similar tickets come in. If you can't resolve it, escalate: change priority to 'high' or 'urgent,' add notes on what you've tried, and reassign to a senior team member. Never close a ticket without the customer's issue being actually resolved. Track patterns — if you see the same issue repeatedly, flag it to the team so we can fix the root cause.",
      },
      {
        title: "Common Scenarios and Responses",
        detail: "'Where is my payout?' — Check their receipt status. If approved, explain the payout processing time (check Settings for payout_processing_days). If pending, explain it's in the review queue. 'Why was my receipt rejected?' — Look up the rejection reason and explain it clearly. Offer to let them resubmit with a better photo if applicable. 'How do I change my business hours?' — Direct business users to their Business Dashboard Profile tab. 'I think my payout amount is wrong' — Pull up the receipt, show the tier calculation, and explain the 365-day rolling window. 'I forgot my password' — Direct them to the login page reset flow. Staff cannot reset passwords manually.",
      },
    ],
  },
  {
    id: "analytics_advanced",
    title: "Advanced Analytics & Reporting",
    description: "Deep dive into analytics, custom reports, and the executive dashboard",
    category: "Analytics",
    duration: "40 min",
    difficulty: "advanced",
    required: false,
    content: [
      {
        title: "Understand the Key Metrics",
        detail: "The Overview page shows real-time platform health: Pending Receipts (how many need review — keep this low), Pending Onboarding (new business applications), Platform Metrics (influencers, surge events, ad campaigns, custom tiers), and Today vs Yesterday comparisons. The Executive page goes deeper: revenue breakdown by category (Basic, Premium, Advertising, Add-ons), payout distribution across 7 tier levels, user growth trends, and business geography by zone.",
      },
      {
        title: "Navigate the Executive Dashboard",
        detail: "The Executive tab has multiple sections. Revenue Analytics: line chart showing revenue over time, filterable by category and time period. Use the day/week/month/year toggles. Progressive Payout by Level: bar chart showing how many receipts fall into each of the 7 payout tiers. Business Geography: zone cards showing business distribution across US regions — hover to see state-level breakdown. Revenue Forecasting: projection based on historical growth rate. User Retention Cohort Analysis: shows what percentage of users from each signup month are still active.",
      },
      {
        title: "Generate Custom Reports",
        detail: "Click the 'Custom Reports' button in the sidebar footer. Select a report type from the dropdown: Receipts, Payouts, Revenue, Users, Businesses, Advertising, Influencer, Surge Pricing, and more. Set your date range. Click 'Generate Report' to download an XLSX file. The Master Report is special — it generates a multi-sheet workbook with ALL data: Executive Summary, Receipts, Payouts, Businesses, Users, Support Tickets, Fraud Alerts, Referrals, Promotions, Sales, Automation, Surge Events, Ad Campaigns, and Staff.",
      },
      {
        title: "Schedule Automated Reports",
        detail: "Below the generate button, you can schedule recurring reports. Select a frequency (daily, weekly, bi-weekly, monthly, quarterly), set the send time, enter recipient email addresses (comma-separated), and optionally include an executive summary. Click 'Save Schedule' to create. Scheduled reports appear in the list below — you can view their next run date or delete them. These are saved to the scheduled_reports table in Supabase.",
      },
      {
        title: "Interpret the Data for Decision-Making",
        detail: "Use analytics to spot actionable trends. If receipt volume is flat but user signups are growing — users aren't converting to active visitors, consider marketing pushes. If a specific tier (e.g., L4-L5) has very few users — most people aren't making repeat visits, consider outreach or promotions. If a geographic zone is underperforming vs target — focus sales efforts there. If the cohort retention chart shows steep drop-offs — investigate what's causing churn. If surge pricing is generating significant fees — it's working. If custom tier adoption is low — businesses may need education about the option.",
      },
    ],
  },
  {
    id: "sales_commission",
    title: "Sales Commission System",
    description: "Learn the commission structure, sales rep management, and payout process",
    category: "Sales",
    duration: "20 min",
    difficulty: "intermediate",
    required: false,
    content: [
      {
        title: "Open the Sales Dashboard",
        detail: "Navigate to \"Sales\" in the sidebar. The dashboard shows your active sales reps, their signup counts, commission totals, and performance metrics. Each rep has a profile with their name, email, phone, assigned zone, commission rate (in basis points — 1000 bps = 10%), and hire date. The leaderboard ranks reps by total signups and commissions earned.",
      },
      {
        title: "Understand the Commission Structure",
        detail: "Sales reps earn a commission when a business they referred signs up and becomes active. The commission rate is set per-rep in basis points (e.g., commission_rate_bps = 1000 means 10%). The commission is calculated on the business's first billing cycle amount. Commissions are tracked in the sales_signups table, which links each signup to the rep who brought them in. Commission status is either 'unpaid' or 'paid' with a paid_at timestamp.",
      },
      {
        title: "Track Sales Performance",
        detail: "On the Sales page, each rep card shows: total signups attributed to them, total commission earned, number of paid vs unpaid commissions, and their assigned zone. Click a rep to see their full signup history — each entry shows the business they signed up, the plan the business chose, the commission amount, and whether it's been paid. Use this to evaluate rep performance and identify top performers or those who need coaching.",
      },
      {
        title: "Process Commission Payouts",
        detail: "To pay commissions: review the unpaid commission list for accuracy. Verify each signup is legitimate — the business should be active and have completed onboarding. Mark commissions as paid when payment is processed, which records the paid_at timestamp. If a business cancels shortly after signup, you may need to claw back the commission — discuss with management before doing this. Never promise commissions on businesses that haven't completed the full onboarding process.",
      },
      {
        title: "Manage Sales Reps and Zones",
        detail: "To add a new rep: use the 'Add Rep' form with their name, email, phone, zone assignment, and commission rate. Zones correspond to the geographic regions shown on the Executive dashboard (Midwest, Mountain, Southwest, Southeast, Northeast, Pacific, Great Plains, New England). Each rep should focus on their assigned zone. To deactivate a rep, toggle their is_active status — this doesn't delete their data, so their historical commissions are preserved. If reassigning a zone, make sure existing leads are properly handed off.",
      },
    ],
  },
  {
    id: "platform_security",
    title: "Platform Security & Access Control",
    description: "Security best practices, access management, and incident response",
    category: "Security",
    duration: "25 min",
    difficulty: "advanced",
    required: true,
    content: [
      {
        title: "Understand the Role System",
        detail: "LetsGo has three access levels. Users: regular app users who discover businesses, upload receipts, and earn payouts. They log in through the main app and can only see their own data (enforced by Row Level Security in Supabase). Business Users: stored in business_users table with roles: owner, manager, or staff. They can access their business dashboard but nothing else. Admin Staff: stored in staff_users table. They access the /admin panel and can see all data across the platform. Only add staff accounts for people who genuinely need admin access.",
      },
      {
        title: "Manage Staff Accounts",
        detail: "Go to Settings in the sidebar, then scroll to the Staff Management section. To add a new staff member: enter their email (must already have a LetsGo user account), set their display name, and assign their role. To remove access: click the remove button next to their name. Important: you cannot remove yourself. When someone leaves the team, remove their staff access immediately — this doesn't delete their user account, it just revokes admin panel access. All staff changes are logged in the audit trail.",
      },
      {
        title: "Protect Sensitive Data",
        detail: "Never share your admin login credentials. Never screenshot or copy user personal information (emails, phone numbers, addresses) outside the admin panel. When helping a user via support, reference them by first name and receipt ID — don't include their full email in notes visible to other businesses. The admin panel uses the Supabase service role key server-side, which bypasses Row Level Security — this means you can see everything. Treat this access with the responsibility it requires. Never expose the service role key or any API keys.",
      },
      {
        title: "Monitor the Audit Log",
        detail: "Navigate to \"Audit Log\" in the sidebar. Every significant admin action is logged: receipt approvals/rejections, business activations, user bans, settings changes, payout processing, and more. Each entry shows the action type, who performed it (actor), what was affected (target), a timestamp, and details. Use this to: verify that actions were taken correctly, investigate if something unexpected happened, track who made a specific change, and ensure compliance. Check the audit log if you suspect unauthorized activity.",
      },
      {
        title: "Respond to Security Incidents",
        detail: "If you discover a security issue: 1) Don't panic — document what you're seeing. 2) If it's active fraud, immediately ban the user account and reject any pending fraudulent receipts. 3) If it's a system vulnerability (e.g., a user can see data they shouldn't), stop using the affected feature and notify management immediately. 4) If a staff member's credentials are compromised, remove their staff access from Settings and have them reset their password. 5) Log everything in the audit system and create a fraud alert with full details. 6) Never discuss security incidents on public channels, social media, or with affected users beyond what's necessary.",
      },
    ],
  },
];

// ==================== TRAINING PAGE ====================
export default function TrainingPage() {
  // State
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [progress, setProgress] = useState<TrainingProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Team progress state
  const [teamMembers, setTeamMembers] = useState<StaffMember[]>([]);
  const [teamProgress, setTeamProgress] = useState<StaffTrainingRecord[]>([]);

  // Fetch progress from Supabase
  const fetchProgress = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data, error } = await supabaseBrowser
          .from("training_progress")
          .select("module_id, completed, completed_at, score")
          .eq("user_id", user.id);

        if (!error && data) {
          setProgress(data.map(d => ({
            moduleId: d.module_id,
            completed: d.completed,
            completedAt: d.completed_at || undefined,
            score: d.score || undefined,
          })));
        } else {
          setProgress([]);
        }
      }

      // Fetch all staff members + their progress for team view
      const { data: staffData } = await supabaseBrowser
        .from("staff_users")
        .select("user_id, name, role")
        .order("name", { ascending: true });

      if (staffData && staffData.length > 0) {
        // Get display names from profiles where staff name is missing
        const staffIds = staffData.map(s => s.user_id);
        const { data: profiles } = await supabaseBrowser
          .from("profiles")
          .select("id, full_name, first_name, last_name")
          .in("id", staffIds);
        const nameMap = new Map(
          (profiles || []).map(p => [
            p.id,
            p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "",
          ])
        );

        setTeamMembers(staffData.map(s => ({
          user_id: s.user_id,
          name: s.name || nameMap.get(s.user_id) || "Unknown",
          role: s.role || "staff",
        })));

        // Fetch all training progress for all staff
        const { data: allProgress } = await supabaseBrowser
          .from("training_progress")
          .select("user_id, module_id, completed, completed_at, score")
          .in("user_id", staffIds);

        setTeamProgress(allProgress || []);
      }
    } catch {
      setProgress([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // Categories
  const categories = ["all", ...new Set(trainingModules.map(m => m.category))];

  // Filter modules
  const filteredModules = activeCategory === "all"
    ? trainingModules
    : trainingModules.filter(m => m.category === activeCategory);

  // Stats
  const totalModules = trainingModules.length;
  const completedModules = progress.filter(p => p.completed).length;
  const requiredModules = trainingModules.filter(m => m.required).length;
  const requiredCompleted = trainingModules.filter(m => m.required && progress.find(p => p.moduleId === m.id && p.completed)).length;

  // Mark module complete — persists to Supabase
  const markComplete = async (moduleId: string) => {
    const now = new Date().toISOString();
    // Optimistic UI update
    setProgress(prev => {
      const existing = prev.find(p => p.moduleId === moduleId);
      if (existing) {
        return prev.map(p => p.moduleId === moduleId ? { ...p, completed: true, completedAt: now } : p);
      }
      return [...prev, { moduleId, completed: true, completedAt: now }];
    });

    // Persist to Supabase
    if (currentUserId) {
      setSaving(true);
      try {
        await supabaseBrowser
          .from("training_progress")
          .upsert({
            user_id: currentUserId,
            module_id: moduleId,
            completed: true,
            completed_at: now,
            updated_at: now,
          }, { onConflict: "user_id,module_id" });
        const mod = trainingModules.find(m => m.id === moduleId);
        logAudit({
          action: "complete_training_module",
          tab: AUDIT_TABS.TRAINING,
          targetType: "training_module",
          targetId: moduleId,
          entityName: mod?.title || moduleId,
          details: `Marked module "${mod?.title || moduleId}" as completed`,
        });
      } catch {
        // Table may not exist yet — progress stays in local state
      } finally {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>
        Loading training modules...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>📚 Staff Training</h1>
        {saving && (
          <span style={{ fontSize: 12, color: COLORS.neonBlue, fontWeight: 600 }}>Saving...</span>
        )}
      </div>

      {/* Progress Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <Card>
          <div style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.neonBlue }}>{completedModules}/{totalModules}</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Modules Completed</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: requiredCompleted === requiredModules ? COLORS.neonGreen : COLORS.neonOrange }}>
              {requiredCompleted}/{requiredModules}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Required Completed</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.neonPink }}>
              {Math.round((completedModules / totalModules) * 100)}%
            </div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Overall Progress</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.neonPurple }}>
              {progress.filter(p => p.score).length > 0 
                ? Math.round(progress.filter(p => p.score).reduce((a, p) => a + (p.score || 0), 0) / progress.filter(p => p.score).length)
                : 0}%
            </div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Avg Score</div>
          </div>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Training Progress</span>
          <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
            {completedModules} of {totalModules} modules completed
          </span>
        </div>
        <div style={{ height: 12, background: COLORS.darkBg, borderRadius: 100, overflow: "hidden" }}>
          <div 
            style={{ 
              height: "100%", 
              width: `${(completedModules / totalModules) * 100}%`, 
              background: COLORS.gradient2,
              borderRadius: 100,
              transition: "width 0.5s",
            }} 
          />
        </div>
        {requiredCompleted < requiredModules && (
          <div style={{ marginTop: 12, padding: 12, background: "rgba(255,107,53,0.1)", borderRadius: 8, color: COLORS.neonOrange, fontSize: 13 }}>
            ⚠️ You have {requiredModules - requiredCompleted} required module(s) remaining
          </div>
        )}
      </Card>

      {/* Team Progress */}
      {teamMembers.length > 0 && (
        <>
          <SectionTitle icon="👥">Team Training Progress</SectionTitle>
          <Card style={{ marginBottom: 32 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid " + COLORS.cardBorder, fontSize: 12, color: COLORS.textSecondary, position: "sticky", left: 0, background: COLORS.cardBg, minWidth: 160 }}>
                      Staff Member
                    </th>
                    <th style={{ padding: 12, textAlign: "center", borderBottom: "1px solid " + COLORS.cardBorder, fontSize: 11, color: COLORS.textSecondary, minWidth: 70 }}>
                      Role
                    </th>
                    {trainingModules.map(m => (
                      <th key={m.id} style={{ padding: 8, textAlign: "center", borderBottom: "1px solid " + COLORS.cardBorder, fontSize: 10, color: COLORS.textSecondary, minWidth: 90, whiteSpace: "nowrap" }}>
                        <div>{m.title.length > 15 ? m.title.slice(0, 15) + "..." : m.title}</div>
                        {m.required && <span style={{ color: COLORS.neonPink, fontSize: 8 }}>REQ</span>}
                      </th>
                    ))}
                    <th style={{ padding: 12, textAlign: "center", borderBottom: "1px solid " + COLORS.cardBorder, fontSize: 11, color: COLORS.textSecondary, minWidth: 80 }}>
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map(member => {
                    const memberRecords = teamProgress.filter(tp => tp.user_id === member.user_id);
                    const memberCompleted = memberRecords.filter(r => r.completed).length;
                    const memberReqCompleted = trainingModules.filter(m => m.required && memberRecords.find(r => r.module_id === m.id && r.completed)).length;
                    const pct = Math.round((memberCompleted / totalModules) * 100);
                    const isCurrentUser = member.user_id === currentUserId;

                    return (
                      <tr key={member.user_id} style={{ background: isCurrentUser ? "rgba(0,212,255,0.05)" : "transparent" }}>
                        <td style={{ padding: 12, borderBottom: "1px solid " + COLORS.cardBorder, fontSize: 13, fontWeight: isCurrentUser ? 700 : 500, position: "sticky", left: 0, background: isCurrentUser ? "rgba(0,212,255,0.05)" : COLORS.cardBg }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{member.name}</span>
                            {isCurrentUser && <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(0,212,255,0.2)", color: COLORS.neonBlue, borderRadius: 4, fontWeight: 600 }}>YOU</span>}
                          </div>
                        </td>
                        <td style={{ padding: 12, textAlign: "center", borderBottom: "1px solid " + COLORS.cardBorder }}>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: "capitalize",
                            background: member.role.toLowerCase() === "admin" ? "rgba(0,212,255,0.15)" : "rgba(191,95,255,0.15)",
                            color: member.role.toLowerCase() === "admin" ? COLORS.neonBlue : COLORS.neonPurple,
                          }}>
                            {member.role}
                          </span>
                        </td>
                        {trainingModules.map(m => {
                          const record = memberRecords.find(r => r.module_id === m.id);
                          const done = record?.completed;
                          return (
                            <td key={m.id} style={{ padding: 8, textAlign: "center", borderBottom: "1px solid " + COLORS.cardBorder }}>
                              {done ? (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: COLORS.neonGreen, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 700, fontSize: 12 }}>✓</span>
                                  {record?.score && <span style={{ fontSize: 9, color: COLORS.neonGreen }}>{record.score}%</span>}
                                </div>
                              ) : (
                                <span style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid " + COLORS.cardBorder, display: "inline-block" }} />
                              )}
                            </td>
                          );
                        })}
                        <td style={{ padding: 12, textAlign: "center", borderBottom: "1px solid " + COLORS.cardBorder }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <span style={{
                              fontWeight: 700,
                              fontSize: 14,
                              color: pct === 100 ? COLORS.neonGreen : pct >= 50 ? COLORS.neonBlue : COLORS.neonOrange,
                            }}>
                              {pct}%
                            </span>
                            <div style={{ width: 50, height: 4, background: COLORS.darkBg, borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: pct + "%", background: pct === 100 ? COLORS.neonGreen : pct >= 50 ? COLORS.neonBlue : COLORS.neonOrange, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 9, color: COLORS.textSecondary }}>
                              {memberReqCompleted}/{requiredModules} req
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Team summary row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0 0", borderTop: "1px solid " + COLORS.cardBorder, marginTop: 16 }}>
              <div style={{ display: "flex", gap: 24 }}>
                <div>
                  <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Team Members: </span>
                  <span style={{ fontWeight: 700, color: COLORS.neonBlue }}>{teamMembers.length}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Avg Completion: </span>
                  <span style={{ fontWeight: 700, color: COLORS.neonGreen }}>
                    {teamMembers.length > 0
                      ? Math.round(teamMembers.reduce((sum, m) => {
                          const done = teamProgress.filter(tp => tp.user_id === m.user_id && tp.completed).length;
                          return sum + (done / totalModules) * 100;
                        }, 0) / teamMembers.length)
                      : 0}%
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: COLORS.textSecondary }}>All Required Done: </span>
                  <span style={{ fontWeight: 700, color: COLORS.neonPink }}>
                    {teamMembers.filter(m => {
                      const recs = teamProgress.filter(tp => tp.user_id === m.user_id && tp.completed);
                      return trainingModules.filter(mod => mod.required).every(mod => recs.find(r => r.module_id === mod.id));
                    }).length}/{teamMembers.length}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { label: "Complete", bg: COLORS.neonGreen },
                  { label: "Incomplete", bg: COLORS.cardBorder },
                ].map((l, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: l.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: i === 0 ? "#000" : "transparent", fontWeight: 700 }}>
                      {i === 0 ? "✓" : ""}
                    </div>
                    <span style={{ color: COLORS.textSecondary }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Business Forms */}
      <SectionTitle icon="📋">Business Forms</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 32 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${COLORS.neonOrange}, ${COLORS.neonPink})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              flexShrink: 0,
            }}>
              📄
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 4 }}>
                Partner Signup Form
              </div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.4 }}>
                Printable offline signup form for in-person business partner registration. Covers business info, package selection, payout tiers, billing, and legal agreements.
              </div>
            </div>
            <a
              href="/partner-signup-form.html"
              download="LetsGo-Partner-Signup-Form.html"
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                background: COLORS.gradient1,
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Download
            </a>
          </div>
        </Card>
      </div>

      {/* Category Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: activeCategory === cat ? COLORS.gradient1 : COLORS.cardBg,
              color: activeCategory === cat ? "#fff" : COLORS.textSecondary,
              fontWeight: activeCategory === cat ? 700 : 500,
              fontSize: 13,
              textTransform: "capitalize",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Training Modules */}
      <SectionTitle icon="📖">Training Modules</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {filteredModules.map(module => {
          const moduleProgress = progress.find(p => p.moduleId === module.id);
          const isComplete = moduleProgress?.completed;

          return (
            <div key={module.id} onClick={() => setSelectedModule(module)} style={{ cursor: "pointer" }}>
            <Card style={{ transition: "transform 0.2s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{module.title}</span>
                    {module.required && (
                      <span style={{ padding: "2px 8px", background: "rgba(255,45,146,0.2)", color: COLORS.neonPink, borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                        REQUIRED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{module.description}</div>
                </div>
                {isComplete ? (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.neonGreen, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 700 }}>
                    ✓
                  </div>
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.darkBg, border: "2px solid " + COLORS.cardBorder }} />
                )}
              </div>
              
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ padding: "4px 10px", background: COLORS.darkBg, borderRadius: 6, fontSize: 11 }}>
                  📁 {module.category}
                </span>
                <span style={{ padding: "4px 10px", background: COLORS.darkBg, borderRadius: 6, fontSize: 11 }}>
                  ⏱️ {module.duration}
                </span>
                <Badge status={module.difficulty} />
                {moduleProgress?.score && (
                  <span style={{ padding: "4px 10px", background: "rgba(57,255,20,0.2)", borderRadius: 6, fontSize: 11, color: COLORS.neonGreen, fontWeight: 600 }}>
                    Score: {moduleProgress.score}%
                  </span>
                )}
              </div>
            </Card>
            </div>
          );
        })}
      </div>

      {/* Module Detail Modal */}
      {selectedModule && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
          onClick={() => setSelectedModule(null)}
        >
          <div
            style={{
              background: COLORS.cardBg,
              borderRadius: 20,
              padding: 32,
              width: 850,
              maxWidth: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid " + COLORS.cardBorder,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 700 }}>{selectedModule.title}</h2>
                  {selectedModule.required && (
                    <span style={{ padding: "4px 12px", background: "rgba(255,45,146,0.2)", color: COLORS.neonPink, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                      REQUIRED
                    </span>
                  )}
                </div>
                <p style={{ color: COLORS.textSecondary }}>{selectedModule.description}</p>
              </div>
              <button onClick={() => setSelectedModule(null)} style={{ background: "none", border: "none", color: COLORS.textSecondary, fontSize: 24, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              <span style={{ padding: "6px 14px", background: COLORS.darkBg, borderRadius: 8, fontSize: 12 }}>📁 {selectedModule.category}</span>
              <span style={{ padding: "6px 14px", background: COLORS.darkBg, borderRadius: 8, fontSize: 12 }}>⏱️ {selectedModule.duration}</span>
              <Badge status={selectedModule.difficulty} />
            </div>

            <SectionTitle icon="📋">Step-by-Step Walkthrough</SectionTitle>
            <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
              {selectedModule.content.map((step, i) => (
                <div
                  key={i}
                  style={{
                    padding: 20,
                    background: COLORS.darkBg,
                    borderRadius: 12,
                    borderLeft: "4px solid " + (i === 0 ? COLORS.neonPink : i === selectedModule.content.length - 1 ? COLORS.neonGreen : COLORS.neonBlue),
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: COLORS.gradient1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 12,
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{step.title}</span>
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.7, paddingLeft: 40 }}>
                    {step.detail}
                  </div>
                </div>
              ))}
            </div>

            {(() => {
              const moduleProgress = progress.find(p => p.moduleId === selectedModule.id);
              const isComplete = moduleProgress?.completed;

              return (
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setSelectedModule(null)}
                    style={{
                      padding: "12px 24px",
                      background: COLORS.darkBg,
                      border: "1px solid " + COLORS.cardBorder,
                      borderRadius: 10,
                      color: COLORS.textPrimary,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Close
                  </button>
                  {!isComplete && (
                    <button
                      onClick={async () => {
                        await markComplete(selectedModule.id);
                        setSelectedModule(null);
                      }}
                      style={{
                        padding: "12px 24px",
                        background: COLORS.gradient2,
                        border: "none",
                        borderRadius: 10,
                        color: "#000",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      ✓ Mark as Complete
                    </button>
                  )}
                  {isComplete && (
                    <div style={{ padding: "12px 24px", background: "rgba(57,255,20,0.2)", borderRadius: 10, color: COLORS.neonGreen, fontWeight: 700 }}>
                      ✓ Completed {moduleProgress?.score ? `(Score: ${moduleProgress.score}%)` : ""}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}