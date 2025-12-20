"use client";

import { useRouter } from "next/navigation";
import "../onboarding.css";

export default function Step3Page() {
  const router = useRouter();

  return (
    <div className="container">
      {/* HEADER */}
      <div className="header">
        <div className="logo">
          <img src="/lg-logo.png" alt="Let'sGo" />
        </div>
        <div className="tagline">
          Set up how payouts work at your business
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="progress-container">
        <div className="progress-header">
          <div className="step-indicator">
            <span className="current">Step 3</span> of 7
          </div>
          <div className="time-remaining">⏱ ~2.5 min remaining</div>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: "42%" }}></div>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="form-card">
        <h1 className="form-title">Progressive Payout Setup</h1>
        <p className="form-subtitle">
          Confirm how much you’re willing to pay out to customers as cash
          rewards through Let&apos;sGo. These are <strong>payouts to your
          customers</strong>, not platform fees.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/partner-onboarding/step-4");
          }}
        >
          {/* OVERVIEW / EXPLANATION */}
          <div className="form-section">
            <div className="section-title">
              <div className="section-icon">📊</div>
              How Progressive Payouts Work
            </div>

            <p className="helper-text">
              As customers visit your business more often, their payout
              percentage increases. This encourages <strong>repeat visits</strong> to
              your location, not one-time deal hunters.
            </p>

            <div className="helper-text" style={{ marginTop: "8px" }}>
              You pay full price at the register like normal. Let&apos;sGo
              sends customers cash based on their level, then we bill you for
              those payouts.
            </div>
          </div>

          {/* BASIC SETTINGS */}
          <div className="form-section">
            <div className="section-title">
              <div className="section-icon">⚙️</div>
              Payout Settings
            </div>

            <div className="form-group">
              <label>
                Max payout per visit ($ cap){" "}
                <span className="required">*</span>
              </label>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="5"
                required
              />
              <div className="helper-text">
                Example: If set to $5, a $100 bill at Level 7 (15%) would still
                only cost you $5 in payouts.
              </div>
            </div>

            <div className="form-group">
              <label>
                Approx. average customer check size{" "}
                <span className="required">*</span>
              </label>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="e.g., 35"
                required
              />
              <div className="helper-text">
                We use this to estimate your expected monthly payout spend.
              </div>
            </div>

            <div className="form-group">
              <label>Apply payouts to:</label>
              <select defaultValue="subtotal">
                <option value="subtotal">Subtotal only (recommended)</option>
                <option value="subtotal-tax">Subtotal + Tax</option>
                <option value="all">
                  Subtotal + Tax + Eligible Fees (if any)
                </option>
              </select>
              <div className="helper-text">
                Most businesses choose <strong>Subtotal only</strong> so you&apos;re
                not paying rewards on taxes.
              </div>
            </div>
          </div>

          {/* SUMMARY OF LEVELS (READ ONLY) */}
          <div className="form-section">
            <div className="section-title">
              <div className="section-icon">📈</div>
              Your Default Payout Levels
            </div>

            <div className="plan-summary">
              <div className="summary-title">
                Visit-Based Payout Tiers (Standard)
              </div>

              <div className="payout-tiers">
                <div className="payout-tier-row">
                  <span className="tier-name">Level 1 (1–10 visits)</span>
                  <span className="tier-value">8% payout</span>
                </div>
                <div className="payout-tier-row">
                  <span className="tier-name">Level 2 (11–20 visits)</span>
                  <span className="tier-value">9% payout</span>
                </div>
                <div className="payout-tier-row">
                  <span className="tier-name">Level 3 (21–30 visits)</span>
                  <span className="tier-value">10% payout</span>
                </div>
                <div className="payout-tier-row">
                  <span className="tier-name">Level 4 (31–40 visits)</span>
                  <span className="tier-value">11% payout</span>
                </div>
                <div className="payout-tier-row">
                  <span className="tier-name">Level 5 (41–50 visits)</span>
                  <span className="tier-value">12% payout</span>
                </div>
                <div className="payout-tier-row">
                  <span className="tier-name">Level 6 (51–60 visits)</span>
                  <span className="tier-value">13.5% payout</span>
                </div>
                <div className="payout-tier-row">
                  <span className="tier-name">Level 7 (61+ visits)</span>
                  <span className="tier-value highlight">15% payout</span>
                </div>
              </div>

              <div
                className="helper-text"
                style={{ marginTop: "12px", textAlign: "center" }}
              >
                Each customer&apos;s visit count is{" "}
                <strong>per business</strong> and{" "}
                <strong>resets annually</strong> on the anniversary of their
                first visit at your location.
              </div>
            </div>
          </div>

          {/* BUTTONS */}
          <div className="button-group">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/partner-onboarding/step-2")}
            >
              ← Back
            </button>

            <button type="submit" className="btn btn-primary">
              Continue →
            </button>
          </div>
        </form>
      </div>

      {/* SOCIAL PROOF */}
      <div className="social-proof">
        <div className="social-proof-text">
          You&apos;re almost halfway done — your customers will thank you for
          rewarding their loyalty.
        </div>
      </div>
    </div>
  );
}