"use client";

import Image from "next/image";
import {
  useState,
  useRef,
  FormEvent,
  ChangeEvent,
  DragEvent,
} from "react";

type VerificationType = "license" | "ein" | "utility";

type UploadedFile = {
  name: string;
  sizeMB: string;
};

export default function Step6VerificationUploads() {
  const [verificationType, setVerificationType] =
    useState<VerificationType>("license");

  const [verificationFile, setVerificationFile] =
    useState<UploadedFile | null>(null);
  const [logoFile, setLogoFile] = useState<UploadedFile | null>(null);
  const [mainPhotoFile, setMainPhotoFile] =
    useState<UploadedFile | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<UploadedFile[]>([]);

  const [verificationDrag, setVerificationDrag] = useState(false);
  const [logoDrag, setLogoDrag] = useState(false);
  const [mainPhotoDrag, setMainPhotoDrag] = useState(false);
  const [galleryDrag, setGalleryDrag] = useState(false);

  const verificationInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const mainPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const formatFile = (file: File): UploadedFile => ({
    name: file.name,
    sizeMB: (file.size / 1024 / 1024).toFixed(2),
  });

  const handleSingleFileChange =
    (setter: (f: UploadedFile | null) => void) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setter(formatFile(file));
    };

  const handleSingleDrop =
    (
      setter: (f: UploadedFile | null) => void,
      setDrag: (v: boolean) => void
    ) =>
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDrag(false);
      const file = e.dataTransfer.files?.[0];
      if (file) setter(formatFile(file));
    };

  const handleGalleryChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const list: UploadedFile[] = [];
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      list.push(formatFile(files[i]));
    }
    setGalleryFiles(list);
  };

  const handleGalleryDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setGalleryDrag(false);
    const files = e.dataTransfer.files;
    if (!files) return;
    const list: UploadedFile[] = [];
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      list.push(formatFile(files[i]));
    }
    setGalleryFiles(list);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert("Files uploaded! Moving to Step 7: Final Review");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  return (
    <div className="step6-root">
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
              <span className="current">Step 6</span> of 7
            </div>
            <div className="time-remaining">⏱ ~1 min remaining</div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: "85%" }} />
          </div>
        </div>

        {/* Card */}
        <div className="form-card">
          <h1 className="form-title">Verification & Uploads</h1>
          <p className="form-subtitle">
            Verify your business and build your profile with quality images.
          </p>

          <form id="step6Form" onSubmit={handleSubmit}>
            {/* Business Verification */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">✓</div>
                Verify Your Business
              </div>

              <div className="verification-options">
                <div className="verification-option">
                  <input
                    type="radio"
                    name="verification"
                    id="license"
                    value="license"
                    checked={verificationType === "license"}
                    onChange={() => setVerificationType("license")}
                  />
                  <label htmlFor="license" className="verification-label">
                    <div className="radio-indicator" />
                    <div className="verification-text">
                      <div className="verification-name">
                        📄 Business License
                      </div>
                      <div className="verification-desc">
                        Upload your current business license document
                      </div>
                    </div>
                  </label>
                </div>

                <div className="verification-option">
                  <input
                    type="radio"
                    name="verification"
                    id="ein"
                    value="ein"
                    checked={verificationType === "ein"}
                    onChange={() => setVerificationType("ein")}
                  />
                  <label htmlFor="ein" className="verification-label">
                    <div className="radio-indicator" />
                    <div className="verification-text">
                      <div className="verification-name">🏢 EIN Certificate</div>
                      <div className="verification-desc">
                        IRS Employer Identification Number document
                      </div>
                    </div>
                  </label>
                </div>

                <div className="verification-option">
                  <input
                    type="radio"
                    name="verification"
                    id="utility"
                    value="utility"
                    checked={verificationType === "utility"}
                    onChange={() => setVerificationType("utility")}
                  />
                  <label htmlFor="utility" className="verification-label">
                    <div className="radio-indicator" />
                    <div className="verification-text">
                      <div className="verification-name">💡 Utility Bill</div>
                      <div className="verification-desc">
                        Recent bill matching business name and address
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Verification upload */}
              <div
                className={
                  "upload-zone" + (verificationDrag ? " dragover" : "")
                }
                onClick={() => verificationInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setVerificationDrag(true);
                }}
                onDragLeave={() => setVerificationDrag(false)}
                onDrop={handleSingleDrop(setVerificationFile, setVerificationDrag)}
              >
                <div className="upload-icon">📁</div>
                <div className="upload-title">Upload Document</div>
                <div className="upload-text">
                  Drag &amp; drop or click to browse
                </div>
                <div className="upload-formats">
                  PDF, JPG, PNG accepted (max 10MB)
                </div>
                <input
                  ref={verificationInputRef}
                  type="file"
                  className="file-input"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleSingleFileChange(setVerificationFile)}
                />
              </div>
              <div id="verificationPreview">
                {verificationFile && (
                  <div className="uploaded-file">
                    <div className="file-info">
                      <div className="file-icon">✅</div>
                      <div className="file-details">
                        <div className="file-name">
                          {verificationFile.name}
                        </div>
                        <div className="file-size">
                          {verificationFile.sizeMB} MB
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="file-remove"
                      onClick={() => setVerificationFile(null)}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Logo Upload */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">🎨</div>
                Business Logo (Required)
              </div>

              <div className="image-requirements">
                <div className="requirement-item">
                  ✓ Square format (500x500px minimum)
                </div>
                <div className="requirement-item">
                  ✓ Clear, high-quality image
                </div>
                <div className="requirement-item">
                  ✓ Your business logo or icon
                </div>
              </div>

              <div
                className={"upload-zone" + (logoDrag ? " dragover" : "")}
                onClick={() => logoInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setLogoDrag(true);
                }}
                onDragLeave={() => setLogoDrag(false)}
                onDrop={handleSingleDrop(setLogoFile, setLogoDrag)}
              >
                <div className="upload-icon">🖼️</div>
                <div className="upload-title">Upload Logo</div>
                <div className="upload-text">
                  Drag &amp; drop or click to browse
                </div>
                <div className="upload-formats">
                  JPG, PNG accepted (max 5MB)
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  className="file-input"
                  accept=".jpg,.jpeg,.png"
                  onChange={handleSingleFileChange(setLogoFile)}
                />
              </div>
              <div id="logoPreview">
                {logoFile && (
                  <div className="uploaded-file">
                    <div className="file-info">
                      <div className="file-icon">✅</div>
                      <div className="file-details">
                        <div className="file-name">{logoFile.name}</div>
                        <div className="file-size">
                          {logoFile.sizeMB} MB
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="file-remove"
                      onClick={() => setLogoFile(null)}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Main Photo Upload */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">📸</div>
                Main Photo (Required)
              </div>

              <div className="image-requirements">
                <div className="requirement-item">
                  ✓ Horizontal format (1200x630px minimum)
                </div>
                <div className="requirement-item">
                  ✓ Show your best angle: dining room, products, or activity
                </div>
                <div className="requirement-item">
                  ✓ Well-lit, professional quality
                </div>
              </div>

              <div
                className={
                  "upload-zone" + (mainPhotoDrag ? " dragover" : "")
                }
                onClick={() => mainPhotoInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setMainPhotoDrag(true);
                }}
                onDragLeave={() => setMainPhotoDrag(false)}
                onDrop={handleSingleDrop(setMainPhotoFile, setMainPhotoDrag)}
              >
                <div className="upload-icon">🌅</div>
                <div className="upload-title">Upload Main Photo</div>
                <div className="upload-text">
                  Drag &amp; drop or click to browse
                </div>
                <div className="upload-formats">
                  JPG, PNG accepted (max 5MB)
                </div>
                <input
                  ref={mainPhotoInputRef}
                  type="file"
                  className="file-input"
                  accept=".jpg,.jpeg,.png"
                  onChange={handleSingleFileChange(setMainPhotoFile)}
                />
              </div>
              <div id="mainPhotoPreview">
                {mainPhotoFile && (
                  <div className="uploaded-file">
                    <div className="file-info">
                      <div className="file-icon">✅</div>
                      <div className="file-details">
                        <div className="file-name">{mainPhotoFile.name}</div>
                        <div className="file-size">
                          {mainPhotoFile.sizeMB} MB
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="file-remove"
                      onClick={() => setMainPhotoFile(null)}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Gallery Upload */}
            <div className="form-section">
              <div className="section-title">
                <div className="section-icon">🖼️</div>
                Photo Gallery (Optional)
              </div>

              <div
                className={"upload-zone" + (galleryDrag ? " dragover" : "")}
                onClick={() => galleryInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setGalleryDrag(true);
                }}
                onDragLeave={() => setGalleryDrag(false)}
                onDrop={handleGalleryDrop}
              >
                <div className="upload-icon">📷</div>
                <div className="upload-title">Upload Gallery Photos</div>
                <div className="upload-text">
                  Add up to 5 additional photos
                </div>
                <div className="upload-formats">
                  JPG, PNG accepted (max 5MB each)
                </div>
                <input
                  ref={galleryInputRef}
                  type="file"
                  className="file-input"
                  accept=".jpg,.jpeg,.png"
                  multiple
                  onChange={handleGalleryChange}
                />
              </div>

              <div className="gallery-preview" id="galleryPreview">
                {galleryFiles.length === 0 ? (
                  <>
                    <div className="gallery-item">
                      <div className="gallery-placeholder">+</div>
                    </div>
                    <div className="gallery-item">
                      <div className="gallery-placeholder">+</div>
                    </div>
                    <div className="gallery-item">
                      <div className="gallery-placeholder">+</div>
                    </div>
                    <div className="gallery-item">
                      <div className="gallery-placeholder">+</div>
                    </div>
                    <div className="gallery-item">
                      <div className="gallery-placeholder">+</div>
                    </div>
                  </>
                ) : (
                  galleryFiles.map((file, idx) => (
                    <div className="gallery-item" key={idx}>
                      <div className="gallery-placeholder">
                        {idx + 1}
                        <div
                          style={{
                            fontSize: "0.6rem",
                            marginTop: "4px",
                            textAlign: "center",
                          }}
                        >
                          {file.name.length > 14
                            ? file.name.slice(0, 11) + "..."
                            : file.name}
                        </div>
                      </div>
                    </div>
                  ))
                )}
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
                Continue to Final Step →
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
        .step6-root {
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

        .verification-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .verification-option {
          position: relative;
        }

        .verification-option input[type="radio"] {
          position: absolute;
          opacity: 0;
        }

        .verification-label {
          display: flex;
          align-items: center;
          padding: 16px;
          border: 2px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          background: var(--bg-white);
        }

        .verification-option input:checked + .verification-label {
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
          flex-shrink: 0;
        }

        .verification-option input:checked
          + .verification-label
          .radio-indicator {
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

        .verification-option input:checked
          + .verification-label
          .radio-indicator::after {
          transform: translate(-50%, -50%) scale(1);
        }

        .verification-text {
          flex: 1;
        }

        .verification-name {
          font-weight: 600;
          color: var(--text-dark);
          margin-bottom: 4px;
        }

        .verification-desc {
          font-size: 0.8125rem;
          color: var(--text-light);
        }

        .upload-zone {
          border: 3px dashed var(--border);
          border-radius: 16px;
          padding: 40px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          background: var(--bg-light);
          position: relative;
          overflow: hidden;
        }

        .upload-zone:hover {
          border-color: var(--primary);
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.03) 0%,
            rgba(255, 107, 53, 0.08) 100%
          );
        }

        .upload-zone.dragover {
          border-color: var(--primary);
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.08) 0%,
            rgba(255, 107, 53, 0.15) 100%
          );
          transform: scale(1.02);
        }

        .upload-icon {
          font-size: 3rem;
          margin-bottom: 16px;
        }

        .upload-title {
          font-family: "Outfit", system-ui, sans-serif;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-dark);
          margin-bottom: 8px;
        }

        .upload-text {
          color: var(--text-light);
          font-size: 0.875rem;
          margin-bottom: 4px;
        }

        .upload-formats {
          font-size: 0.75rem;
          color: var(--text-light);
        }

        .file-input {
          display: none;
        }

        .uploaded-file {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: linear-gradient(
            135deg,
            rgba(0, 200, 150, 0.05) 0%,
            rgba(0, 200, 150, 0.1) 100%
          );
          border: 2px solid rgba(0, 200, 150, 0.2);
          border-radius: 12px;
          margin-top: 16px;
          animation: slideIn 0.3s ease;
        }

        .file-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .file-icon {
          font-size: 1.5rem;
        }

        .file-details {
          flex: 1;
        }

        .file-name {
          font-weight: 600;
          color: var(--text-dark);
          font-size: 0.9375rem;
        }

        .file-size {
          font-size: 0.8125rem;
          color: var(--text-light);
        }

        .file-remove {
          background: transparent;
          border: none;
          color: var(--text-light);
          cursor: pointer;
          font-size: 1.25rem;
          padding: 8px;
          transition: color 0.3s ease;
        }

        .file-remove:hover {
          color: var(--primary);
        }

        .image-requirements {
          background: var(--bg-light);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          font-size: 0.875rem;
          color: var(--text-medium);
        }

        .requirement-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 8px;
        }

        .requirement-item:last-child {
          margin-bottom: 0;
        }

        .gallery-preview {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
          margin-top: 16px;
        }

        .gallery-item {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          background: var(--bg-light);
          border: 2px solid var(--border);
        }

        .gallery-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          color: var(--text-light);
          font-size: 2rem;
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

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @media (max-width: 640px) {
          .container {
            padding: 16px;
          }

          .form-card {
            padding: 28px 20px;
          }

          .gallery-preview {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  );
}