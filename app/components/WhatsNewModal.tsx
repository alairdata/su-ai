"use client";

import { track, EVENTS } from "@/lib/analytics";

interface WhatsNewModalProps {
  whatsNewScreen: number;
  setWhatsNewScreen: (n: number) => void;
  dismissWhatsNew: () => void;
}

export default function WhatsNewModal({ whatsNewScreen, setWhatsNewScreen, dismissWhatsNew }: WhatsNewModalProps) {
  return (
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
            <button onClick={dismissWhatsNew} style={{ fontSize: 12, color: '#7A7680', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Inter', sans-serif" }}>
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
            <button onClick={dismissWhatsNew} style={{ fontSize: 12, color: '#7A7680', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Inter', sans-serif" }}>Skip tutorial</button>
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
                <span style={{ fontSize: 11, flex: 1 }}><span style={{ color: '#E8A04C', fontWeight: 600 }}>@Sarah</span> <span style={{ color: '#7A7680' }}>what&apos;s your take?</span></span>
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
            <button onClick={dismissWhatsNew} style={{ fontSize: 12, color: '#7A7680', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Inter', sans-serif" }}>Skip tutorial</button>
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
                  <div style={{ fontSize: 10, color: '#7A7680' }}>Person+ icon in header</div>
                </div>
                <div className="wn-summary-card">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64D2FF" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 6 }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#F0EDE8', marginBottom: 2 }}>Files</div>
                  <div style={{ fontSize: 10, color: '#7A7680' }}>Paperclip in input bar</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="wn-summary-card">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#69F0AE" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 6 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#F0EDE8', marginBottom: 2 }}>Images</div>
                  <div style={{ fontSize: 10, color: '#7A7680' }}>Upload or paste</div>
                </div>
                <div className="wn-summary-card">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF80AB" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 6 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#F0EDE8', marginBottom: 2 }}>Generate</div>
                  <div style={{ fontSize: 10, color: '#7A7680' }}>Ask AI to create</div>
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
  );
}
