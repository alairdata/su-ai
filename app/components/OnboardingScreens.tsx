import React, { useState, useEffect } from "react";
import { BoltLogo } from "./BoltLogo";

export const OnboardingScreen1 = ({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) => {
  const [demoMessages, setDemoMessages] = useState<{text: string; type: 'user' | 'ai' | 'typing'}[]>([]);
  const [currentConvo, setCurrentConvo] = useState(0);

  const conversations = [
    {
      user: "Am I overthinking this?",
      ai: "Probably. You're here asking an AI at 2am instead of sleeping. That's textbook overthinking. What's eating at you?"
    },
    {
      user: "How do I get my ex back?",
      ai: "Short answer? You probably shouldn't. But I know you don't want to hear that, so let's talk about why you're really asking."
    },
    {
      user: "Give me honest feedback on my business idea",
      ai: "Sure — but fair warning, I don't do the 'everything is great!' thing. Drop your idea and I'll tell you exactly what I think."
    }
  ];

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];

    const playConvo = (index: number) => {
      setDemoMessages([]);
      const convo = conversations[index];

      timeouts.push(setTimeout(() => {
        setDemoMessages([{ text: convo.user, type: 'user' }]);
      }, 300));

      timeouts.push(setTimeout(() => {
        setDemoMessages(prev => [...prev, { text: '', type: 'typing' }]);
      }, 1200));

      timeouts.push(setTimeout(() => {
        setDemoMessages([
          { text: convo.user, type: 'user' },
          { text: convo.ai, type: 'ai' }
        ]);
      }, 2800));
    };

    playConvo(0);

    const interval = setInterval(() => {
      setCurrentConvo(prev => {
        const next = (prev + 1) % conversations.length;
        playConvo(next);
        return next;
      });
    }, 5500);

    return () => {
      clearInterval(interval);
      timeouts.forEach(t => clearTimeout(t));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      zIndex: 1,
      animation: 'onboardFadeDown 0.6s ease forwards',
      width: '100%',
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        borderRadius: '100px',
        background: 'rgba(232,160,76,0.12)',
        border: '1px solid rgba(232,160,76,0.2)',
        color: '#E8A04C',
        fontSize: '12px',
        fontWeight: 600,
        marginBottom: '28px',
      }}>
        <BoltLogo size={14} />
        Not your average AI
      </div>

      <h1 style={{
        fontSize: 'clamp(28px, 5vw, 42px)',
        fontWeight: 800,
        letterSpacing: '-0.04em',
        textAlign: 'center',
        lineHeight: 1.15,
        marginBottom: '12px',
        color: '#F0EDE8',
      }}>
        This ain&apos;t your<br />regular{' '}
        <span style={{
          background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>AI chat</span>
      </h1>

      <p style={{ fontSize: '15px', color: '#8A8690', textAlign: 'center', marginBottom: '40px' }}>
        No sugar-coating. No corporate talk. Just real.
      </p>

      <div style={{
        width: '100%',
        maxWidth: '420px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginBottom: '48px',
        minHeight: '150px',
      }}>
        {demoMessages.map((msg, i) => (
          msg.type === 'typing' ? (
            <div key={i} style={{
              display: 'flex',
              gap: '4px',
              padding: '14px 18px',
              background: '#141416',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '18px 18px 18px 4px',
              alignSelf: 'flex-start',
              animation: 'onboardMsgAppear 0.3s ease forwards',
            }}>
              {[0, 1, 2].map(d => (
                <span key={d} style={{
                  width: '6px', height: '6px',
                  borderRadius: '50%',
                  background: '#7A7680',
                  animation: `onboardBounce 1.4s ${d * 0.2}s infinite`,
                  display: 'block',
                }} />
              ))}
            </div>
          ) : (
            <div key={i} style={{
              padding: '14px 18px',
              borderRadius: msg.type === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              fontSize: '14px',
              lineHeight: 1.5,
              maxWidth: '85%',
              alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
              background: msg.type === 'user' ? '#1A1A1E' : '#141416',
              color: '#F0EDE8',
              border: msg.type === 'ai' ? '1px solid rgba(255,255,255,0.06)' : 'none',
              animation: 'onboardMsgAppear 0.4s ease forwards',
            }}>
              {msg.text}
            </div>
          )
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: currentConvo === i ? '20px' : '6px',
            height: '6px',
            borderRadius: currentConvo === i ? '3px' : '50%',
            background: currentConvo === i ? '#E8A04C' : '#7A7680',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      <button onClick={onNext} style={{
        padding: '14px 32px',
        borderRadius: '14px',
        border: 'none',
        background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
        color: '#0C0C0E',
        fontSize: '15px',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.25s ease',
      }}>
        I&apos;m ready
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="13 17 18 12 13 7"/><line x1="6" y1="12" x2="18" y2="12"/></svg>
      </button>
      <div onClick={onSkip} style={{ fontSize: '12px', color: '#7A7680', cursor: 'pointer', marginTop: '16px' }}>
        Skip intro
      </div>
    </div>
  );
};

export const OnboardingScreen2 = ({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) => {
  const [count, setCount] = useState(0);
  const [filledPills, setFilledPills] = useState<number[]>([]);
  const [showRefill, setShowRefill] = useState(false);
  const [refillAnimate, setRefillAnimate] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    let c = 0;
    const interval = setInterval(() => {
      c++;
      setCount(c);
      setFilledPills(prev => [...prev, c]);
      if (c >= 5) {
        clearInterval(interval);
        setTimeout(() => setRefillAnimate(true), 400);
        setTimeout(() => setShowRefill(true), 800);
        setTimeout(() => setShowDaily(true), 1800);
        setTimeout(() => setShowButton(true), 2500);
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      zIndex: 1,
      animation: 'onboardFadeDown 0.6s ease forwards',
      width: '100%',
    }}>
      <BoltLogo size={48} />

      <h1 style={{
        fontSize: 'clamp(24px, 4.5vw, 36px)',
        fontWeight: 800,
        letterSpacing: '-0.04em',
        textAlign: 'center',
        marginBottom: '8px',
        marginTop: '24px',
        color: '#F0EDE8',
      }}>
        Just so you know...
      </h1>

      <p style={{
        fontSize: '15px',
        color: '#8A8690',
        textAlign: 'center',
        marginBottom: '40px',
        maxWidth: '340px',
      }}>
        You get free messages every day. Use them wisely — or don&apos;t. We don&apos;t judge.
      </p>

      <div style={{
        width: '100%',
        maxWidth: '320px',
        background: '#141416',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '20px',
        padding: '32px 28px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '20px',
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          color: '#7A7680',
          marginBottom: '16px',
        }}>YOUR DAILY MESSAGES</div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', marginBottom: '20px' }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '72px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
          }}>{count}</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '18px',
            color: '#7A7680',
            fontWeight: 500,
          }}>free</span>
        </div>

        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '16px', maxWidth: '240px', margin: '0 auto 16px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              width: '18px', height: '18px',
              borderRadius: '5px',
              background: filledPills.includes(i + 1)
                ? 'linear-gradient(135deg, #E8A04C, #E8624C)'
                : '#1A1A1E',
              border: filledPills.includes(i + 1) ? 'none' : '1px solid rgba(255,255,255,0.06)',
              opacity: filledPills.includes(i + 1) ? 1 : 0.3,
              boxShadow: filledPills.includes(i + 1) ? '0 0 8px rgba(232,160,76,0.3)' : 'none',
              animation: filledPills.includes(i + 1) ? 'onboardPillPop 0.3s ease forwards' : 'none',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        <div style={{ width: '100%', height: '6px', background: '#1A1A1E', borderRadius: '3px', overflow: 'hidden', marginTop: '4px' }}>
          <div style={{
            height: '100%',
            width: refillAnimate ? '100%' : '0%',
            background: 'linear-gradient(90deg, #E8A04C, #E8624C)',
            borderRadius: '3px',
            transition: 'width 2s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          marginTop: '12px',
          fontSize: '13px',
          color: '#8A8690',
          opacity: showRefill ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8A04C" strokeWidth="2" strokeLinecap="round" style={{ animation: 'onboardSpin 2s linear infinite' }}>
            <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 11-1.64-8.36L23 10"/>
          </svg>
          Refills every midnight
        </div>
      </div>

      {showDaily && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: 'rgba(232,160,76,0.12)',
          border: '1px solid rgba(232,160,76,0.15)',
          borderRadius: '12px',
          animation: 'onboardFadeDown 0.5s ease forwards',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8A04C" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <span style={{ fontSize: '13px', color: '#8A8690' }}>
            <strong style={{ color: '#E8A04C' }}>5 messages</strong> reset at midnight in your timezone
          </span>
        </div>
      )}

      <div style={{
        marginTop: '12px',
        fontSize: '12px',
        color: '#7A7680',
        opacity: showDaily ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}>
        Want more? <span style={{ color: '#E8A04C', cursor: 'pointer', textDecoration: 'underline' }} onClick={onSkip}>See plans</span> starting at $4.99/mo
      </div>

      {showButton && (
        <div style={{ animation: 'onboardFadeDown 0.5s ease forwards', marginTop: '28px' }}>
          <button onClick={onNext} style={{
            padding: '14px 32px',
            borderRadius: '14px',
            border: 'none',
            background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
            color: '#0C0C0E',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            Got it
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="13 17 18 12 13 7"/><line x1="6" y1="12" x2="18" y2="12"/></svg>
          </button>
          <div onClick={onSkip} style={{ fontSize: '12px', color: '#7A7680', cursor: 'pointer', marginTop: '16px', textAlign: 'center' }}>
            Skip
          </div>
        </div>
      )}
    </div>
  );
};

export const OnboardingScreen3 = ({ onComplete }: { onComplete: () => void }) => {
  const [visibleFeatures, setVisibleFeatures] = useState<number[]>([]);
  const [showButton, setShowButton] = useState(false);

  const features = [
    {
      name: 'Brutally honest advice',
      desc: 'No sugar-coating. Just straight-up real talk.',
      tag: 'Tip: You can ask it to tone down anytime',
      tagType: 'tip' as const,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      ),
    },
    {
      name: 'Chat characters',
      desc: 'Add different AI personalities to spice up your conversations.',
      tag: 'Coming for Pro+',
      tagType: 'coming' as const,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      ),
    },
    {
      name: 'No topic off limits',
      desc: 'Relationships, money, embarrassing questions — ask anything.',
      tag: null,
      tagType: null,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
      ),
    },
    {
      name: 'It remembers you',
      desc: 'Come back tomorrow and it picks up where you left off.',
      tag: null,
      tagType: null,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
        </svg>
      ),
    },
  ];

  useEffect(() => {
    features.forEach((_, i) => {
      setTimeout(() => {
        setVisibleFeatures(prev => [...prev, i]);
      }, 700 + (i * 200));
    });

    setTimeout(() => setShowButton(true), 700 + (features.length * 200) + 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      zIndex: 1,
      animation: 'onboardFadeDown 0.6s ease forwards',
      width: '100%',
    }}>
      <BoltLogo size={40} />

      <h1 style={{
        fontSize: 'clamp(22px, 4vw, 32px)',
        fontWeight: 800,
        letterSpacing: '-0.04em',
        textAlign: 'center',
        marginBottom: '6px',
        marginTop: '16px',
        color: '#F0EDE8',
      }}>
        Here&apos;s what you can do
      </h1>

      <p style={{
        fontSize: '14px',
        color: '#8A8690',
        textAlign: 'center',
        marginBottom: '28px',
        maxWidth: '340px',
      }}>
        A few things that make this different from anything you&apos;ve used before.
      </p>

      <div style={{ width: '100%', maxWidth: '400px' }}>
        {features.map((f, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            padding: '12px 0',
            borderBottom: i < features.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            opacity: visibleFeatures.includes(i) ? 1 : 0,
            transform: visibleFeatures.includes(i) ? 'translateX(0)' : 'translateX(-20px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
          }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: visibleFeatures.includes(i) ? 'rgba(232,160,76,0.12)' : '#141416',
              border: `1px solid ${visibleFeatures.includes(i) ? 'rgba(232,160,76,0.2)' : 'rgba(255,255,255,0.06)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#E8A04C',
              transition: 'all 0.3s ease',
            }}>
              {f.icon}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#F0EDE8', marginBottom: '2px' }}>{f.name}</div>
              <div style={{ fontSize: '12px', color: '#8A8690', lineHeight: 1.45 }}>{f.desc}</div>
              {f.tag && (
                <div style={{
                  display: 'inline-flex',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  marginTop: '6px',
                  textTransform: 'uppercase' as const,
                  background: f.tagType === 'tip' ? 'rgba(232,160,76,0.1)' : 'rgba(138,134,144,0.1)',
                  color: f.tagType === 'tip' ? '#E8A04C' : '#8A8690',
                  border: `1px solid ${f.tagType === 'tip' ? 'rgba(232,160,76,0.15)' : 'rgba(138,134,144,0.15)'}`,
                }}>
                  {f.tag}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showButton && (
        <div style={{ animation: 'onboardFadeDown 0.5s ease forwards', marginTop: '28px' }}>
          <button onClick={onComplete} style={{
            padding: '14px 32px',
            borderRadius: '14px',
            border: 'none',
            background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
            color: '#0C0C0E',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            Let&apos;s go
            <BoltLogo size={16} />
          </button>
          <div onClick={onComplete} style={{ fontSize: '12px', color: '#7A7680', cursor: 'pointer', marginTop: '16px', textAlign: 'center' }}>
            Skip
          </div>
        </div>
      )}
    </div>
  );
};
