"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, -apple-system, sans-serif',
      padding: '20px',
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '400px',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🙈</div>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 600,
          marginBottom: '12px',
          color: '#1a1a1a',
        }}>
          Oops, something broke
        </h2>
        <p style={{
          color: '#666',
          marginBottom: '24px',
          fontSize: '14px',
          lineHeight: 1.5,
        }}>
          Don't worry, we've been notified. Try refreshing or click below.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 600,
            background: '#1a1a1a',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
