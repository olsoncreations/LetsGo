"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

// ============================================
// City Map Animation Component
// ============================================
const CityMapAnimation = () => {
  const [activeStop, setActiveStop] = useState(0);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    const duration = 12000;
    const timer = setInterval(() => {
      const elapsed = Date.now() - mountTime.current;
      const progress = ((elapsed % duration) / duration) * 100;
      if (progress <= 5) setActiveStop(1);
      else if (progress >= 36 && progress <= 44) setActiveStop(2);
      else if (progress >= 65 && progress <= 73) setActiveStop(3);
      else if (progress >= 95) setActiveStop(4);
      else setActiveStop(0);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  const pathD = "M 120,380 L 120,280 L 250,280 L 250,180 L 420,180 L 420,260 L 580,260 L 580,380";

  const getStopStyle = (stopNumber: number) => ({
    transform: activeStop === stopNumber ? "scale(1.2)" : "scale(1)",
    filter: activeStop === stopNumber ? "brightness(1.4)" : "brightness(1)",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  });

  const getMarkerStyle = (stopNumber: number) => ({
    transform: activeStop === stopNumber ? "scale(1.4)" : "scale(1)",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  });

  const streetGrid = useMemo(() => {
    // Seeded random with rounding to avoid hydration mismatch
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 9999) * 10000;
      const val = x - Math.floor(x);
      return Math.round(val * 100) / 100; // Round to 2 decimal places
    };

    const streets: React.ReactElement[] = [];
    const mainColor = "#4dd0e1";
    const lightColor = "#80deea";
    const fineColor = "#b2ebf2";

    const neighborhoods = [
      { x: 0, y: 0, w: 200, h: 150, density: 12 },
      { x: 180, y: 0, w: 180, h: 180, density: 10 },
      { x: 340, y: 0, w: 200, h: 160, density: 11 },
      { x: 520, y: 0, w: 180, h: 170, density: 13 },
      { x: 0, y: 130, w: 160, h: 140, density: 14 },
      { x: 140, y: 160, w: 200, h: 150, density: 9 },
      { x: 320, y: 140, w: 180, h: 170, density: 12 },
      { x: 480, y: 150, w: 220, h: 160, density: 10 },
      { x: 0, y: 250, w: 180, h: 200, density: 11 },
      { x: 160, y: 290, w: 200, h: 160, density: 13 },
      { x: 340, y: 280, w: 190, h: 170, density: 10 },
      { x: 510, y: 290, w: 190, h: 160, density: 12 },
    ];

    let seedCounter = 0;
    neighborhoods.forEach((hood, hoodIndex) => {
      const gridSize = hood.density;
      for (let i = 0; i <= hood.h / gridSize; i++) {
        const y = hood.y + i * gridSize;
        const variance = Math.round(Math.sin(i * 0.7 + hoodIndex) * 300) / 100;
        const x1 = Math.round(hood.x + Math.abs(variance));
        const x2 = Math.round(hood.x + hood.w - Math.abs(variance * 0.5));
        if (y < 450) {
          streets.push(
            <line
              key={`h-${hoodIndex}-${i}`}
              x1={x1}
              y1={Math.round(y + variance * 0.3)}
              x2={x2}
              y2={Math.round(y - variance * 0.2)}
              stroke={i % 3 === 0 ? mainColor : lightColor}
              strokeWidth={i % 3 === 0 ? 1.5 : 0.8}
              opacity={Math.round((0.7 + seededRandom(seedCounter++) * 0.3) * 100) / 100}
            />
          );
        }
      }
      for (let i = 0; i <= hood.w / gridSize; i++) {
        const x = hood.x + i * gridSize;
        const variance = Math.round(Math.cos(i * 0.8 + hoodIndex) * 300) / 100;
        const y1 = Math.round(hood.y + Math.abs(variance));
        const y2 = Math.round(hood.y + hood.h - Math.abs(variance * 0.5));
        if (x < 700) {
          streets.push(
            <line
              key={`v-${hoodIndex}-${i}`}
              x1={Math.round(x + variance * 0.3)}
              y1={y1}
              x2={Math.round(x - variance * 0.2)}
              y2={y2}
              stroke={i % 4 === 0 ? mainColor : lightColor}
              strokeWidth={i % 4 === 0 ? 1.5 : 0.8}
              opacity={Math.round((0.6 + seededRandom(seedCounter++) * 0.3) * 100) / 100}
            />
          );
        }
      }
    });

    const arterials = [
      { x1: 0, y1: 80, x2: 700, y2: 85 },
      { x1: 0, y1: 180, x2: 700, y2: 175 },
      { x1: 0, y1: 280, x2: 700, y2: 280 },
      { x1: 0, y1: 380, x2: 700, y2: 375 },
      { x1: 120, y1: 0, x2: 125, y2: 450 },
      { x1: 250, y1: 0, x2: 245, y2: 450 },
      { x1: 420, y1: 0, x2: 420, y2: 450 },
      { x1: 580, y1: 0, x2: 575, y2: 450 },
    ];

    arterials.forEach((road, i) => {
      streets.push(
        <line key={`arterial-${i}`} x1={road.x1} y1={road.y1} x2={road.x2} y2={road.y2} stroke={mainColor} strokeWidth="3" opacity="0.95" />
      );
    });

    streets.push(
      <path key="highway1" d="M 0,420 Q 100,380 200,350 Q 350,300 450,280 Q 550,260 650,200 Q 680,180 700,150" fill="none" stroke={mainColor} strokeWidth="5" opacity="0.9" />,
      <path key="highway2" d="M 0,320 Q 80,310 150,280 Q 280,220 400,200 Q 520,180 700,120" fill="none" stroke={mainColor} strokeWidth="4" opacity="0.85" />,
      <path key="river" d="M 50,0 Q 40,80 55,150 Q 70,220 50,300 Q 30,380 45,450" fill="none" stroke="#90caf9" strokeWidth="20" opacity="0.5" />,
      <path key="river2" d="M 650,0 Q 660,60 640,130 Q 620,200 650,280 Q 680,360 660,450" fill="none" stroke="#90caf9" strokeWidth="15" opacity="0.4" />
    );

    for (let i = 0; i < 80; i++) {
      const x1 = Math.round(seededRandom(i * 4) * 700);
      const y1 = Math.round(seededRandom(i * 4 + 1) * 450);
      const length = Math.round(20 + seededRandom(i * 4 + 2) * 60);
      const isHorizontal = seededRandom(i * 4 + 3) > 0.5;
      streets.push(
        <line
          key={`fine-${i}`}
          x1={x1}
          y1={y1}
          x2={isHorizontal ? x1 + length : x1}
          y2={isHorizontal ? y1 : y1 + length}
          stroke={fineColor}
          strokeWidth="0.5"
          opacity={Math.round((0.4 + seededRandom(i * 4 + 4) * 0.3) * 100) / 100}
        />
      );
    }

    return streets;
  }, []);

  const parks = useMemo(
    () => [
      <ellipse key="park1" cx="90" cy="100" rx="35" ry="25" fill="#c8e6c9" opacity="0.6" />,
      <ellipse key="park2" cx="620" cy="80" rx="50" ry="35" fill="#c8e6c9" opacity="0.5" />,
      <rect key="park3" x="300" y="320" width="60" height="45" rx="8" fill="#c8e6c9" opacity="0.5" />,
      <ellipse key="park4" cx="500" cy="400" rx="40" ry="28" fill="#c8e6c9" opacity="0.5" />,
      <ellipse key="park5" cx="180" cy="380" rx="30" ry="22" fill="#c8e6c9" opacity="0.4" />,
      <rect key="park6" x="380" y="60" width="45" height="35" rx="6" fill="#c8e6c9" opacity="0.45" />,
    ],
    []
  );

  return (
    <svg viewBox="0 0 700 450" style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="strongGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="activeGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.6" />
        </filter>
        <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="bottomFade" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="70%" stopColor="#0d0015" stopOpacity="0" />
          <stop offset="100%" stopColor="#0d0015" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect width="700" height="450" fill="#f8f9fa" />
      {parks}
      {streetGrid}

      {/* Route path */}
      <path d={pathD} fill="none" stroke="rgba(26, 10, 46, 0.5)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathD} fill="none" stroke="#ffd93d" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" filter="url(#routeGlow)" />
      <path d={pathD} fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="15 20" />
      <path id="walkPath" d={pathD} fill="none" stroke="transparent" />

      {/* Stop 1: Rosie's Diner */}
      <g transform="translate(120, 380)">
        <g style={getMarkerStyle(1)} filter={activeStop === 1 ? "url(#activeGlow)" : "url(#strongGlow)"}>
          <circle r={activeStop === 1 ? 18 : 14} fill="#ff6b6b" />
          <circle r={activeStop === 1 ? 11 : 8} fill="#1a0a2e" />
          <circle r={activeStop === 1 ? 5 : 3} fill="#ff6b6b" />
        </g>
      </g>
      <g transform="translate(120, 318)">
        <g style={getStopStyle(1)} filter="url(#dropShadow)">
          <rect x="-42" y="-32" width="84" height="62" rx="10" fill="#1a0a2e" stroke="#ff6b6b" strokeWidth={activeStop === 1 ? 3 : 2} filter={activeStop === 1 ? "url(#activeGlow)" : "url(#neonGlow)"} />
          <text x="0" y="-4" textAnchor="middle" fontSize="22">🍔</text>
          <text x="0" y="14" textAnchor="middle" fontSize="8" fill="#ff6b6b" fontFamily="'Outfit', sans-serif" fontWeight="700">ROSIE&apos;S</text>
          <text x="0" y="24" textAnchor="middle" fontSize="6" fill="#ff6b6b" fontFamily="'Outfit', sans-serif" fontWeight="500" opacity="0.85">DINER</text>
        </g>
      </g>

      {/* Stop 2: Movin Movies */}
      <g transform="translate(250, 180)">
        <g style={getMarkerStyle(2)} filter={activeStop === 2 ? "url(#activeGlow)" : "url(#strongGlow)"}>
          <circle r={activeStop === 2 ? 18 : 14} fill="#00bfff" />
          <circle r={activeStop === 2 ? 11 : 8} fill="#1a0a2e" />
          <circle r={activeStop === 2 ? 5 : 3} fill="#00bfff" />
        </g>
      </g>
      <g transform="translate(250, 118)">
        <g style={getStopStyle(2)} filter="url(#dropShadow)">
          <rect x="-42" y="-32" width="84" height="62" rx="10" fill="#1a0a2e" stroke="#00bfff" strokeWidth={activeStop === 2 ? 3 : 2} filter={activeStop === 2 ? "url(#activeGlow)" : "url(#neonGlow)"} />
          <text x="0" y="-4" textAnchor="middle" fontSize="18">📼🍿</text>
          <text x="0" y="14" textAnchor="middle" fontSize="8" fill="#00bfff" fontFamily="'Outfit', sans-serif" fontWeight="700">MOVIN&apos;</text>
          <text x="0" y="24" textAnchor="middle" fontSize="6" fill="#00bfff" fontFamily="'Outfit', sans-serif" fontWeight="500" opacity="0.85">MOVIES</text>
        </g>
      </g>

      {/* Stop 3: Plaza Lanes */}
      <g transform="translate(420, 260)">
        <g style={getMarkerStyle(3)} filter={activeStop === 3 ? "url(#activeGlow)" : "url(#strongGlow)"}>
          <circle r={activeStop === 3 ? 18 : 14} fill="#8a2be2" />
          <circle r={activeStop === 3 ? 11 : 8} fill="#1a0a2e" />
          <circle r={activeStop === 3 ? 5 : 3} fill="#8a2be2" />
        </g>
      </g>
      <g transform="translate(490, 240)">
        <g style={getStopStyle(3)} filter="url(#dropShadow)">
          <rect x="-42" y="-32" width="84" height="62" rx="10" fill="#1a0a2e" stroke="#8a2be2" strokeWidth={activeStop === 3 ? 3 : 2} filter={activeStop === 3 ? "url(#activeGlow)" : "url(#neonGlow)"} />
          <text x="0" y="-4" textAnchor="middle" fontSize="22">🎳</text>
          <text x="0" y="14" textAnchor="middle" fontSize="8" fill="#8a2be2" fontFamily="'Outfit', sans-serif" fontWeight="700">PLAZA</text>
          <text x="0" y="24" textAnchor="middle" fontSize="6" fill="#8a2be2" fontFamily="'Outfit', sans-serif" fontWeight="500" opacity="0.85">LANES</text>
        </g>
      </g>

      {/* Stop 4: The Golden Hour */}
      <g transform="translate(580, 380)">
        <g style={getMarkerStyle(4)} filter={activeStop === 4 ? "url(#activeGlow)" : "url(#strongGlow)"}>
          <circle r={activeStop === 4 ? 18 : 14} fill="#ffd93d" />
          <circle r={activeStop === 4 ? 11 : 8} fill="#1a0a2e" />
          <circle r={activeStop === 4 ? 5 : 3} fill="#ffd93d" />
        </g>
      </g>
      <g transform="translate(580, 318)">
        <g style={getStopStyle(4)} filter="url(#dropShadow)">
          <rect x="-42" y="-32" width="84" height="62" rx="10" fill="#1a0a2e" stroke="#ffd93d" strokeWidth={activeStop === 4 ? 3 : 2} filter={activeStop === 4 ? "url(#activeGlow)" : "url(#neonGlow)"} />
          <text x="0" y="-4" textAnchor="middle" fontSize="22">🍸</text>
          <text x="0" y="14" textAnchor="middle" fontSize="8" fill="#ffd93d" fontFamily="'Outfit', sans-serif" fontWeight="700">THE GOLDEN</text>
          <text x="0" y="24" textAnchor="middle" fontSize="6" fill="#ffd93d" fontFamily="'Outfit', sans-serif" fontWeight="500" opacity="0.85">HOUR</text>
        </g>
      </g>

      {/* Animated car */}
      <g filter="url(#strongGlow)">
        <g>
          <animateMotion dur="12s" repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1">
            <mpath href="#walkPath" />
          </animateMotion>
          <rect x="-14" y="-7" width="28" height="14" rx="5" fill="#000" opacity="0.3" transform="translate(2, 2)" />
          <rect x="-14" y="-7" width="28" height="14" rx="5" fill="#ff6b6b" />
          <rect x="-6" y="-5" width="12" height="10" rx="3" fill="#1a0a2e" opacity="0.4" />
          <rect x="2" y="-4" width="5" height="8" rx="2" fill="#87CEEB" opacity="0.9" />
          <rect x="-7" y="-4" width="4" height="8" rx="2" fill="#87CEEB" opacity="0.7" />
          <circle cx="12" cy="-4" r="2" fill="#ffd93d" />
          <circle cx="12" cy="4" r="2" fill="#ffd93d" />
          <circle cx="-12" cy="-4" r="1.5" fill="#ff0000" />
          <circle cx="-12" cy="4" r="1.5" fill="#ff0000" />
        </g>
      </g>

      <rect x="0" y="350" width="700" height="100" fill="url(#bottomFade)" />
    </svg>
  );
};

