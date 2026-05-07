"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BackofficeLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  // Redirect to dashboard if already authed
  useEffect(() => {
    fetch("/api/backoffice/verify")
      .then(r => { if (r.ok) router.replace("/backoffice"); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/backoffice/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Invalid credentials.");
        return;
      }
      router.push("/backoffice");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={styles.page}>
        <style>{css}</style>
        <div style={{ color: "#55546a", fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{css}</style>
      <div style={styles.card}>
        <div style={styles.brand}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#648FFF" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          Backoffice
        </div>
        <div style={styles.sub}>Sign in to access the admin dashboard</div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              style={styles.input}
              autoComplete="email"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
              autoComplete="current-password"
            />
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0f0f12",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    width: 360,
    background: "#18181f",
    border: "1px solid #2a2a35",
    borderRadius: 12,
    padding: "32px 28px",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 16,
    fontWeight: 700,
    color: "#e8e6f0",
    marginBottom: 6,
  },
  sub: {
    fontSize: 12,
    color: "#55546a",
    marginBottom: 28,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 11,
    color: "#9896a8",
    letterSpacing: "0.3px",
  },
  input: {
    fontFamily: "inherit",
    fontSize: 13,
    background: "#0f0f12",
    border: "1px solid #2a2a35",
    borderRadius: 6,
    color: "#e8e6f0",
    padding: "9px 12px",
    outline: "none",
    transition: "border-color 0.15s",
  },
  error: {
    fontSize: 12,
    color: "#e05555",
    background: "rgba(224,85,85,0.1)",
    border: "1px solid rgba(224,85,85,0.25)",
    borderRadius: 6,
    padding: "8px 12px",
  },
  btn: {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    background: "#648FFF",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "10px",
    cursor: "pointer",
    transition: "opacity 0.15s",
    marginTop: 4,
  },
};

const css = `
  input:focus { border-color: rgba(100,143,255,0.5) !important; }
  button:hover:not(:disabled) { opacity: 0.85; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
`;
