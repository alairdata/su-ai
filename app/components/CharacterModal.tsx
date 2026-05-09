"use client";

import { track, EVENTS } from "@/lib/analytics";

export interface ChatCharacter {
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

export const CHARACTER_COLORS = [
  { name: 'purple', bg: '#2D1B4E', fg: '#B388FF', border: 'rgba(179,136,255,0.2)', bgLight: 'rgba(179,136,255,0.06)', tag: 'rgba(179,136,255,0.15)' },
  { name: 'blue',   bg: '#1B3A4E', fg: '#64D2FF', border: 'rgba(100,210,255,0.2)', bgLight: 'rgba(100,210,255,0.06)', tag: 'rgba(100,210,255,0.15)' },
  { name: 'green',  bg: '#1B4E2D', fg: '#69F0AE', border: 'rgba(105,240,174,0.2)', bgLight: 'rgba(105,240,174,0.06)', tag: 'rgba(105,240,174,0.15)' },
  { name: 'pink',   bg: '#4E1B35', fg: '#FF80AB', border: 'rgba(255,128,171,0.2)', bgLight: 'rgba(255,128,171,0.06)', tag: 'rgba(255,128,171,0.15)' },
  { name: 'orange', bg: '#4E3A1B', fg: '#FFAB40', border: 'rgba(255,171,64,0.2)',  bgLight: 'rgba(255,171,64,0.06)',  tag: 'rgba(255,171,64,0.15)'  },
];

interface CharacterModalProps {
  theme: string;
  chatCharacters: ChatCharacter[];
  newCharName: string;
  setNewCharName: (v: string) => void;
  newCharPersonality: string;
  setNewCharPersonality: (v: string) => void;
  selectedColorIndex: number;
  setSelectedColorIndex: (i: number) => void;
  isAddingCharacter: boolean;
  addChatCharacter: () => void;
  removeChatCharacter: (id: string) => void;
  onClose: () => void;
}

export default function CharacterModal({
  theme, chatCharacters, newCharName, setNewCharName,
  newCharPersonality, setNewCharPersonality, selectedColorIndex,
  setSelectedColorIndex, isAddingCharacter, addChatCharacter,
  removeChatCharacter, onClose,
}: CharacterModalProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) { track(EVENTS.CHARACTER_MODAL_CLOSED, { action: 'clicked_outside' }); onClose(); } }}
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
            onClick={() => { track(EVENTS.CHARACTER_MODAL_CLOSED, { action: 'cancelled' }); onClose(); }}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
              background: 'transparent',
              color: theme === 'dark' ? '#7A7680' : '#9A9590',
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
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: theme === 'dark' ? '#7A7680' : '#9A9590' }}>In this chat</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: theme === 'dark' ? '#7A7680' : '#9A9590' }}>{chatCharacters.length}/5</span>
          </div>

          {chatCharacters.length === 0 ? (
            <div style={{ padding: '12px 0', textAlign: 'center' as const, fontSize: 12, color: theme === 'dark' ? '#7A7680' : '#9A9590' }}>
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
                  <div style={{ fontSize: 11, color: theme === 'dark' ? '#7A7680' : '#9A9590', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{char.personality || 'No description'}</div>
                </div>
                <button
                  onClick={() => removeChatCharacter(char.id)}
                  style={{
                    width: 22, height: 22, borderRadius: 6, border: 'none',
                    background: 'transparent', color: theme === 'dark' ? '#7A7680' : '#9A9590',
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
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: theme === 'dark' ? '#7A7680' : '#9A9590' }}>{newCharName.length}/16</span>
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
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: theme === 'dark' ? '#7A7680' : '#9A9590' }}>{newCharPersonality.length}/300</span>
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
            <div style={{ fontSize: 11, color: theme === 'dark' ? '#7A7680' : '#9A9590', marginTop: 4 }}>
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
              borderRadius: 12, padding: 12, marginTop: 14,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: theme === 'dark' ? '#7A7680' : '#9A9590', marginBottom: 8,
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
                    <span style={{ color: CHARACTER_COLORS[selectedColorIndex].fg }}>{newCharName.trim()}</span>
                    <span style={{
                      fontSize: 8, padding: '1px 5px', borderRadius: 4,
                      fontWeight: 600, textTransform: 'uppercase' as const,
                      background: CHARACTER_COLORS[selectedColorIndex].tag,
                      color: CHARACTER_COLORS[selectedColorIndex].fg,
                    }}>Character</span>
                  </div>
                  <div style={{
                    padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
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
            onClick={() => { track(EVENTS.CHARACTER_MODAL_CLOSED, { action: 'cancelled' }); onClose(); }}
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
  );
}
