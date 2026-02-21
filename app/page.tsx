"use client";

import React, { useState, useEffect, Suspense, useRef, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useChats } from "./hooks/useChats";
import { useTheme } from "./hooks/useTheme";
import { useMemories } from "./hooks/useMemories";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { track, EVENTS } from "@/lib/analytics";

type View = "auth" | "chat";
type AuthMode = "signin" | "signup";

interface ChatCharacter {
  id: string;
  chat_id: string;
  user_id: string;
  name: string;
  personality: string;
  color_bg: string;
  color_fg: string;
  color_border: string;
  color_bg_light: string;
  color_tag: string;
}

const CHARACTER_COLORS = [
  { name: 'purple', bg: '#2D1B4E', fg: '#B388FF', border: 'rgba(179,136,255,0.2)', bgLight: 'rgba(179,136,255,0.06)', tag: 'rgba(179,136,255,0.15)' },
  { name: 'blue', bg: '#1B3A4E', fg: '#64D2FF', border: 'rgba(100,210,255,0.2)', bgLight: 'rgba(100,210,255,0.06)', tag: 'rgba(100,210,255,0.15)' },
  { name: 'green', bg: '#1B4E2D', fg: '#69F0AE', border: 'rgba(105,240,174,0.2)', bgLight: 'rgba(105,240,174,0.06)', tag: 'rgba(105,240,174,0.15)' },
  { name: 'pink', bg: '#4E1B35', fg: '#FF80AB', border: 'rgba(255,128,171,0.2)', bgLight: 'rgba(255,128,171,0.06)', tag: 'rgba(255,128,171,0.15)' },
  { name: 'orange', bg: '#4E3A1B', fg: '#FFAB40', border: 'rgba(255,171,64,0.2)', bgLight: 'rgba(255,171,64,0.06)', tag: 'rgba(255,171,64,0.15)' },
];

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

// ═══════════════════════════════════════════
// ONBOARDING SCREEN COMPONENTS
// ═══════════════════════════════════════════

const OnboardingScreen1 = ({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) => {
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
                  background: '#5A5660',
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
            background: currentConvo === i ? '#E8A04C' : '#5A5660',
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
      <div onClick={onSkip} style={{ fontSize: '12px', color: '#5A5660', cursor: 'pointer', marginTop: '16px' }}>
        Skip intro
      </div>
    </div>
  );
};

const OnboardingScreen2 = ({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) => {
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
      if (c >= 10) {
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
          color: '#5A5660',
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
            color: '#5A5660',
            fontWeight: 500,
          }}>free</span>
        </div>

        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '16px', maxWidth: '240px', margin: '0 auto 16px' }}>
          {Array.from({ length: 10 }).map((_, i) => (
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
        color: '#5A5660',
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
          <div onClick={onSkip} style={{ fontSize: '12px', color: '#5A5660', cursor: 'pointer', marginTop: '16px', textAlign: 'center' }}>
            Skip
          </div>
        </div>
      )}
    </div>
  );
};

const OnboardingScreen3 = ({ onComplete }: { onComplete: () => void }) => {
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
          <div onClick={onComplete} style={{ fontSize: '12px', color: '#5A5660', cursor: 'pointer', marginTop: '16px', textAlign: 'center' }}>
            Skip
          </div>
        </div>
      )}
    </div>
  );
};