// ============================================
// Auth Modal Component
// ============================================
type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  type: "business" | "user";
  mode: "signin" | "signup";
  onSuccess: (userId: string, hasExistingBusiness?: boolean, businessId?: string) => void;
  influencerCode: string;
  influencerName: string;
  influencerValid: boolean;
};

function AuthModal({ isOpen, onClose, type, mode: initialMode, onSuccess, influencerCode: initialInfluencerCode, influencerName: initialInfluencerName, influencerValid: initialInfluencerValid }: AuthModalProps) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Influencer referral code
  const [refCode, setRefCode] = useState(initialInfluencerCode);
  const [refName, setRefName] = useState(initialInfluencerName);
  const [refValid, setRefValid] = useState(initialInfluencerValid);
  const [refExpanded, setRefExpanded] = useState(false);
  const [refChecking, setRefChecking] = useState(false);
  const refTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync props when they update (e.g. URL code validated after mount)
  useEffect(() => {
    if (initialInfluencerCode) setRefCode(initialInfluencerCode);
    if (initialInfluencerName) setRefName(initialInfluencerName);
    setRefValid(initialInfluencerValid);
  }, [initialInfluencerCode, initialInfluencerName, initialInfluencerValid]);

  const validateRefCode = useCallback((code: string) => {
    if (refTimer.current) clearTimeout(refTimer.current);
    const trimmed = code.trim();
    if (!trimmed) { setRefValid(false); setRefName(""); return; }
    setRefChecking(true);
    refTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/influencers/validate?code=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.valid) { setRefValid(true); setRefName(data.name); }
        else { setRefValid(false); setRefName(""); }
      } catch { setRefValid(false); setRefName(""); }
      finally { setRefChecking(false); }
    }, 600);
  }, []);

  useEffect(() => {
    setMode(initialMode);
    setError("");
    setMessage("");
    setShowEmailSent(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const colors = type === "business" ? { primary: "#00bfff", secondary: "#8a2be2" } : { primary: "#ff6b6b", secondary: "#ffd93d" };

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (type === "user") {
      if (!email || !password || !firstName || !lastName || !zipCode || !phone) {
        setError("Please fill in all fields.");
        return;
      }
      if (firstName.trim().length < 1 || lastName.trim().length < 1) {
        setError("Please enter a valid first and last name.");
        return;
      }
      if (firstName.trim().length > 50 || lastName.trim().length > 50) {
        setError("Name is too long (50 characters max).");
        return;
      }
      if (!/^[a-zA-Z\s'-]+$/.test(firstName.trim()) || !/^[a-zA-Z\s'-]+$/.test(lastName.trim())) {
        setError("Name can only contain letters, spaces, hyphens, and apostrophes.");
        return;
      }
      if (!/^\d{5}$/.test(zipCode)) {
        setError("Please enter a valid 5-digit zip code.");
        return;
      }
      const digitsOnly = phone.replace(/\D/g, "");
      if (digitsOnly.length !== 10) {
        setError("Please enter a valid 10-digit phone number.");
        return;
      }
    } else {
      if (!email || !password || !firstName || !lastName || !zipCode || !phone) {
        setError("Please fill in all fields.");
        return;
      }
      if (firstName.trim().length < 1 || lastName.trim().length < 1) {
        setError("Please enter a valid first and last name.");
        return;
      }
      if (!/^\d{5}$/.test(zipCode)) {
        setError("Please enter a valid 5-digit zip code.");
        return;
      }
      const digitsOnly = phone.replace(/\D/g, "");
      if (digitsOnly.length !== 10) {
        setError("Please enter a valid 10-digit phone number.");
        return;
      }
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!agreedToTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    setLoading(true);
    try {
      const metadata = type === "user"
        ? {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`,
            zip_code: zipCode.trim(),
            phone: phone.replace(/\D/g, ""),
            user_type: type,
          }
        : {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`,
            zip_code: zipCode.trim(),
            phone: phone.replace(/\D/g, ""),
            user_type: type,
          };

      const { data, error: signUpError } = await supabaseBrowser.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });

      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("user_already_exists") || msg.includes("duplicate") || msg.includes("already exists")) {
          setError("An account with this email already exists. Try signing in instead.");
        } else if (msg.includes("valid email") || msg.includes("invalid email")) {
          setError("Please enter a valid email address.");
        } else if (msg.includes("password") && msg.includes("short")) {
          setError("Password must be at least 6 characters.");
        } else {
          setError(signUpError.message);
        }
        return;
      }

      // Save profile data via server-side API (bypasses RLS, works even without session)
      if (data.user) {
        const profilePayload: Record<string, string> = {
          user_id: data.user.id,
          user_type: type,
        };
        if (type === "user") {
          profilePayload.first_name = firstName.trim();
          profilePayload.last_name = lastName.trim();
          profilePayload.full_name = `${firstName.trim()} ${lastName.trim()}`;
          profilePayload.zip_code = zipCode.trim();
          profilePayload.phone = phone.replace(/\D/g, "");
        } else {
          profilePayload.first_name = firstName.trim();
          profilePayload.last_name = lastName.trim();
          profilePayload.full_name = `${firstName.trim()} ${lastName.trim()}`;
          profilePayload.zip_code = zipCode.trim();
          profilePayload.phone = phone.replace(/\D/g, "");
        }
        const profileRes = await fetch("/api/profiles/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profilePayload),
        });
        if (!profileRes.ok) {
          const errText = await profileRes.text();
          console.error("Failed to save profile:", errText);
          setError("Account created but profile save failed. Please contact support if your name or zip code are missing.");
          setLoading(false);
          return;
        }
      }

      // Attribute signup to influencer (don't block signup, but log failures)
      if (refCode && refValid && data.session) {
        fetch("/api/influencers/attribute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ code: refCode }),
        }).then(async (res) => {
          if (!res.ok) {
            console.error("Influencer attribution failed:", await res.text());
          }
        }).catch((err) => {
          console.error("Influencer attribution network error:", err);
        });
      }

      if (data.user && !data.session) {
        setShowEmailSent(true);
      } else if (data.session) {
        onSuccess(data.user!.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: signInError } = await supabaseBrowser.auth.signInWithPassword({ email, password });

      if (signInError) {
        console.error("Sign in error:", signInError);
        const msg = signInError.message.toLowerCase();
        if (msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("wrong password") || msg.includes("not found")) {
          setError("Incorrect email or password. Please try again.");
        } else if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
          setError("Your email hasn't been confirmed yet. Check your inbox for a confirmation link.");
        } else if (msg.includes("too many requests") || msg.includes("rate limit")) {
          setError("Too many attempts. Please wait a moment and try again.");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        // Only check business_users for business sign-ins
        let businessId: string | undefined;
        if (type === "business") {
          try {
            const res = await fetch(`/api/auth/check-business`, {
              headers: { Authorization: `Bearer ${data.session.access_token}` },
            });
            const { businessId: foundId } = await res.json();
            if (foundId) {
              businessId = foundId;
            }
          } catch {
            // business_users check failed, continue without business context
          }
        }

        onSuccess(data.user.id, !!businessId, businessId);
      }
    } catch (err: unknown) {
      console.error("Unexpected error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "420px",
          margin: "auto 0",
          background: "linear-gradient(135deg, #0d0015 0%, #1a0a2e 100%)",
          border: `1px solid ${colors.primary}40`,
          borderRadius: "20px",
          padding: "2rem",
          boxShadow: `0 0 60px ${colors.primary}30`,
          flexShrink: 0,
        }}
      >
        {showEmailSent ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✉️</div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "white", marginBottom: "0.75rem" }}>
              Signup Submitted!
            </h2>
            <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              Please check your email for a verification link to complete your registration.
            </p>
            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", marginBottom: "1.5rem" }}>
              Don&apos;t see it? Check your spam or junk folder.
            </p>
            <button
              type="button"
              onClick={() => { setShowEmailSent(false); setMode("signin"); }}
              style={{
                width: "100%",
                padding: "0.85rem",
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                border: "none",
                borderRadius: "12px",
                color: "white",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Got it — Sign In
            </button>
          </div>
        ) : (<>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem", color: "white", textAlign: "center" }}>
          {type === "business" ? "Business & LetsGo Sales Rep Portal" : "Explorer & LetsGo Influencer Portal"}
        </h2>
        <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.6)", textAlign: "center", marginBottom: "1.5rem" }}>
          {mode === "signin" ? "Sign in to continue" : "Create your account"}
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "0.25rem" }}>
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(""); setMessage(""); }}
            style={{
              flex: 1,
              padding: "0.75rem",
              background: mode === "signin" ? `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` : "transparent",
              border: "none",
              borderRadius: "8px",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); setMessage(""); }}
            style={{
              flex: 1,
              padding: "0.75rem",
              background: mode === "signup" ? `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` : "transparent",
              border: "none",
              borderRadius: "8px",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "0.75rem", borderRadius: "10px", color: "#fca5a5", fontSize: "0.85rem", marginBottom: "1rem" }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "0.75rem", borderRadius: "10px", color: "#6ee7b7", fontSize: "0.85rem", marginBottom: "1rem" }}>
            {message}
          </div>
        )}

        {/* Invited by banner */}
        {mode === "signup" && refValid && refName && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            borderRadius: 10, marginBottom: "0.5rem",
            background: "rgba(138,43,226,0.12)", border: "1px solid rgba(138,43,226,0.3)",
          }}>
            <span style={{ fontSize: 18 }}>🎉</span>
            <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
              Invited by <span style={{ color: "#bf5fff" }}>{refName}</span>
            </span>
          </div>
        )}

        <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {mode === "signup" && type === "business" && (
            <>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.375rem" }}>First Name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" required disabled={loading} style={{ width: "100%", padding: "0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", fontSize: "0.95rem" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.375rem" }}>Last Name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" required disabled={loading} style={{ width: "100%", padding: "0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", fontSize: "0.95rem" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.375rem" }}>Zip Code</label>
                <input type="text" inputMode="numeric" value={zipCode} onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="90210" required disabled={loading} style={{ width: "100%", padding: "0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", fontSize: "0.95rem" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.375rem" }}>Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => { const digits = e.target.value.replace(/\D/g, "").slice(0, 10); const formatted = digits.length > 6 ? `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}` : digits.length > 3 ? `(${digits.slice(0,3)}) ${digits.slice(3)}` : digits; setPhone(formatted); }} placeholder="(555) 123-4567" required disabled={loading} style={{ width: "100%", padding: "0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", fontSize: "0.95rem" }} />
              </div>
            </>
          )}
          {mode === "signup" && type === "user" && (
            <>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.375rem" }}>First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                    disabled={loading}
                    style={{ width: "100%", padding: "0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", fontSize: "0.95rem" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.375rem" }}>Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    required
                    disabled={loading}
                    style={{ width: "100%", padding: "0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", fontSize: "0.95rem" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.375rem" }}>Zip Code</label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                    setZipCode(val);
                  }}
                  placeholder="90210"
                  inputMode="numeric"
                  maxLength={5}
                  required
                  disabled={loading}
                  style={{ width: "100%", padding: "0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", fontSize: "0.95rem" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.375rem" }}>Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    let formatted = digits;
                    if (digits.length > 6) {
                      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                    } else if (digits.length > 3) {
                      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                    } else if (digits.length > 0) {
                      formatted = `(${digits}`;
                    }
                    setPhone(formatted);
                  }}
                  placeholder="(555) 123-4567"
                  inputMode="tel"
                  maxLength={14}
                  required
                  disabled={loading}
                  style={{ width: "100%", padding: "0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", fontSize: "0.95rem" }}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.375rem" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              disabled={loading}
              style={{ width: "100%", padding: "0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", fontSize: "0.95rem" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.375rem" }}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                style={{ width: "100%", padding: "0.875rem", paddingRight: "3rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", fontSize: "0.95rem" }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            {mode === "signin" && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  if (!email) {
                    setError("Enter your email address first, then click Forgot Password.");
                    return;
                  }
                  setError("");
                  setLoading(true);
                  try {
                    const { error: resetErr } = await supabaseBrowser.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/welcome?mode=signin`,
                    });
                    if (resetErr) throw resetErr;
                    setMessage("Password reset link sent! Check your email.");
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : "Failed to send reset email.");
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: colors.primary,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  padding: "0.375rem 0",
                  marginTop: "0.375rem",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                Forgot your password?
              </button>
            )}
          </div>

          {mode === "signup" && (
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.375rem" }}>Confirm Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  style={{ width: "100%", padding: "0.875rem", paddingRight: "3rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", fontSize: "0.95rem" }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Referral code input */}
          {mode === "signup" && type === "user" && !refValid && (
            <div>
              {!refExpanded ? (
                <button
                  type="button"
                  onClick={() => setRefExpanded(true)}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", padding: 0 }}
                >
                  Have a referral code?
                </button>
              ) : (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "0.375rem" }}>Referral Code</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="text"
                      value={refCode}
                      onChange={(e) => { const v = e.target.value.toUpperCase(); setRefCode(v); validateRefCode(v); }}
                      placeholder="e.g. SARAH2026"
                      disabled={loading}
                      style={{ flex: 1, padding: "0.875rem", background: "rgba(255,255,255,0.05)", border: `1px solid ${refValid ? "rgba(0,255,135,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: "10px", color: "white", fontSize: "0.95rem", textTransform: "uppercase" }}
                    />
                    {refChecking && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>...</span>}
                    {!refChecking && refCode && refValid && <span style={{ fontSize: 16, color: "#00FF87" }}>✓</span>}
                    {!refChecking && refCode && !refValid && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Invalid</span>}
                  </div>
                  {refValid && refName && (
                    <div style={{ fontSize: "0.75rem", color: "#bf5fff", marginTop: 4 }}>Referred by {refName}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === "signup" && (
            <label style={{
              display: "flex", alignItems: "flex-start", gap: "0.625rem",
              cursor: "pointer", userSelect: "none",
            }}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                disabled={loading}
                style={{
                  width: 18, height: 18, marginTop: 2, flexShrink: 0,
                  accentColor: colors.primary, cursor: "pointer",
                }}
              />
              <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                I agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: "underline" }}>
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: "underline" }}>
                  Privacy Policy
                </a>
                , including the assumption of risk, tax obligations, and receipt verification requirements.
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "1rem",
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              border: "none",
              borderRadius: "10px",
              color: "white",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              marginTop: "0.5rem",
            }}
          >
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <button
          type="button"
          onClick={onClose}
          style={{ width: "100%", padding: "0.75rem", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", cursor: "pointer", marginTop: "1rem" }}
        >
          Cancel
        </button>
        </>)}
      </div>
    </div>
  );
}

// ============================================
// Apply Button — gradient text underline style
// ============================================
function ApplyButton({ type, onClick }: { type: "sales_rep" | "influencer"; onClick: () => void }) {
  const isSales = type === "sales_rep";
  const label = isSales ? "Apply to be a LetsGo Sales Representative" : "Apply to be a LetsGo Influencer";
  const icon = isSales ? "\uD83D\uDCBC" : "\u2728";

  const c = isSales
    ? { solid: "#00bfff", rgb: "0,191,255" }
    : { solid: "#ffd93d", rgb: "255,217,61" };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className="apply-cycle-btn"
      style={{
        cursor: "pointer", fontSize: "0.88rem", fontWeight: 600,
        background: `linear-gradient(90deg, rgba(255,255,255,0.7), ${c.solid})`,
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        transition: "all 0.3s ease",
        display: "inline-flex", flexDirection: "column", alignItems: "center",
        position: "relative",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(90deg, #fff, ${c.solid})`; e.currentTarget.style.webkitBackgroundClip = "text"; e.currentTarget.style.webkitTextFillColor = "transparent"; }}
      onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(90deg, rgba(255,255,255,0.7), ${c.solid})`; e.currentTarget.style.webkitBackgroundClip = "text"; e.currentTarget.style.webkitTextFillColor = "transparent"; }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", paddingBottom: "5px" }}>
        <span>{icon}</span> {label} &rarr;
      </span>
      <span style={{
        display: "block", width: "100%", height: 2.5, borderRadius: 2,
        background: `linear-gradient(90deg, transparent, ${c.solid}, transparent)`,
      }} />
    </span>
  );
}

// ============================================
// Main Welcome Page Component
// ============================================
export default function WelcomePage() {
  const router = useRouter();
  const [hoveredSide, setHoveredSide] = useState<"business" | "user" | null>(null);
  const [authModal, setAuthModal] = useState<{ open: boolean; type: "business" | "user"; mode: "signin" | "signup" }>({ open: false, type: "business", mode: "signin" });
  const [applyRedirect, setApplyRedirect] = useState<string | null>(null);

  // Influencer referral code from URL
  const [influencerCode, setInfluencerCode] = useState("");
  const [influencerName, setInfluencerName] = useState("");
  const [influencerValid, setInfluencerValid] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref") || params.get("influencer") || "";
    if (!refCode) return;
    setInfluencerCode(refCode.toUpperCase());
    fetch(`/api/influencers/validate?code=${encodeURIComponent(refCode)}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setInfluencerCode(data.code);
          setInfluencerName(data.name);
          setInfluencerValid(true);
        }
      })
      .catch(() => {});
  }, []);

  // Check if already logged in (skip if ?new is in URL — allows fresh signups)
  useEffect(() => {
    async function checkSession() {
      const params = new URLSearchParams(window.location.search);
      if (params.has("new")) {
        // Sign out any existing session so a new user can sign up
        await supabaseBrowser.auth.signOut();
        return;
      }

      const { data } = await supabaseBrowser.auth.getSession();
      if (data.session) {
        // Check user type and redirect accordingly
        const userType = data.session.user.user_metadata?.user_type;
        if (userType === "business") {
          // Check if they have a business
          const res = await fetch(`/api/auth/check-business`, {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          let businessId: string | undefined;
          if (res.ok) {
            const json = await res.json();
            businessId = json.businessId;
          }

          if (businessId) {
            router.push(`/businessprofile-v2/${businessId}`);
          } else {
            router.push("/partner-onboarding");
          }
        } else {
          // User type - redirect to main app (or user dashboard when built)
          router.push("/");
        }
      }
    }
    checkSession();
  }, [router]);

  function handleAuthSuccess(userId: string, hasExistingBusiness?: boolean, businessId?: string) {
    setAuthModal({ ...authModal, open: false });

    // If user clicked an apply button, redirect to the apply page after auth
    if (applyRedirect) {
      const dest = applyRedirect;
      setApplyRedirect(null);
      router.push(dest);
      return;
    }

    if (authModal.type === "business") {
      if (hasExistingBusiness && businessId) {
        router.push(`/businessprofile-v2/${businessId}`);
      } else {
        router.push("/partner-onboarding");
      }
    } else {
      // Explorer flow - redirect to Find Friends onboarding step
      router.push("/welcome/find-friends");
    }
  }

  return (
    <div
      className="welcome-container"
      style={{
        fontFamily: "'Outfit', sans-serif",
        position: "relative",
        background: "linear-gradient(135deg, #0d0015 0%, #1a0a2e 50%, #16082a 100%)",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @keyframes winterSpring {
          0% { color: #00bfff; text-shadow: 0 0 10px #00bfff, 0 0 30px #00bfff; }
          50% { color: #98fb98; text-shadow: 0 0 10px #98fb98, 0 0 30px #90ee90; }
          100% { color: #00bfff; text-shadow: 0 0 10px #00bfff, 0 0 30px #00bfff; }
        }
        
        @keyframes summerFall {
          0% { color: #ffd93d; text-shadow: 0 0 10px #ffd93d, 0 0 30px #ffd93d; }
          50% { color: #ff6b6b; text-shadow: 0 0 10px #ff6b6b, 0 0 30px #ff4500; }
          100% { color: #ffd93d; text-shadow: 0 0 10px #ffd93d, 0 0 30px #ffd93d; }
        }
        
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes border-dance {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .welcome-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .map-section {
          height: 60vh;
          padding: 70px 12% 30px 12%;
        }

        .signin-section {
          height: 40vh;
          display: flex;
        }

        .signin-title {
          font-size: 2rem;
        }

        .signin-desc {
          font-size: 1rem;
        }

        .signin-btn {
          padding: 0.9rem 2.25rem;
          font-size: 1.05rem;
        }

        .signin-secondary {
          font-size: 0.9rem;
          padding: 0.5rem 1rem;
        }

        @media (max-width: 768px) {
          .welcome-container {
            height: auto;
            min-height: 100dvh;
            overflow-y: auto;
          }

          .map-section {
            height: 35vh;
            min-height: 250px;
            padding: 75px 5% 10px 5%;
          }

          .signin-section {
            height: auto;
            min-height: auto;
            flex-direction: column;
            gap: 0;
          }

          .signin-side {
            padding: 1.5rem 1.25rem !important;
          }

          .signin-title {
            font-size: 1.3rem;
            margin-bottom: 0.3rem !important;
          }

          .signin-desc {
            font-size: 0.8rem;
            max-width: 260px;
            margin-bottom: 0.75rem !important;
            line-height: 1.4 !important;
          }

          .signin-btn {
            padding: 0.65rem 1.75rem;
            font-size: 0.9rem;
            margin-bottom: 0.5rem !important;
          }

          .signin-secondary {
            font-size: 0.75rem;
            padding: 0.35rem 0.8rem;
          }

          .welcome-apply-cta {
            margin-top: 4rem !important;
            margin-bottom: 0.5rem;
            animation: applyCTAFade 0.6s ease both;
          }

          .apply-cycle-btn {
            font-family: inherit;
          }

          @keyframes applyCTAFade {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .mobile-logo {
            top: 0.6rem !important;
            padding: 0.4rem 1rem !important;
          }

          .mobile-logo img {
            max-width: 140px !important;
            max-height: 44px !important;
          }

          .center-divider {
            left: 10% !important;
            right: 10% !important;
            top: 50% !important;
            bottom: auto !important;
            width: auto !important;
            height: 2px !important;
            transform: translateY(-50%) !important;
            background: linear-gradient(90deg, transparent 0%, rgba(255, 107, 107, 0.6) 15%, rgba(255, 217, 61, 0.6) 30%, rgba(107, 203, 119, 0.6) 50%, rgba(0, 191, 255, 0.6) 70%, rgba(138, 43, 226, 0.6) 85%, transparent 100%) !important;
          }
        }
      `}</style>

      {/* Logo */}
      <div
        className="mobile-logo"
        style={{
          position: "absolute",
          top: "1.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          background: "rgba(13, 0, 21, 0.8)",
          padding: "0.6rem 1.5rem",
          borderRadius: "50px",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
        }}
      >
        <Image
          src="/lg-logo.png"
          alt="LetsGo"
          width={140}
          height={42}
          sizes="(max-width: 768px) 100px, 140px"
          style={{ width: "auto", height: "auto", maxWidth: "140px" }}
          priority
        />
      </div>

      {/* Map Section - 60% of viewport */}
      <div
        className="map-section"
        style={{
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(180deg, #1a0a2e 0%, #0d0015 100%)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "900px",
            margin: "0 auto",
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow: "0 8px 40px rgba(0, 0, 0, 0.4), 0 0 60px rgba(77, 208, 225, 0.15)",
            border: "1px solid rgba(77, 208, 225, 0.2)",
          }}
        >
          <CityMapAnimation />
        </div>
      </div>

      {/* Sign In Section - 40% of viewport */}
      <div className="signin-section" style={{ position: "relative" }}>
        {/* Center Divider */}
        <div
          className="center-divider"
          style={{
            position: "absolute",
            left: "50%",
            top: "10%",
            bottom: "10%",
            width: "2px",
            transform: "translateX(-50%)",
            background: "linear-gradient(180deg, transparent 0%, rgba(255, 107, 107, 0.6) 15%, rgba(255, 217, 61, 0.6) 30%, rgba(107, 203, 119, 0.6) 45%, rgba(0, 191, 255, 0.6) 60%, rgba(138, 43, 226, 0.6) 80%, transparent 100%)",
            zIndex: 50,
          }}
        />

        {/* Business Side */}
        <div
          className="signin-side"
          onMouseEnter={() => setHoveredSide("business")}
          onMouseLeave={() => setHoveredSide(null)}
          style={{
            flex: hoveredSide === "business" ? 1.06 : hoveredSide === "user" ? 0.94 : 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "1.5rem 2rem",
            position: "relative",
            transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden",
            background: "radial-gradient(ellipse at 30% 50%, rgba(138, 43, 226, 0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(0, 191, 255, 0.08) 0%, transparent 50%)",
          }}
        >
          <div style={{ zIndex: 10, textAlign: "center", animation: "slide-up 0.8s ease-out 0.2s forwards", opacity: 0 }}>
            <h2 className="signin-title" style={{ fontWeight: 800, marginBottom: "0.5rem", animation: "winterSpring 8s ease-in-out infinite" }}>For Businesses</h2>
            <p className="signin-desc" style={{ color: "rgba(255, 255, 255, 0.6)", marginBottom: "1.25rem", lineHeight: 1.4 }}>
              Put your spot on the map and connect with explorers in your community
            </p>
            <button
              className="signin-btn"
              onClick={() => setAuthModal({ open: true, type: "business", mode: "signin" })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.75rem",
                fontWeight: 700,
                border: "none",
                borderRadius: "50px",
                cursor: "pointer",
                background: "linear-gradient(135deg, #00bfff, #8a2be2)",
                color: "white",
                boxShadow: "0 0 25px rgba(0, 191, 255, 0.5), 0 0 50px rgba(138, 43, 226, 0.3)",
                marginBottom: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              <span>Sign In</span>
              <span>→</span>
            </button>
            <div>
              <button
                className="signin-secondary"
                onClick={() => setAuthModal({ open: true, type: "business", mode: "signup" })}
                style={{
                  fontWeight: 500,
                  background: "rgba(0, 191, 255, 0.08)",
                  border: "1px solid rgba(0, 191, 255, 0.4)",
                  borderRadius: "25px",
                  color: "#00bfff",
                  cursor: "pointer",
                }}
              >
                New here? Start onboarding →
              </button>
            </div>
            <div className="welcome-apply-cta" style={{ marginTop: "6rem" }}>
              <ApplyButton type="sales_rep" onClick={() => { setApplyRedirect("/apply/sales-rep"); setAuthModal({ open: true, type: "business", mode: "signup" }); }} />
            </div>
          </div>
        </div>

        {/* User Side */}
        <div
          className="signin-side"
          onMouseEnter={() => setHoveredSide("user")}
          onMouseLeave={() => setHoveredSide(null)}
          style={{
            flex: hoveredSide === "user" ? 1.06 : hoveredSide === "business" ? 0.94 : 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "1.5rem 2rem",
            position: "relative",
            transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden",
            background: "radial-gradient(ellipse at 70% 50%, rgba(255, 107, 107, 0.12) 0%, transparent 60%), radial-gradient(ellipse at 30% 80%, rgba(255, 215, 0, 0.08) 0%, transparent 50%)",
          }}
        >
          <div style={{ zIndex: 10, textAlign: "center", animation: "slide-up 0.8s ease-out 0.4s forwards", opacity: 0 }}>
            <h2 className="signin-title" style={{ fontWeight: 800, marginBottom: "0.5rem", animation: "summerFall 8s ease-in-out infinite" }}>For Explorers</h2>
            <p className="signin-desc" style={{ color: "rgba(255, 255, 255, 0.6)", marginBottom: "1.25rem", lineHeight: 1.4 }}>
              Discover the best local spots, hidden gems, and exciting activities near you
            </p>
            <button
              className="signin-btn"
              onClick={() => setAuthModal({ open: true, type: "user", mode: "signin" })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.75rem",
                fontWeight: 700,
                border: "none",
                borderRadius: "50px",
                cursor: "pointer",
                background: "linear-gradient(135deg, #ff6b6b, #ffd93d)",
                color: "#1a0a2e",
                boxShadow: "0 0 25px rgba(255, 107, 107, 0.5), 0 0 50px rgba(255, 217, 61, 0.3)",
                marginBottom: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              <span>Sign In</span>
              <span>→</span>
            </button>
            <div>
              <button
                className="signin-secondary"
                onClick={() => setAuthModal({ open: true, type: "user", mode: "signup" })}
                style={{
                  fontWeight: 500,
                  background: "rgba(255, 217, 61, 0.08)",
                  border: "1px solid rgba(255, 217, 61, 0.4)",
                  borderRadius: "25px",
                  color: "#ffd93d",
                  cursor: "pointer",
                }}
              >
                New explorer? Create account →
              </button>
            </div>
            <div className="welcome-apply-cta" style={{ marginTop: "6rem" }}>
              <ApplyButton type="influencer" onClick={() => { setApplyRedirect("/apply/influencer"); setAuthModal({ open: true, type: "user", mode: "signup" }); }} />
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModal.open}
        onClose={() => setAuthModal({ ...authModal, open: false })}
        type={authModal.type}
        mode={authModal.mode}
        onSuccess={handleAuthSuccess}
        influencerCode={influencerCode}
        influencerName={influencerName}
        influencerValid={influencerValid}
      />
    </div>
  );
}