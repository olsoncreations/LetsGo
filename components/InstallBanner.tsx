"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, X, Share } from "lucide-react";

// ═══════════════════════════════════════════════════
// PWA INSTALL BANNER
// Prompts users to install LetsGo as an app.
// - Android/Desktop: captures beforeinstallprompt
// - iOS: shows manual "Add to Home Screen" instructions
// - Dismissible with localStorage persistence
// ═══════════════════════════════════════════════════

const DISMISS_KEY = "letsgo-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as unknown as { standalone: boolean }).standalone)
  );
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden
  const [installing, setInstalling] = useState(false);

  // Check dismiss state on mount
  useEffect(() => {
    if (isStandalone()) return; // Already installed

    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const ts = parseInt(raw, 10);
      if (Date.now() - ts < DISMISS_DURATION_MS) return; // Still within dismiss window
    }

    // Show banner for iOS or wait for beforeinstallprompt
    if (isIOS()) {
      setDismissed(false);
    }
  }, []);

  // Listen for beforeinstallprompt (Android/Desktop)
  useEffect(() => {
    if (isStandalone()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show if not dismissed
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const ts = parseInt(raw, 10);
        if (Date.now() - ts < DISMISS_DURATION_MS) return;
      }
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Hide if app gets installed
  useEffect(() => {
    const handler = () => setDismissed(true);
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      setInstalling(true);
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDismissed(true);
      }
      setDeferredPrompt(null);
      setInstalling(false);
    } else if (isIOS()) {
      setShowIOSGuide(true);
    }
  }, [deferredPrompt]);

  if (dismissed || isStandalone()) return null;

  // iOS instructions overlay
  if (showIOSGuide) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          padding: 16,
        }}
        onClick={() => setShowIOSGuide(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 400,
            background: "#1a1a2e",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "28px 24px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              Install LetsGo
            </span>
            <button
              onClick={() => {
                setShowIOSGuide(false);
                dismiss();
              }}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Step
              num={1}
              text={
                <>
                  Tap the <Share size={14} style={{ verticalAlign: "middle", color: "#00d4ff" }} /> Share button in Safari
                </>
              }
            />
            <Step num={2} text="Scroll down and tap &quot;Add to Home Screen&quot;" />
            <Step num={3} text='Tap "Add" in the top right' />
          </div>

          <div
            style={{
              marginTop: 20,
              padding: "12px 16px",
              background: "rgba(0,212,255,0.06)",
              borderRadius: 12,
              border: "1px solid rgba(0,212,255,0.15)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.55)",
                lineHeight: 1.5,
              }}
            >
              This gives you the full app experience — home screen icon, full-screen mode, and push notifications.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Main install banner
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: "0 12px 12px",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          background: "#1a1a2e",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "16px 18px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gradient accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, #ff2d92, #00d4ff, #39ff14)",
          }}
        />

        {/* Glow */}
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -10,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(0,212,255,0.15)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            position: "relative",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, #ff2d92 0%, #00d4ff 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Download size={22} color="#ffffff" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#ffffff",
                marginBottom: 2,
              }}
            >
              Install LetsGo
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.4,
              }}
            >
              Add to your home screen for the full app experience
            </div>
          </div>

          <button
            onClick={handleInstall}
            disabled={installing}
            style={{
              background: "linear-gradient(135deg, #ff2d92 0%, #00d4ff 100%)",
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 700,
              color: "#ffffff",
              cursor: installing ? "wait" : "pointer",
              flexShrink: 0,
              opacity: installing ? 0.7 : 1,
            }}
          >
            {installing ? "..." : "Install"}
          </button>

          <button
            onClick={dismiss}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.35)",
              padding: 4,
              flexShrink: 0,
            }}
            aria-label="Dismiss install banner"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper ───
function Step({ num, text }: { num: number; text: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(0,212,255,0.12)",
          border: "1px solid rgba(0,212,255,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          color: "#00d4ff",
          flexShrink: 0,
        }}
      >
        {num}
      </div>
      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.4 }}>
        {text}
      </span>
    </div>
  );
}
