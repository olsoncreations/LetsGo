import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  // RESEND_API_KEY not set — email sending will fail at runtime
}

export const resend = new Resend(apiKey || "re_disabled");
export const isResendConfigured = !!apiKey;

export const FROM_EMAIL = "LetsGo <noreply@useletsgo.com>";
