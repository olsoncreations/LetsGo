"use client";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import "./onboarding.css";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { fetchPlatformTierConfig, getVisitRangeLabel, DEFAULT_VISIT_THRESHOLDS, DEFAULT_PRESET_BPS, type VisitThreshold } from "@/lib/platformSettings";
import type { User } from "@supabase/supabase-js";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

declare global {
  interface Window {
    google?: any;
  }
}



type BusinessType =
  | "restaurant_bar"
  | "activity"
  | "salon_beauty"
  | "retail"
  | "event_venue"
  | "other";

type Role =
  | ""
  | "Owner"
  | "General Manager"
  | "Marketing Manager"
  | "Operations Manager"
  | "Bookkeeper/Accounting"
  | "Other";

type Plan = "basic" | "premium";

type AgeRestriction = "all" | "21" | "18";

type PayoutPreset = "conservative" | "standard" | "aggressive" | "custom";

type PaymentMethod = "bank" | "card";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type HoursDay = {
  enabled: boolean;
  open: string; // "09:00"
  close: string; // "17:00"
};

type AdId = "ad_1day" | "ad_7day" | "ad_14day" | "ad_100mile" | "ad_tourwide";

type AdOption = {
  id: AdId;
  title: string;
  desc: string;
  price: number;
};

type UploadedFileMeta = {
  name: string;
  size: number;
  type: string;
  url?: string;
};

type VerificationDocType = "business_license" | "ein_certificate" | "utility_bill";

type OnboardingData = {
  // Step 1
  businessName: string;
  businessType: BusinessType | "";
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  referredBy: string;
  password: string;
  confirmPassword: string;

  // Step 2
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  businessPhone: string;
  customerEmail: string;
  website: string;
  publicBusinessName: string;
  hours: Record<DayKey, HoursDay>;
  ageRestriction: AgeRestriction;

  // Step 3
  plan: Plan;
  premiumAddons: {
    videoAddon: boolean; // +$50
    liveAddon15: boolean; // +$50
    liveAddon30: boolean; // +$100
  };
  selectedAds: Record<AdId, boolean>;
  wantsCustomAdsCall: boolean;

  // Step 4
  payoutPreset: PayoutPreset;
  payoutBps: number[]; // 7 items
  verifierName: string;
  verifierEmail: string;
  verifierPhone: string;
  autoApprovalEnabled: boolean;
  autoApprovalMax: number; // receipts under this amount auto approved

  // Step 5
  paymentMethod: PaymentMethod;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  stripeSetupComplete: boolean;

  billingSameAsBusiness: boolean;
  billingStreet: string;
  billingCity: string;
  billingState: string;
  billingZip: string;

  authorizeCharges: boolean;

  // Step 6
  verificationDocType: VerificationDocType;
  verificationDocFile?: UploadedFileMeta;
  businessLogoFile?: UploadedFileMeta;

  // Step 7
  marketingPermissions: {
    userUploads: boolean;
    featureInDiscovery: boolean;
    abTesting: boolean;
  };
  optionalServices: {
    promoVideoHelp: boolean;
    profileManagementInterest: boolean;
  };
  legal: {
    terms: boolean;
    billingPolicy: boolean;
    contentPolicy: boolean;
    fraud: boolean;
  };
  signatureName: string;
  signatureBinding: boolean;
};

const STORAGE_KEY = "letsgo_partner_onboarding_v1";
// Using supabaseBrowser from @/lib/supabaseBrowser

// ✅ Correct logo path (place file at: /public/lg-logo.png)
const LOGO_SRC = "/lg-logo.png";

// ADS pricing is now fetched from platform_settings inside the component (dynamicAds)

