// lib/stripe.ts
import "server-only";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.error("[stripe] Missing STRIPE_SECRET_KEY environment variable");
}

// Server-only Stripe client (never import this into client components)
export const stripe = new Stripe(secretKey || "", {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});
