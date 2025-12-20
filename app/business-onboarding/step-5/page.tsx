"use client";

import Image from "next/image";
import { FormEvent, useState, ChangeEvent } from "react";

type PaymentMethod = "bank" | "card";

export default function Step5BillingPayment() {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank");
  const [sameAddress, setSameAddress] = useState<boolean>(true);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert("Payment information saved! Moving to Step 6: Verification & Uploads");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  const handlePaymentMethodClick = (method: PaymentMethod) => {
    setPaymentMethod(method);
  };

  const handleSameAddressChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSameAddress(e.target.checked);
  };

  return (
    <div className="step5-root">
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
              <span className="current">Step 5</span> of 7
            </div>
            <div className="time-remaining">⏱ ~1.5 min remaining</div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: "71%" }} />
          </div>
        </div>

        {/* Main card */}
        <div className="form-card">
          <h1 className="form-title">Billing & Payment</h1>
          <p className="form-subtitle">
            Secure payment setup to process your transactions smoothly.
          </p>

          <div className="security-badge">
            <span className="security-icon">🔒</span>
            <span>
              Your payment information is encrypted and secure. We never store
              full card details.
            </span>
          </div>

          <form id="step5Form" onSubmit={handleSubmit}>
            {/* Payment Method Selection */}
            <div className="payment-method-selector">
              <button
                type="button"
                className={
                  "payment-method-card" +
                  (paymentMethod === "bank" ? " selected" : "")
                }
                onClick={() => handlePaymentMethodClick("bank")}
              >
                <input
                  type="radio"
                  name="payment-method"
                  id="bank"
                  value="bank"
                  checked={paymentMethod === "bank"}
                  readOnly
                />
                <div className="payment-badge">Recommended</div>
                <div className="payment-icon">🏦</div>
                <div className="payment-name">Bank Account</div>
                <div className="payment-fee no-fee">No Processing Fees</div>
              </button>

              <button
                type="button"
                className={
                  "payment-method-card" +
                  (paymentMethod === "card" ? " selected" : "")
                }
                onClick={() => handlePaymentMethodClick("card")}
              >
                <input
                  type="radio"
                  name="payment-method"
                  id="card"
                  value="card"
                  checked={paymentMethod === "card"}
                  readOnly
                />
                <div className="payment-icon">💳</div>
                <div className="payment-name">Credit/Debit Card</div>
                <div className="payment-fee has-fee">3.5% Processing Fee</div>
              </button>
            </div>

            {/* Bank Account Details */}
            <div
              id="bankDetails"
              className={
                "payment-details" + (paymentMethod === "bank" ? " active" : "")
              }
            >
              <div className="form-section">
                <div className="section-title">
                  <div className="section-icon">🏦</div>
                  Bank Account Information
                </div>

                <div className="form-group">
                  <label>
                    Bank Name <span className="required">*</span>
                  </label>
                  <input type="text" placeholder="Chase Bank" required />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Routing Number <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="9 digits"
                      maxLength={9}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      Account Number <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Account number"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Account Type <span className="required">*</span>
                  </label>
                  <select required>
                    <option value="">Select account type</option>
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card Details */}
            <div
              id="cardDetails"
              className={
                "payment-details" + (paymentMethod === "card" ? " active" : "")
              }
            >
              <div className="form-section">
                <div className="section-title">
                  <div className="section-icon">💳</div>
                  Card Information
                </div>

                <div className="form-group">
                  <label>
                    Name on Card <span className="required">*</span>
                  </label>
                  <input type="text" placeholder="John Smith" />
                </div>

                <div className="form-group">
                  <label>
                    Card Number <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Expiration Date <span className="required">*</span>
                    </label>
                    <input type="text" placeholder="MM/YY" maxLength={5} />
                  </div>
                  <div className="form-group">
                    <label>
                      CVV <span className="required">*</span>
                    </label>
                    <input type="text" placeholder="123" maxLength={4} />
                  </div>
                </div>
              </div>
            </div>

            {/* Billing Address */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">📍</div>
                Billing Address
              </div>

              <div className="same-address-checkbox">
                <input
                  type="checkbox"
                  id="sameAddress"
                  checked={sameAddress}
                  onChange={handleSameAddressChange}
                />
                <label htmlFor="sameAddress">Same as business address</label>
              </div>

              {!sameAddress && (
                <div id="billingAddressFields">
                  <div className="form-group">
                    <label>
                      Street Address <span className="required">*</span>
                    </label>
                    <input type="text" placeholder="123 Main Street" />
                  </div>

                  <div className="form-row-3">
                    <div className="form-group">
                      <label>
                        City <span className="required">*</span>
                      </label>
                      <input type="text" placeholder="Los Angeles" />
                    </div>
                    <div className="form-group">
                      <label>
                        State <span className="required">*</span>
                      </label>
                      <select>
                        <option value="">Select</option>
                        <option value="CA">CA</option>
                        <option value="NY">NY</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>
                        ZIP <span className="required">*</span>
                      </label>
                      <input type="text" placeholder="90210" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Authorization */}
            <div className="checkbox-field">
              <input type="checkbox" id="authorize" required />
              <label htmlFor="authorize">
                <strong>I authorize Let&apos;sGo to charge the following:</strong>
                <ul className="authorization-list">
                  <li>
                    <strong>Progressive User Payouts:</strong> Based on the tier
                    structure I configured (Level 1-6, ranging from 5% to 20%
                    of receipt subtotal depending on customer visit frequency)
                  </li>
                  <li>
                    <strong>Platform Fee (Basic Plan):</strong> 10% of subtotal
                    or $5 maximum per redeemed receipt
                  </li>
                  <li>
                    <strong>Monthly Subscription Fees:</strong> If Premium or
                    Advertising plan selected
                  </li>
                  <li>
                    <strong>Advertising Campaigns:</strong> Any campaigns I
                    selected
                  </li>
                  <li>
                    <strong>Credit Card Processing Fee:</strong> 3.5% if using
                    card payment (waived for ACH/Bank Account)
                  </li>
                </ul>
              </label>
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
          alert(
            "Chat support would open here! Available Mon–Fri 9am–6pm local time."
          )
        }
      >
        💬 Need Help?
      </button>

      <style jsx>{`
        .step5-root {
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

        .security-badge {
          background: linear-gradient(135deg, var(--success) 0%, #00a87a 100%);
          color: white;
          padding: 12px 20px;
          border-radius: 12px;
          margin-bottom: 32px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .security-icon {
          font-size: 1.5rem;
        }

        .payment-method-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 32px;
        }

        .payment-method-card {
          border: 3px solid var(--border);
          border-radius: 16px;
          padding: 24px 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
          position: relative;
          background: var(--bg-white);
        }

        .payment-method-card input[type="radio"] {
          position: absolute;
          opacity: 0;
        }

        .payment-method-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }

        .payment-method-card.selected {
          border-color: var(--primary);
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.03) 0%,
            rgba(255, 107, 53, 0.08) 100%
          );
          box-shadow: 0 4px 16px rgba(255, 107, 53, 0.15);
        }

        .payment-icon {
          font-size: 2.5rem;
          margin-bottom: 12px;
        }

        .payment-name {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-dark);
          margin-bottom: 4px;
        }

        .payment-badge {
          display: inline-block;
          background: var(--success);
          color: white;
          padding: 4px 12px;
          border-radius: 100px;
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .payment-fee {
          font-size: 0.8125rem;
          color: var(--text-light);
        }

        .payment-fee.no-fee {
          color: var(--success);
          font-weight: 600;
        }

        .payment-fee.has-fee {
          color: var(--primary);
        }

        .payment-details {
          display: none;
        }

        .payment-details.active {
          display: block;
          animation: fadeIn 0.3s ease;
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

        input[type="text"],
        input[type="email"],
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

        .checkbox-field {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 20px;
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.05) 0%,
            rgba(255, 107, 53, 0.1) 100%
          );
          border: 2px solid var(--primary);
          border-radius: 12px;
          margin-bottom: 24px;
        }

        .checkbox-field input[type="checkbox"] {
          width: 22px;
          height: 22px;
          cursor: pointer;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .checkbox-field label {
          margin: 0;
          cursor: pointer;
          font-size: 0.9375rem;
          line-height: 1.6;
        }

        .checkbox-field strong {
          color: var(--primary);
          display: block;
          margin-bottom: 8px;
          font-size: 1rem;
        }

        .authorization-list {
          list-style: none;
          margin-top: 8px;
        }

        .authorization-list li {
          padding-left: 20px;
          position: relative;
          margin-bottom: 6px;
        }

        .authorization-list li::before {
          content: "•";
          position: absolute;
          left: 8px;
          color: var(--primary);
          font-weight: 700;
        }

        .same-address-checkbox {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }

        .same-address-checkbox input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .same-address-checkbox label {
          margin: 0;
          cursor: pointer;
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
          .form-row-3,
          .payment-method-selector {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}