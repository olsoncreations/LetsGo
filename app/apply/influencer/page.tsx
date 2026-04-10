"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";

const NEON = {
  primary: "#00E5FF", primaryRGB: "0,229,255",
  pink: "#FF2D78", pinkRGB: "255,45,120",
  yellow: "#FFD600", yellowRGB: "255,214,0",
  green: "#00FF87", greenRGB: "0,255,135",
  purple: "#D050FF", purpleRGB: "208,80,255",
  orange: "#FF6B2D", orangeRGB: "255,107,45",
};

interface InfluencerTier {
  tier_index: number;
  min_signups: number;
  max_signups: number | null;
  rate_cents: number;
  label: string | null;
}

interface ExistingApp {
  id: string;
  status: string;
  review_message: string | null;
  created_at: string;
}

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  instagramHandle: string;
  tiktokHandle: string;
  youtubeHandle: string;
  twitterHandle: string;
  facebookHandle: string;
  followerCount: string;
  engagementRate: string;
  contentNiche: string;
  sampleContentUrl: string;
  experience: string;
  personality: string;
  territory: string;
  travelDistance: string;
  linkedin: string;
  referredBy: string;
  coverNote: string;
  felonyDisclosure: string;
  hasReliableTransportation: boolean;
  agreedToTerms: boolean;
  agreed1099: boolean;
  agreedInterview: boolean;
  agreedAge18: boolean;
  agreedWorkAuthorization: boolean;
  agreedBackgroundCheck: boolean;
}

const INITIAL_FORM: FormData = {
  fullName: "", email: "", phone: "", city: "", state: "",
  instagramHandle: "", tiktokHandle: "", youtubeHandle: "", twitterHandle: "", facebookHandle: "",
  followerCount: "", engagementRate: "", contentNiche: "", sampleContentUrl: "",
  experience: "", personality: "",
  territory: "", travelDistance: "", linkedin: "",
  referredBy: "", coverNote: "", felonyDisclosure: "",
  hasReliableTransportation: false,
  agreedToTerms: false, agreed1099: false, agreedInterview: false,
  agreedAge18: false, agreedWorkAuthorization: false, agreedBackgroundCheck: false,
};

const FOLLOWER_OPTIONS = ["Under 1K", "1K - 5K", "5K - 25K", "25K - 100K", "100K+"];
const ENGAGEMENT_OPTIONS = ["Under 1%", "1% - 3%", "3% - 5%", "5% - 10%", "10%+", "Not sure"];
const NICHE_OPTIONS = ["Food & Dining", "Nightlife & Bars", "Lifestyle", "Travel", "Fitness & Wellness", "Fashion & Beauty", "Entertainment", "Other"];

const STORAGE_KEY = "letsgo-apply-influencer";

