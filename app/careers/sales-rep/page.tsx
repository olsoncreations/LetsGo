"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const NEON = {
  primary: "#00E5FF", primaryRGB: "0,229,255",
  pink: "#FF2D78", pinkRGB: "255,45,120",
  yellow: "#FFD600", yellowRGB: "255,214,0",
  green: "#00FF87", greenRGB: "0,255,135",
  purple: "#D050FF", purpleRGB: "208,80,255",
  orange: "#FF6B2D", orangeRGB: "255,107,45",
};

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  experience: string;
  industries: string;
  salesStrategy: string;
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
  experience: "", industries: "", salesStrategy: "", personality: "",
  territory: "", travelDistance: "", linkedin: "",
  referredBy: "", coverNote: "", felonyDisclosure: "",
  hasReliableTransportation: false,
  agreedToTerms: false, agreed1099: false, agreedInterview: false,
  agreedAge18: false, agreedWorkAuthorization: false, agreedBackgroundCheck: false,
};

export default function CareersApplicationPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [error, setError] = useState("");
  const [dlFile, setDlFile] = useState<File | null>(null);
  const [dlPreview, setDlPreview] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [commissionRates, setCommissionRates] = useState<{ basic_signup: number; premium_signup: number; advertising_per_100: number } | null>(null);

  // Load commission rates
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/sales-config");
        if (res.ok) {
          const { rates } = await res.json();
          setCommissionRates(rates);
        }
      } catch { /* ignore — will show fallback values */ }
    })();
  }, []);

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
    if (!form.experience.trim()) { setError("Please describe your sales experience"); return; }
    if (!form.industries.trim()) { setError("Please tell us what industries you've sold to"); return; }
    if (!form.salesStrategy.trim()) { setError("Please describe your sales strategy"); return; }
    if (!form.personality.trim()) { setError("Please describe your personality"); return; }
    if (!form.territory.trim()) { setError("Please tell us what cities or regions you want to cover"); return; }
    if (!form.travelDistance) { setError("Please select how far you're willing to travel"); return; }
    if (!form.referredBy.trim()) { setError("Please tell us how you heard about us"); return; }
    if (!form.coverNote.trim()) { setError("Please tell us why you want to sell for LetsGo"); return; }
    if (!dlFile) { setError("Driver's license is required"); return; }
    if (!resumeFile) { setError("Resume is required"); return; }
    if (!form.felonyDisclosure) { setError("Please answer the felony conviction question"); return; }
    if (!form.hasReliableTransportation) { setError("You must confirm you have reliable transportation"); return; }
    if (!form.agreedAge18) { setError("You must confirm you are at least 18 years old"); return; }
    if (!form.agreedWorkAuthorization) { setError("You must confirm you are authorized to work in the United States"); return; }
    if (!form.agreed1099) { setError("You must acknowledge the independent contractor agreement"); return; }
    if (!form.agreedBackgroundCheck) { setError("You must consent to a background check"); return; }
    if (!form.agreedInterview) { setError("You must agree to participate in an interview"); return; }
    if (!form.agreedToTerms) { setError("You must agree to the terms"); return; }

    setSubmitting(true);
    setError("");

    // Build multipart form data for the public API
    const body = new FormData();
    body.append("application_type", "sales_rep");
    body.append("full_name", form.fullName.trim());
    body.append("email", form.email.trim());
    body.append("phone", form.phone.trim());
    body.append("city", form.city.trim());
    body.append("state", form.state.trim());
    body.append("payload", JSON.stringify({
      experience: form.experience.trim(),
      industries: form.industries.trim(),
      salesStrategy: form.salesStrategy.trim(),
      personality: form.personality.trim(),
      territory: form.territory.trim(),
      travelDistance: form.travelDistance,
      linkedin: form.linkedin.trim() || null,
      referredBy: form.referredBy.trim(),
      coverNote: form.coverNote.trim(),
      felonyDisclosure: form.felonyDisclosure.trim(),
      hasReliableTransportation: form.hasReliableTransportation,
      agreed1099: true,
      agreedInterview: true,
      agreedAge18: true,
      agreedWorkAuthorization: true,
      agreedBackgroundCheck: true,
    }));
    body.append("drivers_license", dlFile);
    body.append("resume", resumeFile);

    const res = await fetch("/api/careers/apply", { method: "POST", body });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Submission failed" }));
      setError(data.error || "Submission failed");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  // ── Success screen ──
  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #000 0%, #0a0a1a 50%, #0f0f1f 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ maxWidth: 520, width: "100%", textAlign: "center", padding: "48px 32px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid rgba(${NEON.greenRGB},0.2)` }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: NEON.green, marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>
            Application Submitted!
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, marginBottom: 12 }}>
            Thank you for applying to be a LetsGo Sales Representative! We&apos;re excited to review your application.
          </p>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 32 }}>
            Our team will reach out to you via email to schedule an interview. In the meantime...
          </p>
          <Link
            href="/welcome?new=1"
            style={{
              display: "inline-block",
              padding: "14px 32px", borderRadius: 8, border: "none",
              background: `linear-gradient(135deg, ${NEON.primary}, ${NEON.purple})`,
              color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em",
              textDecoration: "none",
              boxShadow: `0 0 20px rgba(${NEON.primaryRGB},0.25)`,
            }}
          >
            Excited to see what you&apos;d be selling?!
          </Link>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 12, lineHeight: 1.5 }}>
            Sign up as an explorer and see for yourself!
          </p>
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
          <Link href="/welcome">
            <Image src="/lg-logo.png" alt="LetsGo" width={140} height={42} style={{ marginBottom: 20, cursor: "pointer" }} />
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 8, fontFamily: "'DM Sans', sans-serif", textAlign: "center" }}>
            Become a Sales Rep
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, textAlign: "center", maxWidth: 440 }}>
            Help local businesses grow with LetsGo. Earn commissions on every partnership you close.
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
              LetsGo Sales Representatives are <strong style={{ color: NEON.orange }}>independent contractors (1099)</strong>, not employees. This means:
            </p>
            <ul style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, paddingLeft: 20, marginBottom: 10 }}>
              <li>This is a <strong style={{ color: NEON.orange }}>100% commission-based</strong> role — there is no base salary, hourly wage, or guaranteed pay</li>
              <li>You are <strong style={{ color: "rgba(255,255,255,0.7)" }}>not</strong> a W-2 employee of OlsonCreations, LLC (DBA &quot;LETS GO OUT&quot;)</li>
              <li>You are responsible for your own taxes, including self-employment tax</li>
              <li>You will receive a <strong style={{ color: "rgba(255,255,255,0.7)" }}>1099-NEC</strong> form for earnings over $600/year</li>
              <li>No benefits, health insurance, or PTO are provided</li>
              <li>You set your own schedule and methods of work</li>
              <li>There is <strong style={{ color: "rgba(255,255,255,0.7)" }}>no exclusivity requirement</strong> — you may work with other companies, but you may not represent competing platforms to the same businesses you sign with LetsGo</li>
              <li>Either party may <strong style={{ color: "rgba(255,255,255,0.7)" }}>terminate the relationship at any time</strong> with written notice. Outstanding commissions for completed sales will still be paid</li>
            </ul>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, fontStyle: "italic" }}>
              We recommend consulting a tax professional to understand your obligations.
            </p>
          </div>

          {/* === Commission Rates === */}
          <div style={{ ...sectionStyle, border: `1px solid rgba(${NEON.greenRGB},0.2)`, background: `rgba(${NEON.greenRGB},0.04)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>&#128176;</span>
              <span style={{ ...sectionTitle, marginBottom: 0, color: NEON.green }}>Commission Structure</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 14 }}>
              You earn commission on every business you bring to LetsGo:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Basic Plan Signup", amount: commissionRates ? `$${(commissionRates.basic_signup / 100).toFixed(0)}` : "—", desc: "Per business signed on Basic" },
                { label: "Premium Plan Signup", amount: commissionRates ? `$${(commissionRates.premium_signup / 100).toFixed(0)}` : "—", desc: "Per business signed on Premium" },
                { label: "Advertising Revenue", amount: commissionRates ? `$${(commissionRates.advertising_per_100 / 100).toFixed(0)} per $100` : "—", desc: "Of ad spend from your signups (Premium members only)" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{item.desc}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: NEON.green, fontFamily: "'DM Sans', sans-serif" }}>{item.amount}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
              Commission rates are subject to change. You will be notified of any updates.
            </p>
          </div>

          {/* === Definition of a Sale === */}
          <div style={{ ...sectionStyle, border: `1px solid rgba(${NEON.primaryRGB},0.15)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>&#9989;</span>
              <span style={{ ...sectionTitle, marginBottom: 0, color: NEON.primary }}>What Counts as a Sale</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
              A sale is considered complete when the <strong style={{ color: "rgba(255,255,255,0.7)" }}>first payment is received by LetsGo</strong> from the business you signed up.
              Your commission is earned at that point — not when the business signs up, and not when they agree to a plan. The business must complete onboarding and make their first payment for the sale to count.
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

              {/* Sales Experience */}
              <div>
                <label style={labelStyle}>Sales Experience *</label>
                <textarea
                  value={form.experience}
                  onChange={e => update("experience", e.target.value)}
                  style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                  placeholder="Tell us about your sales background — years of experience, notable achievements..."
                />
              </div>

              {/* Industries */}
              <div>
                <label style={labelStyle}>What industries have you sold to? *</label>
                <input value={form.industries} onChange={e => update("industries", e.target.value)} style={inputStyle} placeholder="Restaurants, retail, healthcare, real estate..." />
              </div>

              {/* Sales Strategy */}
              <div>
                <label style={labelStyle}>How would you describe your sales strategy? *</label>
                <textarea
                  value={form.salesStrategy}
                  onChange={e => update("salesStrategy", e.target.value)}
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                  placeholder="Cold calling, networking, referrals, door-to-door, relationship building..."
                />
              </div>

              {/* Personality */}
              <div>
                <label style={labelStyle}>How would you describe your personality? *</label>
                <textarea
                  value={form.personality}
                  onChange={e => update("personality", e.target.value)}
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                  placeholder="What makes you great at connecting with people and closing deals?"
                />
              </div>

              {/* Territory */}
              <div>
                <label style={labelStyle}>What cities or regions do you want to cover? *</label>
                <input value={form.territory} onChange={e => update("territory", e.target.value)} style={inputStyle} placeholder="Omaha metro, Lincoln, Kansas City..." />
              </div>

              {/* Travel Distance */}
              <div>
                <label style={labelStyle}>How far are you willing to travel? *</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {["Up to 25 miles", "Up to 50 miles", "Up to 100 miles", "100+ miles"].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => update("travelDistance", opt)}
                      style={{
                        padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                        border: form.travelDistance === opt ? `1px solid rgba(${NEON.primaryRGB},0.5)` : "1px solid rgba(255,255,255,0.08)",
                        background: form.travelDistance === opt ? `rgba(${NEON.primaryRGB},0.1)` : "rgba(255,255,255,0.04)",
                        color: form.travelDistance === opt ? NEON.primary : "rgba(255,255,255,0.45)",
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
                <label style={labelStyle}>Resume *</label>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 8, lineHeight: 1.5 }}>
                  Upload your resume if you have one. PDF or Word format preferred.
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
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Click to upload resume</span>
                    </>
                  )}
                </label>
              </div>

              {/* Reliable Transportation */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.hasReliableTransportation}
                  onChange={e => update("hasReliableTransportation", e.target.checked)}
                  style={{ marginTop: 3, accentColor: NEON.primary }}
                />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                  I have <strong style={{ color: "rgba(255,255,255,0.75)" }}>reliable transportation</strong>, a <strong style={{ color: "rgba(255,255,255,0.75)" }}>working cell phone</strong>, <strong style={{ color: "rgba(255,255,255,0.75)" }}>access to the internet</strong>, and am <strong style={{ color: "rgba(255,255,255,0.75)" }}>proficient in English</strong> (spoken and written). *
                </span>
              </label>

              {/* How did you hear about us */}
              <div>
                <label style={labelStyle}>How did you hear about us? *</label>
                <input value={form.referredBy} onChange={e => update("referredBy", e.target.value)} style={inputStyle} placeholder="Friend, social media, job board..." />
              </div>

              {/* Cover Note */}
              <div>
                <label style={labelStyle}>Why do you want to sell for LetsGo? *</label>
                <textarea
                  value={form.coverNote}
                  onChange={e => update("coverNote", e.target.value)}
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                  placeholder="What excites you about selling for LetsGo?"
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
                        border: form.felonyDisclosure === opt ? `1px solid rgba(${NEON.primaryRGB},0.5)` : "1px solid rgba(255,255,255,0.08)",
                        background: form.felonyDisclosure === opt ? `rgba(${NEON.primaryRGB},0.1)` : "rgba(255,255,255,0.04)",
                        color: form.felonyDisclosure === opt ? NEON.primary : "rgba(255,255,255,0.45)",
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
                <input type="checkbox" checked={form.agreedAge18} onChange={e => update("agreedAge18", e.target.checked)} style={{ marginTop: 3, accentColor: NEON.primary }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  I confirm that I am <strong style={{ color: "rgba(255,255,255,0.7)" }}>at least 18 years of age</strong>. *
                </span>
              </label>

              {/* Work Authorization */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.agreedWorkAuthorization} onChange={e => update("agreedWorkAuthorization", e.target.checked)} style={{ marginTop: 3, accentColor: NEON.primary }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  I am <strong style={{ color: "rgba(255,255,255,0.7)" }}>legally authorized to work in the United States</strong>. *
                </span>
              </label>

              {/* Background Check Consent */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.agreedBackgroundCheck} onChange={e => update("agreedBackgroundCheck", e.target.checked)} style={{ marginTop: 3, accentColor: NEON.primary }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  I consent to a <strong style={{ color: "rgba(255,255,255,0.7)" }}>background check</strong> as part of the application process. *
                </span>
              </label>

              {/* 1099 Acknowledgment */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.agreed1099} onChange={e => update("agreed1099", e.target.checked)} style={{ marginTop: 3, accentColor: NEON.primary }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  I understand that I will be engaged as an <strong style={{ color: NEON.orange }}>independent contractor (1099)</strong> and not as an employee. I am responsible for my own taxes and will receive a 1099-NEC for earnings over $600/year. *
                </span>
              </label>

              {/* Interview Agreement */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.agreedInterview} onChange={e => update("agreedInterview", e.target.checked)} style={{ marginTop: 3, accentColor: NEON.primary }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  I understand that I must complete an <strong style={{ color: "rgba(255,255,255,0.7)" }}>interview via Zoom, Microsoft Teams, or in person</strong> before being approved as a sales rep. *
                </span>
              </label>

              {/* Terms */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.agreedToTerms} onChange={e => update("agreedToTerms", e.target.checked)} style={{ marginTop: 3, accentColor: NEON.primary }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  I agree to the <Link href="/terms" style={{ color: NEON.primary, textDecoration: "underline" }}>Terms of Service</Link> and understand that my application will be reviewed by the LetsGo team. *
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
              background: `linear-gradient(135deg, ${NEON.primary}, ${NEON.purple})`,
              color: "#000", fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em",
              opacity: submitting ? 0.6 : 1, transition: "opacity 0.2s ease",
              boxShadow: `0 0 20px rgba(${NEON.primaryRGB},0.25)`,
            }}
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </div>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link
            href="/welcome"
            style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", textDecoration: "none", transition: "color 0.2s ease" }}
          >
            &larr; Back to LetsGo
          </Link>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
