"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

type PlanType = "basic" | "premium";
type AdId = "ad-7day" | "ad-14day" | "ad-30day" | "ad-citywide";

export default function Step3ChoosePlan() {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("basic");
  const [premiumAddon, setPremiumAddon] = useState(false);
  const [selectedAds, setSelectedAds] = useState<Record<AdId, boolean>>({
    "ad-7day": false,
    "ad-14day": false,
    "ad-30day": false,
    "ad-citywide": false,
  });
  const [contactRep, setContactRep] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Later we’ll send this to Supabase; for now just confirm UX.
    alert("Plan selected! Moving to Step 4: Billing & Payments");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  const choosePlan = (plan: PlanType) => {
    setSelectedPlan(plan);
    if (plan === "basic") {
      setPremiumAddon(false);
    }
  };

  const toggleAd = (id: AdId) => {
    setSelectedAds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="onb3-root">
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
              <span className="current">Step 3</span> of 7
            </div>
            <div className="time-remaining">⏱ ~2.5 min remaining</div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: "42%" }} />
          </div>
        </div>

        {/* Card */}
        <div className="form-card">
          <h1 className="form-title">Choose Your Plan</h1>
          <p className="form-subtitle">
            Select the plan that best fits your business goals. You can upgrade
            or downgrade anytime.
          </p>

          <form id="step3Form" onSubmit={handleSubmit}>
            <div className="plans-grid">
              {/* Basic Plan */}
              <button
                type="button"
                className={
                  "plan-card" + (selectedPlan === "basic" ? " selected" : "")
                }
                onClick={() => choosePlan("basic")}
              >
                <input
                  type="radio"
                  name="plan"
                  id="basic"
                  value="basic"
                  checked={selectedPlan === "basic"}
                  onChange={() => choosePlan("basic")}
                  style={{ display: "none" }}
                />
                <div className="plan-name">Basic</div>
                <div className="plan-price">
                  <div className="price-amount">Free</div>
                  <div className="price-period">to start</div>
                </div>
                <ul className="plan-features">
                  <li>Get discovered by local users</li>
                  <li>Pay only per visit (10% or $5 max)</li>
                  <li>Business pays users Progressive Payout on each validated visit</li>
                  <li>Receipt redemption system</li>
                  <li>No monthly fees</li>
                  <li>Basic analytics</li>
                </ul>
              </button>

              {/* Premium Plan */}
              <button
                type="button"
                className={
                  "plan-card" + (selectedPlan === "premium" ? " selected" : "")
                }
                onClick={() => choosePlan("premium")}
              >
                <div className="plan-badge">Most Popular</div>
                <input
                  type="radio"
                  name="plan"
                  id="premium"
                  value="premium"
                  checked={selectedPlan === "premium"}
                  onChange={() => choosePlan("premium")}
                  style={{ display: "none" }}
                />
                <div className="plan-name">Premium</div>
                <div className="plan-price">
                  <div className="price-amount">$100</div>
                  <div className="price-period">per month</div>
                </div>
                <ul className="plan-features">
                  <li>Everything in Basic</li>
                  <li>Upload 1 video daily</li>
                  <li>Priority placement</li>
                  <li>Detailed analytics dashboard</li>
                  <li>User experience uploads</li>
                </ul>

                <div
                  className="addon-section"
                  style={{
                    display: selectedPlan === "premium" ? "block" : "none",
                  }}
                >
                  <div className="addon-checkbox">
                    <input
                      type="checkbox"
                      id="videoAddon"
                      checked={premiumAddon}
                      onChange={(e) => setPremiumAddon(e.target.checked)}
                    />
                    <label htmlFor="videoAddon" className="addon-label">
                      Add 5 videos/day{" "}
                      <span className="addon-price">+$50/month</span>
                    </label>
                  </div>
                </div>
              </button>
            </div>

            {/* Advertising Section */}
            <div className="advertising-section">
              <div className="advertising-title">🚀 Boost Your Visibility</div>
              <div className="advertising-subtitle">
                Add advertising campaigns for maximum exposure
              </div>

              <div className="advertising-options">
                <button
                  type="button"
                  className={
                    "ad-option" +
                    (selectedAds["ad-7day"] ? " selected" : "")
                  }
                  onClick={() => toggleAd("ad-7day")}
                >
                  <input type="checkbox" readOnly checked={selectedAds["ad-7day"]} />
                  <div className="ad-price">$99</div>
                  <div className="ad-duration">7-day spotlight</div>
                </button>

                <button
                  type="button"
                  className={
                    "ad-option" +
                    (selectedAds["ad-14day"] ? " selected" : "")
                  }
                  onClick={() => toggleAd("ad-14day")}
                >
                  <input type="checkbox" readOnly checked={selectedAds["ad-14day"]} />
                  <div className="ad-price">$179</div>
                  <div className="ad-duration">14-day campaign</div>
                </button>

                <button
                  type="button"
                  className={
                    "ad-option" +
                    (selectedAds["ad-30day"] ? " selected" : "")
                  }
                  onClick={() => toggleAd("ad-30day")}
                >
                  <input type="checkbox" readOnly checked={selectedAds["ad-30day"]} />
                  <div className="ad-price">$349</div>
                  <div className="ad-duration">30-day spotlight</div>
                </button>

                <button
                  type="button"
                  className={
                    "ad-option" +
                    (selectedAds["ad-citywide"] ? " selected" : "")
                  }
                  onClick={() => toggleAd("ad-citywide")}
                >
                  <input type="checkbox" readOnly checked={selectedAds["ad-citywide"]} />
                  <div className="ad-price">$599</div>
                  <div className="ad-duration">City-wide promo</div>
                </button>
              </div>

              <div className="ad-contact">
                <input
                  type="checkbox"
                  id="contact-rep"
                  checked={contactRep}
                  onChange={(e) => setContactRep(e.target.checked)}
                />
                <label htmlFor="contact-rep">
                  I&apos;d like a Let&apos;sGo rep to contact me about custom
                  advertising plans
                </label>
              </div>
            </div>

            {/* Estimated Volume */}
            <div className="estimate-section">
              <div className="estimate-title">
                📊 Estimated Monthly Visit Volume
              </div>
              <div className="form-group">
                <label>This helps us forecast your payout liability</label>
                <select defaultValue="">
                  <option value="">Select expected visits</option>
                  <option value="10-50">10-50 visits</option>
                  <option value="50-100">50-100 visits</option>
                  <option value="100-250">100-250 visits</option>
                  <option value="250-500">250-500 visits</option>
                  <option value="500+">500+ visits</option>
                  <option value="unsure">Not sure yet</option>
                </select>
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
          alert("Chat support would open here! Available Mon–Fri 9am–6pm EST")
        }
      >
        💬 Need Help?
      </button>

      <style jsx>{`
        .onb3-root {
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
          max-width: 900px;
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
          text-align: center;
        }

        .form-subtitle {
          color: var(--text-medium);
          font-size: 0.9375rem;
          margin-bottom: 40px;
          line-height: 1.5;
          text-align: center;
        }

        .plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }

        .plan-card {
          position: relative;
          border: 3px solid var(--border);
          border-radius: 16px;
          padding: 28px 24px;
          cursor: pointer;
          transition: all 0.3s ease;
          background: var(--bg-white);
          text-align: left;
        }

        .plan-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }

        .plan-card.selected {
          border-color: var(--primary);
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.03) 0%,
            rgba(255, 107, 53, 0.08) 100%
          );
          box-shadow: 0 8px 24px rgba(255, 107, 53, 0.2);
        }

        .plan-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--accent);
          color: var(--text-dark);
          padding: 4px 16px;
          border-radius: 100px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .plan-name {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-dark);
          margin-bottom: 8px;
          text-align: center;
        }

        .plan-price {
          text-align: center;
          margin-bottom: 20px;
        }

        .price-amount {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--primary);
        }

        .price-period {
          font-size: 0.875rem;
          color: var(--text-light);
        }

        .plan-features {
          list-style: none;
          margin-bottom: 20px;
          padding-left: 0;
        }

        .plan-features li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 12px;
          font-size: 0.9375rem;
          color: var(--text-medium);
        }

        .plan-features li::before {
          content: "✓";
          color: var(--success);
          font-weight: 700;
          font-size: 1.125rem;
          flex-shrink: 0;
        }

        .addon-section {
          background: var(--bg-light);
          border-radius: 12px;
          padding: 20px;
          margin-top: 16px;
        }

        .addon-checkbox {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .addon-checkbox input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .addon-label {
          font-size: 0.9375rem;
          color: var(--text-dark);
          cursor: pointer;
        }

        .addon-price {
          color: var(--primary);
          font-weight: 600;
        }

        .advertising-section {
          background: linear-gradient(
            135deg,
            var(--secondary) 0%,
            var(--secondary-light) 100%
          );
          border-radius: 16px;
          padding: 32px;
          margin-bottom: 32px;
          color: white;
        }

        .advertising-title {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 12px;
          text-align: center;
        }

        .advertising-subtitle {
          text-align: center;
          margin-bottom: 24px;
          opacity: 0.9;
        }

        .advertising-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .ad-option {
          background: rgba(255, 255, 255, 0.15);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .ad-option:hover {
          background: rgba(255, 255, 255, 0.25);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .ad-option.selected {
          background: rgba(255, 255, 255, 0.3);
          border-color: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .ad-price {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 1.75rem;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .ad-duration {
          font-size: 0.875rem;
          opacity: 0.9;
        }

        .ad-contact {
          background: rgba(255, 255, 255, 0.15);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ad-contact input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .ad-contact label {
          flex: 1;
          cursor: pointer;
          margin: 0;
        }

        .estimate-section {
          background: var(--bg-light);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 32px;
        }

        .estimate-title {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-dark);
          margin-bottom: 8px;
        }

        .form-group select {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid var(--border);
          border-radius: 10px;
          font-size: 0.9375rem;
          font-family: "DM Sans", system-ui, sans-serif;
          color: var(--text-dark);
          background: var(--bg-white);
        }

        .button-group {
          display: flex;
          gap: 12px;
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
          .plans-grid {
            grid-template-columns: 1fr;
          }

          .advertising-options {
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
        }
      `}</style>
    </div>
  );
}