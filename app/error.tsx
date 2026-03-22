"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, -apple-system, sans-serif',
      padding: '20px',
      background: '#0C0C0E',
      color: '#F0EDE8',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>😵</div>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 600,
          marginBottom: '12px',
          color: '#F0EDE8',
        }}>
          Something went wrong
        </h2>
        <p style={{
          color: '#8A8690',
          marginBottom: '24px',
          fontSize: '14px',
          lineHeight: 1.5,
        }}>
          The app ran into an unexpected error. Tap below to try again.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: '12px 28px',
            fontSize: '14px',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
            color: '#0C0C0E',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
