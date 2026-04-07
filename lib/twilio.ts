import "server-only";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !phoneNumber) {
  // Twilio not configured — SMS sending will fail at runtime
}

export const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;
export const twilioPhoneNumber = phoneNumber || "";
export const isTwilioConfigured = !!(accountSid && authToken && phoneNumber);
