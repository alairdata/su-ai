"use client";

interface LimitModalProps {
  theme: string;
  plan: string;
  limitCountdown: { h: number; m: number; s: number };
  onClose: () => void;
}

export default function LimitModal({ theme, plan, limitCountdown, onClose }: LimitModalProps) {
  const { h, m, s } = limitCountdown;
  const limit = plan === 'Free' ? 5 : plan === 'Special' ? 10 : plan === 'Pro' ? 100 : 300;
  const nextPlan = (plan === 'Free' || plan === 'Special') ? 'Pro' : plan === 'Pro' ? 'Plus' : null;
  const nextPlanPrice = (plan === 'Free' || plan === 'Special') ? '$4.99' : '$9.99';
  const nextPlanMessages = (plan === 'Free' || plan === 'Special') ? '100' : '300';
  const multiplier = plan === 'Free' ? '20x' : plan === 'Special' ? '10x' : '3x';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <div style={{
        background: `linear-gradient(135deg, ${theme === 'dark' ? 'rgba(232,160,76,0.15), rgba(232,98,76,0.08)' : 'rgba(208,138,48,0.15), rgba(208,78,48,0.08)'})`,
        borderRadius: '24px',
        padding: '1px',
        maxWidth: '400px',
        width: '100%',
        animation: 'scaleIn 0.35s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{
          background: theme === 'dark' ? '#111114' : '#FFFFFF',
          borderRadius: '23px',
          padding: '36px 32px 28px',
          textAlign: 'center' as const,
          position: 'relative' as const,
          overflow: 'hidden',
        }}>
          {/* Subtle glow */}
          <div style={{
            position: 'absolute' as const, top: '-40px', left: '50%', transform: 'translateX(-50%)',
            width: '200px', height: '200px',
            background: 'radial-gradient(circle, rgba(232,160,76,0.08) 0%, transparent 70%)',
            pointerEvents: 'none' as const,
          }} />

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute' as const, top: '16px', right: '16px',
              width: '28px', height: '28px', borderRadius: '8px',
              background: theme === 'dark' ? '#18181C' : '#F0EFEC',
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              color: theme === 'dark' ? '#7A7680' : '#9A969F',
              fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >&#10005;</button>

          {/* Emoji */}
          <span style={{ fontSize: '48px', marginBottom: '20px', display: 'block', position: 'relative' as const }}>&#9889;</span>

          {/* Title */}
          <div style={{
            fontSize: '22px', fontWeight: 800, marginBottom: '8px', lineHeight: 1.2,
            background: `linear-gradient(135deg, ${theme === 'dark' ? '#E8A04C' : '#D08A30'}, ${theme === 'dark' ? '#E8624C' : '#D04E30'})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            You&apos;ve hit today&apos;s limit
          </div>

          {/* Text */}
          <div style={{
            fontSize: '14px', color: theme === 'dark' ? '#8A8690' : '#6B6870',
            lineHeight: 1.6, marginBottom: '24px', maxWidth: '320px',
            marginLeft: 'auto', marginRight: 'auto',
          }}>
            {limit} messages gone. I had more to say, but we&apos;ll have to pick this up later — unless you want to keep going.
          </div>

          {/* Timer */}
          <div style={{
            background: theme === 'dark' ? '#18181C' : '#F0EFEC',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: '14px', padding: '16px 20px', marginBottom: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
          }}>
            <div style={{ textAlign: 'center' as const, minWidth: '52px' }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 700,
                color: theme === 'dark' ? '#F0EDE8' : '#1A1A1C', display: 'block', lineHeight: 1, marginBottom: '4px',
              }}>{String(h).padStart(2, '0')}</span>
              <span style={{ fontSize: '9px', color: theme === 'dark' ? '#7A7680' : '#9A969F', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 600 }}>Hours</span>
            </div>
            <span style={{ fontSize: '22px', color: theme === 'dark' ? '#7A7680' : '#9A969F', fontWeight: 700, margin: '0 2px', alignSelf: 'flex-start', marginTop: '4px' }}>:</span>
            <div style={{ textAlign: 'center' as const, minWidth: '52px' }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 700,
                color: theme === 'dark' ? '#F0EDE8' : '#1A1A1C', display: 'block', lineHeight: 1, marginBottom: '4px',
              }}>{String(m).padStart(2, '0')}</span>
              <span style={{ fontSize: '9px', color: theme === 'dark' ? '#7A7680' : '#9A969F', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 600 }}>Min</span>
            </div>
            <span style={{ fontSize: '22px', color: theme === 'dark' ? '#7A7680' : '#9A969F', fontWeight: 700, margin: '0 2px', alignSelf: 'flex-start', marginTop: '4px' }}>:</span>
            <div style={{ textAlign: 'center' as const, minWidth: '52px' }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 700,
                color: theme === 'dark' ? '#F0EDE8' : '#1A1A1C', display: 'block', lineHeight: 1, marginBottom: '4px',
              }}>{String(s).padStart(2, '0')}</span>
              <span style={{ fontSize: '9px', color: theme === 'dark' ? '#7A7680' : '#9A969F', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 600 }}>Sec</span>
            </div>
          </div>

          {/* Features */}
          {nextPlan && (
            <div style={{ textAlign: 'left' as const, marginBottom: '28px', display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 12px', borderRadius: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0, background: 'rgba(232,160,76,0.1)' }}>&#128172;</div>
                <span style={{ fontSize: '13px', color: theme === 'dark' ? '#8A8690' : '#6B6870', fontWeight: 500 }}>
                  <b style={{ color: theme === 'dark' ? '#F0EDE8' : '#1A1A1C', fontWeight: 700 }}>{nextPlanMessages}</b> messages per day
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 700, padding: '3px 7px', borderRadius: '4px', background: 'rgba(232,160,76,0.1)', color: theme === 'dark' ? '#E8A04C' : '#D08A30', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>{multiplier} more</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 12px', borderRadius: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0, background: 'rgba(179,136,255,0.1)' }}>&#128101;</div>
                <span style={{ fontSize: '13px', color: theme === 'dark' ? '#8A8690' : '#6B6870', fontWeight: 500 }}>
                  <b style={{ color: theme === 'dark' ? '#F0EDE8' : '#1A1A1C', fontWeight: 700 }}>Unlimited</b> chat characters
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 12px', borderRadius: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0, background: 'rgba(100,210,255,0.1)' }}>&#128206;</div>
                <span style={{ fontSize: '13px', color: theme === 'dark' ? '#8A8690' : '#6B6870', fontWeight: 500 }}>File & image uploads</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 12px', borderRadius: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0, background: 'rgba(105,240,174,0.1)' }}>&#127912;</div>
                <span style={{ fontSize: '13px', color: theme === 'dark' ? '#8A8690' : '#6B6870', fontWeight: 500 }}>AI image generation</span>
              </div>
            </div>
          )}

          {/* Upgrade button */}
          {nextPlan && (
            <button
              onClick={() => { onClose(); window.location.href = `/checkout?plan=${nextPlan}`; }}
              style={{
                width: '100%', padding: '15px', border: 'none', borderRadius: '14px',
                background: `linear-gradient(135deg, ${theme === 'dark' ? '#E8A04C' : '#D08A30'}, ${theme === 'dark' ? '#E8624C' : '#D04E30'})`,
                color: '#fff', fontFamily: "'DM Sans', sans-serif",
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.2s', marginBottom: '10px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(232,160,76,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              Upgrade to {nextPlan}
              <span style={{ display: 'block', fontSize: '11px', fontWeight: 500, opacity: 0.8, marginTop: '2px' }}>
                {nextPlanPrice}/month &middot; Cancel anytime
              </span>
            </button>
          )}

          {/* Wait button */}
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '12px', border: 'none', borderRadius: '10px',
              background: 'transparent', color: theme === 'dark' ? '#7A7680' : '#9A969F',
              fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = theme === 'dark' ? '#8A8690' : '#6B6870'; e.currentTarget.style.background = theme === 'dark' ? '#18181C' : '#F0EFEC'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme === 'dark' ? '#7A7680' : '#9A969F'; e.currentTarget.style.background = 'transparent'; }}
          >
            I&apos;ll come back tomorrow
          </button>
        </div>
      </div>
    </div>
  );
}
