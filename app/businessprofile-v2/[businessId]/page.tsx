"use client";

import React from "react";
import { useParams } from "next/navigation";

// ✅ No aliases. This path works as long as your component is here:
// /components/business/v2/BusinessProfileV2.tsx
import BusinessProfileV2 from "../../../components/business/v2/BusinessProfileV2";

export default function BusinessProfileV2Page() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId;

  if (!businessId) return null;

  return <BusinessProfileV2 businessId={businessId} />;
}