"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, -apple-system, sans-serif',
          background: '#f8f5ef',
          padding: '20px',
        }}>
          <div style={{
            textAlign: 'center',
            maxWidth: '400px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>😵</div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 600,
              marginBottom: '12px',
              color: '#1a1a1a',
            }}>
              Something went wrong
            </h1>
            <p style={{
              color: '#666',
              marginBottom: '24px',
              lineHeight: 1.5,
            }}>
              We've been notified and are working on it. Please try again.
            </p>
            <button
              onClick={() => reset()}
              style={{
                padding: '12px 24px',
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
      </body>
    </html>
  );
}
