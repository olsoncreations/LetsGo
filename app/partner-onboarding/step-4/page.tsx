"use client";

import { useRouter } from "next/navigation";
import "../onboarding.css";

export default function Step4Page() {
  const router = useRouter();

  return (
    <div className="container">
      {/* HEADER */}
      <div className="header">
        <div className="logo">
          <img src="/lg-logo.png" alt="Let'sGo" />
        </div>
        <div className="tagline">
          Choose how much visibility you want — all advertising is optional.
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="progress-container">
        <div className="progress-header">
          <div className="step-indicator">
            <span className="current">Step 4</span> of 7
          </div>
          <div className="time-remaining">⏱ ~2 min remaining</div>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: "57%" }}></div>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="form-card">
        <h1 className="form-title">Advertising & Exposure</h1>
        <p className="form-subtitle">
          These options help you get noticed inside Let&apos;sGo.{" "}
          <strong>Everything on this page is optional.</strong> You can always
          change it later from your dashboard.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/partner-onboarding/step-5");
          }}
        >
          {/* DISCOVERY & ORGANIC BOOST */}
          <div className="form-section">
            <div className="section-title">
              <div className="section-icon">🔍</div>
              Discovery & Boost Settings
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  defaultChecked
                  style={{ marginRight: "8px" }}
                />
                Feature my business in Let&apos;sGo discovery feeds when
                relevant
              </label>
              <div className="helper-text">
                We may show your business more often to users who match your
                category and radius. This is included in your plan.
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  defaultChecked
                  style={{ marginRight: "8px" }}
                />
                Allow A/B testing on my photos, tags, and descriptions
              </label>
              <div className="helper-text">
                We test different layouts and photos to learn what gets more
                people to pick your business.
              </div>
            </div>
          </div>

          {/* SPOTLIGHT CAMPAIGNS */}
          <div className="form-section">
            <div className="section-title">
              <div className="section-icon">🚀</div>
              Optional Spotlight Campaigns
            </div>

            <p className="helper-text">
              These are **paid campaigns** that push you higher in the swipe
              deck and search results. Only selected campaigns will ever be
              billed.
            </p>

            <div className="form-group" style={{ marginTop: "16px" }}>
              <label>
                <input
                  type="checkbox"
                  id="spotlight-1"
                  style={{ marginRight: "8px" }}
                />
                1-Day Spotlight — 20 miles, 1 day featured — <strong>$99</strong>
              </label>
              <div className="helper-text">
                Great for testing or promoting a single event / slow day.
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  id="spotlight-7"
                  style={{ marginRight: "8px" }}
                />
                7-Day Spotlight — 50 miles, 7 days featured —{" "}
                <strong>$599</strong>
              </label>
              <div className="helper-text">
                Ideal for new openings, menu launches, or seasonal pushes.
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  id="spotlight-14"
                  style={{ marginRight: "8px" }}
                />
                14-Day Spotlight — 50 miles, 14 days featured —{" "}
                <strong>$999</strong>
              </label>
              <div className="helper-text">
                Best for larger pushes where you want to own your local area
                for 2 weeks.
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  id="push-100"
                  style={{ marginRight: "8px" }}
                />
                100 Mile Wide Push — 100 miles, 7 days push + priority —{" "}
                <strong>$2,599</strong>
              </label>
              <div className="helper-text">
                Regional reach for festivals, destination spots, or tours.
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  id="tour-wide"
                  style={{ marginRight: "8px" }}
                />
                Tour Wide Push — 100 miles, 14 days push (flex) + 7 days
                priority — <strong>$4,599</strong>
              </label>
              <div className="helper-text">
                Built for multi-stop events, tours, or anchor locations that
                want maximum visibility.
              </div>
            </div>
          </div>

          {/* BUDGET GUARDRAIL */}
          <div className="form-section">
            <div className="section-title">
              <div className="section-icon">💰</div>
              Monthly Budget Guardrail
            </div>

            <div className="form-group">
              <label>
                Max monthly advertising budget (optional)
              </label>
              <input
                type="number"
                min={0}
                step={50}
                placeholder="e.g., 500"
              />
              <div className="helper-text">
                We use this as a soft cap and will not auto-start new campaigns
                above this amount without your approval.
              </div>
            </div>
          </div>

          {/* BUTTONS */}
          <div className="button-group">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/partner-onboarding/step-3")}
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
          You&apos;re in control — you can start with zero ads and turn them on
          when you&apos;re ready.
        </div>
      </div>
    </div>
  );
}