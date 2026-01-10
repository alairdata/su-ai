"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

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
        setSuccess(data.message);
        setPassword("");
        setConfirmPassword("");
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/?reset=success");
        }, 3000);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch (err) {
      setError("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const currentStyles = theme === "dark" ? darkStyles : lightStyles;

  if (!token) {
    return (
      <div style={currentStyles.container}>
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <button onClick={toggleTheme} style={currentStyles.themeToggle}>
          {theme === "light" ? "🌙" : "☀️"}
        </button>
        <div style={currentStyles.card}>
          <div style={currentStyles.logoContainer}>
            <div style={currentStyles.logo} className="auth-logo-glow" />
            <h1 style={currentStyles.title}>Invalid Link</h1>
          </div>
          <div style={currentStyles.error}>
            This reset link is invalid or has expired. Please request a new password reset.
          </div>
          <a href="/" style={currentStyles.link}>
            ← Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={currentStyles.container}>
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />
      <button onClick={toggleTheme} style={currentStyles.themeToggle}>
        {theme === "light" ? "🌙" : "☀️"}
      </button>
      <div style={currentStyles.card}>
        <div style={currentStyles.logoContainer}>
          <div style={currentStyles.logo} className="auth-logo-glow" />
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
              style={currentStyles.button}
              disabled={loading}
              className="auth-btn-ripple"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <div style={currentStyles.footer}>
          <a href="/" style={currentStyles.link}>
            ← Back to login
          </a>
        </div>
      </div>
    </div>
  );
}

const lightStyles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "#f8f9fa",
    position: "relative" as const,
    overflow: "hidden",
  },
  themeToggle: {
    position: "absolute" as const,
    top: "24px",
    right: "24px",
    background: "#fafafa",
    border: "1px solid #e0e0e0",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "18px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    zIndex: 10,
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    padding: "36px 32px",
    background: "rgba(255, 255, 255, 0.65)",
    borderRadius: "24px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.4)",
    position: "relative" as const,
    zIndex: 1,
  },
  logoContainer: {
    textAlign: "center" as const,
    marginBottom: "20px",
  },
  logo: {
    width: "48px",
    height: "48px",
    background: "linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 100%)",
    border: "2px solid #d0d0d0",
    borderRadius: "14px",
    margin: "0 auto 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    color: "#666",
  },
  title: {
    fontSize: "26px",
    fontWeight: 600,
    marginBottom: "6px",
    color: "#1a1a1a",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: "14px",
    color: "#666",
  },
  error: {
    padding: "12px 16px",
    background: "rgba(239, 68, 68, 0.1)",
    borderLeft: "4px solid #ef4444",
    borderRadius: "8px",
    color: "#ef4444",
    fontSize: "14px",
    marginBottom: "20px",
  },
  success: {
    padding: "12px 16px",
    background: "rgba(16, 185, 129, 0.1)",
    borderLeft: "4px solid #10b981",
    borderRadius: "8px",
    color: "#10b981",
    fontSize: "14px",
    marginBottom: "20px",
  },
  formGroup: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontSize: "13px",
    fontWeight: 500,
    color: "#444",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    border: "1px solid #e0e0e0",
    borderRadius: "10px",
    fontSize: "14px",
    background: "#fafafa",
    color: "#1a1a1a",
    boxSizing: "border-box" as const,
    transition: "all 0.3s ease",
    outline: "none",
  },
  button: {
    width: "100%",
    padding: "13px 24px",
    border: "1px solid #d0d0d0",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    background: "linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 100%)",
    color: "#1a1a1a",
    transition: "all 0.3s ease",
    marginTop: "20px",
  },
  footer: {
    textAlign: "center" as const,
    marginTop: "24px",
  },
  link: {
    color: "#1a1a1a",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
};

const darkStyles: { [key: string]: React.CSSProperties } = {
  ...lightStyles,
  container: {
    ...lightStyles.container,
    background: "#0a0a0a",
  },
  themeToggle: {
    ...lightStyles.themeToggle,
    background: "rgba(30, 30, 40, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#fff",
  },
  card: {
    ...lightStyles.card,
    background: "rgba(20, 20, 30, 0.7)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  },
  logo: {
    ...lightStyles.logo,
    background: "rgba(255, 255, 255, 0.1)",
    border: "2px solid rgba(255, 255, 255, 0.2)",
    color: "#999",
  },
  title: {
    ...lightStyles.title,
    color: "#fff",
  },
  subtitle: {
    ...lightStyles.subtitle,
    color: "#999",
  },
  label: {
    ...lightStyles.label,
    color: "#fff",
  },
  input: {
    ...lightStyles.input,
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#fff",
  },
  button: {
    ...lightStyles.button,
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    color: "#fff",
  },
  link: {
    ...lightStyles.link,
    color: "#fff",
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
            background: "#f5f5f7",
          }}
        >
          <div style={{ fontSize: "18px", color: "#666" }}>Loading...</div>
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
