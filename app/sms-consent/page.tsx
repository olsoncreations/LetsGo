import Image from "next/image";

export const metadata = {
  title: "SMS Invite Consent | LetsGo",
  description: "How LetsGo handles SMS invitations and user consent.",
};

export default function SmsConsentPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0d0015 0%, #1a0a2e 50%, #16082a 100%)",
      fontFamily: "'Outfit', system-ui, sans-serif",
      color: "#fff",
      padding: "60px 24px 40px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      <div style={{ maxWidth: 640, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Image src="/lg-logo.png" alt="LetsGo" width={180} height={54} style={{ margin: "0 auto 16px" }} priority />
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
            SMS Invite Consent
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            How LetsGo handles text message invitations
          </p>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "32px 28px",
          lineHeight: 1.8,
          fontSize: 15,
          color: "rgba(255,255,255,0.75)",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
            How It Works
          </h2>
          <ol style={{ paddingLeft: 20, marginBottom: 24 }}>
            <li style={{ marginBottom: 12 }}>A LetsGo user signs into the app and navigates to the <strong style={{ color: "#fff" }}>Find Your Friends</strong> page.</li>
            <li style={{ marginBottom: 12 }}>The user taps <strong style={{ color: "#fff" }}>Import Contacts</strong> and selects specific contacts from their phone.</li>
            <li style={{ marginBottom: 12 }}>The user reviews the selected contacts and explicitly taps <strong style={{ color: "#fff" }}>Send Invites</strong>.</li>
            <li style={{ marginBottom: 12 }}>Each selected contact receives a <strong style={{ color: "#fff" }}>single, one-time SMS</strong> inviting them to join LetsGo.</li>
          </ol>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
            User Consent
          </h2>
          <ul style={{ paddingLeft: 20, marginBottom: 24 }}>
            <li style={{ marginBottom: 12 }}>The sending user explicitly chooses which contacts to invite. No messages are sent automatically.</li>
            <li style={{ marginBottom: 12 }}>Before sending, the user sees a confirmation screen showing exactly who will receive a text.</li>
            <li style={{ marginBottom: 12 }}>Before sending, the user must check a consent checkbox that reads: <em style={{ color: "#fff" }}>&ldquo;I agree to send a one-time SMS invite to the selected contacts. Message frequency: one message per contact. No recurring messages. Recipients can reply STOP to opt out or HELP for help. Msg &amp; data rates may apply. By sending, I agree to the Terms of Service and Privacy Policy.&rdquo;</em></li>
            <li style={{ marginBottom: 12 }}>The &ldquo;Send Invites&rdquo; button is disabled until the checkbox is checked.</li>
          </ul>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
            Message Details
          </h2>
          <ul style={{ paddingLeft: 20, marginBottom: 24 }}>
            <li style={{ marginBottom: 12 }}><strong style={{ color: "#fff" }}>Frequency:</strong> One message per recipient. No recurring or promotional messages are sent.</li>
            <li style={{ marginBottom: 12 }}><strong style={{ color: "#fff" }}>Content:</strong> A brief invitation with a link to join LetsGo.</li>
            <li style={{ marginBottom: 12 }}><strong style={{ color: "#fff" }}>Opt-out:</strong> Recipients can reply STOP at any time to opt out of future messages.</li>
            <li style={{ marginBottom: 12 }}><strong style={{ color: "#fff" }}>Help:</strong> Recipients can reply HELP for support information.</li>
            <li style={{ marginBottom: 12 }}>Message and data rates may apply.</li>
          </ul>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
            Sample Message
          </h2>
          <div style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "16px 20px",
            fontSize: 14,
            fontStyle: "italic",
            marginBottom: 24,
          }}>
            &ldquo;Alex Morgan invited you to join LetsGo — discover restaurants, earn rewards, and play games with friends! Sign up here: https://www.useletsgo.com/welcome Reply STOP to opt out or HELP for help. Msg &amp; data rates may apply.&rdquo;
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
            Links
          </h2>
          <ul style={{ paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}><a href="/privacy" style={{ color: "#FF2D78", textDecoration: "underline" }}>Privacy Policy</a></li>
            <li style={{ marginBottom: 8 }}><a href="/terms" style={{ color: "#FF2D78", textDecoration: "underline" }}>Terms of Service</a></li>
            <li style={{ marginBottom: 8 }}><a href="/Twilio/sms-consent-screenshot.jpg" target="_blank" rel="noopener noreferrer" style={{ color: "#FF2D78", textDecoration: "underline" }}>Consent Checkbox Screenshot</a></li>
          </ul>
        </div>

        <div style={{ textAlign: "center", marginTop: 32, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          &copy; {new Date().getFullYear()} LetsGo &middot; Olson Creations LLC
        </div>
      </div>
    </div>
  );
}
