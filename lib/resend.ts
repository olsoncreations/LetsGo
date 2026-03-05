import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error("[resend] Missing RESEND_API_KEY environment variable");
}

export const resend = new Resend(apiKey || "");

export const FROM_EMAIL = "LetsGo <noreply@useletsgo.com>";
