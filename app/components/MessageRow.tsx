"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import type { Message } from "../hooks/useChats";

type Styles = Record<string, React.CSSProperties>;

export type MessageRowProps = {
  m: Message;
  isLastAssistant: boolean;
  isSearching: boolean;
  chatLoading: boolean;
  theme: string;
  isMobile: boolean;
  styles: Styles;
  revealedParaCount: number;
  isEditing: boolean;
  editingContent: string;
  isCopied: boolean;
  feedback: "like" | "dislike" | null;
  onRegenerate: (msgId: string) => void;
  onEditStart: (msgId: string, content: string) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onEditContentChange: (content: string) => void;
  onCopyMessage: (content: string, msgId: string) => void;
  onFeedback: (msgId: string, type: "like" | "dislike") => void;
  onFindPrecedingUser: (msgId: string) => string | null;
};

const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p style={{ margin: "0 0 0.75em 0", display: "block" }}>{children}</p>
  ),
};

const MessageRow = React.memo(function MessageRow({
  m,
  isLastAssistant,
  isSearching,
  chatLoading,
  theme,
  isMobile,
  styles,
  revealedParaCount,
  isEditing,
  editingContent,
  isCopied,
  feedback,
  onRegenerate,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditContentChange,
  onCopyMessage,
  onFeedback,
  onFindPrecedingUser,
}: MessageRowProps) {
  return (
    <div style={m.role === "user" ? styles.messageRowUser : styles.messageRowAssistant}>
      {m.role === "user" ? (
        <div style={styles.messageWrapperUser}>
          {isEditing ? (
            <div style={styles.editModeContainer}>
              <textarea
                value={editingContent}
                onChange={(e) => onEditContentChange(e.target.value)}
                style={styles.editTextarea}
                autoFocus
              />
              <div style={styles.editWarning}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Heads up: editing this will wipe the AI&apos;s response and get you a fresh one. No going back.</span>
              </div>
              <div style={styles.editActions}>
                <button onClick={onEditCancel} style={styles.editCancelBtn}>Cancel</button>
                <button
                  onClick={onEditSave}
                  disabled={!editingContent.trim() || chatLoading}
                  style={{ ...styles.editSaveBtn, opacity: editingContent.trim() && !chatLoading ? 1 : 0.5 }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={styles.messageBubbleUser}>
                {m.image_url && (!m.file_type || m.file_type === "image") && (
                  <img
                    src={m.image_url}
                    alt="Uploaded"
                    onClick={() => window.open(m.image_url, "_blank")}
                    style={{
                      maxWidth: "300px",
                      maxHeight: "200px",
                      borderRadius: "12px",
                      marginBottom: m.content ? "8px" : 0,
                      cursor: "pointer",
                      display: "block",
                    }}
                  />
                )}
                {m.image_url && m.file_type && m.file_type !== "image" && (
                  <div
                    onClick={() => window.open(m.image_url, "_blank")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      marginBottom: m.content ? "8px" : 0,
                      maxWidth: "250px",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={m.file_type === "pdf" ? "#ef4444" : "#E8A04C"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span style={{ fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.file_name || "File"}
                    </span>
                  </div>
                )}
                {m.content && (
                  <span>
                    {m.content.split(/(@\w+)/g).map((part, pi) =>
                      part.match(/^@\w+$/) ? (
                        <span key={pi} style={{ color: theme === "dark" ? "#E8A04C" : "#D08A30", fontWeight: 600 }}>{part}</span>
                      ) : (
                        <span key={pi}>{part}</span>
                      )
                    )}
                  </span>
                )}
              </div>
              <div style={styles.messageActionsUser}>
                <button
                  onClick={() => onRegenerate(m.id)}
                  disabled={chatLoading}
                  style={{ ...styles.actionButton, ...(isMobile ? { padding: "6px", minWidth: "32px", minHeight: "32px" } : {}), opacity: chatLoading ? 0.3 : 1 }}
                  title="Retry message"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                </button>
                <button
                  onClick={() => onEditStart(m.id, m.content)}
                  disabled={chatLoading}
                  style={{ ...styles.actionButton, ...(isMobile ? { padding: "6px", minWidth: "32px", minHeight: "32px" } : {}), opacity: chatLoading ? 0.3 : 1 }}
                  title="Edit message"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
                <button
                  onClick={() => onCopyMessage(m.content, m.id)}
                  style={{ ...styles.actionButton, ...(isMobile ? { padding: "6px", minWidth: "32px", minHeight: "32px" } : {}) }}
                  title="Copy message"
                >
                  {isCopied ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={styles.messageWrapper}>
          {m.isError ? (
            <div
              className="message-bubble"
              style={{
                ...styles.messageBubbleAssistant,
                background: theme === "dark" ? "#3a2a2a" : "#fef2f2",
                border: `1px solid ${theme === "dark" ? "#5c3c3c" : "#fecaca"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: theme === "dark" ? "#fca5a5" : "#dc2626" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ fontSize: "14px" }}>{m.content}</span>
                <button
                  onClick={() => {
                    const userMsgId = onFindPrecedingUser(m.id);
                    if (userMsgId) onRegenerate(userMsgId);
                  }}
                  disabled={chatLoading}
                  style={{
                    marginLeft: "auto",
                    padding: "6px 12px",
                    fontSize: "13px",
                    background: theme === "dark" ? "#4a3a3a" : "#fee2e2",
                    border: `1px solid ${theme === "dark" ? "#6c4c4c" : "#fca5a5"}`,
                    borderRadius: "8px",
                    color: theme === "dark" ? "#fca5a5" : "#dc2626",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                  Retry
                </button>
              </div>
            </div>
          ) : m.content ? (
            m.character_name ? (
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: m.character_color_bg || "#2D1B4E",
                  color: m.character_color_fg || "#B388FF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 4,
                }}>
                  {m.character_name.substring(0, 2).toUpperCase()}
                </div>
                <div style={{ maxWidth: "80%", minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: m.character_color_fg || "#B388FF" }}>{m.character_name}</span>
                    <span style={{
                      fontSize: 8, padding: "1px 5px", borderRadius: 4,
                      fontWeight: 600, textTransform: "uppercase" as const,
                      background: m.character_color_tag || "rgba(179,136,255,0.15)",
                      color: m.character_color_fg || "#B388FF",
                    }}>Character</span>
                  </div>
                  <>
                    {m.content.split(/\n\n+/).filter(p => p.trim()).map((para, pi) => (
                      <div
                        key={pi}
                        className={`message-bubble${isLastAssistant ? " bubble-pop-in" : ""}`}
                        style={{
                          padding: "12px 16px", borderRadius: "16px 16px 16px 4px",
                          fontSize: 14, lineHeight: 1.6,
                          background: m.character_color_bg_light || "rgba(179,136,255,0.06)",
                          border: `1px solid ${m.character_color_border || "rgba(179,136,255,0.2)"}`,
                          color: theme === "dark" ? "#F0EDE8" : "#1A1918",
                        }}
                      >
                        <div style={styles.messageText}>
                          <ReactMarkdown components={mdComponents}>{para}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </>
                </div>
              </div>
            ) : (
              (() => {
                const allParas = m.content.split(/\n\n+/).filter(p => p.trim());
                const visibleParas = isLastAssistant ? allParas.slice(0, revealedParaCount) : allParas;
                const hasPendingPara = isLastAssistant && revealedParaCount < allParas.length;
                return (
                  <>
                    {visibleParas.map((para, pi) => (
                      <div key={pi} className="message-bubble bubble-pop-in" style={styles.messageBubbleAssistant}>
                        <div style={styles.messageText}>
                          <ReactMarkdown components={mdComponents}>{para}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                    {hasPendingPara && (
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
                    )}
                  </>
                );
              })()
            )
          ) : !isSearching && isLastAssistant ? (
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
          {m.content && !m.isFinalized && !chatLoading &&
            (!isLastAssistant || revealedParaCount >= m.content.split(/\n\n+/).filter(p => p.trim()).length) && (
            <div style={styles.messageActions}>
              <button
                onClick={() => onCopyMessage(m.content, m.id)}
                style={{ ...styles.actionButton, ...(isMobile ? { padding: "6px", minWidth: "32px", minHeight: "32px" } : {}) }}
                title="Copy message"
              >
                {isCopied ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => onFeedback(m.id, "like")}
                style={{
                  ...styles.actionButton,
                  ...(isMobile ? { padding: "6px", minWidth: "32px", minHeight: "32px" } : {}),
                  ...(feedback === "like" ? { color: "#10b981", opacity: 1 } : {}),
                }}
                title="Good response"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={feedback === "like" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              </button>
              <button
                onClick={() => onFeedback(m.id, "dislike")}
                style={{
                  ...styles.actionButton,
                  ...(isMobile ? { padding: "6px", minWidth: "32px", minHeight: "32px" } : {}),
                  ...(feedback === "dislike" ? { color: "#ef4444", opacity: 1 } : {}),
                }}
                title="Bad response"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={feedback === "dislike" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                </svg>
              </button>
              <button
                onClick={() => {
                  const userMsgId = onFindPrecedingUser(m.id);
                  if (userMsgId) onRegenerate(userMsgId);
                }}
                disabled={chatLoading}
                style={{
                  ...styles.actionButton,
                  ...(isMobile ? { padding: "6px", minWidth: "32px", minHeight: "32px" } : {}),
                  opacity: chatLoading ? 0.3 : 1,
                }}
                title="Regenerate response"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default MessageRow;
