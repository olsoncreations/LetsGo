"use client";

import { useRouter } from "next/navigation";
import "../onboarding.css";

export default function Step2Page() {
  const router = useRouter();

  return (
    <div className="container">
      {/* HEADER */}
      <div className="header">
        <div className="logo">
          <img src="/lg-logo.png" alt="Let'sGo" />
        </div>
        <div className="tagline">Tell us more about your business</div>
      </div>

      {/* PROGRESS BAR */}
      <div className="progress-container">
        <div className="progress-header">
          <div className="step-indicator">
            <span className="current">Step 2</span> of 7
          </div>
          <div className="time-remaining">⏱ ~3 min remaining</div>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: "28%" }}></div>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="form-card">
        <h1 className="form-title">Business Details</h1>
        <p className="form-subtitle">
          Help customers find you. This should match what appears on Google Maps.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/partner-onboarding/step-3");
          }}
        >
          {/* BUSINESS ADDRESS */}
          <div className="form-section">
            <div className="section-title">
              <div className="section-icon">📍</div>
              Business Location
            </div>

            <div className="form-group">
              <label>Street Address <span className="required">*</span></label>
              <input type="text" placeholder="123 Main St" required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>City <span className="required">*</span></label>
                <input type="text" placeholder="Omaha" required />
              </div>

              <div className="form-group">
                <label>State <span className="required">*</span></label>
                <input type="text" placeholder="NE" required />
              </div>
            </div>

            <div className="form-group">
              <label>Zip Code <span className="required">*</span></label>
              <input type="text" placeholder="68137" required />
            </div>
          </div>

          {/* BUSINESS CATEGORY (Additional Optional Fields) */}
          <div className="form-section">
            <div className="section-title">
              <div className="section-icon">🏷️</div>
              Additional Categorization (Optional)
            </div>

            <div className="form-group">
              <label>Category 2</label>
              <input type="text" placeholder="e.g., Wings, Italian, Museum" />
            </div>

            <div className="form-group">
              <label>Category 3</label>
              <input type="text" placeholder="e.g., Romantic, Family, Arcade" />
            </div>

            <div className="form-group">
              <label>Category 4</label>
              <input type="text" placeholder="e.g., Indoor, Group Friendly" />
            </div>

            <div className="form-group">
              <label>Category 5</label>
              <input type="text" placeholder="e.g., Brunch, Late Night" />
            </div>
          </div>

          {/* BACK / CONTINUE BUTTONS */}
          <div className="button-group">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/partner-onboarding")}
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
          Trusted by <span className="business-count">2,500+</span> local businesses
        </div>
      </div>
    </div>
  );
}