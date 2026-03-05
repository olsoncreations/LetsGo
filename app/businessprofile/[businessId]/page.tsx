"use client";

import React from "react";
import { useParams } from "next/navigation";
import LetsGoBusinessProfile from "@/components/business/LetsGoBusinessProfile";

export default function BusinessProfileRoutePage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId;

  if (!businessId) return null;

  return <LetsGoBusinessProfile businessId={businessId} />;
}
