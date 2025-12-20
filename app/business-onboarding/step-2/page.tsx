"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const DAYS: { id: DayKey; label: string; defaultOpen: string; defaultClose: string }[] = [
  { id: "mon", label: "Monday", defaultOpen: "09:00", defaultClose: "17:00" },
  { id: "tue", label: "Tuesday", defaultOpen: "09:00", defaultClose: "17:00" },
  { id: "wed", label: "Wednesday", defaultOpen: "09:00", defaultClose: "17:00" },
  { id: "thu", label: "Thursday", defaultOpen: "09:00", defaultClose: "17:00" },
  { id: "fri", label: "Friday", defaultOpen: "09:00", defaultClose: "17:00" },
  { id: "sat", label: "Saturday", defaultOpen: "10:00", defaultClose: "15:00" },
  { id: "sun", label: "Sunday", defaultOpen: "10:00", defaultClose: "15:00" },
];

export default function Step2BusinessDetails() {
  const [openDays, setOpenDays] = useState<Record<DayKey, boolean>>({
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: true,
    sun: false,
  });

  const [hours, setHours] = useState<
    Record<DayKey, { open: string; close: string }>
  >(
    DAYS.reduce((acc, d) => {
      acc[d.id] = { open: d.defaultOpen, close: d.defaultClose };
      return acc;
    }, {} as Record<DayKey, { open: string; close: string }>)
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Later we'll serialize & send to Supabase; for now just confirm.
    alert("Step 2 complete! Moving to Step 3: Plan Selection");

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  const toggleDay = (day: DayKey, checked: boolean) => {
    setOpenDays((prev) => ({ ...prev, [day]: checked }));
  };

  const updateHours = (
    day: DayKey,
    which: "open" | "close",
    value: string
  ) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [which]: value },
    }));
  };

  return (
    <div className="onb2-root">
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
              <span className="current">Step 2</span> of 7
            </div>
            <div className="time-remaining">⏱ ~3 min remaining</div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: "28%" }} />
          </div>
        </div>

        {/* Form card */}
        <div className="form-card">
          <h1 className="form-title">Business Details</h1>
          <p className="form-subtitle">
            Help customers find you with accurate location and contact
            information.
          </p>

          <form id="step2Form" onSubmit={handleSubmit}>
            {/* Location */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">📍</div>
                Location
              </div>

              <div className="form-group">
                <label>
                  Street Address <span className="required">*</span>
                </label>
                <input type="text" placeholder="123 Main Street" required />
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label>
                    City <span className="required">*</span>
                  </label>
                  <input type="text" placeholder="Los Angeles" required />
                </div>
                <div className="form-group">
                  <label>
                    State <span className="required">*</span>
                  </label>
                  <select required defaultValue="">
                    <option value="">Select</option>
                    <option value="CA">CA</option>
                    <option value="NY">NY</option>
                    <option value="TX">TX</option>
                    <option value="FL">FL</option>
                    {/* TODO: add full state list */}
                  </select>
                </div>
                <div className="form-group">
                  <label>
                    ZIP <span className="required">*</span>
                  </label>
                  <input type="text" placeholder="90210" required />
                </div>
              </div>
            </div>

            {/* Contact info */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">📞</div>
                Contact Information
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    Business Phone <span className="required">*</span>
                  </label>
                  <input type="tel" placeholder="(555) 123-4567" required />
                </div>
                <div className="form-group">
                  <label>
                    Customer Email <span className="required">*</span>
                  </label>
                  <input type="email" placeholder="info@business.com" required />
                </div>
              </div>

              <div className="form-group">
                <label>
                  Website <span className="optional">(optional)</span>
                </label>
                <input type="url" placeholder="https://yourbusiness.com" />
              </div>
            </div>

            {/* Display name */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">✏️</div>
                Display Name
              </div>

              <div className="form-group">
                <label>
                  Public Business Name <span className="required">*</span>
                </label>
                <input type="text" placeholder="Joe&apos;s Bar & Grill" required />
                <div className="helper-text">
                  This is how customers will see your business (can be different
                  from legal name)
                </div>
              </div>
            </div>

            {/* Operating hours */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">🕐</div>
                Operating Hours
              </div>

              <div className="hours-grid">
                {DAYS.map((day) => (
                  <div className="day-row" key={day.id}>
                    <div className="day-checkbox">
                      <input
                        type="checkbox"
                        id={day.id}
                        checked={openDays[day.id]}
                        onChange={(e) => toggleDay(day.id, e.target.checked)}
                      />
                      <label htmlFor={day.id} className="day-label">
                        {day.label}
                      </label>
                    </div>

                    <div
                      className={
                        "time-inputs" + (openDays[day.id] ? "" : " closed")
                      }
                    >
                      <input
                        type="time"
                        value={hours[day.id].open}
                        onChange={(e) =>
                          updateHours(day.id, "open", e.target.value)
                        }
                        disabled={!openDays[day.id]}
                      />
                      <span className="time-separator">to</span>
                      <input
                        type="time"
                        value={hours[day.id].close}
                        onChange={(e) =>
                          updateHours(day.id, "close", e.target.value)
                        }
                        disabled={!openDays[day.id]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Age restrictions */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">🎂</div>
                Age Restrictions
              </div>

              <div className="form-group">
                <div className="radio-group">
                  <div className="radio-item">
                    <input
                      type="radio"
                      name="age"
                      id="all-ages"
                      value="all"
                      defaultChecked
                    />
                    <label htmlFor="all-ages" className="radio-label">
                      <div className="radio-indicator" />
                      <span>All ages welcome</span>
                    </label>
                  </div>
                  <div className="radio-item">
                    <input type="radio" name="age" id="age-21" value="21" />
                    <label htmlFor="age-21" className="radio-label">
                      <div className="radio-indicator" />
                      <span>21+ only</span>
                    </label>
                  </div>
                  <div className="radio-item">
                    <input type="radio" name="age" id="age-18" value="18" />
                    <label htmlFor="age-18" className="radio-label">
                      <div className="radio-indicator" />
                      <span>18+ only</span>
                    </label>
                  </div>
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
                Continue →
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
          alert("Chat support would open here! Available Mon-Fri 9am-6pm EST")
        }
      >
        💬 Need Help?
      </button>

      <style jsx>{`
        .onb2-root {
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

        .form-row-3 {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
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

        .onb2-root input[type="text"],
        .onb2-root input[type="email"],
        .onb2-root input[type="tel"],
        .onb2-root input[type="url"],
        .onb2-root select {
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

        .onb2-root input:focus,
        .onb2-root select:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 4px rgba(255, 107, 53, 0.1);
        }

        .onb2-root input::placeholder {
          color: var(--text-light);
        }

        .helper-text {
          font-size: 0.8125rem;
          color: var(--text-light);
          margin-top: 6px;
          font-style: italic;
        }

        .checkbox-group {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 12px;
        }

        .checkbox-item {
          position: relative;
        }

        .checkbox-item input[type="checkbox"] {
          position: absolute;
          opacity: 0;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          padding: 10px 16px;
          border: 2px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
          background: var(--bg-white);
          font-size: 0.9375rem;
          font-weight: 500;
        }

        .checkbox-item input:checked + .checkbox-label {
          border-color: var(--primary);
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.05) 0%,
            rgba(255, 107, 53, 0.1) 100%
          );
          color: var(--primary);
        }

        .hours-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .day-row {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: 16px;
          align-items: center;
          padding: 12px;
          background: var(--bg-light);
          border-radius: 10px;
          transition: all 0.3s ease;
        }

        .day-row:hover {
          background: rgba(255, 107, 53, 0.03);
        }

        .day-checkbox {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .day-checkbox input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .day-label {
          font-weight: 600;
          color: var(--text-dark);
          cursor: pointer;
          margin: 0;
        }

        .time-inputs {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .time-inputs.closed {
          opacity: 0.4;
        }

        .time-inputs input[type="time"] {
          flex: 1;
          padding: 10px 14px;
          border: 2px solid var(--border);
          border-radius: 8px;
          font-size: 0.9375rem;
          font-family: "DM Sans", system-ui, sans-serif;
          color: var(--text-dark);
          background: var(--bg-white);
          transition: all 0.3s ease;
        }

        .time-inputs input[type="time"]:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
        }

        .time-inputs input[type="time"]:disabled {
          background: var(--border);
          cursor: not-allowed;
        }

        .time-separator {
          color: var(--text-medium);
          font-weight: 500;
          font-size: 0.875rem;
        }

        .radio-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 12px;
        }

        .radio-item {
          position: relative;
        }

        .radio-item input[type="radio"] {
          position: absolute;
          opacity: 0;
        }

        .radio-label {
          display: flex;
          align-items: center;
          padding: 14px 18px;
          border: 2px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          background: var(--bg-white);
        }

        .radio-item input:checked + .radio-label {
          border-color: var(--primary);
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.05) 0%,
            rgba(255, 107, 53, 0.1) 100%
          );
          box-shadow: 0 2px 8px rgba(255, 107, 53, 0.15);
        }

        .radio-indicator {
          width: 20px;
          height: 20px;
          border: 2px solid var(--border);
          border-radius: 50%;
          margin-right: 12px;
          position: relative;
          transition: all 0.3s ease;
        }

        .radio-item input:checked + .radio-label .radio-indicator {
          border-color: var(--primary);
          background: var(--primary);
        }

        .radio-indicator::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0);
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s ease;
        }

        .radio-item
          input:checked
          + .radio-label
          .radio-indicator::after {
          transform: translate(-50%, -50%) scale(1);
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

        @media (max-width: 640px) {
          .container {
            padding: 16px;
          }

          .form-card {
            padding: 28px 20px;
          }

          .form-row,
          .form-row-3 {
            grid-template-columns: 1fr;
          }

          .logo img {
            height: 60px;
          }

          .help-badge {
            bottom: 16px;
            right: 16px;
            padding: 12px 20px;
            font-size: 0.875rem;
          }

          .checkbox-group {
            flex-direction: column;
          }

          .day-row {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .time-inputs {
            padding-left: 30px;
          }
        }
      `}</style>
    </div>
  );
}