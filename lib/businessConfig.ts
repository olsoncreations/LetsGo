// lib/businessConfig.ts

export type BusinessTier = {
  id: string;
  label: string;
  minVisits: number;
  maxVisits: number | null; // null = no upper bound
  percent: number;          // 0.05 = 5%
};

export type BusinessConfig = {
  id: string;
  name: string;
  location: string;
  tiers: BusinessTier[];
};

const BUSINESS_CONFIG: Record<string, BusinessConfig> = {
  block16: {
    id: "block16",
    name: "Block 16",
    location: "Downtown Omaha, NE",
    tiers: [
      {
        id: "tier-1",
        label: "Level 1 • 1–2 visits · 5%",
        minVisits: 1,
        maxVisits: 2,
        percent: 0.05,
      },
      {
        id: "tier-2",
        label: "Level 2 • 3–4 visits · 7%",
        minVisits: 3,
        maxVisits: 4,
        percent: 0.07,
      },
      {
        id: "tier-3",
        label: "Level 3 • 5–6 visits · 10%",
        minVisits: 5,
        maxVisits: 6,
        percent: 0.10,
      },
      {
        id: "tier-4",
        label: "Level 4 • 7–8 visits · 12%",
        minVisits: 7,
        maxVisits: 8,
        percent: 0.12,
      },
      {
        id: "tier-5",
        label: "Level 5 • 9–10 visits · 15%",
        minVisits: 9,
        maxVisits: 10,
        percent: 0.15,
      },
      {
        id: "tier-6",
        label: "Level 6 • 11+ visits · 20%",
        minVisits: 11,
        maxVisits: null,
        percent: 0.20,
      },
    ],
  },
  // you can add more businesses here later:
  // "blue-sushi": { ... }
};

export function getBusinessConfig(
  businessId: string
): BusinessConfig | null {
  return BUSINESS_CONFIG[businessId] ?? null;
}