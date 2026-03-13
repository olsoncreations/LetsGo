"use client";

import { useState } from "react";
import Link from "next/link";

const NEON_GRADIENT = "linear-gradient(90deg, #FF2D78, #00E5FF, #FFD600, #00FF87, #D050FF, #FF6B2D, #FF2D78)";

const ITEMS = [
  {
    id: "sales",
    title: "Apply to be a LetsGo Sales Representative",
    icon: "✦",
    href: "/apply/sales-rep",
  },
  {
    id: "influencer",
    title: "Apply to be a LetsGo Influencer",
    icon: "✦",
    href: "/apply/influencer",
  },
];

const fontImport = `@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap");`;

const styles = `
${fontImport}
@keyframes neonShift {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
@media (max-width: 640px) {
  .opportunity-grid {
    grid-template-columns: 1fr !important;
    gap: 10px !important;
  }
}
`;

const FONT = "'Outfit', sans-serif";

export default function OpportunityCTA() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div style={{ padding: "0 0 20px", marginTop: 240 }}>
      <style>{styles}</style>
      <div className="opportunity-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            onMouseEnter={() => setHovered(item.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              textDecoration: "none", display: "flex", overflow: "hidden",
              borderRadius: 6,
              background: "linear-gradient(145deg, #0C0C14 0%, #111120 100%)",
              border: "1px solid rgba(255,255,255,0.04)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              transform: hovered === item.id ? "translateY(-2px)" : "translateY(0)",
            }}
          >
            {/* White stripe */}
            <div style={{
              width: 4, minHeight: "100%",
              background: "#ffffff",
            }} />
            <div style={{ padding: "14px 14px 14px 12px", flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontSize: 16, fontWeight: 800, lineHeight: 1,
                color: "#ffffff",
              }}>
                {item.icon}
              </span>
              <div style={{
                flex: 1, fontSize: 13, fontWeight: 600, fontFamily: FONT,
                background: NEON_GRADIENT,
                backgroundSize: "200% 100%",
                animation: "neonShift 30s linear infinite",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                {item.title}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", fontFamily: FONT,
                textTransform: "uppercase" as const, whiteSpace: "nowrap" as const,
                color: "#ffffff",
              }}>
                APPLY &rarr;
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