// Formatting helpers (module-level so Step functions can use them)
function centsToStr(c: number) {
  return `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function bpsToStr(b: number) {
  return `${(b / 100).toFixed(1)}%`;
}

function defaultHours(): Record<DayKey, HoursDay> {
  return {
    mon: { enabled: true, open: "09:00", close: "17:00" },
    tue: { enabled: true, open: "09:00", close: "17:00" },
    wed: { enabled: true, open: "09:00", close: "17:00" },
    thu: { enabled: true, open: "09:00", close: "17:00" },
    fri: { enabled: true, open: "09:00", close: "17:00" },
    sat: { enabled: true, open: "10:00", close: "15:00" },
    sun: { enabled: false, open: "10:00", close: "15:00" },
  };
}

function initialData(): OnboardingData {
  return {
    businessName: "",
    businessType: "",
    fullName: "",
    email: "",
    phone: "",
    role: "",
    referredBy: "",
    password: "",
    confirmPassword: "",

    streetAddress: "",
    city: "",
    state: "",
    zip: "",
    businessPhone: "",
    customerEmail: "",
    website: "",
    publicBusinessName: "",
    hours: defaultHours(),
    ageRestriction: "all",

    plan: "basic",
    premiumAddons: { videoAddon: false, liveAddon15: false, liveAddon30: false },
    selectedAds: {
      ad_1day: false,
      ad_7day: false,
      ad_14day: false,
      ad_100mile: false,
      ad_tourwide: false,
    },
    wantsCustomAdsCall: false,

    // ✅ Updated to match “Claude-style” progressive ladder defaults (more realistic %s)
    payoutPreset: "standard",
    payoutBps: [300, 400, 500, 600, 700, 800, 1000], // 3% → 10%

    verifierName: "",
    verifierEmail: "",
    verifierPhone: "",
    autoApprovalEnabled: true,
    autoApprovalMax: 50,

    paymentMethod: "card",
    stripeCustomerId: "",
    stripePaymentMethodId: "",
    stripeSetupComplete: false,

    billingSameAsBusiness: true,
    billingStreet: "",
    billingCity: "",
    billingState: "",
    billingZip: "",

    authorizeCharges: false,

    verificationDocType: "business_license",
    verificationDocFile: undefined,
    businessLogoFile: undefined,

    marketingPermissions: {
      userUploads: true,
      featureInDiscovery: true,
      abTesting: true,
    },
    optionalServices: {
      promoVideoHelp: false,
      profileManagementInterest: false,
    },
    legal: {
      terms: false,
      billingPolicy: false,
      contentPolicy: false,
      fraud: false,
    },
    signatureName: "",
    signatureBinding: false,
  };
}

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function bpsToPct(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

function clampInt(value: string, min: number, max: number) {
  const n = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function onlyDigits(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatPhone(value: string) {
  const d = onlyDigits(value).slice(0, 10);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);
  if (d.length <= 3) return a;
  if (d.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

function progressWidth(step: number) {
  const pct = Math.round((step / 7) * 100);
  return `${pct}%`;
}

function timeRemaining(step: number) {
  switch (step) {
    case 1:
      return "⏱ ~4 min remaining";
    case 2:
      return "⏱ ~3 min remaining";
    case 3:
      return "⏱ ~2.5 min remaining";
    case 4:
      return "⏱ ~2 min remaining";
    case 5:
      return "⏱ ~1.5 min remaining";
    case 6:
      return "⏱ ~1 min remaining";
    case 7:
      return "✓ Almost Done!";
    default:
      return "";
  }
}

function validateEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function validateStep(step: number, d: OnboardingData, authUserEmail?: string): { ok: boolean; message?: string } {
  if (step === 1) {
    if (!d.businessName.trim()) return { ok: false, message: "Business Name is required." };
    if (!d.businessType) return { ok: false, message: "Please select a Business Type." };
    if (!d.fullName.trim()) return { ok: false, message: "Full Name is required." };
    // Email comes from auth - use authUserEmail as fallback
    const emailToValidate = d.email || authUserEmail || "";
    if (!validateEmail(emailToValidate)) return { ok: false, message: "A valid Email is required." };
    if (onlyDigits(d.phone).length < 10) return { ok: false, message: "A valid Phone Number is required." };
    if (!d.role) return { ok: false, message: "Please select your Role/Title." };
    // Password no longer required - user already authenticated via /welcome
    return { ok: true };
  }

  if (step === 2) {
    if (!d.streetAddress.trim()) return { ok: false, message: "Street Address is required." };
    if (!d.city.trim()) return { ok: false, message: "City is required." };
    if (!d.state.trim()) return { ok: false, message: "State is required." };
    if (!d.zip.trim()) return { ok: false, message: "ZIP is required." };
    if (onlyDigits(d.businessPhone).length < 10) return { ok: false, message: "Business Phone is required." };
    if (!validateEmail(d.customerEmail)) return { ok: false, message: "Customer Email is required." };
    if (!d.publicBusinessName.trim()) return { ok: false, message: "Public Business Name is required." };

    for (const key of Object.keys(d.hours) as DayKey[]) {
      const day = d.hours[key];
      if (!day.enabled) continue;
      if (!day.open || !day.close) {
        return { ok: false, message: "Operating hours must have open and close times." };
      }
      // ❌ Removed the "open must be before close" rule to allow late-night hours (e.g., 6pm–2am)
    }
    return { ok: true };
  }

  if (step === 3) {
    return { ok: true };
  }

  if (step === 4) {
    if (!d.verifierName.trim()) return { ok: false, message: "Verifier name is required." };
    if (!validateEmail(d.verifierEmail)) return { ok: false, message: "Verifier email is required." };
    if (d.autoApprovalEnabled) {
      if (!Number.isFinite(d.autoApprovalMax) || d.autoApprovalMax < 1) {
        return { ok: false, message: "Auto-approval max must be a valid number." };
      }
    }
    return { ok: true };
  }

  if (step === 5) {
    if (!d.authorizeCharges) return { ok: false, message: "You must authorize charges to continue." };
    if (!d.stripeSetupComplete) return { ok: false, message: "Please complete payment setup before continuing." };

    if (!d.billingSameAsBusiness) {
      if (!d.billingStreet.trim()) return { ok: false, message: "Billing street is required." };
      if (!d.billingCity.trim()) return { ok: false, message: "Billing city is required." };
      if (!d.billingState.trim()) return { ok: false, message: "Billing state is required." };
      if (!d.billingZip.trim()) return { ok: false, message: "Billing ZIP is required." };
    }

    return { ok: true };
  }

  if (step === 6) {
    if (!d.verificationDocFile) return { ok: false, message: "Please upload a verification document." };
    if (!d.businessLogoFile) return { ok: false, message: "Please upload your business logo." };
    return { ok: true };
  }

  if (step === 7) {
    if (!d.legal.terms || !d.legal.billingPolicy || !d.legal.contentPolicy || !d.legal.fraud) {
      return { ok: false, message: "Please accept all required legal agreements." };
    }
    if (!d.signatureName.trim()) return { ok: false, message: "Please type your full name to sign." };
    if (!d.signatureBinding) return { ok: false, message: "Please confirm the signature is legally binding." };
    return { ok: true };
  }

  return { ok: true };
}

// Applies preset BPS from platform_settings (falls back to DEFAULT_PRESET_BPS)
function applyPayoutPreset(preset: PayoutPreset, presetBps: Record<string, number[]>): number[] {
  return presetBps[preset] || presetBps.standard || DEFAULT_PRESET_BPS.standard;
}

function planTitle(plan: Plan) {
  return plan === "basic" ? "Basic Package" : "Premium Package";
}

// monthlyFee and selectedAdsList moved inside component to use dynamic pricing

export default function PartnerOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [data, setData] = useState<OnboardingData>(initialData());
  const [error, setError] = useState<string>("");
  const [completed, setCompleted] = useState<boolean>(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Pricing from platform_settings (fetched on mount, falls back to defaults)
  const [pkgPricing, setPkgPricing] = useState({
    basic_monthly_cents: 0,
    premium_monthly_cents: 10000,
    addon_video_5_monthly_cents: 5000,
    addon_live_15_monthly_cents: 5000,
    addon_live_30_monthly_cents: 10000,
    tpms_monthly_cents: 20000,
  });
  const [adPricing, setAdPricing] = useState({
    spotlight_1day_cents: 9900,
    spotlight_7day_cents: 59900,
    spotlight_14day_cents: 99900,
    push_100mile_cents: 259900,
    push_tourwide_cents: 459900,
  });
  const [feeBps, setFeeBps] = useState(1000); // platform_fee_bps
  const [feeCapCents, setFeeCapCents] = useState(500); // platform_fee_cap_cents
  const [ccFeeBps, setCcFeeBps] = useState(300); // cc_processing_fee_bps

  // Dynamic visit thresholds + preset BPS from platform_settings
  const [visitThresholds, setVisitThresholds] = useState<VisitThreshold[]>(DEFAULT_VISIT_THRESHOLDS);
  const [presetBps, setPresetBps] = useState<Record<string, number[]>>(DEFAULT_PRESET_BPS);
  const dynamicTiers = useMemo(() =>
    visitThresholds.map((t) => ({ level: `Level ${t.level}`, range: getVisitRangeLabel(t) })),
    [visitThresholds],
  );

  // Fetch pricing + tier config from platform_settings
  useEffect(() => {
    async function fetchPricing() {
      try {
        const [pricingRes, tierConfig] = await Promise.all([
          supabaseBrowser
            .from("platform_settings")
            .select("package_pricing, ad_pricing, platform_fee_bps, platform_fee_cap_cents, cc_processing_fee_bps")
            .eq("id", 1)
            .maybeSingle(),
          fetchPlatformTierConfig(supabaseBrowser),
        ]);
        const ps = pricingRes.data;
        if (ps) {
          if (ps.package_pricing) setPkgPricing(ps.package_pricing);
          if (ps.ad_pricing) setAdPricing(ps.ad_pricing);
          if (ps.platform_fee_bps) setFeeBps(ps.platform_fee_bps);
          if (ps.platform_fee_cap_cents) setFeeCapCents(ps.platform_fee_cap_cents);
          if (ps.cc_processing_fee_bps) setCcFeeBps(ps.cc_processing_fee_bps);
        }
        setVisitThresholds(tierConfig.visitThresholds);
        setPresetBps(tierConfig.presetBps);
      } catch (err) {
        console.error("Error fetching pricing:", err);
      }
    }
    fetchPricing();
  }, []);

  // Dynamic ADS array from platform_settings
  const dynamicAds: AdOption[] = useMemo(() => [
    { id: "ad_1day", title: "1-Day Spotlight", desc: "Featured at top of Discovery feed for 1 day in your category (within 20 miles of your business zip code)", price: adPricing.spotlight_1day_cents / 100 },
    { id: "ad_7day", title: "7-Day Spotlight", desc: "Featured at top of Discovery feed for 7 days in your category (within 50 miles of your zip code)", price: adPricing.spotlight_7day_cents / 100 },
    { id: "ad_14day", title: "14-Day Spotlight", desc: "Featured at top of Discovery feed for 14 days in your category (within 50 miles of your zip code)", price: adPricing.spotlight_14day_cents / 100 },
    { id: "ad_100mile", title: "100 Mile Wide Push", desc: "Promoted to all users within 100 miles of your business zip code with push notifications for 7 days straight and top priority placement on Discovery page", price: adPricing.push_100mile_cents / 100 },
    { id: "ad_tourwide", title: "Tour Wide Push", desc: "Promoted to all users within 100 miles of your business zip code with push notifications for 14 days total (split in 60-day range) and top priority placement on Discovery page for 7 days (priority days may be split up)", price: adPricing.push_tourwide_cents / 100 },
  ], [adPricing]);

  // Dynamic monthlyFee using pricing from platform_settings
  function monthlyFee(d: OnboardingData) {
    if (d.plan === "basic") return pkgPricing.basic_monthly_cents / 100;
    let fee = pkgPricing.premium_monthly_cents / 100;
    if (d.premiumAddons.videoAddon) fee += pkgPricing.addon_video_5_monthly_cents / 100;
    if (d.premiumAddons.liveAddon15) fee += pkgPricing.addon_live_15_monthly_cents / 100;
    if (d.premiumAddons.liveAddon30) fee += pkgPricing.addon_live_30_monthly_cents / 100;
    return fee;
  }

  function selectedAdsList(d: OnboardingData) {
    return dynamicAds.filter((a) => d.selectedAds[a.id]);
  }

  // Check authentication
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session }, error } = await supabaseBrowser.auth.getSession();
        
        if (error) {
          console.error("Auth error:", error);
          setAuthLoading(false);
          return;
        }
        
        if (!session) {
          // Not logged in, redirect to welcome page
          console.log("No session, redirecting to /welcome");
          router.push("/welcome");
          return;
        }
        
        setAuthUser(session.user);
        
        // Pre-fill email and name from auth user
        setData((prev) => ({
          ...prev,
          email: session.user.email || prev.email,
          fullName: session.user.user_metadata?.full_name || prev.fullName,
        }));
        
        setAuthLoading(false);
      } catch (err) {
        console.error("Auth check failed:", err);
        setAuthLoading(false);
      }
    }
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push("/welcome");
      } else {
        setAuthUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { step?: number; data?: OnboardingData; completed?: boolean };
      if (parsed?.data) {
        // Preserve auth email - don't let localStorage overwrite it
        setData((prev) => ({
          ...parsed.data!,
          email: prev.email || parsed.data!.email, // Keep auth email if available
        }));
      }
      if (parsed?.step && parsed.step >= 1 && parsed.step <= 7) setStep(parsed.step);
      if (parsed?.completed) setCompleted(true);
    } catch {
      // ignore
    }
  }, [authLoading]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data, completed }));
    } catch {
      // ignore
    }
  }, [step, data, completed]);

  const submitDisabled = useMemo(() => {
    const v = validateStep(7, data, authUser?.email);
    return !v.ok;
  }, [data, authUser]);

  const reviewPlanFees = useMemo(() => {
    const ads = selectedAdsList(data);
    const adsTotal = ads.reduce((s, a) => s + a.price, 0);
    const ccPct = bpsToStr(ccFeeBps);
    return {
      planName: planTitle(data.plan),
      monthly: monthlyFee(data),
      perVisit:
        data.plan === "basic"
          ? `Platform fee: ${bpsToStr(feeBps)} of ticket subtotal (pretax) OR ${centsToStr(feeCapCents)} max (whichever is less)`
          : "Platform fee: $0 (Premium package)",
      paymentMethod: data.paymentMethod === "bank" ? "Bank Account (ACH)" : "Credit/Debit Card",
      processingFee: data.paymentMethod === "bank" ? "$0 (No Fees)" : `${ccPct} (Credit Card Processing)`,
      adsTotal,
      ads,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, feeBps, feeCapCents, ccFeeBps, adPricing, pkgPricing]);

  function goNext() {
    setError("");
    const v = validateStep(step, data, authUser?.email);
    if (!v.ok) {
      setError(v.message || "Please complete required fields.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setStep((s) => Math.min(7, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setError("");
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveAndExit() {
    setError("");
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data, completed }));
    } catch {
      // ignore
    }
    alert("Saved! You can come back anytime to finish.");
  }

  function resetAll() {
    setCompleted(false);
    setStep(1);
    setData(initialData());
    setError("");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

async function completeSignup() {
  setError("");
  const v = validateStep(7, data, authUser?.email);
  if (!v.ok) {
    setError(v.message || "Please complete required fields.");
    return;
  }

  if (!authUser) {
    setError("You must be logged in to submit. Please refresh and try again.");
    return;
  }

  try {
    // Save everything as JSON, plus a few helpful top-level fields
    const payload = {
      ...data,
      email: data.email || authUser.email, // Ensure email is included
      // optional: include some metadata
      submittedAt: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    };

    const { error: insertError } = await supabaseBrowser.from("partner_onboarding_submissions").insert([
      {
        user_id: authUser.id,
        status: "submitted",
        payload,
        business_name: data.businessName || null,
        contact_email: data.email || authUser.email || null,
        contact_phone: data.phone || null,
      },
    ]);

    if (insertError) {
      console.error("Insert error details:", JSON.stringify(insertError, null, 2));
      console.error("Insert error message:", insertError.message);
      console.error("Insert error code:", insertError.code);
      setError(`Could not submit your application: ${insertError.message || "Unknown error"}. Please try again.`);
      return;
    }

    setCompleted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    console.error(e);
    setError("Could not submit your application. Please try again.");
  }
}

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="container">
        <Header />
        <div className="form-card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
            Loading...
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)" }}>
            Checking your session
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="container">
        <Header />
        <Progress step={7} />
        <div className="form-card">
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "5rem", marginBottom: 24 }}>🎉</div>
            <h1 className="success-title">Welcome to Let'sGo!</h1>
            <p className="success-subtitle">Your business profile has been submitted for review.</p>

            <div className="success-box">
              <h3 className="success-box-title">What happens next:</h3>
              <div className="success-row">
                <span className="success-check">✓</span>
                <span>
                  <strong>Within 24 hours:</strong> We’ll verify your documents and activate your account
                </span>
              </div>
              <div className="success-row">
                <span className="success-check">✓</span>
                <span>
                  <strong>You’ll receive:</strong> An email notification when your account is approved
                </span>
              </div>
              <div className="success-row">
                <span className="success-check">✓</span>
                <span>
                  <strong>First steps:</strong> Wait for your first customer visit and start earning
                </span>
              </div>
            </div>

            <p className="success-help">
              Need help? Contact{" "}
              <a href="mailto:support@letsgo.com" className="success-help-link">
                support@letsgo.com
              </a>{" "}
              or call (555) 123-4567
            </p>
          </div>
        </div>

        <HelpBadge />
      </div>
    );
  }

  return (
    <div className="container">


{GMAPS_KEY ? (
<Script
  src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&v=weekly`}
  strategy="afterInteractive"
  onLoad={() => setMapsLoaded(true)}
