"use client";

import { Session } from "next-auth";

type MemoryCategory = 'personal' | 'preference' | 'interest' | 'context';
export type Memory = {
  id: string;
  content: string;
  category: MemoryCategory;
  source_chat_id: string | null;
  created_at: string;
  updated_at: string;
};

interface AccountSettingsModalProps {
  theme: string;
  session: Session | null;
  messagesUsed: number;
  showMemorySection: boolean;
  setShowMemorySection: (v: boolean) => void;
  isEditingName: boolean;
  setIsEditingName: (v: boolean) => void;
  editNameValue: string;
  setEditNameValue: (v: string) => void;
  isSavingName: boolean;
  updateName: () => void;
  memoryPlan: string | null;
  memories: Memory[];
  isMemoriesLoading: boolean;
  isCancellingSubscription: boolean;
  getProgressPercentage: () => number;
  upgradePlan: (plan: "Free" | "Pro" | "Plus") => void;
  cancelSubscription: () => void;
  handleLogout: () => void;
  showConfirm: (title: string, message: string, confirmText: string, onConfirm: () => void, isDestructive?: boolean) => void;
  deleteMemoryItem: (id: string) => void;
  clearAllMemories: () => void;
  onClose: () => void;
}

function makeStyles(theme: string) {
  const isDark = theme === 'dark';
  return {
    modalOverlay: {
      position: 'fixed' as const,
      top: 0, left: 0, right: 0, bottom: 0,
      background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
      zIndex: 1100,
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
    },
    modalContainer: {
      position: 'fixed' as const,
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 1101,
      maxWidth: '500px', width: '90%',
      maxHeight: '85vh', overflowY: 'auto' as const,
    },
    modalContent: {
      background: isDark ? 'rgba(20,20,22,0.95)' : 'rgba(245,244,240,0.95)',
      borderRadius: '20px',
      boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.1)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
    },
    modalHeader: {
      padding: '20px 24px 16px',
      borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    },
    modalTitle: {
      fontSize: '17px', fontWeight: 600,
      color: isDark ? '#E8E6E1' : '#1A1918', margin: 0,
    },
    modalCloseBtn: {
      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      border: 'none', borderRadius: '50%',
      width: '30px', height: '30px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', color: '#6B6660', transition: 'all 0.2s ease',
    },
    modalBody: { padding: '20px 28px 28px' },
    modalSection: {
      padding: '20px 24px',
      borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
    },
    modalSectionTitle: {
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      color: isDark ? '#7A7680' : '#9A9590', marginBottom: '14px',
    },
    modalSubsectionTitle: {
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      color: isDark ? '#7A7680' : '#9A9590',
      marginBottom: '14px', marginTop: '16px',
    },
    modalInfoRow: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', fontSize: '13px',
    },
    modalLabel: { fontSize: '13px', color: isDark ? '#8A8690' : '#6B6660' },
    modalValue: {
      fontSize: '13px', fontWeight: 500,
      color: isDark ? '#F0EDE8' : '#1A1918',
    },
    planCurrentBadge: {
      padding: '16px 20px',
      background: isDark ? '#1A1A1E' : '#f9f9f9',
      borderRadius: '12px', marginBottom: '16px',
    },
    planBadgeLarge: {
      display: 'inline-flex', padding: '4px 14px', borderRadius: '100px',
      fontWeight: 700, fontSize: '12px',
      background: isDark ? 'linear-gradient(135deg,#E8A04C,#E8624C)' : 'linear-gradient(135deg,#D08A30,#C05A30)',
      color: isDark ? '#0C0C0E' : '#fff',
    },
    planDescription: { color: isDark ? '#7A7680' : '#9A9590', fontSize: '12px' },
    progressBarContainer: {
      width: '100%', height: '4px',
      background: isDark ? '#1A1A1E' : '#e0e0e0',
      borderRadius: '4px', overflow: 'hidden', marginTop: '8px',
    },
    progressBar: {
      height: '100%',
      background: isDark ? 'linear-gradient(90deg,#E8A04C,#E8624C)' : 'linear-gradient(90deg,#D08A30,#C05A30)',
      borderRadius: '4px', transition: 'width 0.5s ease',
    },
    plansGrid: {
      display: 'flex', gap: '10px',
      overflowX: 'auto' as const, paddingBottom: '8px',
    },
    planCard: {
      padding: '16px', borderRadius: '12px',
      border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
      background: isDark ? '#0C0C0E' : '#F5F4F0',
      transition: 'all 0.2s', minWidth: '180px', flexShrink: 0,
    },
    planCardActive: {
      border: isDark ? '2px solid #E8A04C' : '2px solid #D08A30',
      background: isDark ? 'rgba(232,160,76,0.08)' : 'rgba(208,138,48,0.08)',
    },
    planCardTitle: {
      fontSize: '15px', fontWeight: 700, marginBottom: '6px',
      color: isDark ? '#E8E6E1' : '#1A1918',
    },
    planPrice: {
      fontSize: '22px', fontWeight: 700, margin: '8px 0 12px',
      color: isDark ? '#E8E6E1' : '#1A1918',
    },
    planPricePeriod: {
      fontSize: '13px', fontWeight: 400,
      color: isDark ? '#6B6660' : '#6B6660',
    },
    planFeatures: { listStyle: 'none', marginBottom: '14px', padding: 0 },
    planFeature: {
      padding: '3px 0', fontSize: '11px',
      color: isDark ? '#8A8690' : '#6B6660',
      display: 'flex', alignItems: 'flex-start', gap: '4px',
    },
    checkMark: {
      color: isDark ? '#E8A04C' : '#D08A30',
      fontSize: '10px', fontWeight: 700, flexShrink: 0, marginRight: '2px',
    },
    planBtn: {
      width: '100%', marginTop: '12px', padding: '8px', borderRadius: '8px',
      border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.13)',
      background: 'transparent',
      color: isDark ? '#8A8690' : '#6B6660',
      fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 600,
      cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
    },
  };
}

