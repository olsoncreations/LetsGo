"use client";

import React from "react";
import { useParams } from "next/navigation";
import CorporateDashboard from "@/components/business/v2/CorporateDashboard";

export default function CorporateDashboardPage() {
  const params = useParams<{ chainId: string }>();
  const chainId = params?.chainId;

  if (!chainId) return null;

  return <CorporateDashboard chainId={chainId} />;
}