/>
) : (
  <div className="error-banner" role="alert">
    <strong>Missing Google Maps API Key:</strong> NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set for this build.
  </div>
)}
      <Header />
      <Progress step={step} />

      <div className="form-card">
        <h1 className="form-title">{stepTitle(step)}</h1>
        <p className="form-subtitle">{stepSubtitle(step)}</p>

        {error ? (
          <div className="error-banner" role="alert">
            <strong>Fix this to continue:</strong> {error}
          </div>
        ) : null}

        {step === 1 && <Step1 data={data} setData={setData} onSaveExit={saveAndExit} authUserEmail={authUser?.email} />}
        {step === 2 && <Step2 data={data} setData={setData} mapsLoaded={mapsLoaded} />}
        {step === 3 && <Step3 data={data} setData={setData} pkgPricing={pkgPricing} dynamicAds={dynamicAds} ccFeeBps={ccFeeBps} />}
        {step === 4 && <Step4 data={data} setData={setData} tiers={dynamicTiers} presetBps={presetBps} />}
        {step === 5 && <Step5 data={data} setData={setData} ccFeeBps={ccFeeBps} feeBps={feeBps} feeCapCents={feeCapCents} />}
        {step === 6 && <Step6 data={data} setData={setData} pkgPricing={pkgPricing} authUser={authUser} />}
        {step === 7 && <Step7 data={data} setData={setData} reviewPlanFees={reviewPlanFees} feeBps={feeBps} feeCapCents={feeCapCents} ccFeeBps={ccFeeBps} pkgPricing={pkgPricing} tiers={dynamicTiers} />}

        <div className="button-group">
          <button type="button" className="btn btn-secondary" onClick={goBack} disabled={step === 1}>
            ← Back
          </button>

          {step < 7 ? (
            <button type="button" className="btn btn-primary" onClick={goNext}>
              Continue →
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={completeSignup}
              disabled={submitDisabled}
              title={submitDisabled ? "Complete all required checkboxes and signature to submit." : "Submit"}
            >
              🎉 Complete Sign-Up
            </button>
          )}
        </div>
      </div>

      <HelpBadge />
    </div>
  );
}

function Header() {
  return (
    <div className="header">
      <div className="logo-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt="Let'sGo" className="logo-img" />
      </div>
      <div className="tagline">Partner with us to grow your business</div>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="progress-container">
      <div className="progress-header">
        <div className="step-indicator">
          <span className="current">Step {step}</span> of 7
        </div>
        <div className="time-remaining">{timeRemaining(step)}</div>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: progressWidth(step) }} />
      </div>
    </div>
  );
}

function HelpBadge() {
  return (
    <div
      className="help-badge"
      onClick={() => alert("Chat support would open here! Available Mon-Fri 9am-6pm EST")}
      role="button"
      tabIndex={0}
    >
      💬 Need Help?
    </div>
  );
}

function stepTitle(step: number) {
  switch (step) {
    case 1:
      return "Get Started";
    case 2:
      return "Business Details";
    case 3:
      return "Choose Your Package";
    case 4:
      return "Progressive Payout Structure";
    case 5:
      return "Billing & Payment";
    case 6:
      return "Verification & Uploads";
    case 7:
      return "Review & Agree";
    default:
      return "Partner Onboarding";
  }
}

function stepSubtitle(step: number) {
  switch (step) {
    case 1:
      return "Let’s set up your business profile. This takes about 30 seconds.";
    case 2:
      return "Help customers find you with accurate location and contact information.";
    case 3:
      return "Choose Basic or Premium. Advertising is an optional package you can add to either.";
    case 4:
      return "Set how much you’ll pay customers based on their repeat visits to YOUR business.";
    case 5:
      return "Secure payment setup to process your transactions smoothly.";
    case 6:
      return "Verify your business and build your profile with quality images.";
    case 7:
      return "Review your package details and finalize your partnership with Let'sGo.";
    default:
      return "";
  }
}

/* =========================
   STEP 1
========================= */