function HomePage() {
  const { data: session, status, update: updateSession } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { memories, isLoading: isMemoriesLoading, plan: memoryPlan, fetchMemories, deleteMemory: deleteMemoryItem, clearAll: clearAllMemories } = useMemories();
  const searchParams = useSearchParams();
  
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showCheckEmail, setShowCheckEmail] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showResetEmailSent, setShowResetEmailSent] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const [showStillThere, setShowStillThere] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingScreen, setOnboardingScreen] = useState(1);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [whatsNewScreen, setWhatsNewScreen] = useState(1);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showMemorySection, setShowMemorySection] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState("");
  const [isUpdatingTimezone, setIsUpdatingTimezone] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showChatActionsModal, setShowChatActionsModal] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    isDestructive?: boolean;
    isLoading?: boolean;
  }>({ show: false, title: '', message: '', confirmText: 'Confirm', onConfirm: () => {}, isLoading: false });
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [selectedChatForActions, setSelectedChatForActions] = useState<{id: string, title: string} | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Analytics refs for typing/focus/abandon/scroll tracking
  const typingStartedRef = useRef(false);
  const inputAbandonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFocusTrackRef = useRef(0);
  const scrollMilestonesRef = useRef(new Set<number>());

  // Auth form states
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [honeypot, setHoneypot] = useState(""); // SECURITY: Honeypot for bot detection
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const setAuthErrorTracked = (msg: string) => {
    setAuthError(msg);
    if (msg) track(EVENTS.FORM_VALIDATION_ERROR, { error_message: msg.slice(0, 100) });
  };
  const [authSuccess, setAuthSuccess] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // Message editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState("");

  // Message feedback state (like/dislike)
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'like' | 'dislike'>>({});

  // Plus menu state
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  // Chat characters state
  const [chatCharacters, setChatCharacters] = useState<ChatCharacter[]>([]);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [isAddingCharacter, setIsAddingCharacter] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharPersonality, setNewCharPersonality] = useState('');
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);

  // File upload state (images + documents)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<"image" | "pdf" | "text" | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const {
    chats,
    currentChat,
    currentChatId,
    isLoading: chatLoading,
    isChatsLoaded,
    isSearching,
    searchQuery,
    messagesEndRef,
    messagesUsed,
    sendMessage,
    startNewChat,
    createNewChat,
    createChatWithEntry,
    selectChat,
    renameChat,
    deleteChat,
    editMessage,
    regenerateResponse,
    stopGeneration,
    canSendMessage,
    getRemainingMessages,
  } = useChats();

  const isAuthLoading = status === "loading";
  const isAuthenticated = !!session?.user;
  const isUnauthenticated = status === "unauthenticated";

  // Check for verification status from URL
  useEffect(() => {
    const verified = searchParams.get('verified');
    const error = searchParams.get('error');

    if (verified === 'true') {
      track(EVENTS.EMAIL_VERIFIED);
      setAuthSuccess('Email verified! You can now log in.');
      setAuthMode('signin');
    } else if (error === 'invalid-token') {
      setAuthErrorTracked('Invalid or expired verification link.');
    } else if (error === 'token-expired') {
      setAuthErrorTracked('Verification link expired. Please sign up again.');
    } else if (error === 'verification-failed') {
      setAuthErrorTracked('Verification failed. Please try again.');
    } else if (error === 'OAuthAccountNotLinked') {
      setAuthErrorTracked('This email is already registered with a different sign-in method.');
    }
  }, [searchParams]);

  // Check if user is new (OAuth first-time user)
  useEffect(() => {
    if (session?.user && session.user.isNewUser) {
      setShowWelcome(true);
    }
  }, [session]);

  // Trigger onboarding for users who haven't completed it
  useEffect(() => {
    if (session?.user && session.user.onboardingComplete === false) {
      setShowOnboarding(true);
      track(EVENTS.ONBOARDING_STARTED);
    }
  }, [session]);

  // Check if existing user should see "What's New" modal
  useEffect(() => {
    if (!session?.user?.id) return;
    if (showOnboarding) return; // Don't show during onboarding

    // Only show to users who signed up BEFORE Feb 18, 2026
    const createdAt = session.user.createdAt;
    if (createdAt) {
      const signupDate = new Date(createdAt);
      const cutoffDate = new Date('2026-02-18T00:00:00Z');
      if (signupDate >= cutoffDate) return;
    }

    // Check if they've already seen it
    if (session.user.whatsNewSeen === false) {
      setShowWhatsNew(true);
      track(EVENTS.WHATS_NEW_SHOWN);
    }
  }, [session?.user?.id, session?.user?.whatsNewSeen, showOnboarding]);

  // Auto-logout if user was deleted from database
  useEffect(() => {
    if (session?.user?.isDeleted) {
      console.log('User deleted from database, signing out...');
      signOut({ callbackUrl: '/' });
    }
  }, [session]);

  // External link click tracking (delegation on messages area)
  useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area) return;
    const handler = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href^="http"]') as HTMLAnchorElement | null;
      if (link) {
        try {
          const url = new URL(link.href);
          if (url.origin !== window.location.origin) {
            track(EVENTS.EXTERNAL_LINK_CLICKED, { domain: url.hostname });
          }
        } catch { /* invalid URL, ignore */ }
      }
    };
    area.addEventListener('click', handler);
    return () => area.removeEventListener('click', handler);
  }, [currentChatId]);

  // Check if user has been away for more than 24 hours
  useEffect(() => {
    if (session?.user && !session.user.isNewUser) {
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const lastVisitKey = `lastVisit_${session.user.id}`;
      const lastVisit = localStorage.getItem(lastVisitKey);
      const now = Date.now();

      if (lastVisit) {
        const timeSinceLastVisit = now - parseInt(lastVisit, 10);
        if (timeSinceLastVisit > TWENTY_FOUR_HOURS) {
          setShowStillThere(true);
        }
      }

      // Update last visit time
      localStorage.setItem(lastVisitKey, now.toString());
    }
  }, [session]);

  // Auto-detect and save timezone for OAuth users (runs once per session)
  useEffect(() => {
    const autoDetectTimezone = async () => {
      if (session?.user && !session.user.timezone) {
        try {
          const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          await fetch('/api/user/timezone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: detectedTimezone }),
          });
        } catch (error) {
          console.error('Failed to auto-detect timezone:', error);
        }
      }
    };
    autoDetectTimezone();
  }, [session?.user]);


  // Mark this browser session as active (used by 24-hour away check)
  useEffect(() => {
    sessionStorage.setItem('session_active', '1');
  }, []);

  // Detect mobile and handle orientation changes
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Close sidebar when switching to desktop to prevent desync
      if (!mobile) {
        setSidebarOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Apply theme to body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Close plus menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    if (showPlusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPlusMenu]);

  // Derive view from auth state — no useEffect delay
  const currentView: View = isAuthenticated ? "chat" : "auth";

  // Fetch characters when chat changes
  useEffect(() => {
    if (!currentChatId || currentChatId.startsWith('temp-')) {
      setChatCharacters([]);
      return;
    }
    const fetchCharacters = async () => {
      try {
        const res = await fetch(`/api/characters?chatId=${currentChatId}`);
        if (res.ok) {
          const data = await res.json();
          setChatCharacters(data.characters || []);
        }
      } catch {
        // Silently ignore - characters are non-critical
      }
    };
    fetchCharacters();
  }, [currentChatId]);

  const messages = currentChat?.messages ?? [];
  // Don't show greeting while chats are loading (prevents flash when restoring from localStorage)
  // Also don't show if we're waiting for a stored chat to load
  const isWaitingForStoredChat = currentChatId && !currentChat;
  const showGreeting = isChatsLoaded && !chatLoading && !isWaitingForStoredChat && (!currentChat || messages.length === 0);
  const remainingMessages = getRemainingMessages();

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    const userName = session?.user?.name?.split(' ')[0] || '';

    const morningGreetings = [
      "Rise and shine",
      "Morning vibes",
      "Fresh start today",
      "Good morning",
      "New day ahead",
    ];

    const afternoonGreetings = [
      "Good afternoon",
      "Afternoon vibes",
      "What's good",
      "Let's get it",
      "Hey there",
    ];

    const eveningGreetings = [
      "Good evening",
      "Evening vibes",
      "Wind down time",
      "Hey there",
      "What's good",
    ];

    const nightGreetings = [
      "Night owl mode",
      "Still up huh",
      "Late night vibes",
      "Can't sleep either",
      "After hours",
    ];

    let greetings;
    if (hour >= 5 && hour < 12) {
      greetings = morningGreetings;
    } else if (hour >= 12 && hour < 17) {
      greetings = afternoonGreetings;
    } else if (hour >= 17 && hour < 21) {
      greetings = eveningGreetings;
    } else {
      greetings = nightGreetings;
    }

    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    return { text: randomGreeting, name: userName };
  };

  const [greeting, setGreeting] = useState<{ text: string; name: string }>({ text: '', name: '' });

  const suggestedPrompts = [
    "Roast my business idea",
    "Give me brutally honest life advice",
    "Explain something like I'm 5 but make it unhinged",
    "Write me a bio that actually slaps",
    "Settle this argument for me",
    "Help me craft the perfect comeback",
    "Hype me up like a motivational speaker on Red Bull",
    "Tell me what I'm doing wrong with my life",
  ];

  const [displayedPrompts, setDisplayedPrompts] = useState<string[]>([]);

  useEffect(() => {
    setGreeting(getGreeting());
    // Pick 4 random prompts
    const shuffled = [...suggestedPrompts].sort(() => Math.random() - 0.5);
    setDisplayedPrompts(shuffled.slice(0, 4));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, currentChat]);

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!session?.user) return 0;
    const limits: Record<string, number> = { Free: 5, Pro: 100, Plus: 300 };
    const limit = limits[session.user.plan as keyof typeof limits];
    if (limit === Infinity) return 100;
    return (messagesUsed / limit) * 100;
  };

  // Auto-detect and save user's timezone
  const saveUserTimezone = async () => {
    try {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await fetch('/api/user/timezone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: detectedTimezone }),
      });
    } catch (error) {
      console.error('Failed to save timezone:', error);
    }
  };

  // Sync selected timezone and fetch memories when modal opens
  useEffect(() => {
    if (showAccountModal && session?.user) {
      setSelectedTimezone(session.user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
      fetchMemories();
    }
  }, [showAccountModal, session, fetchMemories]);

  // Update user's timezone
  const updateTimezone = async (newTimezone: string) => {
    setIsUpdatingTimezone(true);
    try {
      const res = await fetch('/api/user/timezone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: newTimezone }),
      });
      if (res.ok) {
        setSelectedTimezone(newTimezone);
      }
    } catch (error) {
      console.error('Failed to update timezone:', error);
    } finally {
      setIsUpdatingTimezone(false);
    }
  };

  const updateName = async () => {
    if (!editNameValue.trim() || editNameValue.trim() === session?.user?.name) {
      setIsEditingName(false);
      return;
    }
    setIsSavingName(true);
    try {
      const res = await fetch('/api/user/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editNameValue.trim() }),
      });
      if (res.ok) {
        await updateSession(); // Refresh session with new name
        setIsEditingName(false);
      } else {
        const data = await res.json();
        console.error('Failed to update name:', data.error);
      }
    } catch (error) {
      console.error('Failed to update name:', error);
    } finally {
      setIsSavingName(false);
    }
  };

  // Auth handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    const result = await signIn("credentials", {
      email: authEmail,
      password: authPassword,
      redirect: false,
    });

    if (result?.error) {
      // SECURITY: Show error message directly - no special handling to prevent enumeration
      track(EVENTS.LOGIN_FAILED, { method: 'credentials', error_type: result.error });
      setAuthErrorTracked(result.error);
    } else {
      track(EVENTS.USER_LOGGED_IN, { method: 'credentials' });
      setAuthEmail("");
      setAuthPassword("");
      // Auto-detect and save timezone on successful login
      await saveUserTimezone();
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          password: authPassword,
          website: honeypot, // SECURITY: Honeypot field
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthErrorTracked(data.error || "Signup failed");
        return;
      }

      // Show the check email screen
      track(EVENTS.USER_SIGNED_UP, { method: 'email' });
      setSignupEmail(authEmail);
      setShowCheckEmail(true);
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");

    } catch {
      setAuthErrorTracked("Signup failed. Please try again.");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setAuthError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();

      if (res.ok) {
        track(EVENTS.PASSWORD_RESET_REQUESTED);
        setResetEmail(forgotEmail);
        setShowResetEmailSent(true);
        setShowForgotPassword(false);
        setForgotEmail("");
      } else {
        setAuthErrorTracked(data.error || "Failed to send reset email");
      }
    } catch {
      setAuthErrorTracked("Failed to send reset email. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement("span");
    ripple.className = "ripple-effect";
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  };

  const handleDismissWelcome = async () => {
    try {
      await fetch('/api/user/dismiss-welcome', { method: 'POST' });
      setShowWelcome(false);
    } catch (error) {
      console.error('Failed to dismiss welcome:', error);
      setShowWelcome(false);
    }
  };

  const dismissWhatsNew = async () => {
    track(EVENTS.WHATS_NEW_DISMISSED, { screen: whatsNewScreen });
    setShowWhatsNew(false);
    setWhatsNewScreen(1);
    try {
      await fetch('/api/user/dismiss-whats-new', { method: 'POST' });
    } catch (error) {
      console.error('Failed to dismiss whats new:', error);
    }
  };

  const completeOnboarding = async (skippedFromScreen?: number) => {
    if (skippedFromScreen) {
      track(EVENTS.ONBOARDING_SKIPPED, { screen: skippedFromScreen });
    } else {
      track(EVENTS.ONBOARDING_COMPLETED);
    }
    setShowOnboarding(false);
    setOnboardingScreen(1);
    try {
      await fetch('/api/user/complete-onboarding', { method: 'POST' });
    } catch (error) {
      console.error('Failed to update onboarding status:', error);
    }
  };

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      track(EVENTS.MESSAGE_COPIED);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Edit message handlers
  const handleEditStart = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingMessageContent(content);
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
    setEditingMessageContent("");
  };

  const handleEditSave = async () => {
    if (!editingMessageId || !editingMessageContent.trim()) return;
    await editMessage(editingMessageId, editingMessageContent);
    setEditingMessageId(null);
    setEditingMessageContent("");
  };

  // Regenerate handler
  const handleRegenerate = async (userMessageId: string) => {
    await regenerateResponse(userMessageId);
  };

  // Like/Dislike feedback handler
  const handleFeedback = async (messageId: string, type: 'like' | 'dislike') => {
    // Toggle off if already selected
    if (messageFeedback[messageId] === type) {
      setMessageFeedback(prev => {
        const updated = { ...prev };
        delete updated[messageId];
        return updated;
      });
      // TODO: Send removal to backend
      return;
    }

    // Set new feedback
    setMessageFeedback(prev => ({ ...prev, [messageId]: type }));
    track(EVENTS.MESSAGE_FEEDBACK, { type });

    // Send to backend
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          chatId: currentChatId,
          feedback: type,
        }),
      });
    } catch (error) {
      console.error('Failed to send feedback:', error);
    }
  };

  // Find the user message that preceded an AI message (for regenerate on AI side)
  const findPrecedingUserMessageId = (aiMessageId: string): string | null => {
    if (!currentChat) return null;
    const messages = currentChat.messages;
    const aiIndex = messages.findIndex(m => m.id === aiMessageId);
    if (aiIndex <= 0) return null;
    // Find the user message before this AI message
    for (let i = aiIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i].id;
      }
    }
    return null;
  };

  const _formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const handleLogout = async () => {
    setShowAccountModal(false);
    await signOut({ redirect: false });
  };

  // Scroll to bottom handler
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesEndRef]);

  // Handle scroll to show/hide scroll button + scroll depth tracking
  const handleScroll = useCallback(() => {
    if (!messagesAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);

    // Scroll depth milestones
    if (scrollHeight > clientHeight) {
      const scrollPercent = Math.round(((scrollTop + clientHeight) / scrollHeight) * 100);
      const milestones = [25, 50, 75, 100];
      for (const m of milestones) {
        if (scrollPercent >= m && !scrollMilestonesRef.current.has(m)) {
          scrollMilestonesRef.current.add(m);
          track(EVENTS.SCROLL_DEPTH, { depth_percent: m });
        }
      }
    }
  }, []);

  const imageAllowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const docAllowedExtensions = new Set([
    "pdf", "txt", "csv", "md", "json", "js", "ts", "py", "html", "css",
    "jsx", "tsx", "sql", "xml", "yaml", "yml", "sh", "rb", "go", "rs",
    "java", "cpp", "c", "h",
  ]);

  const classifyFile = (file: File): "image" | "pdf" | "text" => {
    if (imageAllowedTypes.includes(file.type)) return "image";
    if (file.type === "application/pdf") return "pdf";
    return "text";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isImage = imageAllowedTypes.includes(file.type);
    const isDoc = file.type === "application/pdf" || docAllowedExtensions.has(ext);

    if (!isImage && !isDoc) {
      alert("Invalid file type. Allowed: images, PDFs, and common text/code files.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File too large. Maximum size is 10MB.");
      return;
    }

    const fType = classifyFile(file);
    track(EVENTS.FILE_SELECTED, { file_type: fType, file_size_kb: Math.round(file.size / 1024) });
    setSelectedFile(file);
    setSelectedFileType(fType);
    setFilePreviewUrl(fType === "image" ? URL.createObjectURL(file) : null);

    // Reset file inputs so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const handleFileRemove = () => {
    track(EVENTS.FILE_UPLOAD_CANCELLED, { file_type: selectedFileType });
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setSelectedFileType(null);
  };

  // Character CRUD
  const addChatCharacter = async () => {
    const name = newCharName.trim();
    if (!name || isAddingCharacter) return;
    if (chatCharacters.length >= 5) {
      track(EVENTS.CHARACTER_LIMIT_REACHED);
      return;
    }

    setIsAddingCharacter(true);

    try {
      // If no chat exists yet, create one (adds to chats list to avoid loading screen)
      let chatId = currentChatId;
      if (!chatId) {
        const newChatId = await createChatWithEntry();
        if (!newChatId) {
          console.error('Failed to create chat for character');
          return;
        }
        chatId = newChatId;
      }

      const color = CHARACTER_COLORS[selectedColorIndex];

      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          name,
          personality: newCharPersonality.trim(),
          color_bg: color.bg,
          color_fg: color.fg,
          color_border: color.border,
          color_bg_light: color.bgLight,
          color_tag: color.tag,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('Failed to add character:', res.status, errData);
        return;
      }

      const data = await res.json();
      setChatCharacters(prev => [...prev, data.character]);
      track(EVENTS.CHARACTER_CREATED, { name, color: color.name });
      track(EVENTS.CHARACTER_MODAL_CLOSED, { action: 'added' });
      setNewCharName('');
      setNewCharPersonality('');
      setSelectedColorIndex(0);
      setShowCharacterModal(false);
    } catch (err) {
      console.error('Failed to add character:', err);
    } finally {
      setIsAddingCharacter(false);
    }
  };

  const removeChatCharacter = async (charId: string) => {
    try {
      const charToRemove = chatCharacters.find(c => c.id === charId);
      const res = await fetch(`/api/characters?id=${charId}`, { method: 'DELETE' });
      if (res.ok) {
        setChatCharacters(prev => prev.filter(c => c.id !== charId));
        track(EVENTS.CHARACTER_REMOVED, { character_name: charToRemove?.name });
      }
    } catch (err) {
      console.error('Failed to remove character:', err);
    }
  };

  // Input change handler with @mention detection + typing analytics
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    // Typing started (fire once per composition)
    if (val.length > 0 && !typingStartedRef.current) {
      typingStartedRef.current = true;
      track(EVENTS.TYPING_STARTED);
    }
    if (val.length === 0) {
      typingStartedRef.current = false;
    }

    // Input abandon timer (30s of no typing after starting)
    if (inputAbandonTimerRef.current) clearTimeout(inputAbandonTimerRef.current);
    if (val.length > 0) {
      inputAbandonTimerRef.current = setTimeout(() => {
        track(EVENTS.INPUT_ABANDONED, { input_length: val.length });
      }, 30000);
    }

    if (chatCharacters.length > 0 && (val.endsWith('@') || val.match(/@\w{0,15}$/))) {
      if (!showMentionDropdown) {
        track(EVENTS.MENTION_DROPDOWN_SHOWN, { character_count: chatCharacters.length });
      }
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
    }
  };

  // Input focus handler (debounced to 1 fire per 60s)
  const handleInputFocus = useCallback(() => {
    const now = Date.now();
    if (now - lastFocusTrackRef.current > 60000) {
      lastFocusTrackRef.current = now;
      track(EVENTS.INPUT_FOCUSED);
    }
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || chatLoading || !canSendMessage()) return;

    // Clear typing/abandon tracking on send
    typingStartedRef.current = false;
    if (inputAbandonTimerRef.current) { clearTimeout(inputAbandonTimerRef.current); inputAbandonTimerRef.current = null; }

    const messageToSend = input;
    const fileToUpload = selectedFile;
    const fileTypeToUpload = selectedFileType;
    setInput("");
    setSelectedFile(null);
    const previewToRevoke = filePreviewUrl;
    setFilePreviewUrl(null);
    setSelectedFileType(null);

    // Reset textarea height to single row
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
    }

    let uploadResult: { url: string; fileType: string; fileName: string } | undefined;

    // Upload file if selected
    if (fileToUpload) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", fileToUpload);
        formData.append("chatId", currentChatId || "00000000-0000-0000-0000-000000000000");

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          track(EVENTS.FILE_UPLOAD_FAILED, { file_type: fileTypeToUpload, error_type: err.error || 'upload_error' });
          alert(err.error || "Failed to upload file.");
          setInput(messageToSend);
          setSelectedFile(fileToUpload);
          setSelectedFileType(fileTypeToUpload);
          if (previewToRevoke) setFilePreviewUrl(previewToRevoke);
          setIsUploading(false);
          return;
        }

        const uploadData = await uploadRes.json();
        uploadResult = {
          url: uploadData.url,
          fileType: uploadData.fileType || "image",
          fileName: uploadData.fileName || fileToUpload.name,
        };
        track(EVENTS.FILE_UPLOADED, { file_type: uploadResult.fileType, file_size_kb: Math.round(fileToUpload.size / 1024) });
      } catch {
        track(EVENTS.FILE_UPLOAD_FAILED, { file_type: fileTypeToUpload, error_type: 'network_error' });
        alert("Failed to upload file. Please try again.");
        setInput(messageToSend);
        setSelectedFile(fileToUpload);
        setSelectedFileType(fileTypeToUpload);
        if (previewToRevoke) setFilePreviewUrl(previewToRevoke);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    // Clean up preview URL
    if (previewToRevoke) URL.revokeObjectURL(previewToRevoke);

    const defaultMsg = uploadResult && uploadResult.fileType !== "image"
      ? "Analyze this file"
      : "What's in this image?";

    // Detect @mention for character routing
    const mentionMatch = messageToSend.match(/@(\w+)/);
    const mentionedChar = mentionMatch
      ? chatCharacters.find(c => c.name.toLowerCase() === mentionMatch[1].toLowerCase())
      : null;

    setShowMentionDropdown(false);

    await sendMessage(
      messageToSend || defaultMsg,
      uploadResult?.fileType === "image" ? uploadResult.url : undefined,
      uploadResult ? uploadResult : undefined,
      mentionedChar?.id
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
    // Plain Enter just creates a new line (default behavior)
  };

  const handleRenameStart = (chatId: string, currentTitle: string) => {
    setRenamingChatId(chatId);
    setRenameValue(currentTitle);
    setShowChatActionsModal(false);
  };

  const handleRenameSubmit = async (chatId: string) => {
    if (renameValue.trim()) {
      await renameChat(chatId, renameValue.trim());
    }
    setRenamingChatId(null);
    setRenameValue("");
  };

  const handleRenameCancel = () => {
    setRenamingChatId(null);
    setRenameValue("");
  };

  const handleDeleteClick = (chatId: string) => {
    setChatToDelete(chatId);
    setShowDeleteModal(true);
    setShowChatActionsModal(false);
  };

  const handleDeleteConfirm = () => {
    if (chatToDelete) {
      // Close modal immediately (optimistic)
      setShowDeleteModal(false);
      const chatId = chatToDelete;
      setChatToDelete(null);
      // Delete in background
      deleteChat(chatId);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setChatToDelete(null);
  };

  const toggleSidebar = () => {
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  const openCharacterModal = () => {
    track(EVENTS.CHARACTER_MODAL_OPENED);
    setShowCharacterModal(true);
  };

  const openUpgradeModal = () => {
    track(EVENTS.UPGRADE_MODAL_OPENED);
    setShowAccountModal(true);
  };

  const handleChipClick = (chipText: string) => {
    track(EVENTS.PROMPT_CHIP_CLICKED, { chip_text: chipText });
    sendMessage(chipText);
  };

  const handleSelectChat = (id: string) => {
    track(EVENTS.CHAT_SELECTED);
    selectChat(id);
    scrollMilestonesRef.current.clear();
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Helper to show confirmation modal
  const showConfirm = (title: string, message: string, confirmText: string, onConfirm: () => void, isDestructive = false) => {
    setConfirmModal({ show: true, title, message, confirmText, onConfirm, isDestructive, isLoading: false });
  };

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, show: false, isLoading: false }));
  };

  const setConfirmLoading = (loading: boolean) => {
    setConfirmModal(prev => ({ ...prev, isLoading: loading }));
  };

  const upgradePlan = async (newPlan: "Free" | "Pro" | "Plus") => {
    if (!session?.user) return;

    const currentPlan = session.user.plan;

    // Same plan - nothing to do
    if (currentPlan === newPlan) return;

    track(EVENTS.UPGRADE_INITIATED, { from_plan: currentPlan, to_plan: newPlan });

    // DOWNGRADE TO FREE
    if (newPlan === "Free") {
      if (currentPlan !== "Free") {
        // Prevent if already canceling
        if (session.user.subscriptionStatus === 'canceling') {
          showConfirm("Already Scheduled", "You've already scheduled a cancellation. Your subscription will end at the end of your billing period.", "OK", closeConfirmModal);
          return;
        }
        showConfirm(
          "Cancel Subscription?",
          `Your ${currentPlan} subscription will remain active until the end of your billing period. After that, you'll be on the Free plan with 5 messages/day.`,
          "Cancel Subscription",
          doCancelSubscription,
          true
        );
      }
      return;
    }

    // UPGRADE FROM FREE - go to custom checkout page
    if (currentPlan === "Free") {
      window.location.href = `/checkout?plan=${newPlan}`;
      return;
    }

    // UPGRADE: Pro → Plus (with proration)
    if (currentPlan === "Pro" && newPlan === "Plus") {
      showConfirm(
        "Upgrade to Plus",
        "Upgrade to Plus for $9.99/month!\n\nYou'll be charged the prorated difference for the rest of this billing period, then $9.99/month going forward.",
        "Upgrade",
        async () => {
          setConfirmLoading(true);
          try {
            const res = await fetch("/api/subscription/change-plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ newPlan: "Plus" }),
            });

            const data = await res.json();
            if (data.success) {
              setConfirmModal({
                show: true,
                title: "Success!",
                message: data.message || "Successfully upgraded to Plus!",
                confirmText: "OK",
                onConfirm: closeConfirmModal,
                isDestructive: false,
                isLoading: false,
              });
              await updateSession();
            } else if (data.redirect === "checkout") {
              // Redirect to custom checkout page
              window.location.href = `/checkout?plan=Plus`;
            } else {
              setConfirmModal({
                show: true,
                title: "Error",
                message: data.error || "Failed to upgrade. Please try again.",
                confirmText: "OK",
                onConfirm: closeConfirmModal,
                isDestructive: false,
                isLoading: false,
              });
            }
          } catch (error) {
            console.error("Failed to upgrade:", error);
            setConfirmModal({
              show: true,
              title: "Error",
              message: "Network error. Please try again.",
              confirmText: "OK",
              onConfirm: closeConfirmModal,
              isDestructive: false,
              isLoading: false,
            });
          }
        }
      );
      return;
    }

    // DOWNGRADE: Plus → Pro (scheduled for end of period)
    if (currentPlan === "Plus" && newPlan === "Pro") {
      // Prevent downgrade if already downgrading
      if (session.user.subscriptionStatus === 'downgrading') {
        showConfirm("Already Scheduled", "You've already scheduled a downgrade to Pro. It will take effect at the end of your billing period.", "OK", closeConfirmModal);
        return;
      }

      showConfirm(
        "Downgrade to Pro",
        "Your Plus subscription will remain active until the end of your billing period. After that, you'll be on the Pro plan ($4.99/month) with 100 messages/day.",
        "Downgrade",
        async () => {
          setConfirmLoading(true);
          try {
            const res = await fetch("/api/subscription/change-plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ newPlan: "Pro" }),
            });

            const data = await res.json();
            if (data.success) {
              setConfirmModal({
                show: true,
                title: "Plan Changed",
                message: data.message || "Your plan will change at the end of your billing period.",
                confirmText: "OK",
                onConfirm: closeConfirmModal,
                isDestructive: false,
                isLoading: false,
              });
              await updateSession();
            } else {
              setConfirmModal({
                show: true,
                title: "Error",
                message: data.error || "Failed to change plan. Please try again.",
                confirmText: "OK",
                onConfirm: closeConfirmModal,
                isDestructive: false,
                isLoading: false,
              });
            }
          } catch (error) {
            console.error("Failed to change plan:", error);
            setConfirmModal({
              show: true,
              title: "Error",
              message: "Network error. Please try again.",
              confirmText: "OK",
              onConfirm: closeConfirmModal,
              isDestructive: false,
              isLoading: false,
            });
          }
        },
        true
      );
      return;
    }
  };

  // Actual cancel logic (called from modal confirmation)
  const doCancelSubscription = async () => {
    if (!session?.user || session.user.plan === "Free") return;

    // Show loading in the modal immediately
    setConfirmLoading(true);
    setIsCancellingSubscription(true);

    try {
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (res.ok) {
        track(EVENTS.SUBSCRIPTION_CANCELLED, { from_plan: session.user.plan });
        // Show success modal
        setConfirmModal({
          show: true,
          title: "Subscription Cancelled",
          message: "Your subscription has been cancelled. You'll retain access until the end of your billing period.",
          confirmText: "OK",
          onConfirm: closeConfirmModal,
          isDestructive: false,
          isLoading: false,
        });
        await updateSession();
      } else {
        setConfirmModal({
          show: true,
          title: "Error",
          message: data.error || "Failed to cancel subscription",
          confirmText: "OK",
          onConfirm: closeConfirmModal,
          isDestructive: false,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      setConfirmModal({
        show: true,
        title: "Error",
        message: "Failed to cancel subscription. Please try again.",
        confirmText: "OK",
        onConfirm: closeConfirmModal,
        isDestructive: false,
        isLoading: false,
      });
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  // Show cancel confirmation modal
  const cancelSubscription = () => {
    if (!session?.user || session.user.plan === "Free") return;

    showConfirm(
      "Cancel Subscription?",
      "Are you sure you want to cancel your subscription? You'll keep access until the end of your current billing period.",
      "Cancel Subscription",
      doCancelSubscription,
      true
    );
  };

  const currentStyles = theme === 'dark' ? darkStyles : lightStyles;

  const getChatGroups = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

    const groups: { label: string; chats: typeof chats }[] = [
      { label: 'TODAY', chats: [] },
      { label: 'YESTERDAY', chats: [] },
      { label: 'OLDER', chats: [] },
    ];

    chats.forEach((chat) => {
      const chatDate = new Date(chat.created_at || Date.now());
      if (chatDate >= todayStart) {
        groups[0].chats.push(chat);
      } else if (chatDate >= yesterdayStart) {
        groups[1].chats.push(chat);
      } else {
        groups[2].chats.push(chat);
      }
    });

    return groups.filter(g => g.chats.length > 0);
  };

  const getRelativeTime = (date: Date | string) => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Show loading while auth state is being determined
  if (isAuthLoading || (!isAuthenticated && !isUnauthenticated)) {
    return (
      <div style={currentStyles.loadingContainer}>
        <div style={currentStyles.loadingContent}>
          {/* Logo */}
          <div style={currentStyles.loadingLogo} className="loading-logo-pulse">
            <BoltLogo size={56} />
          </div>
          {/* Brand Name */}
          <div style={currentStyles.loadingBrand}>So UnFiltered AI</div>
          {/* Animated Dots */}
          <div style={currentStyles.loadingDots}>
            <div className="loading-dot" style={currentStyles.loadingDot} />
            <div className="loading-dot" style={currentStyles.loadingDot} />
            <div className="loading-dot" style={currentStyles.loadingDot} />
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "auth") {
    return (
      <div style={currentStyles.authContainer}>
        {/* Animated Background Orbs */}
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={currentStyles.authThemeToggle}
          title="Toggle theme"
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>

        {/* Glassmorphic Card */}
        <div style={currentStyles.authCard}>
          {/* Logo with Glow */}
          <div style={currentStyles.authLogo}>
            <div style={currentStyles.logoIcon} className="auth-logo-glow">
              <BoltLogo size={44} />
            </div>
            <h1 style={currentStyles.authTitle}>So UnFiltered AI</h1>
            <p style={currentStyles.authSubtitle}>
              {showForgotPassword
                ? "Reset your password"
                : authMode === "signin"
                  ? "Welcome back"
                  : "Create your account"}
            </p>
          </div>

          {/* Error/Success Messages */}
          {authError && <div style={currentStyles.authError}>{authError}</div>}
          {authSuccess && <div style={currentStyles.authSuccess}>{authSuccess}</div>}

          {/* Check Email Screen (after signup) */}
          {showCheckEmail ? (
            <div className="auth-tab-content" style={currentStyles.checkEmailContainer}>
              <div style={currentStyles.emailIconWrapper}>
                <div style={currentStyles.emailIcon} className="email-icon-animate">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="M22 7l-10 6L2 7"/>
                  </svg>
                </div>
                <div style={currentStyles.emailIconRing} className="email-ring-animate" />
              </div>
              <h2 style={currentStyles.checkEmailTitle}>Check your email</h2>
              <p style={currentStyles.checkEmailText}>
                We&apos;ve sent a verification link to
              </p>
              <p style={currentStyles.checkEmailAddress}>{signupEmail}</p>
              <p style={currentStyles.checkEmailSubtext}>
                Click the link in the email to verify your account. If you don&apos;t see it, check your spam folder.
              </p>
              <button
                onClick={() => {
                  setShowCheckEmail(false);
                  setAuthMode("signin");
                }}
                style={currentStyles.authBtn}
                className="auth-btn-ripple"
              >
                Back to Sign In
              </button>
            </div>
          ) : showResetEmailSent ? (
            <div className="auth-tab-content" style={currentStyles.checkEmailContainer}>
              <div style={currentStyles.emailIconWrapper}>
                <div style={currentStyles.emailIcon} className="email-icon-animate">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                    <path d="M12 13v5"/>
                    <path d="M9 18h6"/>
                  </svg>
                </div>
                <div style={currentStyles.emailIconRing} className="email-ring-animate" />
              </div>
              <h2 style={currentStyles.checkEmailTitle}>Reset link sent!</h2>
              <p style={currentStyles.checkEmailText}>
                We&apos;ve sent a password reset link to
              </p>
              <p style={currentStyles.checkEmailAddress}>{resetEmail}</p>
              <p style={currentStyles.checkEmailSubtext}>
                Click the link in the email to reset your password. The link expires in 1 hour. Don&apos;t forget to check your spam folder!
              </p>
              <button
                onClick={() => {
                  setShowResetEmailSent(false);
                  setAuthMode("signin");
                }}
                style={currentStyles.authBtn}
                className="auth-btn-ripple"
              >
                Back to Sign In
              </button>
            </div>
          ) : showForgotPassword ? (
            <div className="auth-tab-content">
              <form onSubmit={handleForgotPassword}>
                <div style={currentStyles.formGroup}>
                  <label style={currentStyles.label}>Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={currentStyles.input}
                    className="auth-input-focus"
                  />
                </div>
                <button
                  type="submit"
                  style={currentStyles.authBtn}
                  className="auth-btn-ripple"
                  onClick={handleRipple}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
              <div style={currentStyles.authSwitch}>
                <a
                  onClick={() => {
                    setShowForgotPassword(false);
                    setAuthError("");
                  }}
                  style={currentStyles.authLink}
                >
                  ← Back to sign in
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Switcher */}
              <div style={currentStyles.tabContainer}>
                <button
                  style={{
                    ...currentStyles.tab,
                    ...(authMode === "signin" ? currentStyles.tabActive : {}),
                  }}
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthError("");
                    setAuthSuccess("");
                  }}
                >
                  Sign In
                </button>
                <button
                  style={{
                    ...currentStyles.tab,
                    ...(authMode === "signup" ? currentStyles.tabActive : {}),
                  }}
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError("");
                    setAuthSuccess("");
                  }}
                >
                  Sign Up
                </button>
              </div>

              {/* Sign In Form */}
              {authMode === "signin" && (
                <div className="auth-tab-content" key="signin">
                  <form onSubmit={handleLogin}>
                    <div style={currentStyles.formGroup}>
                      <label style={currentStyles.label}>Email</label>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        style={currentStyles.input}
                        className="auth-input-focus"
                      />
                    </div>
                    <div style={currentStyles.formGroup}>
                      <div style={currentStyles.labelRow}>
                        <label style={currentStyles.label}>Password</label>
                        <a
                          onClick={() => {
                            setShowForgotPassword(true);
                            setAuthError("");
                            setAuthSuccess("");
                          }}
                          style={currentStyles.forgotLink}
                        >
                          Forgot password?
                        </a>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? "text" : "password"}
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          style={{...currentStyles.input, paddingRight: '44px', fontFamily: 'Inter, sans-serif'}}
                          className="auth-input-focus"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: theme === 'dark' ? '#888' : '#666',
                          }}
                        >
                          {showPassword ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      style={currentStyles.authBtn}
                      className="auth-btn-ripple"
                      onClick={handleRipple}
                    >
                      Sign In
                    </button>
                  </form>
                </div>
              )}

              {/* Sign Up Form */}
              {authMode === "signup" && (
                <div className="auth-tab-content" key="signup">
                  <form onSubmit={handleSignup}>
                    <div style={currentStyles.formGroup}>
                      <label style={currentStyles.label}>Full Name</label>
                      <input
                        type="text"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="Your name"
                        required
                        style={currentStyles.input}
                        className="auth-input-focus"
                      />
                    </div>
                    <div style={currentStyles.formGroup}>
                      <label style={currentStyles.label}>Email</label>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        style={currentStyles.input}
                        className="auth-input-focus"
                      />
                    </div>
                    <div style={currentStyles.formGroup}>
                      <label style={currentStyles.label}>Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? "text" : "password"}
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          minLength={8}
                          required
                          style={{...currentStyles.input, paddingRight: '44px', fontFamily: 'Inter, sans-serif'}}
                          className="auth-input-focus"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: theme === 'dark' ? '#888' : '#666',
                          }}
                        >
                          {showPassword ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    {/* SECURITY: Honeypot field - hidden from users, filled by bots */}
                    <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
                      <label htmlFor="website">Website</label>
                      <input
                        type="text"
                        id="website"
                        name="website"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                      />
                    </div>
                    <button
                      type="submit"
                      style={currentStyles.authBtn}
                      className="auth-btn-ripple"
                      onClick={handleRipple}
                    >
                      Create Account
                    </button>
                  </form>
                </div>
              )}

              {/* Divider */}
              <div style={currentStyles.divider}>
                <span style={currentStyles.dividerLine} />
                <span style={currentStyles.dividerText}>or</span>
                <span style={currentStyles.dividerLine} />
              </div>

              {/* Social Login Buttons */}
              <div style={currentStyles.socialButtons}>
                <button
                  className="social-btn social-btn-google"
                  onClick={(e) => {
                    handleRipple(e);
                    track(EVENTS.USER_LOGGED_IN, { method: 'google' });
                    signIn("google");
                  }}
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009.003 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0A8.997 8.997 0 00.957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
                <button
                  className="social-btn social-btn-github"
                  onClick={(e) => {
                    handleRipple(e);
                    track(EVENTS.USER_LOGGED_IN, { method: 'github' });
                    signIn("github");
                  }}
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Welcome screen for new OAuth users
  if (showWelcome) {
    return (
      <div style={currentStyles.authContainer} data-theme={theme}>
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <button onClick={toggleTheme} style={currentStyles.themeToggle}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <div style={currentStyles.authCard}>
          <div className="auth-tab-content" style={currentStyles.checkEmailContainer}>
            <div style={currentStyles.emailIconWrapper}>
              <div style={currentStyles.emailIcon} className="email-icon-animate">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div style={currentStyles.emailIconRing} className="email-ring-animate" />
            </div>
            <h2 style={currentStyles.checkEmailTitle}>Welcome to So UnFiltered AI!</h2>
            <p style={currentStyles.checkEmailText}>
              Your account has been created successfully.
            </p>
            <p style={currentStyles.checkEmailSubtext}>
              You&apos;re all set! Start chatting with our AI assistant and explore unlimited possibilities.
            </p>
            <button
              onClick={handleDismissWelcome}
              style={currentStyles.authBtn}
              className="auth-btn-ripple"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    );
  }

  // "Are you still there?" screen for users returning after 24+ hours
  if (showStillThere) {
    return (
      <div style={currentStyles.authContainer} data-theme={theme}>
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <button onClick={toggleTheme} style={currentStyles.themeToggle}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <div style={currentStyles.authCard}>
          <div className="auth-tab-content" style={currentStyles.checkEmailContainer}>
            <div style={currentStyles.emailIconWrapper}>
              <div style={currentStyles.emailIcon} className="email-icon-animate">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <div style={currentStyles.emailIconRing} className="email-ring-animate" />
            </div>
            <h2 style={currentStyles.checkEmailTitle}>Are you still there?</h2>
            <p style={currentStyles.checkEmailText}>
              Welcome back! It&apos;s been a while since your last visit.
            </p>
            <p style={currentStyles.checkEmailSubtext}>
              Ready to continue chatting with So Unfiltered AI?
            </p>
            <button
              onClick={() => window.location.reload()}
              style={currentStyles.authBtn}
              className="auth-btn-ripple"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showOnboarding && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#0C0C0E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(232,160,76,0.08), transparent 70%), radial-gradient(circle at 70% 80%, rgba(232,98,76,0.04), transparent 50%)',
            pointerEvents: 'none',
          }} />

          <div style={{
            position: 'fixed',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px',
            zIndex: 10,
          }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                width: onboardingScreen === i ? '24px' : '8px',
                height: '8px',
                borderRadius: onboardingScreen === i ? '4px' : '50%',
                background: onboardingScreen === i ? '#E8A04C' : (i < onboardingScreen ? '#E8A04C' : '#5A5660'),
                opacity: onboardingScreen === i ? 1 : (i < onboardingScreen ? 0.5 : 0.3),
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>

          {onboardingScreen === 1 && (
            <OnboardingScreen1
              onNext={() => { track(EVENTS.ONBOARDING_SCREEN_VIEWED, { screen_number: 2 }); setOnboardingScreen(2); }}
              onSkip={() => completeOnboarding(1)}
            />
          )}

          {onboardingScreen === 2 && (
            <OnboardingScreen2
              onNext={() => { track(EVENTS.ONBOARDING_SCREEN_VIEWED, { screen_number: 3 }); setOnboardingScreen(3); }}
              onSkip={() => completeOnboarding(2)}
            />
          )}

          {onboardingScreen === 3 && (
            <OnboardingScreen3
              onComplete={() => completeOnboarding()}
            />
          )}
        </div>
      )}

      <div style={currentStyles.app}>
        {isMobile && sidebarOpen && (
          <div
            style={currentStyles.mobileOverlay}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside style={{
          ...currentStyles.sidebar,
          ...(sidebarCollapsed && !isMobile ? currentStyles.sidebarCollapsed : {}),
          ...(isMobile ? {
            position: 'fixed' as const,
            left: sidebarOpen ? 0 : '-280px',
            top: 0,
            bottom: 0,
            zIndex: 1000,
            width: '280px',
            opacity: 1,
            pointerEvents: 'auto' as const,
          } : {})
        }}>
          <div style={currentStyles.sidebarTop}>
            <div style={currentStyles.sidebarHeader}>
              <div style={currentStyles.brandContainer}>
                <BoltLogo size={28} />
                <span style={currentStyles.brand}>
                  <span style={{
                    background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>So-UnFiltered</span><span style={{ marginLeft: '4px' }}> AI</span>
                </span>
              </div>
              <button
                style={currentStyles.collapseBtn}
                onClick={toggleSidebar}
                aria-label="Collapse sidebar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="11 17 6 12 11 7" />
                  <line x1="18" y1="12" x2="6" y2="12" />
                </svg>
              </button>
            </div>

            <div style={{ padding: '12px 16px 8px' }}>
              <button
                style={currentStyles.newChatBtn}
                onClick={() => {
                  startNewChat();
                  if (isMobile) setSidebarOpen(false);
                }}
                onMouseEnter={(e) => {
                  Object.assign(e.currentTarget.style, currentStyles.newChatBtnHover);
                }}
                onMouseLeave={(e) => {
                  Object.assign(e.currentTarget.style, currentStyles.newChatBtn);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New conversation
              </button>
            </div>

            {/* Chat groups */}
            <div style={currentStyles.recentsList}>
              {chats.length === 0 && (
                <div style={{...currentStyles.recentItem, opacity: 0.6, padding: '12px 16px'}}>
                  No chats yet
                </div>
              )}
              {getChatGroups().map((group) => (
                <div key={group.label}>
                  <div style={currentStyles.sectionLabel}>{group.label}</div>
                  {group.chats.map((chat) => (
                    <div
                      key={chat.id}
                      style={currentStyles.chatItemWrapper}
                      onMouseEnter={() => !isMobile && setHoveredChatId(chat.id)}
                      onMouseLeave={() => !isMobile && setHoveredChatId(null)}
                    >
                      {renamingChatId === chat.id ? (
                        <div style={currentStyles.renameWrapper}>
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSubmit(chat.id);
                              else if (e.key === 'Escape') handleRenameCancel();
                            }}
                            style={currentStyles.renameInput}
                            autoFocus
                          />
                          <button onClick={() => handleRenameSubmit(chat.id)} style={currentStyles.renameIconBtn} title="Save">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          </button>
                          <button onClick={handleRenameCancel} style={currentStyles.cancelIconBtn} title="Cancel">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              ...currentStyles.recentItem,
                              ...(chat.id === currentChatId ? currentStyles.recentItemActive : {}),
                              ...(isMobile ? { paddingRight: '48px' } : {}),
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                            onClick={() => handleSelectChat(chat.id)}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1 }}>
                              {chat.title}
                            </span>
                            <span style={{ fontSize: '11px', color: theme === 'dark' ? '#5A5660' : '#9A9590', flexShrink: 0, whiteSpace: 'nowrap' as const }}>
                              {getRelativeTime(chat.created_at || new Date().toISOString())}
                            </span>
                            {isMobile && (
                              <span
                                style={currentStyles.mobileMenuDots}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedChatForActions({id: chat.id, title: chat.title});
                                  setShowChatActionsModal(true);
                                }}
                              >
                                ⋮
                              </span>
                            )}
                          </div>
                          {hoveredChatId === chat.id && !isMobile && (
                            <div style={currentStyles.chatActions}>
                              <button onClick={(e) => { e.stopPropagation(); handleRenameStart(chat.id, chat.title); }} style={currentStyles.actionBtn} title="Rename">✏️</button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(chat.id); }} style={currentStyles.actionBtn} title="Delete">🗑️</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div style={currentStyles.sidebarFooter} onClick={() => setShowAccountModal(true)}>
            <div style={currentStyles.avatar}>
              {session?.user?.name?.substring(0, 2).toUpperCase()}
            </div>
            <div style={currentStyles.userInfo}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme === 'dark' ? '#F0EDE8' : '#1A1918' }}>
                {session?.user?.name}
              </div>
              {session?.user?.plan !== 'Free' && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
                  color: '#0C0C0E',
                  textTransform: 'uppercase' as const,
                  display: 'inline-block',
                  marginTop: '2px',
                }}>
                  {session?.user?.plan}
                </span>
              )}
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
              fontSize: 11,
              color: theme === 'dark' ? '#5A5660' : '#9A9590',
              background: theme === 'dark' ? '#1A1A1E' : '#E4E3DF',
              padding: '4px 8px',
              borderRadius: '6px',
              marginLeft: 'auto',
              whiteSpace: 'nowrap' as const,
              flexShrink: 0,
            }}>
              <span style={{ color: theme === 'dark' ? '#E8A04C' : '#D08A30', fontWeight: 500 }}>
                {messagesUsed}
              </span>
              /{session?.user?.plan === 'Free' ? 5 : session?.user?.plan === 'Pro' ? 100 : 300}
            </div>
          </div>
        </aside>

        <main style={currentStyles.main}>
          <div style={currentStyles.topBar}>
            <div style={currentStyles.topBarLeft}>
              {(isMobile || sidebarCollapsed) && (
                <button
                  style={currentStyles.expandBtn}
                  onClick={() => {
                    if (isMobile) {
                      setSidebarOpen(true);
                    } else {
                      setSidebarCollapsed(false);
                    }
                  }}
                  title="Open sidebar"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
              )}
              <div style={currentStyles.modelBadge}>
                {currentChat && messages.length > 0 ? currentChat.title : 'New conversation'}
              </div>
            </div>
            <div style={currentStyles.topBarRight}>
              {/* Character circles + Add button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginRight: 4 }}>
                {chatCharacters.map((char, i) => (
                  <div
                    key={char.id}
                    className="char-circle-header"
                    onClick={() => openCharacterModal()}
                    title={char.name}
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: char.color_bg, color: char.color_fg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                      border: `2px solid ${theme === 'dark' ? '#0C0C0E' : '#F5F4F0'}`,
                      marginLeft: i === 0 ? 0 : -6,
                      cursor: 'pointer',
                    }}
                  >
                    {char.name.substring(0, 2).toUpperCase()}
                  </div>
                ))}
              </div>
              <button
                className="add-char-btn"
                onClick={() => openCharacterModal()}
                title="Add chat character"
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                  background: 'transparent',
                  color: theme === 'dark' ? '#5A5660' : '#9A9590',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginRight: 4,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <line x1="20" y1="8" x2="20" y2="14"/>
                  <line x1="17" y1="11" x2="23" y2="11"/>
                </svg>
              </button>
              <div style={{ display: 'flex', gap: '4px', background: theme === 'dark' ? '#1A1A1E' : '#E4E3DF', borderRadius: '999px', padding: '3px' }}>
                <button
                  onClick={() => theme !== 'light' && toggleTheme()}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '999px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    background: theme === 'light' ? '#fff' : 'transparent',
                    color: theme === 'light' ? '#D08A30' : (theme === 'dark' ? '#5A5660' : '#9A9590'),
                    transition: 'all 0.2s ease',
                    boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                  title="Light mode"
                >
                  ☀️
                </button>
                <button
                  onClick={() => theme !== 'dark' && toggleTheme()}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '999px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    background: theme === 'dark' ? '#2A2A2E' : 'transparent',
                    color: theme === 'dark' ? '#E8A04C' : '#9A9590',
                    transition: 'all 0.2s ease',
                    boxShadow: theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                  }}
                  title="Dark mode"
                >
                  🌙
                </button>
              </div>
            </div>
          </div>


          <div style={currentStyles.chatWrapper}>
            <div
              ref={messagesAreaRef}
              onScroll={handleScroll}
              style={currentStyles.messagesArea}
            >
              {/* Show loading state while waiting for stored chat to load */}
              {(!isChatsLoaded || isWaitingForStoredChat) && (
                <div style={currentStyles.emptyState}>
                  <div style={{
                    width: 40,
                    height: 40,
                    border: '3px solid transparent',
                    borderTopColor: theme === 'dark' ? '#fff' : '#333',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                </div>
              )}

              {showGreeting && (
                <div style={currentStyles.emptyState}>
                  <div style={currentStyles.greetingText}>
                    <BoltLogo size={36} />
                    <span style={{ marginLeft: '8px' }}>
                      {greeting.text || getGreeting().text}{greeting.name ? ', ' : ''}
                      {greeting.name && (
                        <span style={{ color: theme === 'dark' ? '#E8A04C' : '#D08A30' }}>
                          {greeting.name}
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '16px',
                    color: theme === 'dark' ? '#5A5660' : '#9A9590',
                    marginBottom: '24px',
                    marginTop: '-16px',
                  }}>
                    Time to spill.
                  </div>
                  {/* Scrolling prompt chips carousel */}
                  {canSendMessage() && (
                    <div className="quick-actions-wrapper" style={{ marginBottom: '48px' }}>
                      <div className="quick-actions-carousel">
                        {/* First set */}
                        <button
                          style={currentStyles.quickChip}
                          onClick={() => handleChipClick('Roast my business idea brutally')}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChipHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChip)}
                        >
                          <span style={currentStyles.chipIcon}>&#128293;</span> Roast my idea
                        </button>
                        <button
                          style={currentStyles.quickChip}
                          onClick={() => handleChipClick('Give me brutally honest life advice')}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChipHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChip)}
                        >
                          <span style={currentStyles.chipIcon}>&#128172;</span> Real talk
                        </button>
                        <button
                          style={currentStyles.quickChip}
                          onClick={() => handleChipClick('Write something unhinged and creative')}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChipHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChip)}
                        >
                          <span style={currentStyles.chipIcon}>&#9997;&#65039;</span> Write unhinged
                        </button>
                        <button
                          style={currentStyles.quickChip}
                          onClick={() => handleChipClick('Settle this debate for me once and for all')}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChipHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChip)}
                        >
                          <span style={currentStyles.chipIcon}>&#9878;&#65039;</span> Settle a debate
                        </button>
                        <button
                          style={currentStyles.quickChip}
                          onClick={() => handleChipClick('Help me cook up a savage comeback')}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChipHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChip)}
                        >
                          <span style={currentStyles.chipIcon}>&#128165;</span> Savage comeback
                        </button>
                        <button
                          style={currentStyles.quickChip}
                          onClick={() => handleChipClick('Tell me what I need to hear not what I want to hear')}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChipHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChip)}
                        >
                          <span style={currentStyles.chipIcon}>&#128142;</span> Hard truth
                        </button>
                        {/* Duplicate set for seamless loop */}
                        <button
                          style={currentStyles.quickChip}
                          onClick={() => handleChipClick('Roast my business idea brutally')}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChipHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChip)}
                        >
                          <span style={currentStyles.chipIcon}>&#128293;</span> Roast my idea
                        </button>
                        <button
                          style={currentStyles.quickChip}
                          onClick={() => handleChipClick('Give me brutally honest life advice')}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChipHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChip)}
                        >
                          <span style={currentStyles.chipIcon}>&#128172;</span> Real talk
                        </button>
                        <button
                          style={currentStyles.quickChip}
                          onClick={() => handleChipClick('Write something unhinged and creative')}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChipHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChip)}
                        >
                          <span style={currentStyles.chipIcon}>&#9997;&#65039;</span> Write unhinged
                        </button>
                        <button
                          style={currentStyles.quickChip}
                          onClick={() => handleChipClick('Settle this debate for me once and for all')}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChipHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChip)}
                        >
                          <span style={currentStyles.chipIcon}>&#9878;&#65039;</span> Settle a debate
                        </button>
                        <button
                          style={currentStyles.quickChip}
                          onClick={() => handleChipClick('Help me cook up a savage comeback')}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChipHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChip)}
                        >
                          <span style={currentStyles.chipIcon}>&#128165;</span> Savage comeback
                        </button>
                        <button
                          style={currentStyles.quickChip}
                          onClick={() => handleChipClick('Tell me what I need to hear not what I want to hear')}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChipHover)}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, currentStyles.quickChip)}
                        >
                          <span style={currentStyles.chipIcon}>&#128142;</span> Hard truth
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Hidden file inputs for uploads */}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <input
                    type="file"
                    accept=".pdf,.txt,.csv,.md,.json,.js,.ts,.py,.html,.css,.jsx,.tsx,.sql,.xml,.yaml,.yml,.sh,.rb,.go,.rs,.java,.cpp,.c,.h"
                    ref={docInputRef}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />

                  {/* Input area centered with greeting */}
                  <div style={{
                    ...currentStyles.inputWrapper,
                    ...(isMobile ? currentStyles.inputWrapperMobile : {}),
                    padding: '16px 24px',
                    marginTop: '8px',
                  }}>
                    {!canSendMessage() && (
                      <div style={currentStyles.limitWarning}>
                        <strong>Daily limit reached!</strong> You&apos;ve used all your messages for today.
                        {" "}
                        <span
                          style={currentStyles.upgradeLink}
                          onClick={() => openUpgradeModal()}
                        >
                          Upgrade your plan
                        </span> for more messages.
                      </div>
                    )}

                    <div style={{ ...currentStyles.inputCard, position: 'relative' as const }}>
                      {/* @mention dropdown */}
                      {showMentionDropdown && chatCharacters.length > 0 && (
                        <div style={{
                          position: 'absolute', bottom: 'calc(100% + 8px)', left: 12,
                          background: theme === 'dark' ? '#1A1A1E' : '#E4E3DF',
                          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.13)'}`,
                          borderRadius: 12, padding: 6, minWidth: 200,
                          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 50,
                        }}>
                          {chatCharacters.map(char => (
                            <div
                              key={char.id}
                              className="mention-dropdown-item"
                              onClick={() => {
                                track(EVENTS.MENTION_DROPDOWN_SELECTED, { character_name: char.name, characters_available: chatCharacters.length });
                                const atIdx = input.lastIndexOf('@');
                                setInput(input.substring(0, atIdx) + '@' + char.name + ' ');
                                setShowMentionDropdown(false);
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? '#222228' : '#DDDCD8'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{
                                width: 24, height: 24, borderRadius: '50%',
                                background: char.color_bg, color: char.color_fg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 700,
                              }}>{char.name.substring(0, 2).toUpperCase()}</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: char.color_fg }}>{char.name}</div>
                                <div style={{ fontSize: 11, color: theme === 'dark' ? '#5A5660' : '#9A9590' }}>{char.personality?.substring(0, 30) || 'Character'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* File preview strip */}
                      {(filePreviewUrl || (selectedFile && selectedFileType !== "image")) && (
                        <div style={{
                          padding: '8px 12px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            {selectedFileType === "image" && filePreviewUrl ? (
                              <img
                                src={filePreviewUrl}
                                alt="Selected"
                                style={{
                                  height: '60px',
                                  maxWidth: '120px',
                                  objectFit: 'cover',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                                }}
                              />
                            ) : selectedFile ? (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                background: 'var(--bg-tertiary, #1a1a1e)',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                              }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={selectedFileType === "pdf" ? "#ef4444" : "#E8A04C"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #f0ede8)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-secondary, #888)' }}>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                                </div>
                              </div>
                            ) : null}
                            <button
                              onClick={handleFileRemove}
                              style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-6px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                lineHeight: 1,
                                padding: 0,
                              }}
                            >
                              &times;
                            </button>
                          </div>
                          {isUploading && (
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary, #888)' }}>Uploading...</span>
                          )}
                        </div>
                      )}
                      <div style={currentStyles.inputRow}>
                        <textarea
                          ref={textareaRef}
                          rows={1}
                          placeholder={canSendMessage() ? "Talk, no filters..." : "Daily limit reached. Upgrade to continue."}
                          value={input}
                          onChange={handleInputChange}
                          onKeyDown={handleKeyDown}
                          onFocus={handleInputFocus}
                          onInput={(e) => {
                            const el = e.currentTarget;
                            el.style.height = 'auto';
                            el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
                          }}
                          disabled={chatLoading || !canSendMessage()}
                          style={{ ...currentStyles.textarea, caretColor: input ? undefined : 'transparent' }}
                        />
                        {chatLoading ? (
                          <button
                            style={{
                              ...currentStyles.sendBtn,
                              background: '#ef4444',
                            }}
                            onClick={stopGeneration}
                            title="Stop generating"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            style={{
                              ...currentStyles.sendBtn,
                              ...((!input.trim() && !selectedFile) || !canSendMessage() ? currentStyles.sendBtnDisabled : {})
                            }}
                            onClick={handleSend}
                            disabled={(!input.trim() && !selectedFile) || !canSendMessage()}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="22" y1="2" x2="11" y2="13" />
                              <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={currentStyles.inputFooter}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <div ref={showGreeting ? plusMenuRef : undefined} style={{ position: 'relative' }}>
                          <button
                            style={currentStyles.attachBtn}
                            title="Attach file"
                            onClick={() => setShowPlusMenu(!showPlusMenu)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                            </svg>
                          </button>
                          {showPlusMenu && (
                            <div style={currentStyles.plusMenu}>
                              <button style={currentStyles.plusMenuItem} onClick={() => {
                                setShowPlusMenu(false);
                                fileInputRef.current?.click();
                              }}>
                                <div style={currentStyles.plusMenuItemContent}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                  </svg>
                                  <span>Add Photos</span>
                                </div>
                              </button>
                              <button style={currentStyles.plusMenuItem} onClick={() => {
                                setShowPlusMenu(false);
                                docInputRef.current?.click();
                              }}>
                                <div style={currentStyles.plusMenuItemContent}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                  </svg>
                                  <span>Add Files</span>
                                </div>
                              </button>
                              <button style={currentStyles.plusMenuItem} onClick={() => { setShowPlusMenu(false); openUpgradeModal(); }}>
                                <div style={currentStyles.plusMenuItemContent}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="4" />
                                    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                                  </svg>
                                  <span>Generate Image</span>
                                </div>
                                <span style={currentStyles.upgradeBadge}>Upgrade</span>
                              </button>
                              <button style={currentStyles.plusMenuItem} onClick={() => {
                                setShowPlusMenu(false);
                                openCharacterModal();
                              }}>
                                <div style={currentStyles.plusMenuItemContent}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                  </svg>
                                  <span>Add Chat Character</span>
                                </div>
                              </button>
                            </div>
                          )}
                        </div>
                        <button style={currentStyles.attachBtn} title="Voice input" onClick={() => openUpgradeModal()}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                            <line x1="12" y1="19" x2="12" y2="23"/>
                            <line x1="8" y1="23" x2="16" y2="23"/>
                          </svg>
                        </button>
                      </div>
                      <span style={currentStyles.inputHint}>{chatCharacters.length > 0 ? 'Type @ to mention a character' : 'So-UnFiltered AI may produce inaccurate responses'}</span>
                    </div>
                  </div>
                </div>
              )}

              {!showGreeting && isChatsLoaded && !isWaitingForStoredChat && (() => {
                // Find the index of the last assistant message (for showing buttons only on last one)
                const lastAssistantIndex = messages.reduce((lastIdx, m, idx) =>
                  m.role === 'assistant' ? idx : lastIdx, -1);

                return (
                <div style={{
                  ...currentStyles.chatMessages,
                  ...(isMobile ? currentStyles.chatMessagesMobile : {})
                }}>
                  {messages.map((m, index) => {
                    const isLastAssistant = m.role === 'assistant' && index === lastAssistantIndex;

                    // Hide empty assistant messages UNLESS it's the last one (which shows typing dots)
                    // Also hide if searching (search indicator will show instead)
                    if (m.role === "assistant" && !m.content && (!isLastAssistant || isSearching)) {
                      return null;
                    }
                    return (
                    <div
                      key={m.id}
                      style={m.role === "user" ? currentStyles.messageRowUser : currentStyles.messageRowAssistant}
                    >
                      {m.role === "user" ? (
                        /* User messages: bubble with actions below, or edit mode */
                        <div style={currentStyles.messageWrapperUser}>
                          {editingMessageId === m.id ? (
                            /* Edit mode */
                            <div style={currentStyles.editModeContainer}>
                              <textarea
                                value={editingMessageContent}
                                onChange={(e) => setEditingMessageContent(e.target.value)}
                                style={currentStyles.editTextarea}
                                autoFocus
                              />
                              <div style={currentStyles.editWarning}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                                  <circle cx="12" cy="12" r="10"/>
                                  <line x1="12" y1="8" x2="12" y2="12"/>
                                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                <span>Heads up: editing this will wipe the AI&apos;s response and get you a fresh one. No going back.</span>
                              </div>
                              <div style={currentStyles.editActions}>
                                <button
                                  onClick={handleEditCancel}
                                  style={currentStyles.editCancelBtn}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleEditSave}
                                  disabled={!editingMessageContent.trim() || chatLoading}
                                  style={{
                                    ...currentStyles.editSaveBtn,
                                    opacity: editingMessageContent.trim() && !chatLoading ? 1 : 0.5,
                                  }}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Normal display mode */
                            <>
                              <div style={currentStyles.messageBubbleUser}>
                                {m.image_url && (!m.file_type || m.file_type === "image") && (
                                  <img
                                    src={m.image_url}
                                    alt="Uploaded"
                                    onClick={() => window.open(m.image_url, '_blank')}
                                    style={{
                                      maxWidth: '300px',
                                      maxHeight: '200px',
                                      borderRadius: '12px',
                                      marginBottom: m.content ? '8px' : 0,
                                      cursor: 'pointer',
                                      display: 'block',
                                    }}
                                  />
                                )}
                                {m.image_url && m.file_type && m.file_type !== "image" && (
                                  <div
                                    onClick={() => window.open(m.image_url, '_blank')}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '8px 12px',
                                      background: 'rgba(255,255,255,0.06)',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      marginBottom: m.content ? '8px' : 0,
                                      maxWidth: '250px',
                                    }}
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={m.file_type === "pdf" ? "#ef4444" : "#E8A04C"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                      <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    <span style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {m.file_name || 'File'}
                                    </span>
                                  </div>
                                )}
                                {m.content && (
                                  <span>
                                    {m.content.split(/(@\w+)/g).map((part, pi) =>
                                      part.match(/^@\w+$/) ? (
                                        <span key={pi} style={{ color: theme === 'dark' ? '#E8A04C' : '#D08A30', fontWeight: 600 }}>{part}</span>
                                      ) : (
                                        <span key={pi}>{part}</span>
                                      )
                                    )}
                                  </span>
                                )}
                              </div>
                              <div style={currentStyles.messageActionsUser}>
                                {/* Refresh/retry button */}
                                <button
                                  onClick={() => handleRegenerate(m.id)}
                                  disabled={chatLoading}
                                  style={{
                                    ...currentStyles.actionButton,
                                    ...(isMobile ? { padding: '6px', minWidth: '32px', minHeight: '32px' } : {}),
                                    opacity: chatLoading ? 0.3 : 1,
                                  }}
                                  title="Retry message"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                                    <path d="M21 3v5h-5"/>
                                  </svg>
                                </button>
                                {/* Edit button */}
                                <button
                                  onClick={() => handleEditStart(m.id, m.content)}
                                  disabled={chatLoading}
                                  style={{
                                    ...currentStyles.actionButton,
                                    ...(isMobile ? { padding: '6px', minWidth: '32px', minHeight: '32px' } : {}),
                                    opacity: chatLoading ? 0.3 : 1,
                                  }}
                                  title="Edit message"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                  </svg>
                                </button>
                                {/* Copy button */}
                                <button
                                  onClick={() => handleCopyMessage(m.content, m.id)}
                                  style={{
                                    ...currentStyles.actionButton,
                                    ...(isMobile ? { padding: '6px', minWidth: '32px', minHeight: '32px' } : {})
                                  }}
                                  title="Copy message"
                                >
                                  {copiedMessageId === m.id ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                  ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        /* AI messages: bubble on left, copy button on right */
                        <div style={currentStyles.messageWrapper}>
                          {m.isError ? (
                            /* Error state - show error message with retry button */
                            <div
                              className="message-bubble"
                              style={{
                                ...currentStyles.messageBubbleAssistant,
                                background: theme === 'dark' ? '#3a2a2a' : '#fef2f2',
                                border: `1px solid ${theme === 'dark' ? '#5c3c3c' : '#fecaca'}`,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme === 'dark' ? '#fca5a5' : '#dc2626' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10"/>
                                  <line x1="12" y1="8" x2="12" y2="12"/>
                                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                <span style={{ fontSize: '14px' }}>{m.content}</span>
                                <button
                                  onClick={() => {
                                    const userMsgId = findPrecedingUserMessageId(m.id);
                                    if (userMsgId) handleRegenerate(userMsgId);
                                  }}
                                  disabled={chatLoading}
                                  style={{
                                    marginLeft: 'auto',
                                    padding: '6px 12px',
                                    fontSize: '13px',
                                    background: theme === 'dark' ? '#4a3a3a' : '#fee2e2',
                                    border: `1px solid ${theme === 'dark' ? '#6c4c4c' : '#fca5a5'}`,
                                    borderRadius: '8px',
                                    color: theme === 'dark' ? '#fca5a5' : '#dc2626',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                                    <path d="M21 3v5h-5"/>
                                  </svg>
                                  Retry
                                </button>
                              </div>
                            </div>
                          ) : m.content ? (
                            m.character_name ? (
                              /* CHARACTER MESSAGE */
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: m.character_color_bg || '#2D1B4E',
                                  color: m.character_color_fg || '#B388FF',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 4,
                                }}>
                                  {m.character_name.substring(0, 2).toUpperCase()}
                                </div>
                                <div style={{ maxWidth: '80%', minWidth: 0 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ color: m.character_color_fg || '#B388FF' }}>{m.character_name}</span>
                                    <span style={{
                                      fontSize: 8, padding: '1px 5px', borderRadius: 4,
                                      fontWeight: 600, textTransform: 'uppercase' as const,
                                      background: m.character_color_tag || 'rgba(179,136,255,0.15)',
                                      color: m.character_color_fg || '#B388FF',
                                    }}>Character</span>
                                  </div>
                                  <div
                                    className="message-bubble"
                                    style={{
                                      padding: '12px 16px', borderRadius: '16px 16px 16px 4px',
                                      fontSize: 14, lineHeight: 1.6,
                                      background: m.character_color_bg_light || 'rgba(179,136,255,0.06)',
                                      border: `1px solid ${m.character_color_border || 'rgba(179,136,255,0.2)'}`,
                                      color: theme === 'dark' ? '#F0EDE8' : '#1A1918',
                                    }}
                                  >
                                    <div style={currentStyles.messageText}>
                                      <ReactMarkdown
                                        components={{
                                          p: ({ children }) => <p style={{ margin: '0 0 0.75em 0', display: 'block' }}>{children}</p>,
                                        }}
                                      >
                                        {m.content}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* NORMAL AI MESSAGE */
                              <div
                                className="message-bubble"
                                style={currentStyles.messageBubbleAssistant}
                              >
                                <div style={currentStyles.messageText}>
                                  <ReactMarkdown
                                    components={{
                                      p: ({ children }) => <p style={{ margin: '0 0 0.75em 0', display: 'block' }}>{children}</p>,
                                    }}
                                  >
                                    {m.content}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )
                          ) : (!isSearching && isLastAssistant) ? (
                            /* Typing indicator bubble - only for the LAST assistant message and only when not searching */
                            <div className="typing-bubble-wrapper">
                              <div className="typing-bubble">
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                              </div>
                              <div className="typing-bubble-tail">
                                <div className="tail-circle tail-circle-1" />
                                <div className="tail-circle tail-circle-2" />
                              </div>
                            </div>
                          ) : null}
                          {/* Show action buttons for all assistant messages (except pre-search finalized ones) */}
                          {m.content && !m.isFinalized && (
                            <div style={currentStyles.messageActions}>
                              {/* Copy button */}
                              <button
                                onClick={() => handleCopyMessage(m.content, m.id)}
                                style={{
                                  ...currentStyles.actionButton,
                                  ...(isMobile ? { padding: '6px', minWidth: '32px', minHeight: '32px' } : {})
                                }}
                                title="Copy message"
                              >
                                {copiedMessageId === m.id ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                  </svg>
                                )}
                              </button>
                              {/* Thumbs up button */}
                              <button
                                onClick={() => handleFeedback(m.id, 'like')}
                                style={{
                                  ...currentStyles.actionButton,
                                  ...(isMobile ? { padding: '6px', minWidth: '32px', minHeight: '32px' } : {}),
                                  ...(messageFeedback[m.id] === 'like' ? { color: '#10b981', opacity: 1 } : {}),
                                }}
                                title="Good response"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill={messageFeedback[m.id] === 'like' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                                </svg>
                              </button>
                              {/* Thumbs down button */}
                              <button
                                onClick={() => handleFeedback(m.id, 'dislike')}
                                style={{
                                  ...currentStyles.actionButton,
                                  ...(isMobile ? { padding: '6px', minWidth: '32px', minHeight: '32px' } : {}),
                                  ...(messageFeedback[m.id] === 'dislike' ? { color: '#ef4444', opacity: 1 } : {}),
                                }}
                                title="Bad response"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill={messageFeedback[m.id] === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                                </svg>
                              </button>
                              {/* Refresh/regenerate button */}
                              <button
                                onClick={() => {
                                  const userMsgId = findPrecedingUserMessageId(m.id);
                                  if (userMsgId) handleRegenerate(userMsgId);
                                }}
                                disabled={chatLoading}
                                style={{
                                  ...currentStyles.actionButton,
                                  ...(isMobile ? { padding: '6px', minWidth: '32px', minHeight: '32px' } : {}),
                                  opacity: chatLoading ? 0.3 : 1,
                                }}
                                title="Regenerate response"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                                  <path d="M21 3v5h-5"/>
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                  })}

                  {/* Show searching indicator when AI is searching the web */}
                  {isSearching && (
                    <div style={currentStyles.messageRowAssistant}>
                      <div style={{
                        ...currentStyles.messageBubbleAssistant,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 16px',
                      }}>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{ animation: 'spin 1s linear infinite' }}
                        >
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.35-4.35" />
                        </svg>
                        <span style={{ fontSize: '14px', color: '#666' }}>
                          Searching the web{searchQuery ? ` for "${searchQuery}"` : ''}...
                        </span>
                      </div>
                    </div>
                  )}


                  <div ref={messagesEndRef} />
                </div>
                );
              })()}
            </div>

            {/* Scroll to bottom floating button */}
            {showScrollButton && (
              <button
                onClick={scrollToBottom}
                style={currentStyles.scrollToBottomBtn}
                title="Scroll to bottom"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            )}

            {/* Bottom input area - only shown when there are messages */}
            {!showGreeting && (
              <div style={currentStyles.inputArea}>
                <div style={{
                  ...currentStyles.inputWrapper,
                  ...(isMobile ? currentStyles.inputWrapperMobile : {})
                }}>
                  {!canSendMessage() && (
                    <div style={currentStyles.limitWarning}>
                      <strong>Daily limit reached!</strong> You&apos;ve used all your messages for today.
                      {" "}
                      <span
                        style={currentStyles.upgradeLink}
                        onClick={() => setShowAccountModal(true)}
                      >
                        Upgrade your plan
                      </span> for more messages.
                    </div>
                  )}

                  <div style={currentStyles.inputCard}>
                    {/* File preview strip */}
                    {(filePreviewUrl || (selectedFile && selectedFileType !== "image")) && (
                      <div style={{
                        padding: '8px 12px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          {selectedFileType === "image" && filePreviewUrl ? (
                            <img
                              src={filePreviewUrl}
                              alt="Selected"
                              style={{
                                height: '60px',
                                maxWidth: '120px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                              }}
                            />
                          ) : selectedFile ? (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              background: 'var(--bg-tertiary, #1a1a1e)',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                            }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={selectedFileType === "pdf" ? "#ef4444" : "#E8A04C"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #f0ede8)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary, #888)' }}>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                              </div>
                            </div>
                          ) : null}
                          <button
                            onClick={handleFileRemove}
                            style={{
                              position: 'absolute',
                              top: '-6px',
                              right: '-6px',
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              lineHeight: 1,
                              padding: 0,
                            }}
                          >
                            &times;
                          </button>
                        </div>
                        {isUploading && (
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary, #888)' }}>Uploading...</span>
                        )}
                      </div>
                    )}
                    <div style={currentStyles.inputRow}>
                      <textarea
                        ref={textareaRef}
                        rows={1}
                        placeholder={canSendMessage() ? "Talk, no filters..." : "Daily limit reached. Upgrade to continue."}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={handleInputFocus}
                        onInput={(e) => {
                          const el = e.currentTarget;
                          el.style.height = 'auto';
                          el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
                        }}
                        disabled={chatLoading || !canSendMessage()}
                        style={{ ...currentStyles.textarea, caretColor: input ? undefined : 'transparent' }}
                      />
                      {chatLoading ? (
                        <button
                          style={{
                            ...currentStyles.sendBtn,
                            background: '#ef4444',
                          }}
                          onClick={stopGeneration}
                          title="Stop generating"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="6" width="12" height="12" rx="2" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          style={{
                            ...currentStyles.sendBtn,
                            ...((!input.trim() && !selectedFile) || !canSendMessage() ? currentStyles.sendBtnDisabled : {})
                          }}
                          onClick={handleSend}
                          disabled={(!input.trim() && !selectedFile) || !canSendMessage()}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={currentStyles.inputFooter}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <div ref={!showGreeting ? plusMenuRef : undefined} style={{ position: 'relative' }}>
                        <button
                          style={currentStyles.attachBtn}
                          title="Attach file"
                          onClick={() => setShowPlusMenu(!showPlusMenu)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                          </svg>
                        </button>
                        {showPlusMenu && (
                          <div style={currentStyles.plusMenu}>
                            <button style={currentStyles.plusMenuItem} onClick={() => {
                              setShowPlusMenu(false);
                              fileInputRef.current?.click();
                            }}>
                              <div style={currentStyles.plusMenuItemContent}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                  <circle cx="8.5" cy="8.5" r="1.5" />
                                  <polyline points="21 15 16 10 5 21" />
                                </svg>
                                <span>Add Photos</span>
                              </div>
                            </button>
                            <button style={currentStyles.plusMenuItem} onClick={() => {
                              setShowPlusMenu(false);
                              docInputRef.current?.click();
                            }}>
                              <div style={currentStyles.plusMenuItemContent}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <span>Add Files</span>
                              </div>
                            </button>
                            <button style={currentStyles.plusMenuItem} onClick={() => { setShowPlusMenu(false); setShowAccountModal(true); }}>
                              <div style={currentStyles.plusMenuItemContent}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="4" />
                                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                                </svg>
                                <span>Generate Image</span>
                              </div>
                              <span style={currentStyles.upgradeBadge}>Upgrade</span>
                            </button>
                            <button style={currentStyles.plusMenuItem} onClick={() => {
                              setShowPlusMenu(false);
                              openCharacterModal();
                            }}>
                              <div style={currentStyles.plusMenuItemContent}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                  <circle cx="12" cy="7" r="4" />
                                </svg>
                                <span>Add Chat Character</span>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                      <button style={currentStyles.attachBtn} title="Voice input" onClick={() => openUpgradeModal()}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                          <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                          <line x1="12" y1="19" x2="12" y2="23"/>
                          <line x1="8" y1="23" x2="16" y2="23"/>
                        </svg>
                      </button>
                    </div>
                    <span style={currentStyles.inputHint}>{chatCharacters.length > 0 ? 'Type @ to mention a character' : 'So-UnFiltered AI may produce inaccurate responses'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Account Modal */}
      {showAccountModal && (
        <>
          <div style={currentStyles.modalOverlay} onClick={() => { setShowAccountModal(false); setShowMemorySection(false); }} />
          <div style={currentStyles.modalContainer}>
            <div style={currentStyles.modalContent}>
              <div style={currentStyles.modalHeader}>
                <h2 style={currentStyles.modalTitle}>Account Settings</h2>
                <button style={currentStyles.modalCloseBtn} onClick={() => { setShowAccountModal(false); setShowMemorySection(false); }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div style={currentStyles.modalBody}>
                <div style={currentStyles.modalSection}>
                  <h3 style={currentStyles.modalSectionTitle}>Profile Information</h3>
                  <div style={{
                    ...currentStyles.modalInfoRow,
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    <span style={{ ...currentStyles.modalLabel, flexShrink: 0, minWidth: '50px' }}>Name:</span>
                    {isEditingName ? (
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        flex: 1,
                        minWidth: 0,
                        justifyContent: 'flex-end',
                      }}>
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateName();
                            if (e.key === 'Escape') setIsEditingName(false);
                          }}
                          disabled={isSavingName}
                          autoFocus
                          style={{
                            flex: 1,
                            minWidth: 0,
                            maxWidth: '200px',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #d0d0d0',
                            fontSize: '16px', // 16px prevents iOS zoom
                            background: theme === 'dark' ? '#2a2a2a' : '#fff',
                            color: theme === 'dark' ? '#fff' : '#333',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={updateName}
                          disabled={isSavingName}
                          title="Save"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#10b981',
                            color: '#fff',
                            cursor: isSavingName ? 'not-allowed' : 'pointer',
                            opacity: isSavingName ? 0.6 : 1,
                            flexShrink: 0,
                          }}
                        >
                          {isSavingName ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => setIsEditingName(false)}
                          disabled={isSavingName}
                          title="Cancel"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: '1px solid #d0d0d0',
                            background: theme === 'dark' ? '#3a3a3a' : '#fff',
                            color: theme === 'dark' ? '#fff' : '#666',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flex: 1 }}>
                        <span style={currentStyles.modalValue}>{session?.user?.name}</span>
                        <button
                          onClick={() => {
                            setEditNameValue(session?.user?.name || '');
                            setIsEditingName(true);
                          }}
                          title="Edit name"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            border: '1px solid #d0d0d0',
                            background: theme === 'dark' ? '#3a3a3a' : '#f5f5f5',
                            color: theme === 'dark' ? '#ccc' : '#555',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={currentStyles.modalInfoRow}>
                    <span style={currentStyles.modalLabel}>Email:</span>
                    <span style={currentStyles.modalValue}>{session?.user?.email}</span>
                  </div>
                </div>

                <div style={currentStyles.modalSection}>
                  <h3 style={currentStyles.modalSectionTitle}>Timezone</h3>
                  <p style={{ fontSize: '13px', color: theme === 'dark' ? '#888' : '#666', marginBottom: '12px' }}>
                    Your daily message limit resets at midnight in your timezone.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: theme === 'dark' ? '#ccc' : '#333' }}>
                      {session?.user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </span>
                    <span style={{ fontSize: '12px', color: theme === 'dark' ? '#666' : '#999' }}>
                      (auto-detected)
                    </span>
                  </div>
                </div>

                <div style={currentStyles.modalSection}>
                  <h3 style={currentStyles.modalSectionTitle}>Current Plan</h3>
                  <div style={currentStyles.planCurrentBadge}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={currentStyles.planBadgeLarge}>{session?.user?.plan}</div>
                      <div style={currentStyles.planDescription}>
                        {session?.user?.plan === "Free" && `${messagesUsed}/5 messages used today`}
                        {session?.user?.plan === "Pro" && `${messagesUsed}/100 messages used today`}
                        {session?.user?.plan === "Plus" && `${messagesUsed}/300 messages used today`}
                      </div>
                    </div>
                    {/* Cancellation Status Indicator */}
                    {session?.user?.subscriptionStatus === 'canceling' && session?.user?.currentPeriodEnd && (
                      <div style={{
                        marginBottom: '12px',
                        padding: '10px 14px',
                        background: theme === 'dark' ? 'rgba(251, 191, 36, 0.15)' : '#fffbeb',
                        border: `1px solid ${theme === 'dark' ? 'rgba(251, 191, 36, 0.3)' : '#fcd34d'}`,
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: theme === 'dark' ? '#fcd34d' : '#92400e',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                          </svg>
                          <span>
                            Cancelling at end of billing period ({new Date(session.user.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                          </span>
                        </div>
                      </div>
                    )}
                    {/* Downgrading Status Indicator */}
                    {session?.user?.subscriptionStatus === 'downgrading' && session?.user?.currentPeriodEnd && (
                      <div style={{
                        marginBottom: '12px',
                        padding: '10px 14px',
                        background: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                        border: `1px solid ${theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : '#93c5fd'}`,
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: theme === 'dark' ? '#93c5fd' : '#1e40af',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 8 12 12 14 14"/>
                          </svg>
                          <span>
                            Downgrading to Pro on {new Date(session.user.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Progress Bar */}
                    {session?.user && (
                      <div style={currentStyles.progressBarContainer}>
                        <div 
                          style={{
                            ...currentStyles.progressBar,
                            width: `${getProgressPercentage()}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <h4 style={currentStyles.modalSubsectionTitle}>Upgrade Your Plan</h4>
                  <div style={{ position: 'relative' as const }}>
                    <div
                      id="planScrollHint"
                      style={{
                        position: 'absolute' as const,
                        right: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: theme === 'dark' ? '#141416' : '#EDECE8',
                        border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: theme === 'dark' ? '#E8A04C' : '#D08A30',
                        zIndex: 2,
                        animation: 'nudgeRight 1.5s ease-in-out infinite',
                        pointerEvents: 'none' as const,
                        boxShadow: theme === 'dark' ? '-8px 0 16px #141416' : '-8px 0 16px #EDECE8',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="9 6 15 12 9 18" />
                      </svg>
                    </div>
                    <div
                      style={currentStyles.plansGrid}
                      onScroll={(e) => {
                        const hint = document.getElementById('planScrollHint');
                        if (hint) {
                          const target = e.target as HTMLElement;
                          hint.style.opacity = target.scrollLeft > 20 ? '0' : '1';
                          hint.style.transition = 'opacity 0.3s ease';
                        }
                      }}
                    >
                    <div style={{...currentStyles.planCard, ...(session?.user?.plan === "Free" ? currentStyles.planCardActive : {})}}>
                      <h5 style={currentStyles.planCardTitle}>Free</h5>
                      <div style={currentStyles.planPrice}>$0<span style={currentStyles.planPricePeriod}>/mo</span></div>
                      <ul style={currentStyles.planFeatures}>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> 5 messages per day</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> Basic support</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> Chat on web</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> Limited uploads</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> Limited memory and context</li>
                      </ul>
                      {session?.user?.plan !== "Free" && (
                        <button
                          style={currentStyles.planBtn}
                          onClick={() => upgradePlan("Free")}
                        >
                          Downgrade to Free
                        </button>
                      )}
                      {session?.user?.plan === "Free" && (
                        <button
                          style={{
                            ...currentStyles.planBtn,
                            background: theme === 'dark' ? '#E8A04C' : '#D08A30',
                            color: theme === 'dark' ? '#0C0C0E' : '#fff',
                            borderColor: theme === 'dark' ? '#E8A04C' : '#D08A30',
                          }}
                          disabled
                        >
                          Current Plan
                        </button>
                      )}
                    </div>

                    <div style={{...currentStyles.planCard, ...(session?.user?.plan === "Pro" || session?.user?.subscriptionStatus === 'downgrading' ? currentStyles.planCardActive : {})}}>
                      <h5 style={currentStyles.planCardTitle}>Pro</h5>
                      <div style={currentStyles.planPrice}>$4.99<span style={currentStyles.planPricePeriod}>/mo</span></div>
                      <ul style={currentStyles.planFeatures}>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> 100 messages per day</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> 20x more than Free</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> Expanded memory and context</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> Early access to new features</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> Advanced reasoning models</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> Memory across conversations</li>
                      </ul>
                      {/* Show downgrading indicator */}
                      {session?.user?.subscriptionStatus === 'downgrading' && session?.user?.currentPeriodEnd && (
                        <div style={{
                          padding: '8px 12px',
                          background: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                          border: `1px solid ${theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : '#93c5fd'}`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: theme === 'dark' ? '#93c5fd' : '#1e40af',
                          marginBottom: '8px',
                          textAlign: 'center',
                        }}>
                          Switching to this plan on {new Date(session.user.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                      {session?.user?.plan !== "Pro" && session?.user?.subscriptionStatus !== 'downgrading' && (
                        <button
                          style={currentStyles.planBtn}
                          onClick={() => upgradePlan("Pro")}
                        >
                          {session?.user?.plan === "Free" ? "Upgrade to Pro" : "Switch to Pro"}
                        </button>
                      )}
                      {(session?.user?.plan === "Pro" || session?.user?.subscriptionStatus === 'downgrading') && (
                        <button
                          style={{
                            ...currentStyles.planBtn,
                            background: theme === 'dark' ? '#E8A04C' : '#D08A30',
                            color: theme === 'dark' ? '#0C0C0E' : '#fff',
                            borderColor: theme === 'dark' ? '#E8A04C' : '#D08A30',
                          }}
                          disabled
                        >
                          Current Plan
                        </button>
                      )}
                    </div>

                    <div style={{...currentStyles.planCard, ...(session?.user?.plan === "Plus" ? currentStyles.planCardActive : {})}}>
                      <h5 style={currentStyles.planCardTitle}>Plus</h5>
                      <div style={currentStyles.planPrice}>$9.99<span style={currentStyles.planPricePeriod}>/mo</span></div>
                      <ul style={currentStyles.planFeatures}>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> Everything in Pro</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> 300 messages per day</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> 60x more than Free, 3x more than Pro</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> Higher outputs for more tasks</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> Priority access at high traffic</li>
                        <li style={currentStyles.planFeature}><span style={currentStyles.checkMark}>&#10003;</span> Early access to advanced features</li>
                      </ul>
                      {session?.user?.plan !== "Plus" && (
                        <button
                          style={currentStyles.planBtn}
                          onClick={() => upgradePlan("Plus")}
                        >
                          Upgrade to Plus
                        </button>
                      )}
                      {session?.user?.plan === "Plus" && (
                        <button
                          style={{
                            ...currentStyles.planBtn,
                            background: theme === 'dark' ? '#E8A04C' : '#D08A30',
                            color: theme === 'dark' ? '#0C0C0E' : '#fff',
                            borderColor: theme === 'dark' ? '#E8A04C' : '#D08A30',
                          }}
                          disabled
                        >
                          Current Plan
                        </button>
                      )}
                    </div>
                  </div>
                  </div>

                </div>

                {/* AI Memory Section — Collapsible */}
                <div style={currentStyles.modalSection}>
                  <button
                    onClick={() => setShowMemorySection(!showMemorySection)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ ...currentStyles.modalSectionTitle, marginBottom: 0 }}>AI Memory</h3>
                      {memories.length > 0 && !showMemorySection && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '1px 7px',
                          borderRadius: '10px',
                          background: theme === 'dark' ? 'rgba(232,160,76,0.15)' : 'rgba(208,138,48,0.1)',
                          color: theme === 'dark' ? '#E8A04C' : '#D08A30',
                        }}>
                          {memories.length}
                        </span>
                      )}
                    </div>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke={theme === 'dark' ? '#888' : '#999'}
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{
                        transition: 'transform 0.2s ease',
                        transform: showMemorySection ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showMemorySection && (
                    <div style={{ marginTop: '12px' }}>
                      <p style={{ fontSize: '13px', color: theme === 'dark' ? '#888' : '#666', marginBottom: '12px' }}>
                        The AI remembers things about you across conversations to give more personal responses.
                      </p>
                      {memoryPlan === 'Free' || (!memoryPlan && session?.user?.plan === 'Free') ? (
                        <div style={{
                          padding: '16px',
                          background: theme === 'dark' ? 'rgba(232, 160, 76, 0.08)' : 'rgba(208, 138, 48, 0.06)',
                          border: `1px solid ${theme === 'dark' ? 'rgba(232, 160, 76, 0.2)' : 'rgba(208, 138, 48, 0.2)'}`,
                          borderRadius: '10px',
                          textAlign: 'center',
                        }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme === 'dark' ? '#E8A04C' : '#D08A30'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                            <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2z"/>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                          <p style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#E8A04C' : '#D08A30', marginBottom: '4px' }}>
                            Upgrade to Pro to enable AI Memory
                          </p>
                          <p style={{ fontSize: '12px', color: theme === 'dark' ? '#888' : '#999' }}>
                            The AI will remember your name, preferences, and interests across conversations.
                          </p>
                        </div>
                      ) : isMemoriesLoading ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: theme === 'dark' ? '#888' : '#999' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                          </svg>
                        </div>
                      ) : memories.length === 0 ? (
                        <div style={{
                          padding: '16px',
                          background: theme === 'dark' ? '#1a1a1c' : '#f9f9f8',
                          borderRadius: '10px',
                          textAlign: 'center',
                          color: theme === 'dark' ? '#888' : '#999',
                          fontSize: '13px',
                        }}>
                          No memories yet. As you chat, the AI will automatically learn about you.
                        </div>
                      ) : (
                        <div>
                          <div style={{
                            maxHeight: '200px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            marginBottom: '10px',
                          }}>
                            {memories.map((memory) => (
                              <div key={memory.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 10px',
                                background: theme === 'dark' ? '#1a1a1c' : '#f9f9f8',
                                borderRadius: '8px',
                                fontSize: '13px',
                              }}>
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: memory.category === 'personal' ? (theme === 'dark' ? 'rgba(100,210,255,0.15)' : 'rgba(59,130,246,0.1)')
                                    : memory.category === 'preference' ? (theme === 'dark' ? 'rgba(179,136,255,0.15)' : 'rgba(139,92,246,0.1)')
                                    : memory.category === 'interest' ? (theme === 'dark' ? 'rgba(105,240,174,0.15)' : 'rgba(34,197,94,0.1)')
                                    : (theme === 'dark' ? 'rgba(232,160,76,0.15)' : 'rgba(234,179,8,0.1)'),
                                  color: memory.category === 'personal' ? (theme === 'dark' ? '#64D2FF' : '#3b82f6')
                                    : memory.category === 'preference' ? (theme === 'dark' ? '#B388FF' : '#8b5cf6')
                                    : memory.category === 'interest' ? (theme === 'dark' ? '#69F0AE' : '#22c55e')
                                    : (theme === 'dark' ? '#E8A04C' : '#eab308'),
                                  flexShrink: 0,
                                  letterSpacing: '0.5px',
                                }}>
                                  {memory.category}
                                </span>
                                <span style={{ flex: 1, color: theme === 'dark' ? '#ccc' : '#333', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {memory.content}
                                </span>
                                <button
                                  onClick={() => deleteMemoryItem(memory.id)}
                                  title="Delete memory"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: theme === 'dark' ? '#555' : '#ccc',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={clearAllMemories}
                            style={{
                              background: 'none',
                              border: `1px solid ${theme === 'dark' ? '#333' : '#ddd'}`,
                              color: theme === 'dark' ? '#888' : '#999',
                              fontSize: '12px',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              width: '100%',
                            }}
                          >
                            Clear all memories ({memories.length})
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Support Section */}
                <div style={currentStyles.modalSection}>
                  <h3 style={currentStyles.modalSectionTitle}>Need Help?</h3>
                  <p style={{ fontSize: '14px', color: theme === 'dark' ? '#aaa' : '#666', marginBottom: '12px' }}>
                    We&apos;re here to help with any questions or issues.
                  </p>
                  <a
                    href="mailto:sounfilteredai@gmail.com"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      background: theme === 'dark' ? '#3a3a3a' : '#f5f5f5',
                      borderRadius: '8px',
                      color: theme === 'dark' ? '#fff' : '#333',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    sounfilteredai@gmail.com
                  </a>
                </div>

                {/* Account Actions - subtle at bottom */}
                <div style={{
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: `1px solid ${theme === 'dark' ? '#333' : '#eee'}`,
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}>
                    <button
                      onClick={handleLogout}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme === 'dark' ? '#666' : '#999',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                      }}
                    >
                      Log out
                    </button>
                    {session?.user?.plan !== "Free" && session?.user?.subscriptionStatus !== 'canceling' && (
                      <button
                        onClick={cancelSubscription}
                        disabled={isCancellingSubscription}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: theme === 'dark' ? '#666' : '#999',
                          fontSize: '12px',
                          cursor: isCancellingSubscription ? 'not-allowed' : 'pointer',
                          padding: '4px 8px',
                          opacity: isCancellingSubscription ? 0.5 : 1,
                        }}
                      >
                        {isCancellingSubscription ? "Cancelling..." : "Cancel subscription"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mobile Chat Actions Modal */}
      {showChatActionsModal && selectedChatForActions && (
        <>
          <div style={currentStyles.modalOverlay} onClick={() => setShowChatActionsModal(false)} />
          <div style={currentStyles.actionsModalContainer}>
            <div style={currentStyles.actionsModalContent}>
              <div style={currentStyles.actionsModalHeader}>
                <h3 style={currentStyles.actionsModalTitle}>{selectedChatForActions.title}</h3>
              </div>
              <div style={currentStyles.actionsModalBody}>
                <button
                  style={currentStyles.actionMenuItem}
                  onClick={() => handleRenameStart(selectedChatForActions.id, selectedChatForActions.title)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Rename
                </button>
                <button
                  style={{...currentStyles.actionMenuItem, ...currentStyles.actionMenuItemDanger}}
                  onClick={() => handleDeleteClick(selectedChatForActions.id)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
                <button
                  style={currentStyles.actionMenuItem}
                  onClick={() => setShowChatActionsModal(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <>
          <div style={currentStyles.modalOverlay} onClick={handleDeleteCancel} />
          <div style={currentStyles.deleteModalContainer}>
            <div style={currentStyles.deleteModalContent}>
              <div style={currentStyles.deleteModalHeader}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗑️</div>
                <h3 style={currentStyles.deleteModalTitle}>Delete this chat?</h3>
              </div>
              <div style={currentStyles.deleteModalBody}>
                <p style={currentStyles.deleteModalText}>
                  This conversation will be <strong>permanently deleted</strong> and cannot be recovered. Are you sure you want to continue?
                </p>
              </div>
              <div style={currentStyles.deleteModalFooter}>
                <button
                  onClick={handleDeleteCancel}
                  style={currentStyles.deleteCancelBtn}
                >
                  No, keep it
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  style={currentStyles.deleteConfirmBtn}
                >
                  Yes, delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Generic Confirmation Modal */}
      {/* Character Modal */}
      {showCharacterModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { track(EVENTS.CHARACTER_MODAL_CLOSED, { action: 'clicked_outside' }); setShowCharacterModal(false); } }}
        >
          <div style={{
            background: theme === 'dark' ? '#141416' : '#EDECE8',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.13)'}`,
            borderRadius: 20, width: 440, maxWidth: '90vw', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column' as const,
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px 16px',
              borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: theme === 'dark' ? '#F0EDE8' : '#1A1918' }}>Chat Characters</div>
              <button
                onClick={() => { track(EVENTS.CHARACTER_MODAL_CLOSED, { action: 'cancelled' }); setShowCharacterModal(false); }}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                  background: 'transparent',
                  color: theme === 'dark' ? '#5A5660' : '#9A9590',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}
              >&times;</button>
            </div>

            {/* Existing characters */}
            <div style={{
              padding: '12px 24px',
              borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: theme === 'dark' ? '#5A5660' : '#9A9590' }}>In this chat</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: theme === 'dark' ? '#5A5660' : '#9A9590' }}>{chatCharacters.length}/5</span>
              </div>

              {chatCharacters.length === 0 ? (
                <div style={{ padding: '12px 0', textAlign: 'center' as const, fontSize: 12, color: theme === 'dark' ? '#5A5660' : '#9A9590' }}>
                  No characters yet. Add one below.
                </div>
              ) : (
                chatCharacters.map((char) => (
                  <div key={char.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                    borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: char.color_bg, color: char.color_fg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                    }}>{char.name.substring(0, 2).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: char.color_fg }}>{char.name}</div>
                      <div style={{ fontSize: 11, color: theme === 'dark' ? '#5A5660' : '#9A9590', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{char.personality || 'No description'}</div>
                    </div>
                    <button
                      onClick={() => removeChatCharacter(char.id)}
                      style={{
                        width: 22, height: 22, borderRadius: 6, border: 'none',
                        background: 'transparent', color: theme === 'dark' ? '#5A5660' : '#9A9590',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                      }}
                    >&times;</button>
                  </div>
                ))
              )}
            </div>

            {/* Add new character form */}
            <div style={{ padding: '20px 24px', overflowY: 'auto' as const, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: theme === 'dark' ? '#F0EDE8' : '#1A1918' }}>Add New Character</div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme === 'dark' ? '#F0EDE8' : '#1A1918' }}>Name</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: theme === 'dark' ? '#5A5660' : '#9A9590' }}>{newCharName.length}/16</span>
                </div>
                <input
                  type="text"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  maxLength={16}
                  placeholder="e.g. Danny, Kofi, Coach..."
                  style={{
                    width: '100%', padding: '10px 12px', boxSizing: 'border-box' as const,
                    background: theme === 'dark' ? '#0C0C0E' : '#F5F4F0',
                    border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.13)'}`,
                    borderRadius: 10, color: theme === 'dark' ? '#F0EDE8' : '#1A1918',
                    fontFamily: "'Inter', sans-serif", fontSize: 14, outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme === 'dark' ? '#F0EDE8' : '#1A1918' }}>Personality</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: theme === 'dark' ? '#5A5660' : '#9A9590' }}>{newCharPersonality.length}/300</span>
                </div>
                <textarea
                  value={newCharPersonality}
                  onChange={(e) => setNewCharPersonality(e.target.value)}
                  maxLength={300}
                  placeholder="Describe how they talk, their vibe..."
                  style={{
                    width: '100%', padding: '10px 12px', height: 64, boxSizing: 'border-box' as const,
                    background: theme === 'dark' ? '#0C0C0E' : '#F5F4F0',
                    border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.13)'}`,
                    borderRadius: 10, color: theme === 'dark' ? '#F0EDE8' : '#1A1918',
                    fontFamily: "'Inter', sans-serif", fontSize: 14, outline: 'none',
                    resize: 'none' as const, lineHeight: 1.5,
                  }}
                />
                <div style={{ fontSize: 11, color: theme === 'dark' ? '#5A5660' : '#9A9590', marginTop: 4 }}>
                  e.g. &quot;A tough love mentor who doesn&apos;t sugarcoat anything&quot;
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: theme === 'dark' ? '#F0EDE8' : '#1A1918' }}>Color</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {CHARACTER_COLORS.map((color, i) => (
                    <div
                      key={color.name}
                      className="char-color-option"
                      onClick={() => setSelectedColorIndex(i)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: color.fg, cursor: 'pointer',
                        border: selectedColorIndex === i ? `2px solid ${theme === 'dark' ? '#F0EDE8' : '#1A1918'}` : '2px solid transparent',
                        transition: 'all 0.2s',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Live Preview */}
              {newCharName.trim() && (
                <div style={{
                  background: theme === 'dark' ? '#0C0C0E' : '#F5F4F0',
                  border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 14,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const,
                    color: theme === 'dark' ? '#5A5660' : '#9A9590',
                    marginBottom: 8,
                  }}>Preview</div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: CHARACTER_COLORS[selectedColorIndex].bg,
                      color: CHARACTER_COLORS[selectedColorIndex].fg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>
                      {newCharName.trim().substring(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: CHARACTER_COLORS[selectedColorIndex].fg }}>
                          {newCharName.trim()}
                        </span>
                        <span style={{
                          fontSize: 8, padding: '1px 5px', borderRadius: 4,
                          fontWeight: 600, textTransform: 'uppercase' as const,
                          background: CHARACTER_COLORS[selectedColorIndex].tag,
                          color: CHARACTER_COLORS[selectedColorIndex].fg,
                        }}>Character</span>
                      </div>

                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '14px 14px 14px 4px',
                        fontSize: 12, lineHeight: 1.5,
                        color: theme === 'dark' ? '#8A8690' : '#6B6660',
                        fontStyle: 'italic' as const,
                        border: `1px solid ${CHARACTER_COLORS[selectedColorIndex].border}`,
                        background: CHARACTER_COLORS[selectedColorIndex].bgLight,
                      }}>
                        This is how {newCharName.trim()}&apos;s messages will look in your chat...
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end',
              borderTop: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
            }}>
              <button
                onClick={() => { track(EVENTS.CHARACTER_MODAL_CLOSED, { action: 'cancelled' }); setShowCharacterModal(false); }}
                style={{
                  padding: '10px 20px', borderRadius: 10,
                  border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.13)'}`,
                  background: 'transparent',
                  color: theme === 'dark' ? '#8A8690' : '#6B6660',
                  fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={addChatCharacter}
                disabled={!newCharName.trim() || chatCharacters.length >= 5 || isAddingCharacter}
                style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
                  color: '#0C0C0E',
                  fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: (!newCharName.trim() || chatCharacters.length >= 5 || isAddingCharacter) ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {isAddingCharacter ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                    </svg>
                    Adding...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Character
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.show && (
        <>
          <div style={currentStyles.modalOverlay} onClick={confirmModal.isLoading ? undefined : closeConfirmModal} />
          <div style={currentStyles.deleteModalContainer}>
            <div style={currentStyles.deleteModalContent}>
              <div style={currentStyles.deleteModalHeader}>
                <h3 style={currentStyles.deleteModalTitle}>{confirmModal.title}</h3>
              </div>
              <div style={currentStyles.deleteModalBody}>
                {confirmModal.isLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={theme === 'dark' ? '#93c5fd' : '#3b82f6'} strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                    </svg>
                    <p style={{ ...currentStyles.deleteModalText, margin: 0 }}>Processing...</p>
                  </div>
                ) : (
                  <p style={{
                    ...currentStyles.deleteModalText,
                    whiteSpace: 'pre-line'
                  }}>
                    {confirmModal.message}
                  </p>
                )}
              </div>
              {!confirmModal.isLoading && (
                <div style={currentStyles.deleteModalFooter}>
                  {confirmModal.confirmText !== "OK" && (
                    <button
                      onClick={closeConfirmModal}
                      style={currentStyles.deleteCancelBtn}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={confirmModal.onConfirm}
                    style={confirmModal.isDestructive ? currentStyles.deleteConfirmBtn : {
                      ...currentStyles.deleteCancelBtn,
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                    }}
                  >
                    {confirmModal.confirmText}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* What's New Modal */}
      {showWhatsNew && (
        <div className="whats-new-overlay" onClick={(e) => { if (e.target === e.currentTarget) dismissWhatsNew(); }}>
          <div className="whats-new-modal">

            {/* SCREEN 1: Feature Overview */}
            <div className={`wn-screen ${whatsNewScreen === 1 ? 'active' : ''}`} key="wn1">
              <div style={{ padding: '32px 32px 0', textAlign: 'center' as const }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 100,
                  background: 'rgba(232,160,76,0.12)', border: '1px solid rgba(232,160,76,0.2)',
                  color: '#E8A04C', fontSize: 11, fontWeight: 700, marginBottom: 20,
                }}>
                  <svg width="14" height="14" viewBox="0 0 100 100" fill="none"><path d="M56 4L30 48H50L28 96L74 44H52L72 4Z" fill="#E8A04C"/></svg>
                  What&apos;s New
                </div>
                <div style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: 8, color: '#F0EDE8' }}>
                  We&apos;ve been <span style={{ background: 'linear-gradient(135deg, #E8A04C, #E8624C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>cooking.</span>
                </div>
                <div style={{ fontSize: 14, color: '#8A8690', lineHeight: 1.5, maxWidth: 380, margin: '0 auto' }}>
                  A bunch of new features just dropped. Here&apos;s what you can do now.
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' as const, padding: '24px 32px' }}>
                <div className="wn-feature-card highlight">
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(179,136,255,0.12)', border: '1px solid rgba(179,136,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B388FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8, color: '#F0EDE8' }}>
                      Chat Characters
                      <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' as const, background: 'linear-gradient(135deg, #E8A04C, #E8624C)', color: '#0C0C0E' }}>New</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#8A8690', lineHeight: 1.45 }}>Add up to 5 AI characters to any chat. They each have their own personality and can disagree with each other.</div>
                    <div className="wn-tutorial-link" onClick={() => { track(EVENTS.WHATS_NEW_SCREEN_VIEWED, { screen_number: 2 }); setWhatsNewScreen(2); }}>
                      See how it works
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </div>
                </div>

                <div className="wn-feature-card">
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(100,210,255,0.12)', border: '1px solid rgba(100,210,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64D2FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8, color: '#F0EDE8' }}>
                      File Uploads
                      <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' as const, background: 'linear-gradient(135deg, #E8A04C, #E8624C)', color: '#0C0C0E' }}>New</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#8A8690', lineHeight: 1.45 }}>Upload documents, PDFs, code files and more. The AI reads them and gives you real feedback.</div>
                  </div>
                </div>

                <div className="wn-feature-card">
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(105,240,174,0.12)', border: '1px solid rgba(105,240,174,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#69F0AE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8, color: '#F0EDE8' }}>
                      Image Uploads
                      <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' as const, background: 'linear-gradient(135deg, #E8A04C, #E8624C)', color: '#0C0C0E' }}>New</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#8A8690', lineHeight: 1.45 }}>Drop an image into chat. Ask the AI to describe it, roast it, or give honest feedback.</div>
                  </div>
                </div>

                <div className="wn-feature-card">
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,128,171,0.12)', border: '1px solid rgba(255,128,171,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF80AB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8, color: '#F0EDE8' }}>
                      Image Generation
                      <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' as const, background: 'linear-gradient(135deg, #E8A04C, #E8624C)', color: '#0C0C0E' }}>New</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#8A8690', lineHeight: 1.45 }}>Ask the AI to create images for you. Logos, memes, concepts — just describe what you want.</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px 32px 28px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingBottom: 4 }}>
                  <div className="wn-dot active"></div>
                  <div className="wn-dot"></div>
                  <div className="wn-dot"></div>
                  <div className="wn-dot"></div>
                </div>
                <button className="wn-btn-primary" onClick={() => { track(EVENTS.WHATS_NEW_SCREEN_VIEWED, { screen_number: 2 }); setWhatsNewScreen(2); }}>
                  Show me
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <button onClick={dismissWhatsNew} style={{ fontSize: 12, color: '#5A5660', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Inter', sans-serif" }}>
                  Skip, I&apos;ll figure it out
                </button>
              </div>
            </div>

            {/* SCREEN 2: Add Characters Tutorial */}
            <div className={`wn-screen ${whatsNewScreen === 2 ? 'active' : ''}`} key="wn2">
              <div style={{ padding: '32px 32px 16px', textAlign: 'center' as const }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 100,
                  background: 'rgba(179,136,255,0.12)', border: '1px solid rgba(179,136,255,0.2)',
                  color: '#B388FF', fontSize: 11, fontWeight: 700, marginBottom: 20,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B388FF" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  Chat Characters
                </div>
                <div style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 8, color: '#F0EDE8' }}>
                  Add characters to <span style={{ background: 'linear-gradient(135deg, #E8A04C, #E8624C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>any chat</span>
                </div>
                <div style={{ fontSize: 13, color: '#8A8690', lineHeight: 1.5 }}>
                  Click the person icon in the header to create a character with their own name and personality.
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 32px' }}>
                <div style={{ width: '100%', maxWidth: 400, borderRadius: 16, background: '#0C0C0E', border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: 12, color: '#8A8690', flex: 1 }}>Career Advice Session</span>
                    <div style={{
                      width: 26, height: 26, borderRadius: 6,
                      border: '1px solid #E8A04C', color: '#E8A04C', background: 'rgba(232,160,76,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      animation: 'wnPulse 2s infinite',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' as const, padding: '8px 0' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E8A04C" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                    <div style={{ fontSize: 10, color: '#E8A04C', fontWeight: 600, marginTop: 4 }}>Click here to add</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px 32px 28px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingBottom: 4 }}>
                  <div className="wn-dot done"></div>
                  <div className="wn-dot active"></div>
                  <div className="wn-dot"></div>
                  <div className="wn-dot"></div>
                </div>
                <button className="wn-btn-primary" onClick={() => { track(EVENTS.WHATS_NEW_SCREEN_VIEWED, { screen_number: 3 }); setWhatsNewScreen(3); }}>
                  Next
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <button onClick={dismissWhatsNew} style={{ fontSize: 12, color: '#5A5660', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Inter', sans-serif" }}>Skip tutorial</button>
              </div>
            </div>

            {/* SCREEN 3: @mention Tutorial */}
            <div className={`wn-screen ${whatsNewScreen === 3 ? 'active' : ''}`} key="wn3">
              <div style={{ padding: '32px 32px 16px', textAlign: 'center' as const }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 100,
                  background: 'rgba(179,136,255,0.12)', border: '1px solid rgba(179,136,255,0.2)',
                  color: '#B388FF', fontSize: 11, fontWeight: 700, marginBottom: 20,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B388FF" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  Chat Characters
                </div>
                <div style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 8, color: '#F0EDE8' }}>
                  Use <span style={{ background: 'linear-gradient(135deg, #E8A04C, #E8624C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>@mention</span> to talk to them
                </div>
                <div style={{ fontSize: 13, color: '#8A8690', lineHeight: 1.5 }}>
                  Type @ followed by a character&apos;s name to ask them directly. They&apos;ll respond with their own personality.
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 32px' }}>
                <div style={{ width: '100%', maxWidth: 400, borderRadius: 16, background: '#0C0C0E', border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: 12, color: '#8A8690', flex: 1 }}>Career Advice</span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#2D1B4E', color: '#B388FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, border: '2px solid #0C0C0E' }}>Da</div>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1B3A4E', color: '#64D2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, border: '2px solid #0C0C0E', marginLeft: -4 }}>Sa</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <div style={{ padding: '8px 12px', borderRadius: '12px 12px 4px 12px', fontSize: 11, background: '#1A1A1E', color: '#F0EDE8' }}>
                      <span style={{ color: '#E8A04C', fontWeight: 600 }}>@Danny</span> what do you think?
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#2D1B4E', color: '#B388FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>Da</div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: '#B388FF', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        Danny
                        <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(179,136,255,0.15)', color: '#B388FF', fontWeight: 600 }}>CHARACTER</span>
                      </div>
                      <div style={{ padding: '8px 12px', borderRadius: '12px 12px 12px 4px', fontSize: 11, lineHeight: 1.5, border: '1px solid rgba(179,136,255,0.2)', background: 'rgba(179,136,255,0.06)', color: '#8A8690' }}>
                        Stop overthinking and start doing. You&apos;ll figure it out along the way.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#1A1A1E', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', marginTop: 12 }}>
                    <span style={{ fontSize: 11, flex: 1 }}><span style={{ color: '#E8A04C', fontWeight: 600 }}>@Sarah</span> <span style={{ color: '#5A5660' }}>what&apos;s your take?</span></span>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #E8A04C, #E8624C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0C0C0E" strokeWidth="3"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px 32px 28px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingBottom: 4 }}>
                  <div className="wn-dot done"></div>
                  <div className="wn-dot done"></div>
                  <div className="wn-dot active"></div>
                  <div className="wn-dot"></div>
                </div>
                <button className="wn-btn-primary" onClick={() => { track(EVENTS.WHATS_NEW_SCREEN_VIEWED, { screen_number: 4 }); setWhatsNewScreen(4); }}>
                  Next
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <button onClick={dismissWhatsNew} style={{ fontSize: 12, color: '#5A5660', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Inter', sans-serif" }}>Skip tutorial</button>
              </div>
            </div>

            {/* SCREEN 4: Summary */}
            <div className={`wn-screen ${whatsNewScreen === 4 ? 'active' : ''}`} key="wn4">
              <div style={{ padding: '32px 32px 16px', textAlign: 'center' as const }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 100,
                  background: 'rgba(232,160,76,0.12)', border: '1px solid rgba(232,160,76,0.2)',
                  color: '#E8A04C', fontSize: 11, fontWeight: 700, marginBottom: 20,
                }}>
                  <svg width="14" height="14" viewBox="0 0 100 100" fill="none"><path d="M56 4L30 48H50L28 96L74 44H52L72 4Z" fill="#E8A04C"/></svg>
                  You&apos;re all set
                </div>
                <div style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 8, color: '#F0EDE8' }}>
                  Go <span style={{ background: 'linear-gradient(135deg, #E8A04C, #E8624C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>try it out.</span>
                </div>
                <div style={{ fontSize: 14, color: '#8A8690', lineHeight: 1.5 }}>
                  All the new features are live right now. Start a conversation and see for yourself.
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 32px' }}>
                <div style={{ width: '100%', maxWidth: 380 }}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <div className="wn-summary-card">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B388FF" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 6 }}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#F0EDE8', marginBottom: 2 }}>Characters</div>
                      <div style={{ fontSize: 10, color: '#5A5660' }}>Person+ icon in header</div>
                    </div>
                    <div className="wn-summary-card">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64D2FF" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 6 }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#F0EDE8', marginBottom: 2 }}>Files</div>
                      <div style={{ fontSize: 10, color: '#5A5660' }}>Paperclip below input</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div className="wn-summary-card">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#69F0AE" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 6 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#F0EDE8', marginBottom: 2 }}>Images</div>
                      <div style={{ fontSize: 10, color: '#5A5660' }}>Upload or paste</div>
                    </div>
                    <div className="wn-summary-card">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF80AB" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 6 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#F0EDE8', marginBottom: 2 }}>Generate</div>
                      <div style={{ fontSize: 10, color: '#5A5660' }}>Ask AI to create</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px 32px 28px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingBottom: 4 }}>
                  <div className="wn-dot done"></div>
                  <div className="wn-dot done"></div>
                  <div className="wn-dot done"></div>
                  <div className="wn-dot active"></div>
                </div>
                <button className="wn-btn-primary" onClick={() => { track(EVENTS.WHATS_NEW_COMPLETED); dismissWhatsNew(); }}>
                  <svg width="16" height="16" viewBox="0 0 100 100" fill="none"><path d="M56 4L30 48H50L28 96L74 44H52L72 4Z" fill="#0C0C0E"/></svg>
                  Let&apos;s go
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

// Light Mode Styles
const lightStyles: { [key: string]: React.CSSProperties } = {
  loadingContainer: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #F5F4F0 0%, #EDECE8 100%)',
  },
  loadingContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '16px',
  },
  loadingLogo: {
    width: '72px',
    height: '72px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
  },
  loadingBrand: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1A1918',
    letterSpacing: '-0.02em',
  },
  loadingDots: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  loadingDot: {
    background: '#D08A30',
  },
  limitWarning: {
    padding: '12px 16px',
    background: 'rgba(208, 138, 48, 0.1)',
    border: '1px solid rgba(208, 138, 48, 0.3)',
    borderRadius: '8px',
    marginBottom: '12px',
    fontSize: '14px',
    color: '#D08A30',
  },
  upgradeLink: {
    color: '#D08A30',
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: 'underline',
  },
  messageLimitInfo: {
    fontSize: '14px',
    color: '#9A9590',
    marginTop: '16px',
  },
  promptGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginTop: '20px',
    maxWidth: '500px',
    width: '100%',
  },
  promptGridMobile: {
    gridTemplateColumns: '1fr',
  },
  promptChip: {
    padding: '10px 16px',
    borderRadius: '999px',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    background: '#EDECE8',
    color: '#6B6660',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'background 0.15s, border-color 0.15s',
    lineHeight: 1.4,
  },
  promptChipHover: {
    padding: '10px 16px',
    borderRadius: '999px',
    border: '1px solid #D08A30',
    background: 'rgba(208, 138, 48, 0.1)',
    color: '#D08A30',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'background 0.15s, border-color 0.15s',
    lineHeight: 1.4,
  },
  quickChip: {
    padding: '10px 18px',
    borderRadius: '100px',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    background: '#EDECE8',
    color: '#6B6660',
    fontFamily: 'Inter, sans-serif',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  quickChipHover: {
    padding: '10px 18px',
    borderRadius: '100px',
    border: '1px solid #D08A30',
    background: 'rgba(208, 138, 48, 0.1)',
    color: '#D08A30',
    fontFamily: 'Inter, sans-serif',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 16px rgba(208, 138, 48, 0.1)',
  },
  chipIcon: {
    width: '20px',
    height: '20px',
    borderRadius: '6px',
    background: '#E4E3DF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    flexShrink: 0,
  },
  remainingMessages: {
    color: '#9A9590',
    fontSize: '11px',
  },
  authContainer: {
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
    touchAction: 'none' as const,
    overscrollBehavior: 'none' as const,
  },
  authThemeToggle: {
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
  authCard: {
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
  authLogo: {
    textAlign: 'center' as const,
    marginBottom: '20px',
  },
  logoIcon: {
    width: '56px',
    height: '56px',
    margin: '0 auto 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
  },
  authTitle: {
    fontSize: '26px',
    fontWeight: 600,
    marginBottom: '6px',
    color: '#1A1918',
    letterSpacing: '-0.02em',
  },
  authSubtitle: {
    fontSize: '14px',
    color: '#9A9590',
  },
  authError: {
    padding: '12px 16px',
    background: 'rgba(232, 90, 90, 0.1)',
    borderLeft: '4px solid #E85A5A',
    borderRadius: '8px',
    color: '#E85A5A',
    fontSize: '14px',
    marginBottom: '20px',
  },
  authSuccess: {
    padding: '12px 16px',
    background: 'rgba(16, 185, 129, 0.1)',
    borderLeft: '4px solid #10b981',
    borderRadius: '8px',
    color: '#10b981',
    fontSize: '14px',
    marginBottom: '20px',
  },
  tabContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    background: '#E4E3DF',
    padding: '4px',
    borderRadius: '12px',
  },
  tab: {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'transparent',
    color: '#9A9590',
    transition: 'all 0.3s ease',
  },
  tabActive: {
    background: 'rgba(208, 138, 48, 0.1)',
    color: '#D08A30',
    boxShadow: 'none',
  },
  formGroup: {
    marginBottom: '16px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#6B6660',
  },
  forgotLink: {
    fontSize: '12px',
    color: '#6B6660',
    cursor: 'pointer',
    fontWeight: 400,
    transition: 'color 0.3s ease',
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
  authBtn: {
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
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '20px 0',
    color: '#9A9590',
    fontSize: '12px',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'rgba(0, 0, 0, 0.07)',
  },
  dividerText: {
    padding: '0 16px',
    fontSize: '12px',
    color: '#9A9590',
    fontWeight: 400,
  },
  socialButtons: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  authSwitch: {
    textAlign: 'center' as const,
    marginTop: '24px',
    fontSize: '14px',
    color: '#6B6660',
  },
  authLink: {
    color: '#D08A30',
    cursor: 'pointer',
    fontWeight: 600,
  },
  checkEmailContainer: {
    textAlign: 'center' as const,
    padding: '20px 0',
  },
  emailIconWrapper: {
    position: 'relative' as const,
    width: '80px',
    height: '80px',
    margin: '0 auto 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(208, 138, 48, 0.1)',
    border: '2px solid rgba(208, 138, 48, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#D08A30',
    zIndex: 2,
    position: 'relative' as const,
  },
  emailIconRing: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: '2px solid rgba(208, 138, 48, 0.2)',
    zIndex: 1,
  },
  checkEmailTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#1A1918',
    marginBottom: '12px',
  },
  checkEmailText: {
    fontSize: '14px',
    color: '#6B6660',
    marginBottom: '4px',
  },
  checkEmailAddress: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#D08A30',
    marginBottom: '16px',
  },
  checkEmailSubtext: {
    fontSize: '13px',
    color: '#9A9590',
    marginBottom: '24px',
    lineHeight: 1.5,
  },
  app: {
    display: 'flex',
    height: '100dvh',
    width: '100vw',
    maxWidth: '100%',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  mobileOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  mobileMenuBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
    color: '#1A1918',
    marginRight: '12px',
  },
  mobileMenuDots: {
    position: 'absolute' as const,
    right: '4px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '18px',
    padding: '10px 12px',
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
  },
  sidebar: {
    width: '280px',
    background: '#EDECE8',
    borderRight: '1px solid rgba(0, 0, 0, 0.07)',
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'width 0.3s ease, opacity 0.3s ease',
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative' as const,
    height: '100dvh',
  },
  sidebarCollapsed: {
    width: '0px',
    opacity: 0,
    overflow: 'hidden',
    pointerEvents: 'none' as const,
    padding: 0,
    borderRight: 'none',
  },
  sidebarTop: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.07)',
  },
  sidebarToggle: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '6px',
    color: '#6B6660',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s ease',
    flexShrink: 0,
  },
  brandContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'opacity 0.2s ease, width 0.2s ease',
    overflow: 'hidden',
    whiteSpace: 'nowrap' as const,
  },
  brandLogo: {
    width: '24px',
    height: '24px',
    objectFit: 'contain' as const,
  },
  brand: {
    fontWeight: 600,
    fontSize: '15px',
    letterSpacing: '-0.03em',
    color: '#1A1918',
    whiteSpace: 'nowrap' as const,
    display: 'flex',
    alignItems: 'center',
    transition: 'opacity 0.2s ease, width 0.2s ease',
  },
  section: {
    padding: '12px 16px 8px',
    borderBottom: 'none',
  },
  newChatBtn: {
    width: '100%',
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px dashed rgba(0, 0, 0, 0.13)',
    background: 'transparent',
    color: '#6B6660',
    fontFamily: 'Inter, sans-serif',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.25s ease',
  },
  newChatBtnHover: {
    width: '100%',
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px dashed #D08A30',
    background: 'rgba(208, 138, 48, 0.1)',
    color: '#D08A30',
    fontFamily: 'Inter, sans-serif',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.25s ease',
  },
  collapseBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    background: 'transparent',
    color: '#9A9590',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    flexShrink: 0,
    transition: 'all 0.2s ease',
  },
  expandBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    background: 'transparent',
    color: '#6B6660',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    flexShrink: 0,
    marginRight: '12px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '12px',
    cursor: 'pointer',
    marginBottom: '4px',
    transition: 'all 0.2s ease',
  },
  navIcon: {
    fontSize: '18px',
    width: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: '15px',
    color: '#1A1918',
    transition: 'opacity 0.2s ease, width 0.2s ease',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
  },
  sectionLabel: {
    padding: '12px 16px 8px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#9A9590',
    transition: 'opacity 0.2s ease',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
  },
  recentsList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 10px',
  },
  chatItemWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
    marginBottom: '2px',
  },
  recentItem: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    color: '#1A1918',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    position: 'relative' as const,
    transition: 'background 0.15s ease',
  },
  recentItemActive: {
    background: 'rgba(208, 138, 48, 0.08)',
    boxShadow: 'inset 3px 0 0 #D08A30',
    borderRadius: '0 10px 10px 0',
    fontWeight: 500,
    color: '#1A1918',
  },
  chatActions: {
    display: 'flex',
    gap: '4px',
    marginLeft: '4px',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: '4px',
    opacity: 0.7,
  },
  renameWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '4px 8px',
    boxSizing: 'border-box' as const,
  },
  renameInput: {
    flex: 1,
    minWidth: 0,
    padding: '6px 10px',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    borderRadius: '6px',
    fontSize: '16px', // 16px prevents iOS auto-zoom
    outline: 'none',
    fontFamily: 'inherit',
    background: '#F5F4F0',
  },
  renameIconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    background: '#10b981',
    border: 'none',
    color: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  cancelIconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    background: '#ef4444',
    border: 'none',
    color: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  renameBtn: {
    background: '#10b981',
    border: 'none',
    color: 'white',
    padding: '6px 10px',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  cancelBtn: {
    background: '#ef4444',
    border: 'none',
    color: 'white',
    padding: '6px 10px',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  sidebarFooter: {
    padding: '16px',
    borderTop: '1px solid rgba(0, 0, 0, 0.07)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #D08A30, #C05A30)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '14px',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    overflow: 'hidden',
    transition: 'opacity 0.2s ease, width 0.2s ease',
    whiteSpace: 'nowrap' as const,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#F5F4F0',
    overflow: 'hidden',
    maxWidth: '100%',
    position: 'relative' as const,
    backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(208, 138, 48, 0.05), transparent), radial-gradient(circle at 80% 90%, rgba(192, 90, 48, 0.02), transparent)',
  },
  topBar: {
    padding: '12px 16px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.07)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '100%',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  },
  modelBadge: {
    fontSize: '15px',
    fontWeight: 500,
    color: '#6B6660',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '400px',
    flex: 1,
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '10px',
    transition: 'background 0.15s ease',
  },
  chatWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    maxWidth: '100%',
    position: 'relative' as const,
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    maxWidth: '100%',
  },
  scrollToBottomBtn: {
    position: 'absolute' as const,
    bottom: '140px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(237, 236, 232, 0.95)',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6B6660',
    zIndex: 10,
    transition: 'all 0.2s ease',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  greetingLogo: {
    width: '72px',
    height: '72px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingLogoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
  },
  greetingText: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1A1918',
    marginBottom: '24px',
    textAlign: 'center' as const,
    maxWidth: '500px',
    lineHeight: 1.4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMessages: {
    maxWidth: '768px',
    width: '100%',
    margin: '0 auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    boxSizing: 'border-box' as const,
  },
  chatMessagesMobile: {
    padding: '12px 8px',
    maxWidth: '100%',
    boxSizing: 'border-box' as const,
  },
  messageRowUser: {
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-end',
    maxWidth: '100%',
    paddingTop: '1px',
    paddingBottom: '1px',
  },
  messageRowAssistant: {
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-start',
    maxWidth: '100%',
    paddingTop: '1px',
    paddingBottom: '1px',
  },
  messageBubbleUser: {
    padding: '12px 16px',
    borderRadius: '14px 14px 4px 14px',
    fontSize: '15px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
    overflowWrap: 'break-word' as const,
    background: 'rgba(208, 138, 48, 0.12)',
    color: '#1A1918',
    boxSizing: 'border-box' as const,
    boxShadow: 'none',
  },
  messageBubbleAssistant: {
    maxWidth: '90%',
    padding: '12px 16px',
    borderRadius: '14px 14px 14px 4px',
    fontSize: '15px',
    lineHeight: 1.5,
    wordWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
    overflowWrap: 'break-word' as const,
    background: '#EDECE8',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    color: '#1A1918',
    boxSizing: 'border-box' as const,
    boxShadow: 'none',
  },
  messageText: {
    wordBreak: 'normal' as const,
    overflowWrap: 'break-word' as const,
  },
  messageWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: '4px',
    width: 'fit-content' as const,
    maxWidth: '90%',
  },
  messageWrapperUser: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '4px',
    width: 'fit-content' as const,
    maxWidth: '90%',
    marginLeft: 'auto',
  },
  messageActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    opacity: 0.5,
    marginTop: '4px',
    marginLeft: '4px',
  },
  messageActionsUser: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    opacity: 0.5,
    marginTop: '4px',
    marginRight: '4px',
  },
  editModeContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    width: '100%',
    maxWidth: '600px',
  },
  editTextarea: {
    width: '100%',
    minHeight: '100px',
    padding: '14px 16px',
    fontSize: '16px',
    fontFamily: 'inherit',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    borderRadius: '12px',
    resize: 'vertical' as const,
    outline: 'none',
    background: '#EDECE8',
    color: '#1A1918',
    lineHeight: 1.5,
  },
  editWarning: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontSize: '13px',
    color: '#8e8e93',
    lineHeight: 1.4,
  },
  editActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  editCancelBtn: {
    padding: '10px 20px',
    fontSize: '15px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '10px',
    background: '#E4E3DF',
    color: '#1A1918',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  editSaveBtn: {
    padding: '10px 20px',
    fontSize: '15px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #D08A30, #C05A30)',
    color: '#fff',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  messageTimestamp: {
    fontSize: '11px',
    color: '#9A9590',
  },
  actionButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '8px',
    color: '#9A9590',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s ease, transform 0.15s ease',
  },
  typingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '8px 4px',
    minHeight: '28px',
  },
  typingDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#D08A30',
  },
  inputArea: {
    borderTop: '1px solid rgba(0, 0, 0, 0.07)',
    background: '#F5F4F0',
    padding: '0',
    maxWidth: '100%',
  },
  inputWrapper: {
    maxWidth: '768px',
    width: '100%',
    margin: '0 auto',
    padding: '12px 16px',
    boxSizing: 'border-box' as const,
  },
  inputWrapperMobile: {
    padding: '10px 12px',
    maxWidth: '100%',
    boxSizing: 'border-box' as const,
  },
  inputCard: {
    width: '100%',
    background: '#EDECE8',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    borderRadius: '16px',
    padding: '4px 6px',
    boxShadow: 'none',
    boxSizing: 'border-box' as const,
  },
  inputFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 4px 0',
    maxWidth: '100%',
  },
  attachBtn: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: '#9A9590',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  inputHint: {
    fontSize: '11px',
    color: '#9A9590',
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Courier New', monospace",
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
  },
  textarea: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: '16px',
    fontFamily: 'inherit',
    resize: 'none' as const,
    outline: 'none',
    color: '#1A1918',
    padding: '8px 8px',
    maxHeight: '150px',
    minHeight: '36px',
    height: '36px',
    lineHeight: '20px',
    width: '100%',
    overflow: 'hidden' as const,
    verticalAlign: 'middle' as const,
  },
  sendBtn: {
    width: '36px',
    height: '36px',
    minWidth: '36px',
    minHeight: '36px',
    border: 'none',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #D08A30, #C05A30)',
    color: 'white',
    fontSize: '15px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'transform 0.15s ease, opacity 0.15s ease',
  },
  sendBtnDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
    background: '#C4C0B8',
  },
  plusBtn: {
    width: '30px',
    height: '30px',
    minWidth: '30px',
    minHeight: '30px',
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
    color: '#9A9590',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s ease, color 0.15s ease',
  },
  plusMenu: {
    position: 'absolute' as const,
    bottom: '100%',
    left: 0,
    marginBottom: '8px',
    background: '#EDECE8',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
    padding: '8px 0',
    minWidth: '260px',
    zIndex: 1000,
  },
  plusMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    background: 'transparent',
    color: '#1A1918',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'background 0.15s ease',
    position: 'relative' as const,
  },
  plusMenuItemContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  upgradeBadge: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#D08A30',
    background: 'rgba(208, 138, 48, 0.1)',
    padding: '3px 10px',
    borderRadius: '10px',
    marginLeft: 'auto',
  },
  modelSelect: {
    padding: '6px 0 0',
    textAlign: 'center' as const,
    fontSize: '11px',
    color: '#9A9590',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    zIndex: 1100,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  modalContainer: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1101,
    maxWidth: '500px',
    width: '90%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
  },
  modalContent: {
    background: 'rgba(245, 244, 240, 0.95)',
    borderRadius: '20px',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    border: '1px solid rgba(0, 0, 0, 0.07)',
  },
  modalHeader: {
    padding: '20px 24px 16px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.07)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '17px',
    fontWeight: 600,
    color: '#1A1918',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'rgba(0, 0, 0, 0.06)',
    border: 'none',
    borderRadius: '50%',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#6B6660',
    transition: 'all 0.2s ease',
  },
  modalBody: {
    padding: '20px 28px 28px',
  },
  modalSection: {
    padding: '20px 24px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.07)',
  },
  modalSectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#9A9590',
    marginBottom: '14px',
  },
  modalSubsectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#9A9590',
    marginBottom: '14px',
    marginTop: '16px',
  },
  modalInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    fontSize: '13px',
  },
  modalLabel: {
    fontSize: '13px',
    color: '#6B6660',
  },
  modalValue: {
    fontSize: '13px',
    color: '#1A1918',
    fontWeight: 500,
  },
  planCurrentBadge: {
    padding: '16px 20px',
    background: '#f9f9f9',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  planBadgeLarge: {
    display: 'inline-flex',
    padding: '4px 14px',
    borderRadius: '100px',
    fontWeight: 700,
    fontSize: '12px',
    background: 'linear-gradient(135deg, #D08A30, #C05A30)',
    color: '#fff',
  },
  planDescription: {
    color: '#9A9590',
    fontSize: '12px',
  },
  progressBarContainer: {
    width: '100%',
    height: '4px',
    background: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #D08A30, #C05A30)',
    borderRadius: '4px',
    transition: 'width 0.5s ease',
  },
  plansGrid: {
    display: 'flex',
    gap: '10px',
    overflowX: 'auto' as const,
    paddingBottom: '8px',
  },
  planCard: {
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    background: '#F5F4F0',
    transition: 'all 0.2s',
    minWidth: '180px',
    flexShrink: 0,
  },
  planCardActive: {
    border: '2px solid #D08A30',
    background: 'rgba(208, 138, 48, 0.08)',
  },
  planCardTitle: {
    fontSize: '15px',
    fontWeight: 700,
    marginBottom: '6px',
    color: '#1A1918',
  },
  planPrice: {
    fontSize: '22px',
    fontWeight: 700,
    margin: '8px 0 12px',
    color: '#1A1918',
  },
  planPricePeriod: {
    fontSize: '13px',
    fontWeight: 400,
    color: '#6B6660',
  },
  planFeatures: {
    listStyle: 'none',
    marginBottom: '14px',
    padding: 0,
  },
  planFeature: {
    padding: '3px 0',
    fontSize: '11px',
    color: '#6B6660',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '4px',
  },
  checkMark: {
    color: '#D08A30',
    fontSize: '10px',
    fontWeight: 700,
    flexShrink: 0,
    marginRight: '2px',
  },
  planBtn: {
    width: '100%',
    marginTop: '12px',
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.13)',
    background: 'transparent',
    color: '#6B6660',
    fontFamily: 'Inter, sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
  },
  planBtnSpacer: {
    width: '100%',
    height: '36px',
  },
  logoutBtn: {
    width: '100%',
    padding: '13px 24px',
    background: 'rgba(232, 90, 90, 0.1)',
    color: '#E85A5A',
    border: '1px solid rgba(232, 90, 90, 0.3)',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  cancelSubscriptionBtn: {
    width: '100%',
    padding: '10px 16px',
    marginTop: '16px',
    background: 'transparent',
    color: '#9A9590',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  actionsModalContainer: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1101,
    width: '90%',
    maxWidth: '340px',
  },
  actionsModalContent: {
    background: 'rgba(245, 244, 240, 0.95)',
    borderRadius: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    overflow: 'hidden',
  },
  actionsModalHeader: {
    padding: '20px 24px 16px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.07)',
  },
  actionsModalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1A1918',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    textAlign: 'center' as const,
  },
  actionsModalBody: {
    padding: '16px 20px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  actionMenuItem: {
    width: '100%',
    padding: '13px 24px',
    background: '#EDECE8',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    color: '#1A1918',
  },
  actionMenuItemDanger: {
    background: 'rgba(232, 90, 90, 0.1)',
    border: '1px solid rgba(232, 90, 90, 0.3)',
    color: '#E85A5A',
  },
  actionMenuIcon: {
    fontSize: '16px',
  },
  deleteModalContainer: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1101,
    width: '90%',
    maxWidth: '400px',
  },
  deleteModalContent: {
    background: '#F5F4F0',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
  },
  deleteModalHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.07)',
  },
  deleteModalTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1A1918',
    margin: 0,
  },
  deleteModalBody: {
    padding: '20px 24px',
  },
  deleteModalText: {
    fontSize: '15px',
    color: '#6B6660',
    lineHeight: 1.5,
    margin: 0,
  },
  deleteModalFooter: {
    padding: '16px 24px',
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  deleteCancelBtn: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#1A1918',
  },
  deleteConfirmBtn: {
    padding: '10px 20px',
    background: '#E85A5A',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'white',
  },
};

// Dark Mode Styles (PRIMARY theme)
const darkStyles: { [key: string]: React.CSSProperties } = {
  ...lightStyles,
  loadingContainer: {
    ...lightStyles.loadingContainer,
    background: 'linear-gradient(135deg, #0C0C0E 0%, #141416 100%)',
  },
  loadingLogo: {
    ...lightStyles.loadingLogo,
  },
  loadingLogoImg: {
    ...lightStyles.loadingLogoImg,
  },
  loadingBrand: {
    ...lightStyles.loadingBrand,
    color: '#E8E6E1',
  },
  loadingDot: {
    ...lightStyles.loadingDot,
    background: '#E8A04C',
  },
  limitWarning: {
    ...lightStyles.limitWarning,
    background: 'rgba(232, 160, 76, 0.1)',
    border: '1px solid rgba(232, 160, 76, 0.3)',
    color: '#E8A04C',
  },
  upgradeLink: {
    ...lightStyles.upgradeLink,
    color: '#E8A04C',
  },
  messageLimitInfo: {
    ...lightStyles.messageLimitInfo,
    color: '#6B6660',
  },
  remainingMessages: {
    ...lightStyles.remainingMessages,
    color: '#6B6660',
  },
  authContainer: {
    ...lightStyles.authContainer,
    background: '#0C0C0E',
  },
  authThemeToggle: {
    ...lightStyles.authThemeToggle,
    background: '#1E1E20',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#E8E6E1',
  },
  authCard: {
    ...lightStyles.authCard,
    background: 'rgba(20, 20, 22, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
  authTitle: {
    ...lightStyles.authTitle,
    color: '#E8E6E1',
  },
  authSubtitle: {
    ...lightStyles.authSubtitle,
    color: '#6B6660',
  },
  logoIconImg: {
    ...lightStyles.logoIconImg,
  },
  authError: {
    ...lightStyles.authError,
    background: 'rgba(232, 90, 90, 0.1)',
    borderLeft: '4px solid #E85A5A',
    color: '#E85A5A',
  },
  authSuccess: {
    ...lightStyles.authSuccess,
    background: 'rgba(16, 185, 129, 0.15)',
  },
  tabContainer: {
    ...lightStyles.tabContainer,
    background: 'rgba(255, 255, 255, 0.04)',
  },
  tab: {
    ...lightStyles.tab,
    color: '#6B6660',
  },
  tabActive: {
    ...lightStyles.tabActive,
    background: 'rgba(232, 160, 76, 0.1)',
    color: '#E8A04C',
    boxShadow: 'none',
  },
  labelRow: {
    ...lightStyles.labelRow,
  },
  label: {
    ...lightStyles.label,
    color: '#E8E6E1',
  },
  forgotLink: {
    ...lightStyles.forgotLink,
    color: '#6B6660',
  },
  input: {
    ...lightStyles.input,
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#E8E6E1',
  },
  authBtn: {
    ...lightStyles.authBtn,
    background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
    color: '#fff',
    border: 'none',
  },
  divider: {
    ...lightStyles.divider,
    color: '#6B6660',
  },
  dividerLine: {
    ...lightStyles.dividerLine,
    background: 'rgba(255, 255, 255, 0.06)',
  },
  dividerText: {
    ...lightStyles.dividerText,
    color: '#6B6660',
  },
  socialButtons: {
    ...lightStyles.socialButtons,
  },
  authSwitch: {
    ...lightStyles.authSwitch,
    color: '#6B6660',
  },
  authLink: {
    ...lightStyles.authLink,
    color: '#E8A04C',
  },
  emailIcon: {
    ...lightStyles.emailIcon,
    background: 'rgba(232, 160, 76, 0.1)',
    border: '2px solid rgba(232, 160, 76, 0.3)',
    color: '#E8A04C',
  },
  emailIconRing: {
    ...lightStyles.emailIconRing,
    border: '2px solid rgba(232, 160, 76, 0.15)',
  },
  checkEmailTitle: {
    ...lightStyles.checkEmailTitle,
    color: '#E8E6E1',
  },
  checkEmailText: {
    ...lightStyles.checkEmailText,
    color: '#6B6660',
  },
  checkEmailAddress: {
    ...lightStyles.checkEmailAddress,
    color: '#E8A04C',
  },
  checkEmailSubtext: {
    ...lightStyles.checkEmailSubtext,
    color: '#6B6660',
  },
  mobileOverlay: {
    ...lightStyles.mobileOverlay,
    background: 'rgba(0, 0, 0, 0.6)',
  },
  mobileMenuBtn: {
    ...lightStyles.mobileMenuBtn,
    color: '#E8E6E1',
  },
  mobileMenuDots: {
    ...lightStyles.mobileMenuDots,
    color: '#6B6660',
  },
  sidebar: {
    ...lightStyles.sidebar,
    background: '#141416',
    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
  },
  sidebarCollapsed: {
    ...lightStyles.sidebarCollapsed,
  },
  expandBtn: {
    ...lightStyles.expandBtn,
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#8A8690',
  },
  sidebarHeader: {
    ...lightStyles.sidebarHeader,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  sidebarToggle: {
    ...lightStyles.sidebarToggle,
    color: '#E8E6E1',
  },
  brand: {
    ...lightStyles.brand,
    color: '#E8E6E1',
  },
  brandLogo: {
    ...lightStyles.brandLogo,
  },
  section: {
    ...lightStyles.section,
    borderBottom: 'none',
  },
  newChatBtn: {
    ...lightStyles.newChatBtn,
    border: '1px dashed rgba(255, 255, 255, 0.12)',
    color: '#8A8690',
  },
  newChatBtnHover: {
    ...lightStyles.newChatBtnHover,
    border: '1px dashed #E8A04C',
    background: 'rgba(232, 160, 76, 0.12)',
    color: '#E8A04C',
  },
  collapseBtn: {
    ...lightStyles.collapseBtn,
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#5A5660',
  },
  navText: {
    ...lightStyles.navText,
    color: '#E8E6E1',
  },
  sectionLabel: {
    ...lightStyles.sectionLabel,
    color: '#6B6660',
  },
  greetingLogoImg: {
    ...lightStyles.greetingLogoImg,
  },
  greetingText: {
    ...lightStyles.greetingText,
    color: '#F0EDE8',
  },
  promptChip: {
    ...lightStyles.promptChip,
    background: '#1E1E20',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#9A9590',
  },
  promptChipHover: {
    ...lightStyles.promptChipHover,
    background: 'rgba(232, 160, 76, 0.1)',
    border: '1px solid #E8A04C',
    color: '#E8A04C',
  },
  quickChip: {
    ...lightStyles.quickChip,
    border: '1px solid rgba(255, 255, 255, 0.06)',
    background: '#141416',
    color: '#8A8690',
  },
  quickChipHover: {
    ...lightStyles.quickChipHover,
    border: '1px solid #E8A04C',
    background: 'rgba(232, 160, 76, 0.12)',
    color: '#E8A04C',
    boxShadow: '0 4px 16px rgba(232, 160, 76, 0.1)',
  },
  chipIcon: {
    ...lightStyles.chipIcon,
    background: '#1A1A1E',
  },
  recentItem: {
    ...lightStyles.recentItem,
    color: '#E8E6E1',
  },
  recentItemActive: {
    ...lightStyles.recentItemActive,
    background: 'rgba(232, 160, 76, 0.08)',
    boxShadow: 'inset 3px 0 0 #E8A04C',
    color: '#F0EDE8',
  },
  renameInput: {
    ...lightStyles.renameInput,
    background: '#1E1E20',
    color: '#E8E6E1',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  sidebarFooter: {
    ...lightStyles.sidebarFooter,
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  },
  avatar: {
    ...lightStyles.avatar,
    background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
  },
  main: {
    ...lightStyles.main,
    background: '#0C0C0E',
    backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(232, 160, 76, 0.06), transparent), radial-gradient(circle at 80% 90%, rgba(232, 98, 76, 0.03), transparent)',
  },
  topBar: {
    ...lightStyles.topBar,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  modelBadge: {
    ...lightStyles.modelBadge,
    color: '#8A8690',
  },
  scrollToBottomBtn: {
    ...lightStyles.scrollToBottomBtn,
    background: 'rgba(30, 30, 32, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#E8E6E1',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  messageBubbleUser: {
    ...lightStyles.messageBubbleUser,
    background: 'rgba(232, 160, 76, 0.15)',
    color: '#E8E6E1',
  },
  messageBubbleAssistant: {
    ...lightStyles.messageBubbleAssistant,
    background: '#141416',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#E8E6E1',
  },
  messageTimestamp: {
    ...lightStyles.messageTimestamp,
    color: '#6B6660',
  },
  actionButton: {
    ...lightStyles.actionButton,
    color: '#6B6660',
  },
  typingDot: {
    ...lightStyles.typingDot,
    background: '#E8A04C',
  },
  editTextarea: {
    ...lightStyles.editTextarea,
    background: '#1E1E20',
    color: '#E8E6E1',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  editWarning: {
    ...lightStyles.editWarning,
    color: '#6B6660',
  },
  editCancelBtn: {
    ...lightStyles.editCancelBtn,
    background: '#1E1E20',
    border: 'none',
    color: '#E8E6E1',
  },
  editSaveBtn: {
    ...lightStyles.editSaveBtn,
    background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
    color: '#fff',
  },
  inputArea: {
    ...lightStyles.inputArea,
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    background: '#0C0C0E',
  },
  inputCard: {
    ...lightStyles.inputCard,
    background: '#141416',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: 'none',
  },
  inputFooter: {
    ...lightStyles.inputFooter,
  },
  attachBtn: {
    ...lightStyles.attachBtn,
    color: '#5A5660',
  },
  inputHint: {
    ...lightStyles.inputHint,
    color: '#5A5660',
  },
  textarea: {
    ...lightStyles.textarea,
    color: '#E8E6E1',
  },
  sendBtn: {
    ...lightStyles.sendBtn,
    background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
  },
  sendBtnDisabled: {
    ...lightStyles.sendBtnDisabled,
    opacity: 0.3,
    background: '#2A2A2C',
  },
  plusBtn: {
    ...lightStyles.plusBtn,
    color: '#6B6660',
  },
  plusMenu: {
    ...lightStyles.plusMenu,
    background: '#141416',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  plusMenuItem: {
    ...lightStyles.plusMenuItem,
    color: '#E8E6E1',
  },
  plusMenuItemContent: {
    ...lightStyles.plusMenuItemContent,
  },
  upgradeBadge: {
    ...lightStyles.upgradeBadge,
    color: '#E8A04C',
    background: 'rgba(232, 160, 76, 0.1)',
  },
  modelSelect: {
    ...lightStyles.modelSelect,
    color: '#6B6660',
  },
  modalOverlay: {
    ...lightStyles.modalOverlay,
    background: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    ...lightStyles.modalContent,
    background: 'rgba(20, 20, 22, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
  },
  modalHeader: {
    ...lightStyles.modalHeader,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  modalTitle: {
    ...lightStyles.modalTitle,
    color: '#E8E6E1',
  },
  modalCloseBtn: {
    ...lightStyles.modalCloseBtn,
    background: 'rgba(255, 255, 255, 0.06)',
    color: '#6B6660',
  },
  modalSection: {
    ...lightStyles.modalSection,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  modalSectionTitle: {
    ...lightStyles.modalSectionTitle,
    color: '#5A5660',
  },
  modalSubsectionTitle: {
    ...lightStyles.modalSubsectionTitle,
    color: '#5A5660',
  },
  modalInfoRow: {
    ...lightStyles.modalInfoRow,
  },
  modalLabel: {
    ...lightStyles.modalLabel,
    color: '#8A8690',
  },
  modalValue: {
    ...lightStyles.modalValue,
    color: '#F0EDE8',
  },
  planCurrentBadge: {
    ...lightStyles.planCurrentBadge,
    background: '#1A1A1E',
  },
  planBadgeLarge: {
    ...lightStyles.planBadgeLarge,
    background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
    color: '#0C0C0E',
  },
  planDescription: {
    ...lightStyles.planDescription,
    color: '#5A5660',
  },
  progressBarContainer: {
    ...lightStyles.progressBarContainer,
    background: '#1A1A1E',
  },
  progressBar: {
    ...lightStyles.progressBar,
    background: 'linear-gradient(90deg, #E8A04C, #E8624C)',
  },
  planCard: {
    ...lightStyles.planCard,
    border: '1px solid rgba(255, 255, 255, 0.06)',
    background: '#0C0C0E',
  },
  planCardActive: {
    ...lightStyles.planCardActive,
    border: '2px solid #E8A04C',
    background: 'rgba(232, 160, 76, 0.08)',
  },
  planCardTitle: {
    ...lightStyles.planCardTitle,
    color: '#E8E6E1',
  },
  planPrice: {
    ...lightStyles.planPrice,
    color: '#E8E6E1',
  },
  planPricePeriod: {
    ...lightStyles.planPricePeriod,
    color: '#6B6660',
  },
  planFeature: {
    ...lightStyles.planFeature,
    color: '#8A8690',
  },
  checkMark: {
    ...lightStyles.checkMark,
    color: '#E8A04C',
  },
  planBtn: {
    ...lightStyles.planBtn,
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'transparent',
    color: '#8A8690',
  },
  logoutBtn: {
    ...lightStyles.logoutBtn,
    background: 'rgba(232, 90, 90, 0.1)',
    border: '1px solid rgba(232, 90, 90, 0.3)',
    color: '#E85A5A',
  },
  cancelSubscriptionBtn: {
    ...lightStyles.cancelSubscriptionBtn,
    color: '#6B6660',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  actionsModalContent: {
    ...lightStyles.actionsModalContent,
    background: 'rgba(20, 20, 22, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  actionsModalHeader: {
    ...lightStyles.actionsModalHeader,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  actionsModalTitle: {
    ...lightStyles.actionsModalTitle,
    color: '#E8E6E1',
  },
  actionMenuItem: {
    ...lightStyles.actionMenuItem,
    background: '#1E1E20',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#E8E6E1',
  },
  actionMenuItemDanger: {
    ...lightStyles.actionMenuItemDanger,
    background: 'rgba(232, 90, 90, 0.1)',
    border: '1px solid rgba(232, 90, 90, 0.3)',
    color: '#E85A5A',
  },
  deleteModalContent: {
    ...lightStyles.deleteModalContent,
    background: '#141416',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  deleteModalHeader: {
    ...lightStyles.deleteModalHeader,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  deleteModalTitle: {
    ...lightStyles.deleteModalTitle,
    color: '#E8E6E1',
  },
  deleteModalText: {
    ...lightStyles.deleteModalText,
    color: '#6B6660',
  },
  deleteCancelBtn: {
    ...lightStyles.deleteCancelBtn,
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#E8E6E1',
  },
  deleteConfirmBtn: {
    ...lightStyles.deleteConfirmBtn,
    background: '#E85A5A',
  },
};

// Wrap in Suspense for useSearchParams
export default function Home() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100dvh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f9f9f9'
      }}>
        <div style={{fontSize: '18px', color: '#666'}}>Loading...</div>
      </div>
    }>
      <HomePage />
    </Suspense>
  );
}