export default function InfluencerApplicationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingApp, setExistingApp] = useState<ExistingApp | null>(null);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [error, setError] = useState("");
  const [dlFile, setDlFile] = useState<File | null>(null);
  const [dlPreview, setDlPreview] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [influencerTiers, setInfluencerTiers] = useState<InfluencerTier[]>([]);

  // Check auth + load profile + check existing application
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session) { router.push("/welcome"); return; }

      // Pre-fill from profile
      const { data: profile } = await supabaseBrowser
        .from("profiles")
        .select("full_name, first_name, last_name, email, phone, zip_code")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile) {
        const name = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "";
        setForm(prev => ({
          ...prev,
          fullName: name,
          email: profile.email || session.user.email || "",
          phone: profile.phone || "",
        }));
      }

      // Check existing application
      const res = await fetch("/api/applications?type=influencer", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const { applications } = await res.json();
        if (applications?.length > 0) {
          const latest = applications[0];
          if (latest.status === "submitted") {
            setExistingApp(latest);
          }
        }
      }

      // Load influencer rate tiers
      try {
        const tiersRes = await fetch("/api/influencer-tiers");
        if (tiersRes.ok) {
          const { tiers } = await tiersRes.json();
          if (Array.isArray(tiers) && tiers.length > 0) {
            setInfluencerTiers(tiers.sort((a: InfluencerTier, b: InfluencerTier) => a.tier_index - b.tier_index));
          }
        }
      } catch { /* ignore — will hide section if no tiers */ }

      // Load from localStorage
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setForm(prev => ({ ...prev, ...parsed, email: prev.email || parsed.email, fullName: prev.fullName || parsed.fullName }));
        }
      } catch { /* ignore */ }

      setLoading(false);
    })();
  }, [router]);

  // Save to localStorage on change
  useEffect(() => {
    if (!loading) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(form)); } catch { /* ignore */ }
    }
  }, [form, loading]);

  const formatPhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const update = (field: keyof FormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleDLUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("File must be under 10MB"); return; }
    setDlFile(file);
    setDlPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("File must be under 10MB"); return; }
    setResumeFile(file);
    setError("");
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim()) { setError("Full name is required"); return; }
    if (!form.email.trim()) { setError("Email is required"); return; }
    if (!form.phone.trim()) { setError("Phone number is required"); return; }
    if (form.phone.replace(/\D/g, "").length !== 10) { setError("Please enter a valid 10-digit phone number"); return; }
    if (!form.city.trim()) { setError("City is required"); return; }
    if (!form.state.trim()) { setError("State is required"); return; }
    const hasSocial = form.instagramHandle || form.tiktokHandle || form.youtubeHandle || form.twitterHandle || form.facebookHandle;
    if (!hasSocial) { setError("Please provide at least one social media handle"); return; }
    if (!form.followerCount) { setError("Please select your approximate follower count"); return; }
    if (!form.contentNiche) { setError("Please select your content niche"); return; }
    if (!form.experience.trim()) { setError("Please describe your content creation experience"); return; }
    if (!form.personality.trim()) { setError("Please describe your personality"); return; }
    if (!form.territory.trim()) { setError("Please tell us what cities or regions your audience is in"); return; }
    if (!form.travelDistance) { setError("Please select how far you're willing to travel"); return; }
    if (!form.referredBy.trim()) { setError("Please tell us how you heard about us"); return; }
    if (!form.coverNote.trim()) { setError("Please tell us why you want to be a LetsGo influencer"); return; }
    if (!dlFile) { setError("Driver's license is required"); return; }
    if (!resumeFile) { setError("Resume is required"); return; }
    if (!form.felonyDisclosure) { setError("Please answer the felony conviction question"); return; }
    if (!form.hasReliableTransportation) { setError("You must confirm you have a working cell phone and internet access"); return; }
    if (!form.agreedAge18) { setError("You must confirm you are at least 18 years old"); return; }
    if (!form.agreedWorkAuthorization) { setError("You must confirm you are authorized to work in the United States"); return; }
    if (!form.agreed1099) { setError("You must acknowledge the independent contractor agreement"); return; }
    if (!form.agreedBackgroundCheck) { setError("You must consent to a background check"); return; }
    if (!form.agreedInterview) { setError("You must agree to participate in an interview"); return; }
    if (!form.agreedToTerms) { setError("You must agree to the terms"); return; }

    setSubmitting(true);
    setError("");

    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session) { setError("Please sign in first"); setSubmitting(false); return; }

    // Upload DL to storage
    let dlPath: string | null = null;
    if (dlFile) {
      const ext = dlFile.name.split(".").pop() || "jpg";
      const path = `influencer-applications/${session.user.id}/drivers-license-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabaseBrowser.storage
        .from("documents")
        .upload(path, dlFile, { upsert: true });
      if (uploadErr) {
        setError("Failed to upload driver's license. Please try again.");
        setSubmitting(false);
        return;
      }
      dlPath = path;
    }

    // Upload resume to storage
    let resumePath: string | null = null;
    if (resumeFile) {
      const ext = resumeFile.name.split(".").pop() || "pdf";
      const path = `influencer-applications/${session.user.id}/resume-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabaseBrowser.storage
        .from("documents")
        .upload(path, resumeFile, { upsert: true });
      if (uploadErr) {
        setError("Failed to upload resume. Please try again.");
        setSubmitting(false);
        return;
      }
      resumePath = path;
    }

    const res = await fetch("/api/applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        application_type: "influencer",
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        payload: {
          instagramHandle: form.instagramHandle.trim() || null,
          tiktokHandle: form.tiktokHandle.trim() || null,
          youtubeHandle: form.youtubeHandle.trim() || null,
          twitterHandle: form.twitterHandle.trim() || null,
          facebookHandle: form.facebookHandle.trim() || null,
          followerCount: form.followerCount,
          engagementRate: form.engagementRate || null,
          contentNiche: form.contentNiche,
          sampleContentUrl: form.sampleContentUrl.trim() || null,
          experience: form.experience.trim(),
          personality: form.personality.trim(),
          territory: form.territory.trim(),
          travelDistance: form.travelDistance,
          linkedin: form.linkedin.trim() || null,
          referredBy: form.referredBy.trim(),
          coverNote: form.coverNote.trim(),
          felonyDisclosure: form.felonyDisclosure.trim(),
          hasReliableTransportation: form.hasReliableTransportation,
          driversLicensePath: dlPath,
          resumePath: resumePath,
          agreed1099: true,
          agreedInterview: true,
          agreedAge18: true,
          agreedWorkAuthorization: true,
          agreedBackgroundCheck: true,
        },
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Submission failed" }));
      setError(data.error || "Submission failed");
      setSubmitting(false);
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #000 0%, #0a0a1a 50%, #0f0f1f 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${NEON.pink}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #000 0%, #0a0a1a 50%, #0f0f1f 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center", padding: "48px 32px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid rgba(${NEON.greenRGB},0.2)` }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: NEON.green, marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>Application Submitted!</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 24 }}>
            Thank you for your interest in LetsGo! While we&apos;re reviewing your application, please sign up as a user and check out our app!
          </p>
          <button
            onClick={() => router.push("/")}
            style={{ padding: "10px 28px", borderRadius: 6, border: `1px solid rgba(${NEON.primaryRGB},0.4)`, background: `rgba(${NEON.primaryRGB},0.08)`, color: NEON.primary, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Already applied state
  if (existingApp) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #000 0%, #0a0a1a 50%, #0f0f1f 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center", padding: "48px 32px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid rgba(${NEON.yellowRGB},0.2)` }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128203;</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: NEON.yellow, marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>Application Pending</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 8 }}>
            You submitted an influencer application on {new Date(existingApp.created_at).toLocaleDateString()}.
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginBottom: 24 }}>
            We&apos;re reviewing it now. You&apos;ll be notified once a decision is made.
          </p>
          <button
            onClick={() => router.push("/")}
            style={{ padding: "10px 28px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
    color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
    outline: "none",
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 600 as const, color: "rgba(255,255,255,0.45)",
    letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 6, display: "block",
    fontFamily: "'DM Sans', sans-serif",
  };
  const selectStyle = {
    ...inputStyle, appearance: "none" as const, cursor: "pointer",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
  };
  const sectionStyle = {
    padding: "20px 24px", borderRadius: 10, background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)", marginBottom: 0,
  };
  const sectionTitle = {
    fontSize: 15, fontWeight: 700 as const, color: "rgba(255,255,255,0.8)",
    marginBottom: 14, fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #000 0%, #0a0a1a 50%, #0f0f1f 100%)", padding: "20px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: 32, paddingBottom: 60 }}>
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          <Image src="/lg-logo.png" alt="LetsGo" width={140} height={42} style={{ marginBottom: 20, cursor: "pointer" }} onClick={() => router.push("/")} />
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 8, fontFamily: "'DM Sans', sans-serif", textAlign: "center" }}>
            Become an Influencer
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, textAlign: "center", maxWidth: 440 }}>
            Share what you love. Get paid for every signup through your unique referral code.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* === 1099 Independent Contractor Disclosure === */}
          <div style={{ ...sectionStyle, border: `1px solid rgba(${NEON.orangeRGB},0.2)`, background: `rgba(${NEON.orangeRGB},0.04)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>&#128221;</span>
              <span style={{ ...sectionTitle, marginBottom: 0, color: NEON.orange }}>Independent Contractor Disclosure</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 10 }}>
              LetsGo Influencers are <strong style={{ color: NEON.orange }}>independent contractors (1099)</strong>, not employees. This means:
            </p>
            <ul style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, paddingLeft: 20, marginBottom: 10 }}>
              <li>This is a <strong style={{ color: NEON.orange }}>100% commission-based</strong> role — there is no base salary, hourly wage, or guaranteed pay</li>
              <li>You are <strong style={{ color: "rgba(255,255,255,0.7)" }}>not</strong> a W-2 employee of Olson Creations LLC (DBA &quot;LETS GO OUT&quot;)</li>
              <li>You are responsible for your own taxes, including self-employment tax</li>
              <li>You will receive a <strong style={{ color: "rgba(255,255,255,0.7)" }}>1099-NEC</strong> form for earnings over $600/year</li>
              <li>No benefits, health insurance, or PTO are provided</li>
              <li>You set your own schedule and methods of content creation</li>
              <li>There is <strong style={{ color: "rgba(255,255,255,0.7)" }}>no exclusivity requirement</strong> — you may work with other companies, but you may not promote competing platforms to the same audience you promote LetsGo to</li>
              <li>Either party may <strong style={{ color: "rgba(255,255,255,0.7)" }}>terminate the relationship at any time</strong> with written notice. Outstanding commissions for completed referrals will still be paid</li>
            </ul>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, fontStyle: "italic" }}>
              We recommend consulting a tax professional to understand your obligations.
            </p>
          </div>

          {/* === How You Earn === */}
          <div style={{ ...sectionStyle, border: `1px solid rgba(${NEON.greenRGB},0.2)`, background: `rgba(${NEON.greenRGB},0.04)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>&#128176;</span>
              <span style={{ ...sectionTitle, marginBottom: 0, color: NEON.green }}>How You Earn</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 10 }}>
              As a LetsGo Influencer, you earn money every time someone signs up using your unique referral code. Rates work like <strong style={{ color: "rgba(255,255,255,0.7)" }}>tax brackets</strong> — each signup earns the rate of the tier it falls into:
            </p>
            {influencerTiers.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {influencerTiers.map(tier => (
                  <div key={tier.tier_index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                        {tier.label || `Tier ${tier.tier_index}`}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                        Signups {tier.min_signups.toLocaleString()}{tier.max_signups ? ` — ${tier.max_signups.toLocaleString()}` : "+"}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: NEON.green, fontFamily: "'DM Sans', sans-serif" }}>
                      ${(tier.rate_cents / 100).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ul style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, paddingLeft: 20, marginBottom: 10 }}>
                <li>You receive a <strong style={{ color: NEON.green }}>unique referral code</strong> after approval</li>
                <li>Share your code through your content, stories, bios, and more</li>
                <li>Earn a <strong style={{ color: NEON.green }}>per-signup commission</strong> for every new user who joins through your code</li>
                <li>Higher-performing influencers unlock <strong style={{ color: NEON.green }}>higher payout tiers</strong></li>
              </ul>
            )}
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
              Per-signup rate. Rates are subject to change with notice.
            </p>
          </div>

          {/* === What Counts as a Signup === */}
          <div style={{ ...sectionStyle, border: `1px solid rgba(${NEON.primaryRGB},0.15)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>&#9989;</span>
              <span style={{ ...sectionTitle, marginBottom: 0, color: NEON.primary }}>What Counts as a Signup</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
              A referral is considered complete when a <strong style={{ color: "rgba(255,255,255,0.7)" }}>new user creates an account using your referral code</strong> and completes their profile.
              The user must be a genuine new account — duplicate, fake, or self-referral signups do not count and may result in termination.
            </p>
          </div>

          {/* === Payment Schedule === */}
          <div style={{ ...sectionStyle, border: `1px solid rgba(${NEON.purpleRGB},0.15)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>&#128197;</span>
              <span style={{ ...sectionTitle, marginBottom: 0, color: NEON.purple }}>Payment Schedule</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 10 }}>
              Commissions are paid on a <strong style={{ color: "rgba(255,255,255,0.7)" }}>bi-monthly schedule</strong>:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {[
                { period: "1st — 15th of the month", payout: "Paid by the 20th" },
                { period: "16th — End of the month", payout: "Paid by the 5th of the following month" },
              ].map(item => (
                <div key={item.period} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{item.period}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: NEON.purple }}>{item.payout}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
              Payment is made via direct deposit. You will provide banking details after approval.
            </p>
          </div>

          {/* === Application Form === */}
          <div style={{ ...sectionStyle }}>
            <h3 style={sectionTitle}>Your Information</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Full Legal Name */}
              <div>
                <label style={labelStyle}>Full Legal Name *</label>
                <input value={form.fullName} onChange={e => update("fullName", e.target.value)} style={inputStyle} placeholder="Your full legal name" />
              </div>

              {/* Email */}
              <div>
                <label style={labelStyle}>Email *</label>
                <input value={form.email} onChange={e => update("email", e.target.value)} type="email" style={inputStyle} placeholder="you@email.com" />
              </div>

              {/* Phone */}
              <div>
                <label style={labelStyle}>Phone *</label>
                <input value={form.phone} onChange={e => update("phone", formatPhone(e.target.value))} type="tel" style={inputStyle} placeholder="(555) 123-4567" maxLength={14} />
              </div>

              {/* City / State */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
                <div>
                  <label style={labelStyle}>City *</label>
                  <input value={form.city} onChange={e => update("city", e.target.value)} style={inputStyle} placeholder="Omaha" />
                </div>
                <div>
                  <label style={labelStyle}>State *</label>
                  <input value={form.state} onChange={e => update("state", e.target.value)} style={inputStyle} placeholder="NE" maxLength={2} />
                </div>
              </div>

              {/* Social Media Section */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>
                  Social Media (at least one required) *
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Instagram</label>
                    <input value={form.instagramHandle} onChange={e => update("instagramHandle", e.target.value)} style={inputStyle} placeholder="@yourhandle" />
                  </div>
                  <div>
                    <label style={labelStyle}>TikTok</label>
                    <input value={form.tiktokHandle} onChange={e => update("tiktokHandle", e.target.value)} style={inputStyle} placeholder="@yourhandle" />
                  </div>
                  <div>
                    <label style={labelStyle}>YouTube</label>
                    <input value={form.youtubeHandle} onChange={e => update("youtubeHandle", e.target.value)} style={inputStyle} placeholder="Channel name" />
                  </div>
                  <div>
                    <label style={labelStyle}>Twitter / X</label>
                    <input value={form.twitterHandle} onChange={e => update("twitterHandle", e.target.value)} style={inputStyle} placeholder="@yourhandle" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Facebook</label>
                    <input value={form.facebookHandle} onChange={e => update("facebookHandle", e.target.value)} style={inputStyle} placeholder="Facebook page or profile URL" />
                  </div>
                </div>
              </div>

              {/* Follower Count */}
              <div>
                <label style={labelStyle}>Approximate Total Follower Count *</label>
                <select value={form.followerCount} onChange={e => update("followerCount", e.target.value)} style={selectStyle}>
                  <option value="" disabled>Select a range</option>
                  {FOLLOWER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Engagement Rate */}
              <div>
                <label style={labelStyle}>Average Engagement Rate</label>
                <select value={form.engagementRate} onChange={e => update("engagementRate", e.target.value)} style={selectStyle}>
                  <option value="" disabled>Select a range</option>
                  {ENGAGEMENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Content Niche */}
              <div>
                <label style={labelStyle}>Content Niche *</label>
                <select value={form.contentNiche} onChange={e => update("contentNiche", e.target.value)} style={selectStyle}>
                  <option value="" disabled>Select your niche</option>
                  {NICHE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Sample Content URL */}
              <div>
                <label style={labelStyle}>Sample Content URL <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(optional)</span></label>
                <input value={form.sampleContentUrl} onChange={e => update("sampleContentUrl", e.target.value)} style={inputStyle} placeholder="https://instagram.com/p/... or TikTok link" />
              </div>

              {/* Content Creation Experience */}
              <div>
                <label style={labelStyle}>Content Creation Experience *</label>
                <textarea
                  value={form.experience}
                  onChange={e => update("experience", e.target.value)}
                  style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                  placeholder="Tell us about your content creation background — how long you've been creating, brands you've worked with, types of content you produce..."
                />
              </div>

              {/* Personality */}
              <div>
                <label style={labelStyle}>How would you describe your personality? *</label>
                <textarea
                  value={form.personality}
                  onChange={e => update("personality", e.target.value)}
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                  placeholder="What makes you great at connecting with your audience?"
                />
              </div>

              {/* Territory */}
              <div>
                <label style={labelStyle}>What cities or regions is your audience in? *</label>
                <input value={form.territory} onChange={e => update("territory", e.target.value)} style={inputStyle} placeholder="Omaha, Lincoln, Kansas City, nationwide..." />
              </div>

              {/* Travel Distance */}
              <div>
                <label style={labelStyle}>How far are you willing to travel for events/content? *</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {["Up to 25 miles", "Up to 50 miles", "Up to 100 miles", "100+ miles"].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => update("travelDistance", opt)}
                      style={{
                        padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                        border: form.travelDistance === opt ? `1px solid rgba(${NEON.pinkRGB},0.5)` : "1px solid rgba(255,255,255,0.08)",
                        background: form.travelDistance === opt ? `rgba(${NEON.pinkRGB},0.1)` : "rgba(255,255,255,0.04)",
                        color: form.travelDistance === opt ? NEON.pink : "rgba(255,255,255,0.45)",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* LinkedIn */}
              <div>
                <label style={labelStyle}>LinkedIn Profile <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(optional)</span></label>
                <input value={form.linkedin} onChange={e => update("linkedin", e.target.value)} style={inputStyle} placeholder="https://linkedin.com/in/yourname" />
              </div>

              {/* Driver's License Upload */}
              <div>
                <label style={labelStyle}>Driver&apos;s License *</label>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 8, lineHeight: 1.5 }}>
                  Upload a photo or scan of your valid driver&apos;s license for identity verification.
                </p>
                <label
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    padding: "14px 20px", borderRadius: 6, cursor: "pointer",
                    border: dlFile ? `1px solid rgba(${NEON.greenRGB},0.3)` : "1px dashed rgba(255,255,255,0.15)",
                    background: dlFile ? `rgba(${NEON.greenRGB},0.05)` : "rgba(255,255,255,0.02)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <input type="file" accept="image/*,.pdf" onChange={handleDLUpload} style={{ display: "none" }} />
                  {dlFile ? (
                    <>
                      <span style={{ color: NEON.green, fontSize: 16 }}>&#10003;</span>
                      <span style={{ fontSize: 13, color: NEON.green, fontWeight: 600 }}>{dlFile.name}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 16 }}>&#128247;</span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Click to upload driver&apos;s license</span>
                    </>
                  )}
                </label>
                {dlPreview && dlFile?.type.startsWith("image/") && (
                  <div style={{ marginTop: 8, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={dlPreview} alt="Driver's license preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover" }} />
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4 }} />

              {/* Resume Upload */}
              <div>
                <label style={labelStyle}>Resume / Media Kit *</label>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 8, lineHeight: 1.5 }}>
                  Upload your resume or media kit if you have one. PDF or Word format preferred.
                </p>
                <label
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    padding: "14px 20px", borderRadius: 6, cursor: "pointer",
                    border: resumeFile ? `1px solid rgba(${NEON.greenRGB},0.3)` : "1px dashed rgba(255,255,255,0.15)",
                    background: resumeFile ? `rgba(${NEON.greenRGB},0.05)` : "rgba(255,255,255,0.02)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} style={{ display: "none" }} />
                  {resumeFile ? (
                    <>
                      <span style={{ color: NEON.green, fontSize: 16 }}>&#10003;</span>
                      <span style={{ fontSize: 13, color: NEON.green, fontWeight: 600 }}>{resumeFile.name}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 16 }}>&#128196;</span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Click to upload resume or media kit</span>
                    </>
                  )}
                </label>
              </div>

              {/* Reliable Cell Phone + Internet + English */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.hasReliableTransportation}
                  onChange={e => update("hasReliableTransportation", e.target.checked)}
                  style={{ marginTop: 3, accentColor: NEON.pink }}
                />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                  I have a <strong style={{ color: "rgba(255,255,255,0.75)" }}>working cell phone</strong>, <strong style={{ color: "rgba(255,255,255,0.75)" }}>access to the internet</strong>, and am <strong style={{ color: "rgba(255,255,255,0.75)" }}>proficient in English</strong> (spoken and written). *
                </span>
              </label>

              {/* How did you hear about us */}
              <div>
                <label style={labelStyle}>How did you hear about us? *</label>
                <input value={form.referredBy} onChange={e => update("referredBy", e.target.value)} style={inputStyle} placeholder="Friend, social media, job board..." />
              </div>

              {/* Cover Note */}
              <div>
                <label style={labelStyle}>Why do you want to be a LetsGo influencer? *</label>
                <textarea
                  value={form.coverNote}
                  onChange={e => update("coverNote", e.target.value)}
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                  placeholder="Tell us about your audience, content style, and why LetsGo resonates with you..."
                />
              </div>

              {/* Felony Disclosure */}
              <div>
                <label style={labelStyle}>Have you ever been convicted of a felony? *</label>
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  {(["no", "yes"] as const).map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => update("felonyDisclosure", opt)}
                      style={{
                        flex: 1, padding: "10px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                        border: form.felonyDisclosure === opt ? `1px solid rgba(${NEON.pinkRGB},0.5)` : "1px solid rgba(255,255,255,0.08)",
                        background: form.felonyDisclosure === opt ? `rgba(${NEON.pinkRGB},0.1)` : "rgba(255,255,255,0.04)",
                        color: form.felonyDisclosure === opt ? NEON.pink : "rgba(255,255,255,0.45)",
                      }}
                    >
                      {opt === "no" ? "No" : "Yes"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* === Agreements === */}
          <div style={{ ...sectionStyle }}>
            <h3 style={sectionTitle}>Agreements</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Age 18+ */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.agreedAge18}
                  onChange={e => update("agreedAge18", e.target.checked)}
                  style={{ marginTop: 3, accentColor: NEON.pink }}
                />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  I confirm that I am <strong style={{ color: "rgba(255,255,255,0.7)" }}>at least 18 years of age</strong>. *
                </span>
              </label>

              {/* Work Authorization */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.agreedWorkAuthorization}
                  onChange={e => update("agreedWorkAuthorization", e.target.checked)}
                  style={{ marginTop: 3, accentColor: NEON.pink }}
                />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  I am <strong style={{ color: "rgba(255,255,255,0.7)" }}>legally authorized to work in the United States</strong>. *
                </span>
              </label>

              {/* Background Check Consent */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.agreedBackgroundCheck}
                  onChange={e => update("agreedBackgroundCheck", e.target.checked)}
                  style={{ marginTop: 3, accentColor: NEON.pink }}
                />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  I consent to a <strong style={{ color: "rgba(255,255,255,0.7)" }}>background check</strong> as part of the application process. *
                </span>
              </label>

              {/* 1099 Acknowledgment */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.agreed1099}
                  onChange={e => update("agreed1099", e.target.checked)}
                  style={{ marginTop: 3, accentColor: NEON.pink }}
                />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  I understand that I will be engaged as an <strong style={{ color: NEON.orange }}>independent contractor (1099)</strong> and not as an employee. I am responsible for my own taxes and will receive a 1099-NEC for earnings over $600/year. *
                </span>
              </label>

              {/* Interview Agreement */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.agreedInterview}
                  onChange={e => update("agreedInterview", e.target.checked)}
                  style={{ marginTop: 3, accentColor: NEON.pink }}
                />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  I understand that I must complete an <strong style={{ color: "rgba(255,255,255,0.7)" }}>interview via Zoom, Microsoft Teams, or in person</strong> before being approved as an influencer. *
                </span>
              </label>

              {/* Terms + FTC */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.agreedToTerms}
                  onChange={e => update("agreedToTerms", e.target.checked)}
                  style={{ marginTop: 3, accentColor: NEON.pink }}
                />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  I agree to the <span onClick={e => { e.preventDefault(); router.push("/terms"); }} style={{ color: NEON.pink, cursor: "pointer", textDecoration: "underline" }}>Terms of Service</span> and I understand that as an influencer I must comply with <strong style={{ color: "rgba(255,255,255,0.7)" }}>FTC disclosure requirements</strong> when promoting LetsGo. *
                </span>
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(255,45,120,0.08)", border: "1px solid rgba(255,45,120,0.2)", color: NEON.pink, fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: "100%", padding: "14px 24px", borderRadius: 8, border: "none",
              background: `linear-gradient(135deg, ${NEON.pink}, ${NEON.orange})`,
              color: "#fff", fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em",
              opacity: submitting ? 0.6 : 1, transition: "opacity 0.2s ease",
              boxShadow: `0 0 20px rgba(${NEON.pinkRGB},0.25)`,
            }}
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </div>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <span
            onClick={() => router.push("/")}
            style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", cursor: "pointer", transition: "color 0.2s ease" }}
            onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.5)"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}
          >
            &larr; Back to home
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: #1a1a2e; color: #fff; }
        select option:disabled { color: #666; }
      `}</style>
    </div>
  );
}