function Step1({
  data,
  setData,
  onSaveExit,
  authUserEmail,
}: {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  onSaveExit: () => void;
  authUserEmail?: string;
}) {
  const displayEmail = data.email || authUserEmail || "";
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">🏢</div>
          Your Business
        </div>

        <div className="form-group">
          <label>
            Business Name <span className="required">*</span>
          </label>
          <input
            value={data.businessName}
            onChange={(e) => setData((p) => ({ ...p, businessName: e.target.value }))}
            placeholder="Enter your business name"
            required
          />
        </div>

        <div className="form-group">
          <label>
            Business Type <span className="required">*</span>
          </label>

          <div className="category-grid">
            <CategoryCard
              title="Restaurant/Bar"
              icon="🍽️"
              selected={data.businessType === "restaurant_bar"}
              onClick={() => setData((p) => ({ ...p, businessType: "restaurant_bar" }))}
            />
            <CategoryCard
              title="Activity"
              icon="🎯"
              selected={data.businessType === "activity"}
              onClick={() => setData((p) => ({ ...p, businessType: "activity" }))}
            />
            <CategoryCard
              title="Salon/Beauty"
              icon="💇"
              selected={data.businessType === "salon_beauty"}
              onClick={() => setData((p) => ({ ...p, businessType: "salon_beauty" }))}
            />
            <CategoryCard
              title="Retail"
              icon="🛍️"
              selected={data.businessType === "retail"}
              onClick={() => setData((p) => ({ ...p, businessType: "retail" }))}
            />
            <CategoryCard
              title="Event Venue"
              icon="🎉"
              selected={data.businessType === "event_venue"}
              onClick={() => setData((p) => ({ ...p, businessType: "event_venue" }))}
            />
            <CategoryCard
              title="Other"
              icon="✨"
              selected={data.businessType === "other"}
              onClick={() => setData((p) => ({ ...p, businessType: "other" }))}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">🧑‍💼</div>
          Your Information
        </div>

        <div className="form-group">
          <label>
            Full Name <span className="required">*</span>
          </label>
          <input
            value={data.fullName}
            onChange={(e) => setData((p) => ({ ...p, fullName: e.target.value }))}
            placeholder="John Smith"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>
              Email <span className="required">*</span>
            </label>
            <input
              value={displayEmail}
              readOnly
              disabled
              style={{ backgroundColor: "rgba(255,255,255,0.05)", cursor: "not-allowed" }}
              type="email"
            />
            <div className="helper-text">From your account (cannot be changed here)</div>
          </div>

          <div className="form-group">
            <label>
              Phone Number <span className="required">*</span>
            </label>
            <input
              value={data.phone}
              onChange={(e) => setData((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
              placeholder="(555) 123-4567"
              required
              inputMode="tel"
            />
          </div>
        </div>

        <div className="form-group">
          <label>
            Role/Title <span className="required">*</span>
          </label>
          <select
            value={data.role}
            onChange={(e) => setData((p) => ({ ...p, role: e.target.value as Role }))}
            required
          >
            <option value="">Select your role</option>
            <option value="Owner">Owner</option>
            <option value="General Manager">General Manager</option>
            <option value="Marketing Manager">Marketing Manager</option>
            <option value="Operations Manager">Operations Manager</option>
            <option value="Bookkeeper/Accounting">Bookkeeper/Accounting</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">🏷️</div>
          Referral Information
        </div>

        <div className="form-group">
          <label>
            Referred By <span className="optional">(optional)</span>
          </label>
          <input
            value={data.referredBy}
            onChange={(e) => setData((p) => ({ ...p, referredBy: e.target.value }))}
            placeholder="Sales rep name or referral code"
          />
          <div className="helper-text">
            If a Let’sGo sales rep helped you sign up, enter their name here for commission tracking
          </div>
        </div>
      </div>

      <div className="button-row-split">
        <button type="button" className="btn btn-secondary small" onClick={onSaveExit}>
          ← Save & Exit
        </button>
        <div className="footer-note">
          Join <strong>2,500+</strong> local businesses already growing with Let’sGo
        </div>
      </div>
    </form>
  );
}

function CategoryCard({
  title,
  icon,
  selected,
  onClick,
}: {
  title: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`category-card ${selected ? "selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className="category-icon">{icon}</div>
      <div className="category-title">{title}</div>
    </button>
  );
}

/* =========================
   STEP 2
========================= */

function Step2({
  data,
  setData,
  mapsLoaded,
}: {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  mapsLoaded: boolean;
}) {
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const placesElementHostRef = useRef<HTMLDivElement | null>(null);

  
function stateNameToAbbrev(name: string) {
  const n = (name || "").toUpperCase().trim();
  const map: Record<string, string> = {
    ALABAMA: "AL",
    ALASKA: "AK",
    ARIZONA: "AZ",
    ARKANSAS: "AR",
    CALIFORNIA: "CA",
    COLORADO: "CO",
    CONNECTICUT: "CT",
    DELAWARE: "DE",
    FLORIDA: "FL",
    GEORGIA: "GA",
    HAWAII: "HI",
    IDAHO: "ID",
    ILLINOIS: "IL",
    INDIANA: "IN",
    IOWA: "IA",
    KANSAS: "KS",
    KENTUCKY: "KY",
    LOUISIANA: "LA",
    MAINE: "ME",
    MARYLAND: "MD",
    MASSACHUSETTS: "MA",
    MICHIGAN: "MI",
    MINNESOTA: "MN",
    MISSISSIPPI: "MS",
    MISSOURI: "MO",
    MONTANA: "MT",
    NEBRASKA: "NE",
    NEVADA: "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    OHIO: "OH",
    OKLAHOMA: "OK",
    OREGON: "OR",
    PENNSYLVANIA: "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    TENNESSEE: "TN",
    TEXAS: "TX",
    UTAH: "UT",
    VERMONT: "VT",
    VIRGINIA: "VA",
    WASHINGTON: "WA",
    "WEST VIRGINIA": "WV",
    WISCONSIN: "WI",
    WYOMING: "WY",
  };
  return map[n] || name;
}


useEffect(() => {
  if (!mapsLoaded) return;
  if (!addressInputRef.current) return;

  const g = (window as any).google;
  if (!g?.maps?.places?.Autocomplete) return;

  const autocomplete = new g.maps.places.Autocomplete(addressInputRef.current, {
    types: ["address"],
    fields: ["address_components", "formatted_address"],
  });

  const getComponent = (
    components: any[],
    type: string,
    which: "long_name" | "short_name" = "long_name"
  ) => {
    const hit = components?.find((c: any) => c.types?.includes(type));
    return hit?.[which] ?? "";
  };

  const listener = autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    const comps = place?.address_components ?? [];

    const streetNumber = getComponent(comps, "street_number");
    const route = getComponent(comps, "route");

    const city =
      getComponent(comps, "locality") ||
      getComponent(comps, "sublocality") ||
      getComponent(comps, "postal_town");

    const state = getComponent(comps, "administrative_area_level_1", "short_name"); // "NE"
    const zip = getComponent(comps, "postal_code");

    const streetAddress =
      (streetNumber && route ? `${streetNumber} ${route}` : "") ||
      place?.formatted_address ||
      "";

    setData((p) => ({
      ...p,
      streetAddress,
      city: city || p.city,
      state: state || p.state,
      zip: zip || p.zip,
    }));
  });

  return () => {
    if (listener?.remove) listener.remove();
  };
}, [mapsLoaded, setData]);




  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">📍</div>
          Location
        </div>

        <div className="form-group">
          <label>
            Street Address <span className="required">*</span>
          </label>
<input
  ref={addressInputRef}
  value={data.streetAddress}
  onChange={(e) => setData((p) => ({ ...p, streetAddress: e.target.value }))}
  placeholder="123 Main Street"
  required
  autoComplete="off"
/>
        </div>

        <div className="form-row-3">
          <div className="form-group">
            <label>
              City <span className="required">*</span>
            </label>
            <input
              value={data.city}
              onChange={(e) => setData((p) => ({ ...p, city: e.target.value }))}
              placeholder="Los Angeles"
              required
            />
          </div>

          <div className="form-group">
            <label>
              State <span className="required">*</span>
            </label>
            <select
              value={data.state}
              onChange={(e) => setData((p) => ({ ...p, state: e.target.value }))}
              required
            >
              <option value="">Select</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>
              ZIP <span className="required">*</span>
            </label>
            <input
              value={data.zip}
              onChange={(e) => setData((p) => ({ ...p, zip: e.target.value }))}
              placeholder="90210"
              required
              inputMode="numeric"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">☎️</div>
          Contact Information
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>
              Business Phone <span className="required">*</span>
            </label>
            <input
              value={data.businessPhone}
              onChange={(e) => setData((p) => ({ ...p, businessPhone: formatPhone(e.target.value) }))}
              placeholder="(555) 123-4567"
              required
              inputMode="tel"
            />
          </div>

          <div className="form-group">
            <label>
              Customer Email <span className="required">*</span>
            </label>
            <input
              value={data.customerEmail}
              onChange={(e) => setData((p) => ({ ...p, customerEmail: e.target.value }))}
              placeholder="info@business.com"
              required
              type="email"
            />
          </div>
        </div>

        <div className="form-group">
          <label>
            Website <span className="optional">(optional)</span>
          </label>
          <input
            value={data.website}
            onChange={(e) => setData((p) => ({ ...p, website: e.target.value }))}
            placeholder="https://yourbusiness.com"
            type="url"
          />
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">🏷️</div>
          Display Name
        </div>

        <div className="form-group">
          <label>
            Public Business Name <span className="required">*</span>
          </label>
          <input
            value={data.publicBusinessName}
            onChange={(e) => setData((p) => ({ ...p, publicBusinessName: e.target.value }))}
            placeholder="Joe's Bar & Grill"
            required
          />
          <div className="helper-text">
            This is how customers will see your business (can be different from legal name)
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">🕒</div>
          Operating Hours
        </div>

        <div className="hours-grid">
          {DAY_ORDER.map((k) => (
            <DayHoursRow key={k} dayKey={k} data={data} setData={setData} />
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">🔞</div>
          Age Restrictions
        </div>

        <div className="radio-stack">
          <RadioCard
            selected={data.ageRestriction === "all"}
            title="All ages welcome"
            onClick={() => setData((p) => ({ ...p, ageRestriction: "all" }))}
          />
          <RadioCard
            selected={data.ageRestriction === "21"}
            title="21+ only"
            onClick={() => setData((p) => ({ ...p, ageRestriction: "21" }))}
          />
          <RadioCard
            selected={data.ageRestriction === "18"}
            title="18+ only"
            onClick={() => setData((p) => ({ ...p, ageRestriction: "18" }))}
          />
        </div>
      </div>
    </form>
  );
}

function DayHoursRow({
  dayKey,
  data,
  setData,
}: {
  dayKey: DayKey;
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
}) {
  const label = DAY_LABELS[dayKey];
  const day = data.hours[dayKey];

  return (
    <div className={`day-row ${day.enabled ? "" : "disabled"}`}>
      <div className="day-checkbox">
        <input
          type="checkbox"
          checked={day.enabled}
          onChange={(e) =>
            setData((p) => ({
              ...p,
              hours: { ...p.hours, [dayKey]: { ...p.hours[dayKey], enabled: e.target.checked } },
            }))
          }
          id={`${dayKey}-enabled`}
        />
        <label htmlFor={`${dayKey}-enabled`} className="day-label">
          {label}
        </label>
      </div>

      <div className="time-inputs">
        <input
          type="time"
          value={day.open}
          disabled={!day.enabled}
          onChange={(e) =>
            setData((p) => ({
              ...p,
              hours: { ...p.hours, [dayKey]: { ...p.hours[dayKey], open: e.target.value } },
            }))
          }
        />
        <span className="time-separator">to</span>
        <input
          type="time"
          value={day.close}
          disabled={!day.enabled}
          onChange={(e) =>
            setData((p) => ({
              ...p,
              hours: { ...p.hours, [dayKey]: { ...p.hours[dayKey], close: e.target.value } },
            }))
          }
        />
      </div>
    </div>
  );
}

function RadioCard({
  selected,
  title,
  onClick,
}: {
  selected: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`radio-card ${selected ? "selected" : ""}`} onClick={onClick}>
      <span className={`radio-dot ${selected ? "on" : ""}`} />
      <span className="radio-text">{title}</span>
    </button>
  );
}

/* =========================
   STEP 3
========================= */

function Step3({
  data,
  setData,
  pkgPricing,
  dynamicAds,
  ccFeeBps,
}: {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  pkgPricing: { basic_monthly_cents: number; premium_monthly_cents: number; addon_video_5_monthly_cents: number; addon_live_15_monthly_cents: number; addon_live_30_monthly_cents: number; tpms_monthly_cents: number };
  dynamicAds: AdOption[];
  ccFeeBps: number;
}) {
  const isPremium = data.plan === "premium";

  function toggleAd(id: AdId) {
    setData((p) => ({
      ...p,
      selectedAds: { ...p.selectedAds, [id]: !p.selectedAds[id] },
    }));
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {/* ✅ Claude-style “Packages”: Basic + Premium, plus Advertising as optional package */}
      <div className="packages-container">
        {/* Basic Package */}
        <div className={`package-card ${data.plan === "basic" ? "selected" : ""}`}>
          <div className="package-header">
            <h3 className="package-name">Basic</h3>
            <div className="package-price basic-price">No Upfront Costs</div>
            <div className="package-price-sub">Pay later</div>
          </div>

          <ul className="package-features">
            <li><span className="check">✓</span> Get discovered by local users</li>
            <li><span className="check">✓</span> Pay only for real customers</li>
            <li><span className="check">✓</span> Verified customers via receipt redemption system</li>
            <li><span className="check">✓</span> No monthly subscription</li>
            <li><span className="check">✓</span> No paying for clicks or views</li>
            <li><span className="check">✓</span> Basic analytics</li>
            <li><span className="check">✓</span> Zero risk</li>
          </ul>

          <div className="feature-access">
            <div className="feature-access-title">FEATURE ACCESS</div>
            <ul className="feature-access-list">
              <li><span className="check">✓</span> Access to Discovery</li>
              <li><span className="check">✓</span> Access to 5v3v1</li>
              <li><span className="check">✓</span> Access to Group Vote</li>
            </ul>
          </div>

          <button
            type="button"
            className={`package-btn ${data.plan === "basic" ? "current" : ""}`}
            onClick={() => setData((p) => ({ ...p, plan: "basic" }))}
          >
            {data.plan === "basic" ? "Current Plan" : "Switch to Basic"}
          </button>
        </div>

        {/* Premium Package */}
        <div className={`package-card premium ${data.plan === "premium" ? "selected" : ""}`}>
          <div className="package-badges">
            <span className="badge-popular">MOST POPULAR</span>
            {data.plan === "premium" && <span className="badge-current">CURRENT PLAN</span>}
          </div>

          <div className="package-header">
            <h3 className="package-name">Premium Subscription</h3>
            <div className="package-price premium-price">{centsToStr(pkgPricing.premium_monthly_cents)}</div>
            <div className="package-price-sub">per month</div>
          </div>

          <ul className="package-features">
            <li><span className="check">✓</span> Get discovered by local users</li>
            <li><span className="check">✓</span> Verified customers via receipt redemption system</li>
            <li><span className="check">✓</span> No paying for clicks or views</li>
            <li><span className="check">✓</span> No LetsGo fee from Basic section</li>
            <li><span className="check">✓</span> Upload 1 video daily</li>
            <li><span className="check">✓</span> Up to 5 live videos at once</li>
            <li><span className="check">✓</span> Priority placement</li>
            <li><span className="check">✓</span> Detailed analytics dashboard</li>
          </ul>

          <div className="feature-access">
            <div className="feature-access-title">FEATURE ACCESS</div>
            <ul className="feature-access-list">
              <li><span className="check">✓</span> Access to Everything in Basic</li>
              <li><span className="check">✓</span> Access to Events</li>
              <li><span className="check">✓</span> Access to User Experiences</li>
              <li><span className="check">✓</span> Access to Date Night Generator</li>
            </ul>
          </div>

          <button
            type="button"
            className={`package-btn premium-btn ${data.plan === "premium" ? "current" : ""}`}
            onClick={() => setData((p) => ({ ...p, plan: "premium" }))}
          >
            {data.plan === "premium" ? "Current Plan" : "Switch to Premium"}
          </button>
        </div>
      </div>

      {/* Plan change notice */}
      <div className="plan-notice">
        <span className="notice-icon">ⓘ</span>
        <span>Changing from Premium to Basic takes effect at the end of the current billing period. No partial refunds. Premium-only features will stop on the 1st of next month.</span>
      </div>

      {/* Premium addons (kept as-is) */}
      <div className={`addon-panel ${isPremium ? "active" : ""}`}>
        <div className="addon-title">Premium Add-ons</div>

        <label className="addon-item">
          <input
            type="checkbox"
            checked={data.premiumAddons.videoAddon}
            disabled={!isPremium}
            onChange={(e) =>
              setData((p) => ({
                ...p,
                premiumAddons: { ...p.premiumAddons, videoAddon: e.target.checked },
              }))
            }
          />
          <span>Add 5 videos/day</span>
          <span className="addon-price">+{centsToStr(pkgPricing.addon_video_5_monthly_cents)}/month</span>
        </label>

        <label className="addon-item">
          <input
            type="checkbox"
            checked={data.premiumAddons.liveAddon15}
            disabled={!isPremium}
            onChange={(e) =>
              setData((p) => ({
                ...p,
                premiumAddons: { 
                  ...p.premiumAddons, 
                  liveAddon15: e.target.checked,
                  liveAddon30: e.target.checked ? false : p.premiumAddons.liveAddon30, // Uncheck 30 if 15 is selected
                },
              }))
            }
          />
          <span>Increase live video capacity to 15</span>
          <span className="addon-price">+{centsToStr(pkgPricing.addon_live_15_monthly_cents)}/month</span>
        </label>

        <label className="addon-item">
          <input
            type="checkbox"
            checked={data.premiumAddons.liveAddon30}
            disabled={!isPremium}
            onChange={(e) =>
              setData((p) => ({
                ...p,
                premiumAddons: { 
                  ...p.premiumAddons, 
                  liveAddon30: e.target.checked,
                  liveAddon15: e.target.checked ? false : p.premiumAddons.liveAddon15, // Uncheck 15 if 30 is selected
                },
              }))
            }
          />
          <span>Increase live video capacity to 30</span>
          <span className="addon-price">+{centsToStr(pkgPricing.addon_live_30_monthly_cents)}/month</span>
        </label>

        <div className="helper-text" style={{ marginTop: 8 }}>
          Premium monthly total will update automatically in Step 7 Review.
        </div>
      </div>

      {/* ✅ Advertising package callout (Claude-style) */}
      {/* Advertising section - only available for Premium */}
      <div className={`advertising-section ${!isPremium ? "locked" : ""}`}>
        {!isPremium && (
          <div className="advertising-locked-overlay">
            <div className="lock-icon">🔒</div>
            <div className="lock-text">Advertising is available with Premium subscription</div>
          </div>
        )}
        <div className="advertising-title">🚀 Boost Your Visibility with Advertising</div>
        <div className="advertising-subtitle">
          Want even more customers? Add targeted advertising campaigns
        </div>

        <div className="advertising-options">
          {dynamicAds.map((ad) => {
            const checked = data.selectedAds[ad.id];
            return (
              <button
                type="button"
                key={ad.id}
                className={`ad-option ${checked ? "selected" : ""}`}
                onClick={() => isPremium && toggleAd(ad.id)}
                disabled={!isPremium}
              >
                <div className="ad-price">{money(ad.price).replace(".00", "")}</div>
                <div className="ad-duration">{ad.title}</div>
                <div className="ad-description">{ad.desc}</div>
                <div className="ad-check">
                  <input type="checkbox" checked={checked} readOnly disabled={!isPremium} />
                  <span>{checked ? "Selected" : "Select"}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="helper-text" style={{ marginTop: 12, fontSize: "0.8rem", color: "#8892a6", lineHeight: 1.5 }}>
          Prices shown are base rates. Campaigns scheduled during high-demand dates (Hot Days) may include a surge fee, shown before purchase.
        </div>

        <label className={`custom-ad-row ${!isPremium ? "disabled" : ""}`}>
          <input
            type="checkbox"
            checked={data.wantsCustomAdsCall}
            disabled={!isPremium}
            onChange={(e) => setData((p) => ({ ...p, wantsCustomAdsCall: e.target.checked }))}
          />
          <span>I'd like a Let'sGo rep to contact me about custom advertising plans</span>
        </label>
      </div>
    </form>
  );
}

function PlanCard({
  selected,
  badgeText,
  name,
  priceTop,
  priceBottom,
  features,
  fees,
  customerNote,
  onClick,
}: {
  selected: boolean;
  badgeText: string;
  name: string;
  priceTop: string;
  priceBottom: string;
  features: string[];
  fees: { label: string; value: string }[];
  customerNote: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`plan-card ${selected ? "selected" : ""}`} onClick={onClick}>
      {badgeText ? <div className="plan-badge">{badgeText}</div> : null}

      <div className="plan-name">{name}</div>

      <div className="plan-price">
        <div className="price-amount">{priceTop}</div>
        <div className="price-period">{priceBottom}</div>
      </div>

      <ul className="plan-features">
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <div className="plan-fees">
        <div className="fees-title">Upon verified paying customer, your business pays:</div>
        {fees.map((fee) => (
          <div className="fee-item" key={fee.label}>
            <strong>{fee.label}:</strong> {fee.value}
          </div>
        ))}
        <div className="fee-divider" />
        <div className="customer-note">{customerNote}</div>
      </div>
    </button>
  );
}

/* =========================
   STEP 4
========================= */

function Step4({
  data,
  setData,
  tiers,
  presetBps,
}: {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  tiers: { level: string; range: string }[];
  presetBps: Record<string, number[]>;
}) {
  function setPreset(p: PayoutPreset) {
    setData((prev) => ({
      ...prev,
      payoutPreset: p,
      payoutBps: p === "custom" ? prev.payoutBps : applyPayoutPreset(p, presetBps),
    }));
  }

  function updateTier(idx: number, v: string) {
    const bps = clampInt(v, 0, 3000);
    setData((p) => {
      const next = [...p.payoutBps];
      next[idx] = bps;
      return { ...p, payoutPreset: "custom", payoutBps: next };
    });
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div className="info-box">
        <div className="info-title">🔥 How Progressive Payouts Work</div>
        <div className="info-text">
          Progressive Payouts are rewards your customers earn for <strong>repeat visits to YOUR business</strong>.
          <br />
          <br />
          ✅ Each business has its <strong>own</strong> payout ladder. A customer can be Level 4 at your business and
          Level 1 somewhere else.
          <br />
          ✅ Only <strong>verified receipts</strong> count toward visit totals.
          <br />
          ✅ The payout is a % (BPS = basis points) of the receipt subtotal <strong>before tax/tip</strong>.
          <br />
          <br />
          <strong>Note:</strong> Visit counts are tracked per customer per business. (This is how repeat customers are
          rewarded without overpaying one-time visitors.)
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">⚡</div>
          Quick Setup (Choose a Preset)
        </div>

        <div className="preset-grid">
          <PresetCard
            title="Conservative"
            subtitle="Lower payouts, safer for new businesses"
            selected={data.payoutPreset === "conservative"}
            onClick={() => setPreset("conservative")}
          />
          <PresetCard
            title="Standard"
            subtitle="Balanced payouts, recommended"
            selected={data.payoutPreset === "standard"}
            onClick={() => setPreset("standard")}
          />
          <PresetCard
            title="Aggressive"
            subtitle="Higher payouts to drive repeat visits"
            selected={data.payoutPreset === "aggressive"}
            onClick={() => setPreset("aggressive")}
          />
          <PresetCard
            title="Custom"
            subtitle="Set your own payout levels manually"
            selected={data.payoutPreset === "custom"}
            onClick={() => setPreset("custom")}
          />
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">📊</div>
          Your Progressive Payout Tiers
        </div>

        <div className="table">
          <div className="table-head">
            <div>TIER</div>
            <div>VISIT RANGE</div>
            <div>YOU PAY (BPS)</div>
            <div>CUSTOMER SEES</div>
          </div>

          {tiers.map((t, idx) => (
            <div className="table-row" key={t.level}>
              <div className="table-strong">{t.level}</div>
              <div className="table-muted">{t.range}</div>

              <div className="table-input-cell">
                <input
                  className={`table-input ${data.payoutPreset !== "custom" ? "locked" : ""}`}
                  value={String(data.payoutBps[idx])}
                  onChange={(e) => updateTier(idx, e.target.value)}
                  inputMode="numeric"
                  aria-label={`BPS for ${t.level}`}
                  disabled={data.payoutPreset !== "custom"}
                />
              </div>

              <div className={`table-muted ${idx === 6 ? "highlight" : ""}`}>
                {bpsToPct(data.payoutBps[idx])} of subtotal
              </div>
            </div>
          ))}
        </div>

        <div className="helper-text" style={{ marginTop: 10 }}>
          💡 BPS = Basis Points (100 BPS = 1%). Applies to the receipt subtotal before tax/tip.
        </div>
      </div>

      {data.payoutPreset !== "custom" ? (
        <div className="helper-text" style={{ marginTop: 8 }}>
          🔒 Select <strong>Custom</strong> to edit payout tiers.
        </div>
      ) : null}

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">🧾</div>
          Receipt Verification Contact
        </div>

        <div className="form-group">
          <label>
            Name of Person Verifying Receipts <span className="required">*</span>
          </label>
          <input
            value={data.verifierName}
            onChange={(e) => setData((p) => ({ ...p, verifierName: e.target.value }))}
            placeholder="Manager name"
            required
          />
          <div className="helper-text">This person will receive receipt alerts and verify authenticity</div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>
              Verification Email <span className="required">*</span>
            </label>
            <input
              value={data.verifierEmail}
              onChange={(e) => setData((p) => ({ ...p, verifierEmail: e.target.value }))}
              placeholder="manager@business.com"
              type="email"
              required
            />
          </div>

          <div className="form-group">
            <label>
              Phone Number <span className="optional">(optional)</span>
            </label>
            <input
              value={data.verifierPhone}
              onChange={(e) => setData((p) => ({ ...p, verifierPhone: formatPhone(e.target.value) }))}
              placeholder="(555) 123-4567"
              inputMode="tel"
            />
          </div>
        </div>
      </div>

      <div className="auto-approval">
        <div className="auto-approval-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <div className="section-icon">✅</div>
            Auto-Approval (Recommended)
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={data.autoApprovalEnabled}
              onChange={(e) => setData((p) => ({ ...p, autoApprovalEnabled: e.target.checked }))}
            />
            <span className="slider" />
          </label>
        </div>

        <div className="auto-approval-body">
          <div className="helper-bullets">
            <div>✓ Speeds up customer payouts</div>
            <div>✓ Reduces manual review work</div>
            <div>✓ You can still dispute suspicious receipts</div>
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label>
              Auto-approve receipts under <span className="required">*</span>
            </label>
            <input
              value={String(data.autoApprovalMax)}
              onChange={(e) =>
                setData((p) => ({
                  ...p,
                  autoApprovalMax: clampInt(e.target.value, 1, 10000),
                }))
              }
              disabled={!data.autoApprovalEnabled}
              inputMode="numeric"
              placeholder="50"
            />
          </div>
        </div>
      </div>
    </form>
  );
}

function PresetCard({
  title,
  subtitle,
  selected,
  onClick,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`preset-card ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className="preset-card-top">
        <div className="preset-title">{title}</div>
        {selected ? <span className="preset-check">✓</span> : null}
      </div>
      <div className="preset-subtitle">{subtitle}</div>
    </button>
  );
}

/* =========================
   STEP 5
========================= */

function Step5({
  data,
  setData,
  ccFeeBps,
  feeBps,
  feeCapCents,
}: {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  ccFeeBps: number;
  feeBps: number;
  feeCapCents: number;
}) {
  const bankActive = data.paymentMethod === "bank";
  const cardActive = data.paymentMethod === "card";
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState("");

  // Fetch a SetupIntent when payment method type changes (or on first render)
  const fetchSetupIntent = useCallback(async () => {
    if (!data.email && !data.businessName) return;
    setStripeLoading(true);
    setStripeError("");
    try {
      const res = await fetch("/api/stripe/create-setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: data.businessName,
          email: data.email,
          paymentMethodType: bankActive ? "us_bank_account" : "card",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setStripeError(err.error || "Failed to initialize payment setup.");
        return;
      }
      const { clientSecret: cs, customerId } = await res.json();
      setClientSecret(cs);
      setData((p) => ({ ...p, stripeCustomerId: customerId, stripeSetupComplete: false, stripePaymentMethodId: "" }));
    } catch {
      setStripeError("Failed to connect to payment provider. Please try again.");
    } finally {
      setStripeLoading(false);
    }
  }, [data.email, data.businessName, bankActive, setData]);

  useEffect(() => {
    fetchSetupIntent();
  }, [fetchSetupIntent]);

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div className="security-badge">
        <span className="security-icon">🔒</span>
        <span>Your payment information is securely handled by Stripe. We never see or store your card details.</span>
      </div>

      <div className="payment-method-selector">
        <button
          type="button"
          className={`payment-method-card ${bankActive ? "selected" : ""}`}
          onClick={() => setData((p) => ({ ...p, paymentMethod: "bank", stripeSetupComplete: false, stripePaymentMethodId: "" }))}
        >
          <div className="payment-badge">Recommended</div>
          <div className="payment-icon">🏛️</div>
          <div className="payment-name">Bank Account</div>
          <div className="payment-fee no-fee">No Processing Fees</div>
        </button>

        <button
          type="button"
          className={`payment-method-card ${cardActive ? "selected" : ""}`}
          onClick={() => setData((p) => ({ ...p, paymentMethod: "card", stripeSetupComplete: false, stripePaymentMethodId: "" }))}
        >
          <div className="payment-icon">💳</div>
          <div className="payment-name">Credit/Debit Card</div>
          <div className="payment-fee has-fee">{bpsToStr(ccFeeBps)} Processing Fee</div>
        </button>
      </div>

      {/* Stripe Payment Element */}
      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">{bankActive ? "🏦" : "💳"}</div>
          {bankActive ? "Bank Account Setup" : "Card Setup"}
        </div>

        {stripeError && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "0.75rem", borderRadius: "10px", color: "#fca5a5", fontSize: "0.85rem", marginBottom: "1rem" }}>
            {stripeError}
          </div>
        )}

        {stripeLoading && (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-medium)" }}>
            Loading payment form...
          </div>
        )}

        {clientSecret && stripePromise && !stripeLoading && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "night",
                variables: {
                  colorPrimary: "#ff6b35",
                  colorBackground: "#fafbfc",
                  colorText: "#1a2332",
                  colorDanger: "#ff6b6b",
                  borderRadius: "10px",
                  fontFamily: "Inter, system-ui, sans-serif",
                },
              },
            }}
          >
            <StripePaymentForm
              data={data}
              setData={setData}
              bankActive={bankActive}
            />
          </Elements>
        )}

        {!stripePromise && (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-medium)" }}>
            Payment setup is not configured. Please contact support.
          </div>
        )}
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">📬</div>
          Billing Address
        </div>

        <label className="same-address-checkbox">
          <input
            type="checkbox"
            checked={data.billingSameAsBusiness}
            onChange={(e) => setData((p) => ({ ...p, billingSameAsBusiness: e.target.checked }))}
          />
          <span>Same as business address</span>
        </label>

        {!data.billingSameAsBusiness ? (
          <div className="billing-fields">
            <div className="form-group">
              <label>
                Street Address <span className="required">*</span>
              </label>
              <input
                value={data.billingStreet}
                onChange={(e) => setData((p) => ({ ...p, billingStreet: e.target.value }))}
                placeholder="123 Main Street"
              />
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label>
                  City <span className="required">*</span>
                </label>
                <input
                  value={data.billingCity}
                  onChange={(e) => setData((p) => ({ ...p, billingCity: e.target.value }))}
                  placeholder="Los Angeles"
                />
              </div>

              <div className="form-group">
                <label>
                  State <span className="required">*</span>
                </label>
                <select
                  value={data.billingState}
                  onChange={(e) => setData((p) => ({ ...p, billingState: e.target.value }))}
                >
                  <option value="">Select</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>
                  ZIP <span className="required">*</span>
                </label>
                <input
                  value={data.billingZip}
                  onChange={(e) => setData((p) => ({ ...p, billingZip: e.target.value }))}
                  placeholder="90210"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="checkbox-field">
        <input
          type="checkbox"
          id="authorize"
          checked={data.authorizeCharges}
          onChange={(e) => setData((p) => ({ ...p, authorizeCharges: e.target.checked }))}
        />
        <label htmlFor="authorize">
          <strong>I authorize LetsGo to charge the following:</strong>
          <ul className="authorization-list">
            <li>
              <strong>Progressive User Payouts:</strong> Based on the business&apos;s agreed upon tier structure
            </li>
            <li>
              <strong>Platform Fee (Basic Package):</strong> {bpsToStr(feeBps)} of subtotal or {centsToStr(feeCapCents)} maximum per redeemed receipt
            </li>
            <li>
              <strong>Monthly Subscription Fees:</strong> If Premium package (and add-ons) selected
            </li>
            <li>
              <strong>Advertising Campaigns:</strong> Any campaigns I selected
            </li>
            <li>
              <strong>Credit Card Processing Fee:</strong> {bpsToStr(ccFeeBps)} if using card payment (waived for ACH/Bank Account)
            </li>
          </ul>
        </label>
      </div>
    </form>
  );
}

