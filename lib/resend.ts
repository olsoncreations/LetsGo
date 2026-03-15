import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.warn("[resend] Missing RESEND_API_KEY environment variable — email sending will fail");
}

export const resend = new Resend(apiKey || "re_disabled");
export const isResendConfigured = !!apiKey;

export const FROM_EMAIL = "LetsGo <noreply@useletsgo.com>";
