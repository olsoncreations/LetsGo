"use client";

import Image from "next/image";
import { useState, FormEvent, ChangeEvent } from "react";

type AgreementsState = {
  terms: boolean;
  billing: boolean;
  content: boolean;
  fraud: boolean;
  binding: boolean;
};

export default function Step7ReviewAgree() {
  const [agreements, setAgreements] = useState<AgreementsState>({
    terms: false,
    billing: false,
    content: false,
    fraud: false,
    binding: false,
  });

  const [signature, setSignature] = useState("");
  const [completed, setCompleted] = useState(false);

  const handleAgreementChange =
    (key: keyof AgreementsState) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setAgreements((prev) => ({ ...prev, [key]: e.target.checked }));
    };

  const handleSignatureChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSignature(e.target.value);
  };

  const allChecked = Object.values(agreements).every(Boolean);
  const hasSignature = signature.trim().length > 0;
  const canSubmit = allChecked && hasSignature;

  const handleBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setCompleted(true);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="step7-root">
      <div className="container">
        {/* Header */}
        <div className="header">
          <div className="logo">
            <Image
              src="/lg-logo.png"
              alt="Let'sGo"
              width={96}
              height={96}
              priority
            />
          </div>
          <div className="tagline">Partner with us to grow your business</div>
        </div>

        {/* Progress */}
        <div className="progress-container">
          <div className="progress-header">
            <div className="step-indicator">
              <span className="current">Step 7</span> of 7
            </div>
            <div className="time-remaining">✓ Almost Done!</div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" />
          </div>
        </div>

        {/* Card */}
        <div className="form-card">
          {completed ? (
            <SuccessCard />
          ) : (
            <>
              <h1 className="form-title">Review & Agree</h1>
              <p className="form-subtitle">
                Review your plan details and finalize your partnership with
                Let'sGo.
              </p>

              <form id="step7Form" onSubmit={handleSubmit}>
                {/* Plan Summary */}
                <div className="form-section">
                  <div className="section-title">
                    <div className="section-icon">📋</div>
                    Your Plan Summary
                  </div>

                  <div className="plan-summary">
                    <div className="summary-title">Basic Plan</div>
                    <div className="summary-table">
                      <div className="summary-row">
                        <span className="summary-label">Monthly Fee</span>
                        <span className="summary-value">$0</span>
                      </div>
                      <div className="summary-row">
                        <span className="summary-label">Per-Visit Fee</span>
                        <span className="summary-value">10% or $5 max</span>
                      </div>
                      <div className="summary-row">
                        <span className="summary-label">Payment Method</span>
                        <span className="summary-value">
                          Bank Account (ACH)
                        </span>
                      </div>
                      <div className="summary-row">
                        <span className="summary-label">Processing Fee</span>
                        <span className="summary-value highlight">
                          $0 (No Fees)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progressive Payout Structure */}
                  <div className="plan-summary" style={{ marginTop: 16 }}>
                    <div className="summary-title">
                      Your Progressive Payout Structure
                    </div>
                    <div className="payout-tiers">
                      <div className="payout-tier-row">
                        <span className="tier-name">
                          Level 1 (1-2 visits)
                        </span>
                        <span className="tier-value">5% of subtotal</span>
                      </div>
                      <div className="payout-tier-row">
                        <span className="tier-name">
                          Level 2 (3-4 visits)
                        </span>
                        <span className="tier-value">7% of subtotal</span>
                      </div>
                      <div className="payout-tier-row">
                        <span className="tier-name">
                          Level 3 (5-6 visits)
                        </span>
                        <span className="tier-value">10% of subtotal</span>
                      </div>
                      <div className="payout-tier-row">
                        <span className="tier-name">
                          Level 4 (7-8 visits)
                        </span>
                        <span className="tier-value">12% of subtotal</span>
                      </div>
                      <div className="payout-tier-row">
                        <span className="tier-name">
                          Level 5 (9-10 visits)
                        </span>
                        <span className="tier-value">15% of subtotal</span>
                      </div>
                      <div className="payout-tier-row">
                        <span className="tier-name">
                          Level 6 (11+ visits)
                        </span>
                        <span className="tier-value highlight">
                          20% of subtotal
                        </span>
                      </div>
                    </div>
                    <div
                      className="helper-text"
                      style={{ marginTop: 12, textAlign: "center" }}
                    >
                      💡 These are the payouts you'll pay to customers based on
                      their visit frequency
                    </div>
                  </div>
                </div>

                {/* Marketing Permissions */}
                <div className="form-section">
                  <div className="section-title">
                    <div className="section-icon">📢</div>
                    Marketing Permissions
                  </div>

                  <div className="permissions-list">
                    <div className="permission-item">
                      <input type="checkbox" id="perm1" defaultChecked />
                      <label htmlFor="perm1">
                        <strong>Allow users to post videos/photos</strong> from
                        their experiences at your business
                      </label>
                    </div>
                    <div className="permission-item">
                      <input type="checkbox" id="perm2" defaultChecked />
                      <label htmlFor="perm2">
                        <strong>Feature my business</strong> in Let'sGo
                        discovery feeds
                      </label>
                    </div>
                    <div className="permission-item">
                      <input type="checkbox" id="perm3" defaultChecked />
                      <label htmlFor="perm3">
                        <strong>Allow A/B testing</strong> to optimize my
                        profile performance
                      </label>
                    </div>
                  </div>
                </div>

                {/* Optional Services */}
                <div className="form-section">
                  <div className="section-title">
                    <div className="section-icon">✨</div>
                    Optional Services
                  </div>

                  <div className="optional-services">
                    <div className="permission-item">
                      <input type="checkbox" id="service1" />
                      <label htmlFor="service1">
                        I want help creating my first promotional video
                      </label>
                    </div>
                    <div className="permission-item">
                      <input type="checkbox" id="service2" />
                      <label htmlFor="service2">
                        I'm interested in profile management services ($50/month
                        — Future option)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Legal Agreements */}
                <div className="form-section">
                  <div className="section-title">
                    <div className="section-icon">📜</div>
                    Legal Agreements
                  </div>

                  <div className="legal-agreements">
                    <div className="agreement-item">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={agreements.terms}
                        onChange={handleAgreementChange("terms")}
                      />
                      <label htmlFor="terms">
                        I have read and agree to the{" "}
                        <a href="#" className="agreement-link">
                          Terms of Service
                        </a>
                      </label>
                    </div>
                    <div className="agreement-item">
                      <input
                        type="checkbox"
                        id="billing"
                        checked={agreements.billing}
                        onChange={handleAgreementChange("billing")}
                      />
                      <label htmlFor="billing">
                        I accept the{" "}
                        <a href="#" className="agreement-link">
                          Business Billing Policy
                        </a>
                      </label>
                    </div>
                    <div className="agreement-item">
                      <input
                        type="checkbox"
                        id="content"
                        checked={agreements.content}
                        onChange={handleAgreementChange("content")}
                      />
                      <label htmlFor="content">
                        I understand the{" "}
                        <a href="#" className="agreement-link">
                          Content Policy
                        </a>
                      </label>
                    </div>
                    <div className="agreement-item">
                      <input
                        type="checkbox"
                        id="fraud"
                        checked={agreements.fraud}
                        onChange={handleAgreementChange("fraud")}
                      />
                      <label htmlFor="fraud">
                        I acknowledge that{" "}
                        <strong>fraudulent receipt submissions</strong> will
                        result in disputes and possible account suspension
                      </label>
                    </div>
                  </div>
                </div>

                {/* Digital Signature */}
                <div className="signature-section">
                  <div className="signature-title">🖊️ Digital Signature</div>
                  <input
                    type="text"
                    className="signature-input"
                    id="signatureName"
                    placeholder="Type your full name to sign"
                    value={signature}
                    onChange={handleSignatureChange}
                    required
                  />
                  <div className="signature-checkbox">
                    <input
                      type="checkbox"
                      id="binding"
                      checked={agreements.binding}
                      onChange={handleAgreementChange("binding")}
                    />
                    <label htmlFor="binding">
                      I certify that I am authorized to bind this business and
                      that this signature is legally binding.
                    </label>
                  </div>
                </div>

                <div className="button-group">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleBack}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    id="submitBtn"
                    disabled={!canSubmit}
                  >
                    🎉 Complete Sign-Up
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Help badge */}
      <button
        type="button"
        className="help-badge"
        onClick={() =>
          alert(
            "Chat support would open here! Available Mon–Fri 9am–6pm local time."
          )
        }
      >
        💬 Need Help?
      </button>

      <style jsx>{`
        .step7-root {
          --primary: #ff6b35;
          --primary-dark: #e5501f;
          --secondary: #004e89;
          --secondary-light: #1a659e;
          --accent: #f7b801;
          --success: #00c896;
          --bg-light: #fafbfc;
          --bg-white: #ffffff;
          --text-dark: #1a2332;
          --text-medium: #4a5568;
          --text-light: #8892a6;
          --border: #e2e8f0;
          --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04);
          --shadow-md: 0 4px 20px rgba(0, 0, 0, 0.08);
          --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.12);
          font-family: "DM Sans", system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          background: linear-gradient(135deg, #fafbfc 0%, #f0f4f8 100%);
          color: var(--text-dark);
          min-height: 100vh;
        }

        .container {
          max-width: 680px;
          margin: 0 auto;
          padding: 20px;
        }

        .header {
          text-align: center;
          padding: 40px 0 30px;
          animation: fadeInDown 0.6s ease-out;
        }

        .logo {
          margin-bottom: 8px;
        }

        .tagline {
          color: var(--text-medium);
          font-size: 1rem;
          font-weight: 400;
        }

        .progress-container {
          background: var(--bg-white);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: var(--shadow-sm);
          animation: fadeIn 0.6s ease-out 0.2s both;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .step-indicator {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-medium);
        }

        .step-indicator .current {
          color: var(--success);
          font-size: 1.125rem;
        }

        .time-remaining {
          font-size: 0.8125rem;
          color: var(--success);
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
        }

        .progress-bar {
          height: 8px;
          background: var(--border);
          border-radius: 100px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(
            90deg,
            var(--success) 0%,
            #00a87a 100%
          );
          border-radius: 100px;
          box-shadow: 0 0 12px rgba(0, 200, 150, 0.4);
          width: 100%;
        }

        .form-card {
          background: var(--bg-white);
          border-radius: 20px;
          padding: 40px;
          box-shadow: var(--shadow-md);
          animation: fadeInUp 0.6s ease-out 0.3s both;
        }

        .form-title {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-dark);
          margin-bottom: 8px;
          text-align: center;
        }

        .form-subtitle {
          color: var(--text-medium);
          font-size: 0.9375rem;
          margin-bottom: 32px;
          line-height: 1.5;
          text-align: center;
        }

        .form-section {
          margin-bottom: 32px;
        }

        .section-title {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 1rem;
          font-weight: 600;
          color: var(--secondary);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .section-icon {
          width: 20px;
          height: 20px;
          background: var(--secondary);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 0.75rem;
        }

        .permissions-list {
          background: var(--bg-light);
          border-radius: 12px;
          padding: 20px;
        }

        .permission-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }

        .permission-item:last-child {
          margin-bottom: 0;
        }

        .permission-item input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .permission-item label {
          cursor: pointer;
          font-size: 0.9375rem;
          line-height: 1.5;
          margin: 0;
        }

        .optional-services {
          background: linear-gradient(
            135deg,
            rgba(247, 184, 1, 0.05) 0%,
            rgba(247, 184, 1, 0.1) 100%
          );
          border: 2px solid rgba(247, 184, 1, 0.2);
          border-radius: 12px;
          padding: 20px;
        }

        .plan-summary {
          background: var(--bg-light);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .summary-title {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 16px;
          color: var(--text-dark);
        }

        .summary-table {
          width: 100%;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }

        .summary-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .summary-label {
          color: var(--text-medium);
          font-size: 0.9375rem;
        }

        .summary-value {
          font-weight: 600;
          color: var(--text-dark);
        }

        .summary-value.highlight {
          color: var(--primary);
        }

        .payout-tiers {
          margin-top: 16px;
        }

        .payout-tier-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          transition: background 0.3s ease;
        }

        .payout-tier-row:hover {
          background: rgba(255, 107, 53, 0.05);
        }

        .payout-tier-row:last-child {
          border-bottom: none;
        }

        .tier-name {
          font-size: 0.9375rem;
          color: var(--text-dark);
          font-weight: 500;
        }

        .tier-value {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 1rem;
          font-weight: 700;
          color: var(--secondary);
        }

        .tier-value.highlight {
          color: var(--primary);
          font-size: 1.125rem;
        }

        .helper-text {
          font-size: 0.8125rem;
          color: var(--text-light);
          margin-top: 6px;
          font-style: italic;
        }

        .legal-agreements {
          background: var(--bg-light);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .agreement-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }

        .agreement-item:last-child {
          margin-bottom: 0;
        }

        .agreement-item input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .agreement-item label {
          cursor: pointer;
          font-size: 0.9375rem;
          line-height: 1.5;
          margin: 0;
        }

        .agreement-link {
          color: var(--secondary);
          text-decoration: none;
          font-weight: 600;
        }

        .agreement-link:hover {
          text-decoration: underline;
        }

        .signature-section {
          background: linear-gradient(
            135deg,
            rgba(0, 78, 137, 0.05) 0%,
            rgba(0, 78, 137, 0.1) 100%
          );
          border: 2px solid var(--secondary);
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .signature-title {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 16px;
          color: var(--secondary);
        }

        .signature-input {
          width: 100%;
          padding: 16px;
          border: 2px solid var(--border);
          border-radius: 10px;
          font-size: 1.125rem;
          font-family: "Outfit", system-ui, sans-serif;
          color: var(--text-dark);
          background: var(--bg-white);
          margin-bottom: 16px;
          transition: all 0.3s ease;
        }

        .signature-input:focus {
          outline: none;
          border-color: var(--secondary);
          box-shadow: 0 0 0 4px rgba(0, 78, 137, 0.1);
        }

        .signature-checkbox {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .signature-checkbox input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .signature-checkbox label {
          cursor: pointer;
          font-size: 0.9375rem;
          line-height: 1.5;
          margin: 0;
          font-weight: 500;
        }

        .button-group {
          display: flex;
          gap: 12px;
          padding-top: 24px;
          border-top: 1px solid var(--border);
        }

        .btn {
          flex: 1;
          padding: 16px 24px;
          border-radius: 12px;
          font-size: 1.125rem;
          font-weight: 700;
          font-family: "Outfit", system-ui, sans-serif;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
        }

        .btn-primary {
          background: linear-gradient(
            135deg,
            var(--success) 0%,
            #00a87a 100%
          );
          color: white;
          box-shadow: 0 4px 20px rgba(0, 200, 150, 0.4);
        }

        .btn-primary:hover:enabled {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0, 200, 150, 0.5);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .btn-secondary {
          background: var(--bg-light);
          color: var(--text-medium);
          border: 2px solid var(--border);
          flex: 0.5;
        }

        .btn-secondary:hover {
          background: var(--bg-white);
        }

        .help-badge {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: var(--secondary);
          color: white;
          padding: 16px 24px;
          border-radius: 100px;
          font-size: 0.9375rem;
          font-weight: 600;
          box-shadow: var(--shadow-lg);
          cursor: pointer;
          transition: all 0.3s ease;
          z-index: 1000;
          border: none;
        }

        .help-badge:hover {
          transform: scale(1.05);
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @media (max-width: 640px) {
          .container {
            padding: 16px;
          }

          .form-card {
            padding: 28px 20px;
          }

          .button-group {
            flex-direction: column-reverse;
          }

          .btn-secondary {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}

function SuccessCard() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: "5rem", marginBottom: 24 }}>🎉</div>
      <h1
        style={{
          fontFamily: "'Outfit', system-ui, sans-serif",
          fontSize: "2.5rem",
          fontWeight: 700,
          color: "var(--success)",
          marginBottom: 16,
        }}
      >
        Welcome to Let'sGo!
      </h1>
      <p
        style={{
          fontSize: "1.125rem",
          color: "var(--text-medium)",
          marginBottom: 32,
          lineHeight: 1.6,
        }}
      >
        Your business profile has been submitted for review.
      </p>
      <div
        style={{
          background: "var(--bg-light)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 32,
          textAlign: "left",
        }}
      >
        <h3
          style={{
            fontFamily: "'Outfit', system-ui, sans-serif",
            fontSize: "1.125rem",
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          What happens next:
        </h3>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <span style={{ color: "var(--success)", fontSize: "1.25rem" }}>✓</span>
          <span>
            <strong>Within 24 hours:</strong> We'll verify your documents and
            activate your account
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <span style={{ color: "var(--success)", fontSize: "1.25rem" }}>✓</span>
          <span>
            <strong>You'll receive:</strong> Login credentials and dashboard
            access via email
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ color: "var(--success)", fontSize: "1.25rem" }}>✓</span>
          <span>
            <strong>First steps:</strong> Wait for your first customer visit and
            start earning
          </span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }}
          style={{
            padding: "14px 32px",
            background:
              "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
            color: "white",
            border: "none",
            borderRadius: 12,
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Outfit', system-ui, sans-serif",
          }}
        >
          Go to Dashboard
        </button>
        <button
          style={{
            padding: "14px 32px",
            background: "var(--bg-light)",
            color: "var(--text-medium)",
            border: "2px solid var(--border)",
            borderRadius: 12,
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Outfit', system-ui, sans-serif",
          }}
        >
          Download Business App
        </button>
      </div>
      <p
        style={{
          marginTop: 32,
          fontSize: "0.875rem",
          color: "var(--text-light)",
        }}
      >
        Need help? Contact{" "}
        <a
          href="mailto:support@letsgo.com"
          style={{
            color: "var(--secondary)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          support@letsgo.com
        </a>{" "}
        or call (555) 123-4567
      </p>
    </div>
  );
}