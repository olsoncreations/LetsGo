"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

type PresetKey = "conservative" | "standard" | "aggressive" | "custom";

const PRESETS: Record<PresetKey, number[]> = {
  conservative: [400, 600, 800, 1000, 1200, 1500],
  standard: [500, 700, 1000, 1200, 1500, 2000],
  aggressive: [600, 900, 1200, 1500, 1800, 2500],
  custom: [500, 700, 1000, 1200, 1500, 2000], // starting point when they switch to custom
};

export default function Step4ProgressivePayouts() {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("conservative");
  const [tiers, setTiers] = useState<number[]>(PRESETS.conservative);
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(true);
  const [autoApproveAmount, setAutoApproveAmount] = useState<string>("50");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Later we'll send tiers, preset, auto-approve settings to the backend.
    alert("Progressive payout structure configured! Moving to Step 5: Billing & Payment");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  const handleSelectPreset = (preset: PresetKey) => {
    setSelectedPreset(preset);

    if (preset === "custom") {
      // Keep existing values when entering custom mode
      return;
    }

    // When picking a non-custom preset, overwrite tiers
    setTiers(PRESETS[preset]);
  };

  const handleTierChange = (index: number, value: string) => {
    const numeric = Number(value) || 0;
    setTiers((prev) => {
      const next = [...prev];
      next[index] = numeric;
      return next;
    });
  };

  const toggleAutoApprove = () => {
    setAutoApproveEnabled((prev) => !prev);
  };

  return (
    <div className="step4-root">
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

        {/* Progress bar */}
        <div className="progress-container">
          <div className="progress-header">
            <div className="step-indicator">
              <span className="current">Step 4</span> of 7
            </div>
            <div className="time-remaining">⏱ ~2 min remaining</div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: "57%" }} />
          </div>
        </div>

        {/* Card */}
        <div className="form-card">
          <h1 className="form-title">Progressive Payout Structure</h1>
          <p className="form-subtitle">
            Set up how much you&apos;ll pay customers based on their visit
            frequency. The more they visit, the more they earn!
          </p>

          <div className="info-box">
            <div className="info-box-title">💡 How Progressive Payouts Work</div>
            <div className="info-box-text">
              Customers earn rewards based on how many times they visit your
              business. Each tier pays a percentage (BPS = basis points) of
              their receipt subtotal. For example: 500 BPS = 5% of receipt.
            </div>
          </div>

          <form id="step4Form" onSubmit={handleSubmit}>
            {/* Preset options */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">⚡</div>
                Quick Setup (Choose a Preset)
              </div>

              <div className="preset-options">
                <button
                  type="button"
                  className={
                    "preset-card" +
                    (selectedPreset === "conservative" ? " selected" : "")
                  }
                  onClick={() => handleSelectPreset("conservative")}
                >
                  <div className="preset-badge">✓</div>
                  <div className="preset-name">Conservative</div>
                  <div className="preset-desc">
                    Lower payouts, safer for new businesses
                  </div>
                </button>

                <button
                  type="button"
                  className={
                    "preset-card" +
                    (selectedPreset === "standard" ? " selected" : "")
                  }
                  onClick={() => handleSelectPreset("standard")}
                >
                  <div className="preset-badge">✓</div>
                  <div className="preset-name">Standard</div>
                  <div className="preset-desc">
                    Balanced payouts, recommended
                  </div>
                </button>

                <button
                  type="button"
                  className={
                    "preset-card" +
                    (selectedPreset === "aggressive" ? " selected" : "")
                  }
                  onClick={() => handleSelectPreset("aggressive")}
                >
                  <div className="preset-badge">✓</div>
                  <div className="preset-name">Aggressive</div>
                  <div className="preset-desc">
                    Higher payouts to attract more customers
                  </div>
                </button>

                <button
                  type="button"
                  className={
                    "preset-card" +
                    (selectedPreset === "custom" ? " selected" : "")
                  }
                  onClick={() => handleSelectPreset("custom")}
                >
                  <div className="preset-badge">✓</div>
                  <div className="preset-name">Custom</div>
                  <div className="preset-desc">
                    Set your own values manually
                  </div>
                </button>
              </div>
            </div>

            {/* Tiers */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">📊</div>
                Your Progressive Payout Tiers
              </div>

              <div className="payout-tiers-table">
                <div className="tier-header">
                  <div>Tier</div>
                  <div>Visit Range</div>
                  <div>You Pay (BPS)</div>
                  <div>Customer Sees</div>
                </div>

                {[
                  { level: "Level 1", visits: "1-2 visits" },
                  { level: "Level 2", visits: "3-4 visits" },
                  { level: "Level 3", visits: "5-6 visits" },
                  { level: "Level 4", visits: "7-8 visits" },
                  { level: "Level 5", visits: "9-10 visits" },
                  { level: "Level 6", visits: "11+ visits" },
                ].map((tierInfo, index) => {
                  const bps = tiers[index] ?? 0;
                  const percent = bps / 100;
                  const isCustom = selectedPreset === "custom";

                  return (
                    <div
                      key={tierInfo.level}
                      className={
                        "tier-row" + (isCustom ? " editable" : "")
                      }
                    >
                      <div className="tier-level">{tierInfo.level}</div>
                      <div className="tier-visits">{tierInfo.visits}</div>
                      <div className="tier-bps">
                        {!isCustom && (
                          <span className="bps-display">{bps}</span>
                        )}
                        {isCustom && (
                          <input
                            type="number"
                            className="tier-input"
                            value={bps}
                            min={0}
                            max={5000}
                            step={100}
                            onChange={(e) =>
                              handleTierChange(index, e.target.value)
                            }
                          />
                        )}
                      </div>
                      <div className="tier-label">
                        {percent}% of subtotal
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="helper-text">
                ℹ️ BPS = Basis Points (100 BPS = 1%). These percentages apply to
                the receipt subtotal before tax/tip. You can customize these
                later in your dashboard.
              </div>
            </div>

            {/* Verification contact */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">👤</div>
                Receipt Verification Contact
              </div>

              <div className="form-group">
                <label>
                  Name of Person Verifying Receipts{" "}
                  <span className="required">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Manager name"
                  required
                />
                <div className="helper-text">
                  This person will receive receipt alerts and verify
                  authenticity
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    Verification Email <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="manager@business.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>
                    Phone Number <span className="optional">(optional)</span>
                  </label>
                  <input type="tel" placeholder="(555) 123-4567" />
                </div>
              </div>
            </div>

            {/* Auto-Approval */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">⚡</div>
                Auto-Approval (Recommended)
              </div>

              <div className="auto-approve-box">
                <div className="auto-approve-toggle">
                  <button
                    type="button"
                    className={
                      "toggle-switch" + (autoApproveEnabled ? " active" : "")
                    }
                    onClick={toggleAutoApprove}
                  >
                    <div className="toggle-slider" />
                  </button>
                  <div className="toggle-label">Enable Auto-Approval</div>
                </div>

                <div
                  className={
                    "auto-approve-input" +
                    (autoApproveEnabled ? " active" : "")
                  }
                >
                  <div className="form-group">
                    <label>
                      Auto-approve receipts under:{" "}
                      <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      value={autoApproveAmount}
                      onChange={(e) => setAutoApproveAmount(e.target.value)}
                      placeholder="50"
                      id="autoApproveInput"
                    />
                    <div className="helper-text">
                      ✓ Speeds up customer payouts
                      <br />
                      ✓ Reduces manual review work
                      <br />
                      ✓ You can still dispute suspicious receipts
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Expected volume */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">📈</div>
                Expected Monthly Redemptions
              </div>

              <div className="form-group">
                <label>
                  Estimated receipt redemptions per month{" "}
                  <span className="required">*</span>
                </label>
                <select required>
                  <option value="">Select estimated volume</option>
                  <option value="0-50">0-50 receipts</option>
                  <option value="50-150">50-150 receipts</option>
                  <option value="150-300">150-300 receipts</option>
                  <option value="300+">300+ receipts</option>
                  <option value="unsure">Not sure yet</option>
                </select>
                <div className="helper-text">
                  This helps us predict your payout liability
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="button-group">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBack}
              >
                ← Back
              </button>
              <button type="submit" className="btn btn-primary">
                Continue to Billing →
              </button>
            </div>
          </form>
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
        .step4-root {
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
          max-width: 750px;
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
          color: var(--primary);
          font-size: 1.125rem;
        }

        .time-remaining {
          font-size: 0.8125rem;
          color: var(--text-light);
          display: flex;
          align-items: center;
          gap: 6px;
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
            var(--primary) 0%,
            var(--accent) 100%
          );
          border-radius: 100px;
          transition: width 0.6s cubic-bezier(0.65, 0, 0.35, 1);
          box-shadow: 0 0 12px rgba(255, 107, 53, 0.4);
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
        }

        .form-subtitle {
          color: var(--text-medium);
          font-size: 0.9375rem;
          margin-bottom: 32px;
          line-height: 1.5;
        }

        .info-box {
          background: linear-gradient(
            135deg,
            rgba(0, 78, 137, 0.05) 0%,
            rgba(0, 78, 137, 0.1) 100%
          );
          border-left: 4px solid var(--secondary);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 32px;
        }

        .info-box-title {
          font-weight: 600;
          color: var(--secondary);
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .info-box-text {
          font-size: 0.9375rem;
          color: var(--text-medium);
          line-height: 1.6;
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

        .form-group {
          margin-bottom: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-dark);
          margin-bottom: 8px;
        }

        label .required {
          color: var(--primary);
        }

        label .optional {
          color: var(--text-light);
          font-weight: 400;
          font-size: 0.8125rem;
        }

        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="number"],
        select {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid var(--border);
          border-radius: 10px;
          font-size: 0.9375rem;
          font-family: "DM Sans", system-ui, sans-serif;
          color: var(--text-dark);
          transition: all 0.3s ease;
          background: var(--bg-white);
        }

        input:focus,
        select:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 4px rgba(255, 107, 53, 0.1);
        }

        input::placeholder {
          color: var(--text-light);
        }

        .helper-text {
          font-size: 0.8125rem;
          color: var(--text-light);
          margin-top: 6px;
          font-style: italic;
        }

        .payout-tiers-table {
          background: var(--bg-light);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 24px;
        }

        .tier-header {
          display: grid;
          grid-template-columns: 0.8fr 1fr 1fr 1.2fr;
          padding: 16px 20px;
          background: var(--secondary);
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .tier-row {
          display: grid;
          grid-template-columns: 0.8fr 1fr 1fr 1.2fr;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          align-items: center;
          transition: background 0.3s ease;
        }

        .tier-row:last-child {
          border-bottom: none;
        }

        .tier-row:hover {
          background: rgba(255, 107, 53, 0.05);
        }

        .tier-level {
          font-weight: 600;
          color: var(--text-dark);
        }

        .tier-visits {
          color: var(--text-medium);
          font-size: 0.9375rem;
        }

        .tier-bps {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .bps-display {
          font-family: "Outfit", system-ui, sans-serif;
          font-weight: 700;
          font-size: 1.125rem;
          color: var(--primary);
        }

        .tier-label {
          color: var(--text-medium);
          font-size: 0.875rem;
        }

        .tier-row.editable {
          background: linear-gradient(
            135deg,
            rgba(247, 184, 1, 0.05) 0%,
            rgba(247, 184, 1, 0.1) 100%
          );
        }

        .tier-input {
          width: 90px;
          padding: 6px 10px;
          border: 2px solid var(--accent);
          border-radius: 8px;
          font-size: 0.9375rem;
          text-align: center;
          font-weight: 700;
          font-family: "Outfit", system-ui, sans-serif;
          color: var(--primary);
          background: white;
        }

        .tier-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.2);
        }

        .preset-options {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .preset-card {
          border: 2px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
          position: relative;
          background: var(--bg-white);
        }

        .preset-card:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }

        .preset-card.selected {
          border-color: var(--primary);
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.05) 0%,
            rgba(255, 107, 53, 0.1) 100%
          );
          box-shadow: 0 4px 12px rgba(255, 107, 53, 0.15);
        }

        .preset-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 24px;
          height: 24px;
          background: var(--success);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .preset-name {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-dark);
          margin-bottom: 8px;
        }

        .preset-desc {
          font-size: 0.8125rem;
          color: var(--text-light);
        }

        .auto-approve-box {
          background: linear-gradient(
            135deg,
            rgba(0, 200, 150, 0.05) 0%,
            rgba(0, 200, 150, 0.1) 100%
          );
          border: 2px solid rgba(0, 200, 150, 0.2);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .auto-approve-toggle {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .toggle-switch {
          position: relative;
          width: 52px;
          height: 28px;
          background: var(--border);
          border-radius: 100px;
          cursor: pointer;
          transition: background 0.3s ease;
          border: none;
          padding: 0;
        }

        .toggle-switch.active {
          background: var(--success);
        }

        .toggle-slider {
          position: absolute;
          top: 4px;
          left: 4px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          transition: transform 0.3s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .toggle-switch.active .toggle-slider {
          transform: translateX(24px);
        }

        .toggle-label {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-dark);
        }

        .auto-approve-input {
          display: none;
        }

        .auto-approve-input.active {
          display: block;
          animation: fadeIn 0.3s ease;
        }

        .button-group {
          display: flex;
          gap: 12px;
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid var(--border);
        }

        .btn {
          flex: 1;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          font-family: "Outfit", system-ui, sans-serif;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
        }

        .btn-primary {
          background: linear-gradient(
            135deg,
            var(--primary) 0%,
            var(--primary-dark) 100%
          );
          color: white;
          box-shadow: 0 4px 16px rgba(255, 107, 53, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(255, 107, 53, 0.4);
        }

        .btn-secondary {
          background: var(--bg-light);
          color: var(--text-medium);
          border: 2px solid var(--border);
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
          box-shadow: 0 8px 32px rgba(0, 78, 137, 0.4);
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

        @media (max-width: 768px) {
          .tier-header,
          .tier-row {
            grid-template-columns: 1fr;
            gap: 8px;
            padding: 12px 16px;
          }

          .tier-header {
            display: none;
          }

          .preset-options {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 640px) {
          .container {
            padding: 16px;
          }

          .form-card {
            padding: 28px 20px;
          }

          .form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}