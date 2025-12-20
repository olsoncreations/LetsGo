"use client";

import Image from "next/image";
import { FormEvent } from "react";

export default function BusinessOnboardingPage() {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // TODO: later we’ll grab values and send to Supabase
    // const formData = new FormData(e.currentTarget);

    // For now: mimic the old behavior
    alert("Great! In the real app, this would take you to Step 2: Business Details");

    // If you want to navigate instead, once Step 2 exists:
    // const router = useRouter();
    // router.push("/business-onboarding/step-2");
  };

  return (
    <>
      <main className="onboarding-body">
        <div className="container">
          {/* Header */}
          <div className="header">
            <div className="logo">
              <Image
                src="/lg-logo.png"
                alt="Let'sGo"
                width={160}
                height={80}
              />
            </div>
            <div className="tagline">Partner with us to grow your business</div>
          </div>

          {/* Progress Bar */}
          <div className="progress-container">
            <div className="progress-header">
              <div className="step-indicator">
                <span className="current">Step 1</span> of 7
              </div>
              <div className="time-remaining">⏱ ~4 min remaining</div>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: "14%" }} />
            </div>
          </div>

          {/* Form Card */}
          <div className="form-card">
            <h1 className="form-title">Get Started</h1>
            <p className="form-subtitle">
              Let&apos;s set up your business profile. This takes about 30 seconds.
            </p>

            <form id="onboardingForm" onSubmit={handleSubmit}>
              {/* Business Type */}
              <div className="form-section">
                <div className="section-title">
                  <div className="section-icon">🏢</div>
                  Your Business
                </div>

                <div className="form-group">
                  <label>
                    Business Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    placeholder="Enter your business name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Business Type <span className="required">*</span>
                  </label>
                  <div className="category-grid">
                    <div className="category-card">
                      <input
                        type="radio"
                        name="businessType"
                        id="restaurant"
                        value="restaurant"
                        required
                      />
                      <label htmlFor="restaurant" className="category-label">
                        <div className="category-icon">🍽️</div>
                        <div className="category-name">Restaurant/Bar</div>
                      </label>
                    </div>
                    <div className="category-card">
                      <input
                        type="radio"
                        name="businessType"
                        id="activity"
                        value="activity"
                      />
                      <label htmlFor="activity" className="category-label">
                        <div className="category-icon">🎯</div>
                        <div className="category-name">Activity</div>
                      </label>
                    </div>
                    <div className="category-card">
                      <input
                        type="radio"
                        name="businessType"
                        id="salon"
                        value="salon"
                      />
                      <label htmlFor="salon" className="category-label">
                        <div className="category-icon">💅</div>
                        <div className="category-name">Salon/Beauty</div>
                      </label>
                    </div>
                    <div className="category-card">
                      <input
                        type="radio"
                        name="businessType"
                        id="retail"
                        value="retail"
                      />
                      <label htmlFor="retail" className="category-label">
                        <div className="category-icon">🛍️</div>
                        <div className="category-name">Retail</div>
                      </label>
                    </div>
                    <div className="category-card">
                      <input
                        type="radio"
                        name="businessType"
                        id="event"
                        value="event"
                      />
                      <label htmlFor="event" className="category-label">
                        <div className="category-icon">🎉</div>
                        <div className="category-name">Event Venue</div>
                      </label>
                    </div>
                    <div className="category-card">
                      <input
                        type="radio"
                        name="businessType"
                        id="other"
                        value="other"
                      />
                      <label htmlFor="other" className="category-label">
                        <div className="category-icon">✨</div>
                        <div className="category-name">Other</div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="form-section">
                <div className="section-title">
                  <div className="section-icon">👤</div>
                  Your Information
                </div>

                <div className="form-group">
                  <label>
                    Full Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    placeholder="John Smith"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Email <span className="required">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      placeholder="john@business.com"
                      required
                    />
                    <div className="helper-text">
                      This will be your login username
                    </div>
                  </div>
                  <div className="form-group">
                    <label>
                      Phone Number <span className="required">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      placeholder="(555) 123-4567"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Role/Title <span className="required">*</span>
                  </label>
                  <select name="role" required>
                    <option value="">Select your role</option>
                    <option value="owner">Owner</option>
                    <option value="gm">General Manager</option>
                    <option value="marketing">Marketing Director</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Referral */}
              <div className="form-section">
                <div className="section-title">
                  <div className="section-icon">🤝</div>
                  Referral Information
                </div>

                <div className="form-group">
                  <label>
                    Referred By <span className="optional">(optional)</span>
                  </label>
                  <input
                    type="text"
                    name="referredBy"
                    placeholder="Sales rep name or referral code"
                  />
                  <div className="helper-text">
                    If a Let&apos;sGo sales rep helped you sign up, enter their
                    name here for commission tracking
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="form-section">
                <div className="section-title">
                  <div className="section-icon">🔒</div>
                  Create Password
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Password <span className="required">*</span>
                    </label>
                    <input
                      type="password"
                      name="password"
                      placeholder="Min. 8 characters"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      Confirm Password <span className="required">*</span>
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      placeholder="Re-enter password"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="button-group">
                <button type="button" className="btn btn-secondary">
                  ← Save &amp; Exit
                </button>
                <button type="submit" className="btn btn-primary">
                  Continue →
                </button>
              </div>
            </form>
          </div>

          {/* Social Proof */}
          <div className="social-proof">
            <div className="social-proof-text">
              Join{" "}
              <span className="business-count">
                2,500+ local businesses
              </span>{" "}
              already growing with Let&apos;sGo
            </div>
          </div>
        </div>

        {/* Help Badge */}
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
      </main>

      {/* Original CSS from your HTML, applied globally */}
      <style jsx global>{`
        :root {
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
        }

        .onboarding-body {
          font-family: "DM Sans", system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          background: linear-gradient(135deg, #fafbfc 0%, #f0f4f8 100%);
          color: var(--text-dark);
          line-height: 1.6;
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
          font-family: "Outfit", system-ui, -apple-system, "Segoe UI", sans-serif;
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
          position: relative;
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
          font-family: "Outfit", system-ui, -apple-system, "Segoe UI", sans-serif;
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

        .form-section {
          margin-bottom: 32px;
        }

        .section-title {
          font-family: "Outfit", system-ui, -apple-system, "Segoe UI", sans-serif;
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

        .required {
          color: var(--primary);
        }

        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="password"],
        select {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid var(--border);
          border-radius: 10px;
          font-size: 0.9375rem;
          font-family: "DM Sans", system-ui, -apple-system, "Segoe UI",
            sans-serif;
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

        .category-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 12px;
        }

        .category-card {
          position: relative;
        }

        .category-card input[type="radio"] {
          position: absolute;
          opacity: 0;
        }

        .category-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 16px;
          border: 2px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          background: var(--bg-white);
          text-align: center;
        }

        .category-card input:checked + .category-label {
          border-color: var(--primary);
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.05) 0%,
            rgba(255, 107, 53, 0.1) 100%
          );
          box-shadow: 0 4px 12px rgba(255, 107, 53, 0.15);
        }

        .category-icon {
          font-size: 2rem;
          margin-bottom: 8px;
        }

        .category-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-dark);
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
          font-family: "Outfit", system-ui, -apple-system, "Segoe UI",
            sans-serif;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
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
          border-color: var(--text-light);
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
          animation: bounceIn 0.6s ease-out 1s both;
          border: none;
        }

        .help-badge:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 32px rgba(0, 78, 137, 0.4);
        }

        .social-proof {
          text-align: center;
          padding: 20px;
          margin-top: 24px;
          animation: fadeIn 0.6s ease-out 0.8s both;
        }

        .social-proof-text {
          color: var(--text-light);
          font-size: 0.875rem;
        }

        .business-count {
          color: var(--primary);
          font-weight: 600;
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

        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
          }
        }

        .helper-text {
          font-size: 0.8125rem;
          color: var(--text-light);
          margin-top: 6px;
          font-style: italic;
        }

        .optional {
          font-size: 0.8125rem;
          color: var(--text-light);
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

          .category-grid {
            grid-template-columns: 1fr;
          }

          .help-badge {
            bottom: 16px;
            right: 16px;
            padding: 12px 20px;
            font-size: 0.875rem;
          }
        }
      `}</style>
    </>
  );
}