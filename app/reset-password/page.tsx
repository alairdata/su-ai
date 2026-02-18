"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { track, EVENTS } from "@/lib/analytics";

const BoltLogo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
    <defs>
      <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E8A04C" />
        <stop offset="100%" stopColor="#E8624C" />
      </linearGradient>
    </defs>
    <path d="M35 4L12 34h14l-4 22L48 26H34l4-22z" fill="url(#boltGrad)" />
  </svg>
);

function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.body.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.body.setAttribute("data-theme", newTheme);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        track(EVENTS.PASSWORD_RESET_COMPLETED);
        setSuccess(data.message);
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          router.push("/?reset=success");
        }, 3000);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch {
      setError("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const currentStyles = theme === "dark" ? darkStyles : lightStyles;

  if (!token) {
    return (
      <div style={currentStyles.container} data-theme={theme}>
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <button onClick={toggleTheme} style={currentStyles.themeToggle}>
          {theme === "light" ? "🌙" : "☀️"}
        </button>
        <div style={currentStyles.card}>
          <div style={currentStyles.logoContainer}>
            <BoltLogo size={48} />
            <h1 style={currentStyles.title}>Invalid Link</h1>
            <p style={currentStyles.subtitle}>
              This reset link is invalid or has expired.
            </p>
          </div>
          <div style={currentStyles.error}>
            Please request a new password reset from the login page.
          </div>
          <Link href="/" style={currentStyles.backLink}>
            <span style={{ marginRight: '6px' }}>&larr;</span> Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={currentStyles.container} data-theme={theme}>
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />
      <button onClick={toggleTheme} style={currentStyles.themeToggle}>
        {theme === "light" ? "🌙" : "☀️"}
      </button>
      <div style={currentStyles.card}>
        <div style={currentStyles.logoContainer}>
          <BoltLogo size={48} />
          <h1 style={currentStyles.title}>Reset Password</h1>
          <p style={currentStyles.subtitle}>Enter your new password below</p>
        </div>

        {error && <div style={currentStyles.error}>{error}</div>}
        {success && <div style={currentStyles.success}>{success}</div>}

        {!success && (
          <form onSubmit={handleSubmit}>
            <div style={currentStyles.formGroup}>
              <label style={currentStyles.label}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={currentStyles.input}
                className="auth-input-focus"
              />
            </div>
            <div style={currentStyles.formGroup}>
              <label style={currentStyles.label}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={currentStyles.input}
                className="auth-input-focus"
              />
            </div>
            <button
              type="submit"
              style={{
                ...currentStyles.button,
                opacity: loading ? 0.7 : 1,
              }}
              disabled={loading}
              className="auth-btn-ripple"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <div style={currentStyles.footer}>
          <Link href="/" style={currentStyles.backLink}>
            <span style={{ marginRight: '6px' }}>&larr;</span> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

const lightStyles: { [key: string]: React.CSSProperties } = {
  container: {
    height: '100dvh',
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: '#F5F4F0',
    position: 'fixed' as const,
    top: 0,
    left: 0,
    overflow: 'hidden' as const,
  },
  themeToggle: {
    position: 'absolute' as const,
    top: '24px',
    right: '24px',
    background: '#EDECE8',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '18px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    zIndex: 10,
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: '36px 32px',
    margin: 'auto',
    background: 'rgba(255, 255, 255, 0.65)',
    borderRadius: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    position: 'relative' as const,
    zIndex: 1,
  },
  logoContainer: {
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  title: {
    fontSize: '26px',
    fontWeight: 600,
    marginBottom: '6px',
    marginTop: '16px',
    color: '#1A1918',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '14px',
    color: '#9A9590',
    margin: 0,
  },
  error: {
    padding: '12px 16px',
    background: 'rgba(232, 90, 90, 0.1)',
    borderLeft: '4px solid #E85A5A',
    borderRadius: '8px',
    color: '#E85A5A',
    fontSize: '14px',
    marginBottom: '20px',
  },
  success: {
    padding: '12px 16px',
    background: 'rgba(16, 185, 129, 0.1)',
    borderLeft: '4px solid #10b981',
    borderRadius: '8px',
    color: '#10b981',
    fontSize: '14px',
    marginBottom: '20px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#6B6660',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    borderRadius: '10px',
    fontSize: '16px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    background: '#EDECE8',
    color: '#1A1918',
    boxSizing: 'border-box' as const,
    transition: 'all 0.3s ease',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '13px 24px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #D08A30, #C05A30)',
    color: '#fff',
    transition: 'all 0.3s ease',
    marginTop: '20px',
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '24px',
  },
  backLink: {
    color: '#9A9590',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'color 0.2s ease',
  },
};

const darkStyles: { [key: string]: React.CSSProperties } = {
  ...lightStyles,
  container: {
    ...lightStyles.container,
    background: '#0C0C0E',
  },
  themeToggle: {
    ...lightStyles.themeToggle,
    background: '#1E1E20',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#E8E6E1',
  },
  card: {
    ...lightStyles.card,
    background: 'rgba(20, 20, 22, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
  title: {
    ...lightStyles.title,
    color: '#E8E6E1',
  },
  subtitle: {
    ...lightStyles.subtitle,
    color: '#6B6660',
  },
  label: {
    ...lightStyles.label,
    color: '#E8E6E1',
  },
  input: {
    ...lightStyles.input,
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#E8E6E1',
  },
  button: {
    ...lightStyles.button,
    background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
    color: '#fff',
    border: 'none',
  },
  backLink: {
    ...lightStyles.backLink,
    color: '#6B6660',
  },
};

export default function ResetPassword() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0C0C0E",
          }}
        >
          <BoltLogo size={48} />
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