export default function AccountSettingsModal({
  theme, session, messagesUsed,
  showMemorySection, setShowMemorySection,
  isEditingName, setIsEditingName, editNameValue, setEditNameValue,
  isSavingName, updateName,
  memoryPlan, memories, isMemoriesLoading,
  isCancellingSubscription, getProgressPercentage,
  upgradePlan, cancelSubscription, handleLogout,
  showConfirm, deleteMemoryItem, clearAllMemories,
  onClose,
}: AccountSettingsModalProps) {
  const s = makeStyles(theme);
  const isDark = theme === 'dark';

  return (
    <>
      <div style={s.modalOverlay} onClick={() => { onClose(); setShowMemorySection(false); }} />
      <div style={s.modalContainer}>
        <div style={s.modalContent}>
          <div style={s.modalHeader}>
            <h2 style={s.modalTitle}>Account Settings</h2>
            <button style={s.modalCloseBtn} onClick={() => { onClose(); setShowMemorySection(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div style={s.modalBody}>
            {/* Profile Information */}
            <div style={s.modalSection}>
              <h3 style={s.modalSectionTitle}>Profile Information</h3>
              <div style={{ ...s.modalInfoRow, alignItems: 'center', gap: '12px' }}>
                <span style={{ ...s.modalLabel, flexShrink: 0, minWidth: '50px' }}>Name:</span>
                {isEditingName ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
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
                        flex: 1, minWidth: 0, maxWidth: '200px',
                        padding: '5px 10px', borderRadius: '6px',
                        border: '1px solid #d0d0d0', fontSize: '16px',
                        background: isDark ? '#2a2a2a' : '#fff',
                        color: isDark ? '#fff' : '#333', outline: 'none',
                      }}
                    />
                    <button
                      onClick={updateName}
                      disabled={isSavingName}
                      title="Save"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px', borderRadius: '6px', border: 'none',
                        background: '#10b981', color: '#fff',
                        cursor: isSavingName ? 'not-allowed' : 'pointer',
                        opacity: isSavingName ? 0.6 : 1, flexShrink: 0,
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
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px', borderRadius: '6px',
                        border: '1px solid #d0d0d0',
                        background: isDark ? '#3a3a3a' : '#fff',
                        color: isDark ? '#fff' : '#666',
                        cursor: 'pointer', flexShrink: 0,
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
                    <span style={s.modalValue}>{session?.user?.name}</span>
                    <button
                      onClick={() => { setEditNameValue(session?.user?.name || ''); setIsEditingName(true); }}
                      title="Edit name"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '26px', height: '26px', borderRadius: '6px',
                        border: '1px solid #d0d0d0',
                        background: isDark ? '#3a3a3a' : '#f5f5f5',
                        color: isDark ? '#ccc' : '#555',
                        cursor: 'pointer', flexShrink: 0,
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
              <div style={s.modalInfoRow}>
                <span style={s.modalLabel}>Email:</span>
                <span style={s.modalValue}>{session?.user?.email}</span>
              </div>
            </div>

            {/* Timezone */}
            <div style={s.modalSection}>
              <h3 style={s.modalSectionTitle}>Timezone</h3>
              <p style={{ fontSize: '13px', color: isDark ? '#888' : '#666', marginBottom: '12px' }}>
                Your daily message limit resets at midnight in your timezone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: isDark ? '#ccc' : '#333' }}>
                  {session?.user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                </span>
                <span style={{ fontSize: '12px', color: isDark ? '#666' : '#999' }}>(auto-detected)</span>
              </div>
            </div>

            {/* Current Plan */}
            <div style={s.modalSection}>
              <h3 style={s.modalSectionTitle}>Current Plan</h3>
              <div style={s.planCurrentBadge}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={s.planBadgeLarge}>{session?.user?.plan}</div>
                  <div style={s.planDescription}>
                    {session?.user?.plan === "Free" && `${messagesUsed}/5 messages used today`}
                    {session?.user?.plan === "Pro" && `${messagesUsed}/100 messages used today`}
                    {session?.user?.plan === "Plus" && `${messagesUsed}/300 messages used today`}
                  </div>
                </div>

                {session?.user?.subscriptionStatus === 'canceling' && session?.user?.currentPeriodEnd && (
                  <div style={{
                    marginBottom: '12px', padding: '10px 14px',
                    background: isDark ? 'rgba(251,191,36,0.15)' : '#fffbeb',
                    border: `1px solid ${isDark ? 'rgba(251,191,36,0.3)' : '#fcd34d'}`,
                    borderRadius: '8px', fontSize: '13px',
                    color: isDark ? '#fcd34d' : '#92400e',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span>Cancelling at end of billing period ({new Date(session.user.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</span>
                    </div>
                  </div>
                )}

                {session?.user?.subscriptionStatus === 'downgrading' && session?.user?.currentPeriodEnd && (
                  <div style={{
                    marginBottom: '12px', padding: '10px 14px',
                    background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff',
                    border: `1px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#93c5fd'}`,
                    borderRadius: '8px', fontSize: '13px',
                    color: isDark ? '#93c5fd' : '#1e40af',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/>
                      </svg>
                      <span>Downgrading to Pro on {new Date(session.user.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                )}

                {session?.user && (
                  <div style={s.progressBarContainer}>
                    <div style={{ ...s.progressBar, width: `${getProgressPercentage()}%` }} />
                  </div>
                )}
              </div>

              <h4 style={s.modalSubsectionTitle}>Upgrade Your Plan</h4>
              <div style={{ position: 'relative' as const }}>
                <div
                  id="planScrollHint"
                  style={{
                    position: 'absolute' as const, right: 0, top: '50%', transform: 'translateY(-50%)',
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: isDark ? '#141416' : '#EDECE8',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isDark ? '#E8A04C' : '#D08A30',
                    zIndex: 2, animation: 'nudgeRight 1.5s ease-in-out infinite',
                    pointerEvents: 'none' as const,
                    boxShadow: isDark ? '-8px 0 16px #141416' : '-8px 0 16px #EDECE8',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </div>
                <div
                  style={s.plansGrid}
                  onScroll={(e) => {
                    const hint = document.getElementById('planScrollHint');
                    if (hint) {
                      const target = e.target as HTMLElement;
                      hint.style.opacity = target.scrollLeft > 20 ? '0' : '1';
                      hint.style.transition = 'opacity 0.3s ease';
                    }
                  }}
                >
                  {/* Free Plan */}
                  <div style={{ ...s.planCard, ...(session?.user?.plan === "Free" ? s.planCardActive : {}) }}>
                    <h5 style={s.planCardTitle}>Free</h5>
                    <div style={s.planPrice}>$0<span style={s.planPricePeriod}>/mo</span></div>
                    <ul style={s.planFeatures}>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> 5 messages per day</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> Basic support</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> Chat on web</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> Limited uploads</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> Limited memory and context</li>
                    </ul>
                    {session?.user?.plan !== "Free" && (
                      <button style={s.planBtn} onClick={() => upgradePlan("Free")}>Downgrade to Free</button>
                    )}
                    {session?.user?.plan === "Free" && (
                      <button style={{ ...s.planBtn, background: isDark ? '#E8A04C' : '#D08A30', color: isDark ? '#0C0C0E' : '#fff', borderColor: isDark ? '#E8A04C' : '#D08A30' }} disabled>Current Plan</button>
                    )}
                  </div>

                  {/* Pro Plan */}
                  <div style={{ ...s.planCard, ...(session?.user?.plan === "Pro" || session?.user?.subscriptionStatus === 'downgrading' ? s.planCardActive : {}) }}>
                    <h5 style={s.planCardTitle}>Pro</h5>
                    <div style={s.planPrice}>$4.99<span style={s.planPricePeriod}>/mo</span></div>
                    <ul style={s.planFeatures}>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> 100 messages per day</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> 20x more than Free</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> Expanded memory and context</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> Early access to new features</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> Advanced reasoning models</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> Memory across conversations</li>
                    </ul>
                    {session?.user?.subscriptionStatus === 'downgrading' && session?.user?.currentPeriodEnd && (
                      <div style={{
                        padding: '8px 12px',
                        background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff',
                        border: `1px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#93c5fd'}`,
                        borderRadius: '6px', fontSize: '12px',
                        color: isDark ? '#93c5fd' : '#1e40af',
                        marginBottom: '8px', textAlign: 'center',
                      }}>
                        Switching to this plan on {new Date(session.user.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    )}
                    {session?.user?.plan !== "Pro" && session?.user?.subscriptionStatus !== 'downgrading' && (
                      <button style={s.planBtn} onClick={() => upgradePlan("Pro")}>
                        {session?.user?.plan === "Free" ? "Upgrade to Pro" : "Switch to Pro"}
                      </button>
                    )}
                    {(session?.user?.plan === "Pro" || session?.user?.subscriptionStatus === 'downgrading') && (
                      <button style={{ ...s.planBtn, background: isDark ? '#E8A04C' : '#D08A30', color: isDark ? '#0C0C0E' : '#fff', borderColor: isDark ? '#E8A04C' : '#D08A30' }} disabled>Current Plan</button>
                    )}
                  </div>

                  {/* Plus Plan */}
                  <div style={{ ...s.planCard, ...(session?.user?.plan === "Plus" ? s.planCardActive : {}) }}>
                    <h5 style={s.planCardTitle}>Plus</h5>
                    <div style={s.planPrice}>$9.99<span style={s.planPricePeriod}>/mo</span></div>
                    <ul style={s.planFeatures}>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> Everything in Pro</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> 300 messages per day</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> 60x more than Free, 3x more than Pro</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> Higher outputs for more tasks</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> Priority access at high traffic</li>
                      <li style={s.planFeature}><span style={s.checkMark}>&#10003;</span> Early access to advanced features</li>
                    </ul>
                    {session?.user?.plan !== "Plus" && (
                      <button style={s.planBtn} onClick={() => upgradePlan("Plus")}>Upgrade to Plus</button>
                    )}
                    {session?.user?.plan === "Plus" && (
                      <button style={{ ...s.planBtn, background: isDark ? '#E8A04C' : '#D08A30', color: isDark ? '#0C0C0E' : '#fff', borderColor: isDark ? '#E8A04C' : '#D08A30' }} disabled>Current Plan</button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Memory — Collapsible */}
            <div style={s.modalSection}>
              <button
                onClick={() => setShowMemorySection(!showMemorySection)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ ...s.modalSectionTitle, marginBottom: 0 }}>AI Memory</h3>
                  {memories.length > 0 && !showMemorySection && (
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '10px',
                      background: isDark ? 'rgba(232,160,76,0.15)' : 'rgba(208,138,48,0.1)',
                      color: isDark ? '#E8A04C' : '#D08A30',
                    }}>{memories.length}</span>
                  )}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={isDark ? '#888' : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: 'transform 0.2s ease', transform: showMemorySection ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showMemorySection && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '13px', color: isDark ? '#888' : '#666', marginBottom: '12px' }}>
                    The AI remembers things about you across conversations to give more personal responses.
                  </p>
                  {memoryPlan === 'Free' || (!memoryPlan && session?.user?.plan === 'Free') ? (
                    <div style={{
                      padding: '16px',
                      background: isDark ? 'rgba(232,160,76,0.08)' : 'rgba(208,138,48,0.06)',
                      border: `1px solid ${isDark ? 'rgba(232,160,76,0.2)' : 'rgba(208,138,48,0.2)'}`,
                      borderRadius: '10px', textAlign: 'center',
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#E8A04C' : '#D08A30'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                        <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2z"/>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      <p style={{ fontSize: '14px', fontWeight: 500, color: isDark ? '#E8A04C' : '#D08A30', marginBottom: '4px' }}>Upgrade to Pro to enable AI Memory</p>
                      <p style={{ fontSize: '12px', color: isDark ? '#888' : '#999' }}>The AI will remember your name, preferences, and interests across conversations.</p>
                    </div>
                  ) : isMemoriesLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: isDark ? '#888' : '#999' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                      </svg>
                    </div>
                  ) : memories.length === 0 ? (
                    <div style={{ padding: '16px', background: isDark ? '#1a1a1c' : '#f9f9f8', borderRadius: '10px', textAlign: 'center', color: isDark ? '#888' : '#999', fontSize: '13px' }}>
                      No memories yet. As you chat, the AI will automatically learn about you.
                    </div>
                  ) : (
                    <div>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                        {memories.map((memory) => (
                          <div key={memory.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: isDark ? '#1a1a1c' : '#f9f9f8', borderRadius: '8px', fontSize: '13px' }}>
                            <span style={{
                              fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
                              padding: '2px 6px', borderRadius: '4px',
                              background: memory.category === 'personal' ? (isDark ? 'rgba(100,210,255,0.15)' : 'rgba(59,130,246,0.1)')
                                : memory.category === 'preference' ? (isDark ? 'rgba(179,136,255,0.15)' : 'rgba(139,92,246,0.1)')
                                : memory.category === 'interest' ? (isDark ? 'rgba(105,240,174,0.15)' : 'rgba(34,197,94,0.1)')
                                : (isDark ? 'rgba(232,160,76,0.15)' : 'rgba(234,179,8,0.1)'),
                              color: memory.category === 'personal' ? (isDark ? '#64D2FF' : '#3b82f6')
                                : memory.category === 'preference' ? (isDark ? '#B388FF' : '#8b5cf6')
                                : memory.category === 'interest' ? (isDark ? '#69F0AE' : '#22c55e')
                                : (isDark ? '#E8A04C' : '#eab308'),
                              flexShrink: 0, letterSpacing: '0.5px',
                            }}>{memory.category}</span>
                            <span style={{ flex: 1, color: isDark ? '#ccc' : '#333', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {memory.content}
                            </span>
                            <button
                              onClick={() => showConfirm('Delete Memory', `Remove this memory: "${memory.content}"?`, 'Delete', () => deleteMemoryItem(memory.id), true)}
                              title="Delete memory"
                              style={{ background: 'none', border: 'none', color: isDark ? '#555' : '#ccc', cursor: 'pointer', padding: '2px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => showConfirm('Clear All Memories', 'Are you sure? This will permanently delete all your saved memories. This cannot be undone.', 'Clear All', clearAllMemories, true)}
                        style={{ background: 'none', border: `1px solid ${isDark ? '#333' : '#ddd'}`, color: isDark ? '#888' : '#999', fontSize: '12px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', width: '100%' }}
                      >
                        Clear all memories ({memories.length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Support */}
            <div style={s.modalSection}>
              <h3 style={s.modalSectionTitle}>Need Help?</h3>
              <p style={{ fontSize: '14px', color: isDark ? '#aaa' : '#666', marginBottom: '12px' }}>
                We&apos;re here to help with any questions or issues.
              </p>
              <a
                href="mailto:sounfilteredai@gmail.com"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: isDark ? '#3a3a3a' : '#f5f5f5', borderRadius: '8px', color: isDark ? '#fff' : '#333', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                sounfilteredai@gmail.com
              </a>
            </div>

            {/* Account Actions */}
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: `1px solid ${isDark ? '#333' : '#eee'}` }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleLogout}
                  style={{ background: 'none', border: 'none', color: isDark ? '#666' : '#999', fontSize: '12px', cursor: 'pointer', padding: '4px 8px' }}
                >
                  Log out
                </button>
                {session?.user?.plan !== "Free" && session?.user?.subscriptionStatus !== 'canceling' && (
                  <button
                    onClick={cancelSubscription}
                    disabled={isCancellingSubscription}
                    style={{ background: 'none', border: 'none', color: isDark ? '#666' : '#999', fontSize: '12px', cursor: isCancellingSubscription ? 'not-allowed' : 'pointer', padding: '4px 8px', opacity: isCancellingSubscription ? 0.5 : 1 }}
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
  );
}