// Inner component that has access to Stripe hooks (must be inside <Elements>)
function StripePaymentForm({
  data,
  setData,
  bankActive,
}: {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  bankActive: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const handleConfirmSetup = async () => {
    if (!stripe || !elements) return;
    setConfirming(true);
    setError("");

    try {
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (confirmError) {
        setError(confirmError.message || "Payment setup failed. Please try again.");
      } else if (setupIntent && setupIntent.status === "succeeded") {
        const pmId = typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id || "";
        setData((p) => ({
          ...p,
          stripePaymentMethodId: pmId,
          stripeSetupComplete: true,
          paymentMethod: bankActive ? "bank" : "card",
        }));
      } else if (setupIntent && setupIntent.status === "requires_action") {
        // Bank account verification may require additional steps
        setError("Additional verification required. Please follow the prompts.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "0.75rem", borderRadius: "10px", color: "#fca5a5", fontSize: "0.85rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {data.stripeSetupComplete ? (
        <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "0.75rem", borderRadius: "10px", color: "#6ee7b7", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>✓</span> Payment method saved successfully
        </div>
      ) : (
        <button
          type="button"
          onClick={handleConfirmSetup}
          disabled={!stripe || confirming}
          className="btn btn-primary"
          style={{ width: "100%", marginTop: "0.5rem" }}
        >
          {confirming ? "Verifying..." : "Save Payment Method"}
        </button>
      )}
    </div>
  );
}

/* =========================
   STEP 6
========================= */

function Step6({
  data,
  setData,
  pkgPricing,
  authUser,
}: {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  pkgPricing: { tpms_monthly_cents: number };
  authUser: User | null;
}) {
  const [docUploading, setDocUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function uploadToStorage(file: File, folder: string): Promise<string> {
    const userId = authUser?.id || "anonymous";
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${folder}/${timestamp}-${safeName}`;

    const { error } = await supabaseBrowser.storage
      .from("onboarding-documents")
      .upload(path, file, { upsert: true });

    if (error) throw new Error(error.message);

    // Create a signed URL valid for 1 year (admin needs long-term access)
    const { data: urlData, error: urlError } = await supabaseBrowser.storage
      .from("onboarding-documents")
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    if (urlError || !urlData?.signedUrl) throw new Error("Failed to generate file URL");

    return urlData.signedUrl;
  }

  async function onDocFile(file: File | null) {
    if (!file) return;
    setDocUploading(true);
    setUploadError("");
    try {
      const url = await uploadToStorage(file, "verification");
      setData((p) => ({
        ...p,
        verificationDocFile: { name: file.name, size: file.size, type: file.type, url },
      }));
    } catch (e) {
      setUploadError(`Failed to upload document: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setDocUploading(false);
    }
  }

  async function onLogoFile(file: File | null) {
    if (!file) return;
    setLogoUploading(true);
    setUploadError("");
    try {
      const url = await uploadToStorage(file, "logo");
      setData((p) => ({
        ...p,
        businessLogoFile: { name: file.name, size: file.size, type: file.type, url },
      }));
    } catch (e) {
      setUploadError(`Failed to upload logo: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setLogoUploading(false);
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">🧾</div>
          Verify Your Business
        </div>

        <div className="doc-type-stack">
          <DocTypeCard
            title="Business License"
            subtitle="Upload your current business license document"
            selected={data.verificationDocType === "business_license"}
            onClick={() => setData((p) => ({ ...p, verificationDocType: "business_license" }))}
          />
          <DocTypeCard
            title="EIN Certificate"
            subtitle="IRS Employer Identification Number document"
            selected={data.verificationDocType === "ein_certificate"}
            onClick={() => setData((p) => ({ ...p, verificationDocType: "ein_certificate" }))}
          />
          <DocTypeCard
            title="Utility Bill"
            subtitle="Recent bill matching business name and address"
            selected={data.verificationDocType === "utility_bill"}
            onClick={() => setData((p) => ({ ...p, verificationDocType: "utility_bill" }))}
          />
        </div>

        {uploadError && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "0.75rem", borderRadius: "10px", color: "#fca5a5", fontSize: "0.85rem", marginBottom: "1rem" }}>
            {uploadError}
          </div>
        )}

        <FileDrop
          label="Upload Document"
          hint="PDF, JPG, PNG accepted (max 10MB)"
          onFile={onDocFile}
          fileMeta={data.verificationDocFile}
          uploading={docUploading}
        />
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">🖼️</div>
          Business Logo (Required)
        </div>

        <div className="helper-bullets">
          <div>✓ Square format (500x500px minimum)</div>
          <div>✓ Clear, high-quality image</div>
          <div>✓ Your business logo or icon</div>
        </div>

        <FileDrop
          label="Upload Logo"
          hint="JPG, PNG accepted (max 5MB)"
          onFile={onLogoFile}
          fileMeta={data.businessLogoFile}
          accept="image/*"
          uploading={logoUploading}
        />
      </div>
    </form>
  );
}

function DocTypeCard({
  title,
  subtitle,
  selected,
  onClick,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`doc-type-card ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className={`doc-radio ${selected ? "on" : ""}`} />
      <div className="doc-info">
        <div className="doc-title">{title}</div>
        <div className="doc-subtitle">{subtitle}</div>
      </div>
    </button>
  );
}

function FileDrop({
  label,
  hint,
  onFile,
  fileMeta,
  accept,
  uploading,
}: {
  label: string;
  hint: string;
  onFile: (f: File | null) => void;
  fileMeta?: UploadedFileMeta;
  accept?: string;
  uploading?: boolean;
}) {
  return (
    <div className="file-drop">
      <label className="file-drop-inner" style={uploading ? { opacity: 0.6, pointerEvents: "none" } : undefined}>
        <div className="file-icon">{uploading ? "⏳" : "📁"}</div>
        <div className="file-label">{uploading ? "Uploading..." : label}</div>
        <div className="file-hint">{hint}</div>
        <input
          type="file"
          className="file-input"
          accept={accept}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          disabled={uploading}
        />
      </label>

      {fileMeta ? (
        <div className="file-meta" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {fileMeta.url ? (
            <span style={{ color: "#34d399" }}>✓</span>
          ) : null}
          <span>
            <strong>{fileMeta.url ? "Uploaded:" : "Selected:"}</strong> {fileMeta.name}{" "}
            <span className="file-meta-muted">({Math.round(fileMeta.size / 1024)} KB)</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* =========================
   STEP 7
========================= */

function Step7({
  data,
  setData,
  reviewPlanFees,
  feeBps,
  feeCapCents,
  ccFeeBps,
  pkgPricing,
  tiers: tierDefs,
}: {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  reviewPlanFees: {
    planName: string;
    monthly: number;
    perVisit: string;
    paymentMethod: string;
    processingFee: string;
    adsTotal: number;
    ads: AdOption[];
  };
  feeBps: number;
  feeCapCents: number;
  ccFeeBps: number;
  pkgPricing: { tpms_monthly_cents: number };
  tiers: { level: string; range: string }[];
}) {
  const tiers = useMemo(() => {
    return tierDefs.map((t, idx) => ({
      ...t,
      bps: data.payoutBps[idx],
    }));
  }, [data.payoutBps, tierDefs]);

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">📋</div>
          Your Plan Summary
        </div>

        <div className="plan-summary">
          <div className="summary-title">{reviewPlanFees.planName}</div>
          <div className="summary-table">
            <div className="summary-row">
              <span className="summary-label">Monthly Fee</span>
              <span className="summary-value">{money(reviewPlanFees.monthly)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Per-Visit Fee</span>
              <span className="summary-value">{reviewPlanFees.perVisit}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Payment Method</span>
              <span className="summary-value">{reviewPlanFees.paymentMethod}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Processing Fee</span>
              <span className="summary-value highlight">{reviewPlanFees.processingFee}</span>
            </div>
          </div>

          <div className="helper-text" style={{ marginTop: 12 }}>
            Premium add-ons and advertising selections are reflected below (if selected).
          </div>
        </div>

        <div className="plan-summary" style={{ marginTop: 16 }}>
          <div className="summary-title">Your Progressive Payout Structure</div>

          <div className="payout-tiers">
            {tiers.map((t, idx) => (
              <div className="payout-tier-row" key={t.level}>
                <span className="tier-name">
                  {t.level} ({t.range})
                </span>
                <span className={`tier-value ${idx === 6 ? "highlight" : ""}`}>{bpsToPct(t.bps)} of subtotal</span>
              </div>
            ))}
          </div>

          <div className="helper-text" style={{ marginTop: 12, textAlign: "center" }}>
            💰 <strong>These are customer rewards</strong> tied to repeat visits at your business only.
          </div>
        </div>

        <div className="plan-summary" style={{ marginTop: 16 }}>
          <div className="summary-title">📣 Advertising Package</div>

          {reviewPlanFees.ads.length === 0 ? (
            <div className="ad-empty">No campaigns selected. You can add advertising later anytime.</div>
          ) : (
            <div className="ad-summary">
              <div className="ad-summary-note">Only selected campaigns will be charged.</div>
              <div className="ad-summary-list">
                {reviewPlanFees.ads.map((ad) => (
                  <div className="ad-summary-item" key={ad.id}>
                    <div className="ad-summary-info">
                      <span className="ad-summary-label">{ad.title}</span>
                      <span className="ad-summary-desc">{ad.desc}</span>
                    </div>
                    <span className="ad-summary-price">{money(ad.price).replace(".00", "")}</span>
                  </div>
                ))}
                <div className="ad-total-row">
                  <span>Total Selected</span>
                  <strong>{money(reviewPlanFees.adsTotal).replace(".00", "")}</strong>
                </div>
              </div>
              <div className="helper-text" style={{ marginTop: 8, fontSize: "0.78rem", color: "#8892a6" }}>
                Base rates shown. Hot Day surge fees may apply when scheduling during high-demand dates.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">📢</div>
          Marketing Permissions
        </div>

        <div className="permissions-list">
          <label className="permission-item">
            <input
              type="checkbox"
              checked={data.marketingPermissions.userUploads}
              onChange={(e) =>
                setData((p) => ({
                  ...p,
                  marketingPermissions: { ...p.marketingPermissions, userUploads: e.target.checked },
                }))
              }
            />
            <span>
              <strong>Allow users to post videos/photos</strong> from their experiences at your business
            </span>
          </label>

          <label className="permission-item">
            <input
              type="checkbox"
              checked={data.marketingPermissions.featureInDiscovery}
              onChange={(e) =>
                setData((p) => ({
                  ...p,
                  marketingPermissions: { ...p.marketingPermissions, featureInDiscovery: e.target.checked },
                }))
              }
            />
            <span>
              <strong>Feature my business</strong> in Let’sGo discovery feeds
            </span>
          </label>

          <label className="permission-item">
            <input
              type="checkbox"
              checked={data.marketingPermissions.abTesting}
              onChange={(e) =>
                setData((p) => ({
                  ...p,
                  marketingPermissions: { ...p.marketingPermissions, abTesting: e.target.checked },
                }))
              }
            />
            <span>
              <strong>Allow A/B testing</strong> to optimize my profile performance
            </span>
          </label>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">✨</div>
          Optional Services
        </div>

        <div className="optional-services">
          <label className="permission-item">
            <input
              type="checkbox"
              checked={data.optionalServices.profileManagementInterest}
              onChange={(e) =>
                setData((p) => ({
                  ...p,
                  optionalServices: { ...p.optionalServices, profileManagementInterest: e.target.checked },
                }))
              }
            />
            <span>
              <strong>Total Profile Management Services (TPMS) — {centsToStr(pkgPricing.tpms_monthly_cents)}/month.</strong>{" "}
              We&#39;ll handle receipt reviews and approvals for you, keep your profile updated with fresh uploads, and
              manage your payout ladder settings for optimal performance.
            </span>
          </label>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <div className="section-icon">📜</div>
          Legal Agreements
        </div>

        <div className="legal-agreements">
          <label className="agreement-item">
            <input
              type="checkbox"
              checked={data.legal.terms}
              onChange={(e) => setData((p) => ({ ...p, legal: { ...p.legal, terms: e.target.checked } }))}
            />
            <span>
              I have read and agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="agreement-link">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="agreement-link">
                Privacy Policy
              </a>
            </span>
          </label>

          <label className="agreement-item">
            <input
              type="checkbox"
              checked={data.legal.billingPolicy}
              onChange={(e) => setData((p) => ({ ...p, legal: { ...p.legal, billingPolicy: e.target.checked } }))}
            />
            <span>
              I accept the{" "}
              <a href="/terms#14" target="_blank" rel="noopener noreferrer" className="agreement-link">
                Business Billing Policy
              </a>
              , including Hot Day surge pricing on advertising campaigns scheduled during high-demand dates
            </span>
          </label>

          <label className="agreement-item">
            <input
              type="checkbox"
              checked={data.legal.contentPolicy}
              onChange={(e) => setData((p) => ({ ...p, legal: { ...p.legal, contentPolicy: e.target.checked } }))}
            />
            <span>
              I understand the{" "}
              <a href="/terms#19" target="_blank" rel="noopener noreferrer" className="agreement-link">
                Content Policy
              </a>
            </span>
          </label>

          <label className="agreement-item">
            <input
              type="checkbox"
              checked={data.legal.fraud}
              onChange={(e) => setData((p) => ({ ...p, legal: { ...p.legal, fraud: e.target.checked } }))}
            />
            <span>
              I acknowledge that <strong>fraudulent receipt submissions</strong> will result in disputes and possible
              account suspension
            </span>
          </label>
        </div>
      </div>

      <div className="signature-section">
        <div className="signature-title">🖊️ Digital Signature</div>

        <input
          type="text"
          className="signature-input"
          value={data.signatureName}
          onChange={(e) => setData((p) => ({ ...p, signatureName: e.target.value }))}
          placeholder="Type your full name to sign"
        />

        <label className="signature-checkbox">
          <input
            type="checkbox"
            checked={data.signatureBinding}
            onChange={(e) => setData((p) => ({ ...p, signatureBinding: e.target.checked }))}
          />
          <span>I certify that I am authorized to bind this business and that this signature is legally binding.</span>
        </label>
      </div>
    </form>
  );
}

/* =========================
   CONSTANTS
========================= */

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

// TIERS constant removed — now derived dynamically from platform_settings visit thresholds