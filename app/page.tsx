"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useChats } from "./hooks/useChats";
import { useTheme } from "./hooks/useTheme";
import { useSearchParams } from "next/navigation";

type View = "login" | "signup" | "chat";

function HomePage() {
  const { data: session, status, update: updateSession } = useSession();
  const { theme, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  
  const [currentView, setCurrentView] = useState<View>("login");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showChatActionsModal, setShowChatActionsModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [selectedChatForActions, setSelectedChatForActions] = useState<{id: string, title: string} | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  const {
    chats,
    currentChat,
    currentChatId,
    isLoading: chatLoading,
    messagesEndRef,
    sendMessage,
    createNewChat,
    selectChat,
    renameChat,
    deleteChat,
    canSendMessage,
    getRemainingMessages,
  } = useChats();

  const isAuthLoading = status === "loading";
  const isAuthenticated = !!session?.user;

  useEffect(() => {
    const verified = searchParams.get('verified');
    const error = searchParams.get('error');

    if (verified === 'true') {
      setAuthSuccess('Email verified! You can now log in.');
      setCurrentView('login');
    } else if (error) {
      setAuthError('Verification failed. Please try again.');
    }
  }, [searchParams]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  React.useEffect(() => {
    if (isAuthenticated) {
      setCurrentView("chat");
    } else if (!isAuthLoading) {
      setCurrentView("login");
    }
  }, [isAuthenticated, isAuthLoading]);

  const messages = currentChat?.messages ?? [];
  const showGreeting = !currentChat || messages.length === 0;
  const remainingMessages = getRemainingMessages();

  const getProgressPercentage = () => {
    if (!session?.user) return 0;
    const limits = { Free: 10, Pro: 100, Enterprise: Infinity };
    const limit = limits[session.user.plan as keyof typeof limits];
    if (limit === Infinity) return 100;
    return (session.user.messagesUsedToday / limit) * 100;
  };

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
      setAuthError(result.error);
    } else {
      setAuthEmail("");
      setAuthPassword("");
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
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "Signup failed");
        return;
      }

      setAuthSuccess(data.message || "Account created! Check your email to verify.");
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
      
      setTimeout(() => setCurrentView("login"), 2000);
    } catch (error) {
      setAuthError("Signup failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    setShowAccountModal(false);
    await signOut({ redirect: false });
  };

  const handleSend = async () => {
    if (!input.trim() || chatLoading || !canSendMessage()) return;
    const messageToSend = input;
    setInput("");
    await sendMessage(messageToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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

  const handleDeleteConfirm = async () => {
    if (chatToDelete) {
      await deleteChat(chatToDelete);
      setShowDeleteModal(false);
      setChatToDelete(null);
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

  const handleSelectChat = (id: string) => {
    selectChat(id);
    if (isMobile) setSidebarOpen(false);
  };

  const upgradePlan = async (newPlan: "Free" | "Pro" | "Enterprise") => {
    if (!session?.user) return;
    
    if (newPlan === "Free") {
      try {
        const res = await fetch("/api/upgrade-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: newPlan }),
        });

        if (res.ok) {
          await updateSession();
          setShowAccountModal(false);
        }
      } catch (error) {
        console.error("Failed to downgrade:", error);
      }
      return;
    }

    try {
      const res = await fetch("/api/payment/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan }),
      });

      const data = await res.json();

      if (res.ok && data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        alert(data.error || 'Failed to initialize payment');
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert('Failed to initialize payment');
    }
  };

  const currentStyles = theme === 'dark' ? darkStyles : lightStyles;

  if (isAuthLoading) {
    return (
      <div style={currentStyles.loadingContainer}>
        <div style={currentStyles.loadingSpinner}>✦</div>
      </div>
    );
  }

  if (currentView === "login" || currentView === "signup") {
    return (
      <div style={currentStyles.authContainer}>
        <div style={currentStyles.authCard}>
          <div style={currentStyles.authLogo}>✦</div>
          <h1 style={currentStyles.authTitle}>
            {currentView === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p style={currentStyles.authSubtitle}>
            {currentView === "login" ? "Sign in to your account" : "Get started in seconds"}
          </p>

          <div style={currentStyles.tabs}>
            <button
              style={{...currentStyles.tab, ...(currentView === "login" ? currentStyles.tabActive : {})}}
              onClick={() => {
                setCurrentView("login");
                setAuthError("");
                setAuthSuccess("");
              }}
            >
              Sign In
            </button>
            <button
              style={{...currentStyles.tab, ...(currentView === "signup" ? currentStyles.tabActive : {})}}
              onClick={() => {
                setCurrentView("signup");
                setAuthError("");
                setAuthSuccess("");
              }}
            >
              Sign Up
            </button>
          </div>

          {authError && <div style={currentStyles.authError}>{authError}</div>}
          {authSuccess && <div style={currentStyles.authSuccess}>{authSuccess}</div>}

          {currentView === "login" && (
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
                />
              </div>
              <div style={currentStyles.formGroup}>
                <label style={currentStyles.label}>Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={currentStyles.input}
                />
              </div>
              <button type="submit" style={currentStyles.authBtn}>
                <span>Sign In</span>
              </button>
            </form>
          )}

          {currentView === "signup" && (
            <form onSubmit={handleSignup}>
              <div style={currentStyles.formGroup}>
                <label style={currentStyles.label}>Full Name</label>
                <input
                  type="text"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="John Doe"
                  required
                  style={currentStyles.input}
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
                />
              </div>
              <div style={currentStyles.formGroup}>
                <label style={currentStyles.label}>Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  style={currentStyles.input}
                />
              </div>
              <button type="submit" style={currentStyles.authBtn}>
                <span>Create Account</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={currentStyles.app}>
        {isMobile && sidebarOpen && (
          <div style={currentStyles.mobileOverlay} onClick={() => setSidebarOpen(false)} />
        )}

        <aside style={{
          ...currentStyles.sidebar,
          ...(sidebarCollapsed && !isMobile ? currentStyles.sidebarCollapsed : {}),
          ...(isMobile ? {
            position: 'fixed' as const,
            left: sidebarOpen ? 0 : '-260px',
            top: 0,
            bottom: 0,
            zIndex: 1000,
            width: '260px',
          } : {})
        }}>
          <div style={currentStyles.sidebarTop}>
            <div style={currentStyles.sidebarHeader}>
              <button style={currentStyles.sidebarToggle} onClick={toggleSidebar}>
                ☰
              </button>
              <div style={{...currentStyles.brand, ...(sidebarCollapsed && !isMobile ? {display: 'none'} : {})}}>
                ✦ UnFiltered
              </div>
            </div>

            <div style={currentStyles.section}>
              <div style={currentStyles.navItem} onClick={() => {
                createNewChat();
                if (isMobile) setSidebarOpen(false);
              }}>
                <div style={currentStyles.navIcon}>+</div>
                <div style={{...currentStyles.navText, ...(sidebarCollapsed && !isMobile ? {display: 'none'} : {})}}>
                  New chat
                </div>
              </div>
            </div>

            <div style={{...currentStyles.sectionLabel, ...(sidebarCollapsed && !isMobile ? {display: 'none'} : {})}}>
              Chats
            </div>
            <div style={{...currentStyles.recentsList, ...(sidebarCollapsed && !isMobile ? {display: 'none'} : {})}}>
              {chats.length === 0 && (
                <div style={{...currentStyles.recentItem, opacity: 0.5}}>
                  No chats yet
                </div>
              )}
              {chats.map((chat) => (
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
                      <button onClick={() => handleRenameSubmit(chat.id)} style={currentStyles.renameBtn}>✓</button>
                      <button onClick={handleRenameCancel} style={currentStyles.cancelBtn}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          ...currentStyles.recentItem,
                          ...(chat.id === currentChatId ? currentStyles.recentItemActive : {})
                        }}
                        onClick={() => handleSelectChat(chat.id)}
                      >
                        {chat.title}
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameStart(chat.id, chat.title);
                            }}
                            style={currentStyles.actionBtn}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(chat.id);
                            }}
                            style={currentStyles.actionBtn}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={currentStyles.sidebarFooter} onClick={() => setShowAccountModal(true)}>
            <div style={currentStyles.avatar}>
              {session?.user?.name?.substring(0, 2).toUpperCase()}
            </div>
            <div style={{...currentStyles.userInfo, ...(sidebarCollapsed && !isMobile ? {display: 'none'} : {})}}>
              <div style={{fontSize: 13, fontWeight: 500}}>{session?.user?.name}</div>
              <div style={{fontSize: 11, opacity: 0.6}}>{session?.user?.plan}</div>
            </div>
          </div>
        </aside>

        <main style={currentStyles.main}>
          <div style={currentStyles.topBar}>
            <div style={currentStyles.topBarLeft}>
              {isMobile && (
                <button style={currentStyles.mobileMenuBtn} onClick={() => setSidebarOpen(true)}>☰</button>
              )}
              <div style={currentStyles.modelBadge}>✦ UnFiltered AI</div>
            </div>
            <button style={currentStyles.iconBtn} onClick={toggleTheme}>
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>

          <div style={currentStyles.chatWrapper}>
            <div style={currentStyles.messagesArea}>
              {showGreeting && (
                <div style={currentStyles.emptyState}>
                  <div style={currentStyles.greetingLogo}>✦</div>
                  <div style={currentStyles.greetingText}>What's good?</div>
                  {remainingMessages !== Infinity && (
                    <div style={currentStyles.messageLimitInfo}>
                      {remainingMessages} messages remaining
                    </div>
                  )}
                </div>
              )}

              {!showGreeting && (
                <div style={{
                  ...currentStyles.chatMessages,
                  ...(isMobile ? currentStyles.chatMessagesMobile : {})
                }}>
                  {messages.map((m, idx) => (
                    <div
                      key={m.id || idx}
                      style={m.role === "user" ? currentStyles.messageRowUser : currentStyles.messageRowAssistant}
                    >
                      <div style={m.role === "user" ? currentStyles.messageBubbleUser : currentStyles.messageBubbleAssistant}>
                        <div style={currentStyles.messageText}>{m.content}</div>
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div style={currentStyles.messageRowAssistant}>
                      <div style={currentStyles.messageBubbleAssistant}>
                        <div style={currentStyles.typingIndicator}>
                          <span style={currentStyles.typingDot} />
                          <span style={{...currentStyles.typingDot, animationDelay: '0.2s'}} />
                          <span style={{...currentStyles.typingDot, animationDelay: '0.4s'}} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div style={currentStyles.inputArea}>
              <div style={{...currentStyles.inputWrapper, ...(isMobile ? currentStyles.inputWrapperMobile : {})}}>
                {!canSendMessage() && (
                  <div style={currentStyles.limitWarning}>
                    Daily limit reached. <span style={currentStyles.upgradeLink} onClick={() => setShowAccountModal(true)}>Upgrade</span> to continue.
                  </div>
                )}

                <div style={currentStyles.inputCard}>
                  <textarea
                    rows={1}
                    placeholder={canSendMessage() ? "What's on your mind..." : "Daily limit reached"}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={chatLoading || !canSendMessage()}
                    style={currentStyles.textarea}
                  />
                  <button
                    style={{...currentStyles.sendBtn, ...(chatLoading || !input.trim() || !canSendMessage() ? currentStyles.sendBtnDisabled : {})}}
                    onClick={handleSend}
                    disabled={chatLoading || !input.trim() || !canSendMessage()}
                  >
                    ↑
                  </button>
                </div>
                <div style={currentStyles.modelSelect}>
                  AI can make mistakes. Verify important info.
                  {remainingMessages !== Infinity && canSendMessage() && !isMobile && (
                    <span style={currentStyles.remainingMessages}> · {remainingMessages} left</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {showAccountModal && (
        <>
          <div style={currentStyles.modalOverlay} onClick={() => setShowAccountModal(false)} />
          <div style={currentStyles.modalContainer}>
            <div style={currentStyles.modalContent}>
              <div style={currentStyles.modalHeader}>
                <h2 style={currentStyles.modalTitle}>Account</h2>
                <button style={currentStyles.modalCloseBtn} onClick={() => setShowAccountModal(false)}>×</button>
              </div>

              <div style={currentStyles.modalBody}>
                <div style={currentStyles.modalSection}>
                  <div style={currentStyles.infoGrid}>
                    <div>
                      <div style={currentStyles.infoLabel}>Name</div>
                      <div style={currentStyles.infoValue}>{session?.user?.name}</div>
                    </div>
                    <div>
                      <div style={currentStyles.infoLabel}>Email</div>
                      <div style={currentStyles.infoValue}>{session?.user?.email}</div>
                    </div>
                  </div>
                </div>

                <div style={currentStyles.modalSection}>
                  <h3 style={currentStyles.sectionTitle}>Current Plan</h3>
                  <div style={currentStyles.planCurrentBadge}>
                    <div style={currentStyles.planBadgeLarge}>{session?.user?.plan}</div>
                    <div style={currentStyles.planDescription}>
                      {session?.user?.plan === "Free" && `${session.user.messagesUsedToday}/10 messages today`}
                      {session?.user?.plan === "Pro" && `${session.user.messagesUsedToday}/100 messages today`}
                      {session?.user?.plan === "Enterprise" && "Unlimited messages"}
                    </div>
                    
                    {session?.user?.plan !== "Enterprise" && (
                      <div style={currentStyles.progressBarContainer}>
                        <div style={{...currentStyles.progressBar, width: `${getProgressPercentage()}%`}} />
                      </div>
                    )}
                  </div>

                  <div style={currentStyles.plansGrid}>
                    <div style={{...currentStyles.planCard, ...(session?.user?.plan === "Free" ? currentStyles.planCardActive : {})}}>
                      <h5 style={currentStyles.planCardTitle}>Free</h5>
                      <div style={currentStyles.planPrice}>GHS 0<span style={currentStyles.planPricePeriod}>/mo</span></div>
                      <ul style={currentStyles.planFeatures}>
                        <li style={currentStyles.planFeature}>10 messages/day</li>
                        <li style={currentStyles.planFeature}>Basic support</li>
                      </ul>
                      {session?.user?.plan !== "Free" ? (
                        <button style={currentStyles.planBtn} onClick={() => upgradePlan("Free")}>Downgrade</button>
                      ) : (
                        <div style={currentStyles.planBtnSpacer} />
                      )}
                    </div>

                    <div style={{...currentStyles.planCard, ...(session?.user?.plan === "Pro" ? currentStyles.planCardActive : {})}}>
                      <h5 style={currentStyles.planCardTitle}>Pro</h5>
                      <div style={currentStyles.planPrice}>GHS 70<span style={currentStyles.planPricePeriod}>/mo</span></div>
                      <ul style={currentStyles.planFeatures}>
                        <li style={currentStyles.planFeature}>100 messages/day</li>
                        <li style={currentStyles.planFeature}>Priority support</li>
                        <li style={currentStyles.planFeature}>Advanced features</li>
                      </ul>
                      {session?.user?.plan !== "Pro" ? (
                        <button style={currentStyles.planBtn} onClick={() => upgradePlan("Pro")}>
                          {session?.user?.plan === "Free" ? "Upgrade" : "Switch to Pro"}
                        </button>
                      ) : (
                        <div style={currentStyles.planBtnSpacer} />
                      )}
                    </div>

                    <div style={{...currentStyles.planCard, ...(session?.user?.plan === "Enterprise" ? currentStyles.planCardActive : {})}}>
                      <h5 style={currentStyles.planCardTitle}>Enterprise</h5>
                      <div style={currentStyles.planPrice}>GHS 370<span style={currentStyles.planPricePeriod}>/mo</span></div>
                      <ul style={currentStyles.planFeatures}>
                        <li style={currentStyles.planFeature}>Unlimited messages</li>
                        <li style={currentStyles.planFeature}>24/7 support</li>
                        <li style={currentStyles.planFeature}>Custom integrations</li>
                      </ul>
                      {session?.user?.plan !== "Enterprise" ? (
                        <button style={currentStyles.planBtn} onClick={() => upgradePlan("Enterprise")}>Upgrade</button>
                      ) : (
                        <div style={currentStyles.planBtnSpacer} />
                      )}
                    </div>
                  </div>
                </div>

                <button style={currentStyles.logoutBtn} onClick={handleLogout}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showChatActionsModal && selectedChatForActions && (
        <>
          <div style={currentStyles.modalOverlay} onClick={() => setShowChatActionsModal(false)} />
          <div style={currentStyles.actionsModalContainer}>
            <div style={currentStyles.actionsModalContent}>
              <div style={currentStyles.actionsModalHeader}>
                <h3 style={currentStyles.actionsModalTitle}>{selectedChatForActions.title}</h3>
              </div>
              <div style={currentStyles.actionsModalBody}>
                <button style={currentStyles.actionMenuItem} onClick={() => handleRenameStart(selectedChatForActions.id, selectedChatForActions.title)}>
                  <span>✏️</span> Rename
                </button>
                <button style={{...currentStyles.actionMenuItem, color: '#ef4444'}} onClick={() => handleDeleteClick(selectedChatForActions.id)}>
                  <span>🗑️</span> Delete
                </button>
                <button style={currentStyles.actionMenuItem} onClick={() => setShowChatActionsModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}

      {showDeleteModal && (
        <>
          <div style={currentStyles.modalOverlay} />
          <div style={currentStyles.deleteModalContainer}>
            <div style={currentStyles.deleteModalContent}>
              <h3 style={currentStyles.deleteModalTitle}>Delete Chat?</h3>
              <p style={currentStyles.deleteModalText}>This action cannot be undone.</p>
              <div style={currentStyles.deleteModalFooter}>
                <button onClick={handleDeleteCancel} style={currentStyles.deleteCancelBtn}>Cancel</button>
                <button onClick={handleDeleteConfirm} style={currentStyles.deleteConfirmBtn}>Delete</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading...</div>}>
      <HomePage />
    </Suspense>
  );
}

// Minimal Light Theme
const lightStyles: { [key: string]: React.CSSProperties } = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8f9fa',
  },
  loadingSpinner: {
    fontSize: '48px',
    color: '#999',
    animation: 'spin 2s linear infinite',
  },
  authContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: '#f8f9fa',
    position: 'relative' as const,
  },
  authCard: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '400px',
    padding: '36px 32px',
  },
  authLogo: {
    width: '48px',
    height: '48px',
    background: 'linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 100%)',
    border: '2px solid #d0d0d0',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    margin: '0 auto 20px',
    color: '#666',
  },
  authTitle: {
    fontSize: '26px',
    fontWeight: 600,
    textAlign: 'center' as const,
    color: '#1a1a1a',
    marginBottom: '6px',
    letterSpacing: '-0.02em',
  },
  authSubtitle: {
    textAlign: 'center' as const,
    color: '#666',
    marginBottom: '24px',
    fontSize: '14px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    background: '#f5f5f5',
    padding: '4px',
    borderRadius: '12px',
  },
  tab: {
    flex: 1,
    padding: '10px',
    background: 'transparent',
    border: 'none',
    borderRadius: '10px',
    color: '#666',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s',
  },
  tabActive: {
    background: '#fff',
    color: '#1a1a1a',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  authError: {
    padding: '12px 16px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '10px',
    color: '#ef4444',
    fontSize: '13px',
    marginBottom: '16px',
  },
  authSuccess: {
    padding: '12px 16px',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '10px',
    color: '#10b981',
    fontSize: '13px',
    marginBottom: '16px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#444',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    background: '#fafafa',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#1a1a1a',
    transition: 'all 0.3s',
    outline: 'none',
  },
  authBtn: {
    width: '100%',
    padding: '13px',
    background: 'linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 100%)',
    color: '#1a1a1a',
    border: '1px solid #d0d0d0',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '20px',
    transition: 'all 0.3s',
  },
  app: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    maxWidth: '100%',
    overflow: 'hidden',
    background: '#fafafa',
  },
  mobileOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(4px)',
    zIndex: 999,
  },
  sidebar: {
    width: '260px',
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    borderRight: '1px solid rgba(0, 0, 0, 0.06)',
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'all 0.3s ease',
  },
  sidebarCollapsed: {
    width: '70px',
  },
  sidebarTop: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  sidebarToggle: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px',
    color: '#666',
  },
  brand: {
    fontWeight: 600,
    fontSize: '15px',
    color: '#1a1a1a',
    letterSpacing: '-0.01em',
  },
  section: {
    padding: '12px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: 'transparent',
  },
  navIcon: {
    fontSize: '18px',
    width: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
  },
  navText: {
    fontSize: '14px',
    color: '#444',
    fontWeight: 500,
  },
  sectionLabel: {
    padding: '12px 16px 8px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#999',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  recentsList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 12px',
  },
  chatItemWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
    marginBottom: '4px',
  },
  recentItem: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#444',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'all 0.2s',
  },
  recentItemActive: {
    background: 'rgba(0, 0, 0, 0.04)',
    fontWeight: 500,
    color: '#1a1a1a',
  },
  chatActions: {
    display: 'flex',
    gap: '4px',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '6px',
    opacity: 0.6,
    transition: 'all 0.2s',
  },
  renameWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
  },
  renameInput: {
    flex: 1,
    padding: '8px 10px',
    border: '1px solid #d0d0d0',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
  },
  renameBtn: {
    background: '#10b981',
    border: 'none',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  cancelBtn: {
    background: '#ef4444',
    border: 'none',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  sidebarFooter: {
    padding: '16px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 100%)',
    border: '1px solid #d0d0d0',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '13px',
  },
  userInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#fafafa',
    overflow: 'hidden',
  },
  topBar: {
    padding: '14px 20px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  mobileMenuBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px',
    color: '#666',
  },
  modelBadge: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1a1a1a',
    letterSpacing: '-0.01em',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
    transition: 'all 0.2s',
  },
  chatWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
  },
  emptyState: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  greetingLogo: {
    width: '64px',
    height: '64px',
    background: 'linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 100%)',
    border: '2px solid #d0d0d0',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    color: '#999',
    marginBottom: '24px',
  },
  greetingText: {
    fontSize: '28px',
    fontWeight: 600,
    color: '#1a1a1a',
    letterSpacing: '-0.02em',
  },
  messageLimitInfo: {
    fontSize: '13px',
    color: '#999',
    marginTop: '12px',
  },
  chatMessages: {
    maxWidth: '768px',
    width: '100%',
    margin: '0 auto',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  chatMessagesMobile: {
    padding: '20px 20px',
  },
  messageRowUser: {
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-start',
  },
  messageBubbleUser: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '14px',
    lineHeight: 1.6,
    background: '#1a1a1a',
    color: '#fff',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  messageBubbleAssistant: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '14px',
    lineHeight: 1.6,
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    color: '#1a1a1a',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  messageText: {
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  typingIndicator: {
    display: 'flex',
    gap: '6px',
  },
  typingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#999',
    animation: 'pulse 1.5s infinite',
  },
  inputArea: {
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
  },
  inputWrapper: {
    maxWidth: '768px',
    width: '100%',
    margin: '0 auto',
    padding: '16px 24px',
  },
  inputWrapperMobile: {
    padding: '12px 16px',
  },
  limitWarning: {
    padding: '10px 14px',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    borderRadius: '10px',
    marginBottom: '12px',
    fontSize: '13px',
    color: '#f59e0b',
  },
  upgradeLink: {
    color: '#1a1a1a',
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: 'underline',
  },
  inputCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#fff',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '16px',
    padding: '8px 12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  textarea: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: '14px',
    resize: 'none' as const,
    outline: 'none',
    color: '#1a1a1a',
    padding: '6px 8px',
    maxHeight: '120px',
    lineHeight: '1.5',
  },
  sendBtn: {
    width: '32px',
    height: '32px',
    minWidth: '32px',
    border: 'none',
    borderRadius: '50%',
    background: '#1a1a1a',
    color: 'white',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  modelSelect: {
    padding: '8px 0 0',
    textAlign: 'center' as const,
    fontSize: '11px',
    color: '#999',
  },
  remainingMessages: {
    color: '#bbb',
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(8px)',
    zIndex: 999,
  },
  modalContainer: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1000,
    maxWidth: '650px',
    width: '90%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
  },
  modalContent: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
  },
  modalHeader: {
    padding: '24px 28px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1a1a1a',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    color: '#999',
    lineHeight: 1,
  },
  modalBody: {
    padding: '24px 28px',
  },
  modalSection: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#1a1a1a',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  infoLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#999',
    textTransform: 'uppercase' as const,
    marginBottom: '6px',
    letterSpacing: '0.5px',
  },
  infoValue: {
    fontSize: '14px',
    color: '#1a1a1a',
  },
  planCurrentBadge: {
    padding: '20px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '12px',
    textAlign: 'center' as const,
    marginBottom: '20px',
  },
  planBadgeLarge: {
    display: 'inline-block',
    padding: '6px 18px',
    background: '#1a1a1a',
    color: 'white',
    borderRadius: '20px',
    fontWeight: 600,
    fontSize: '13px',
    marginBottom: '10px',
  },
  planDescription: {
    color: '#666',
    fontSize: '13px',
    marginBottom: '12px',
  },
  progressBarContainer: {
    width: '100%',
    height: '6px',
    background: 'rgba(0, 0, 0, 0.06)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: '#1a1a1a',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
  },
  planCard: {
    padding: '18px',
    background: 'rgba(255, 255, 255, 0.5)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '12px',
    transition: 'all 0.2s',
  },
  planCardActive: {
    borderColor: '#1a1a1a',
    background: 'rgba(0, 0, 0, 0.02)',
  },
  planCardTitle: {
    fontSize: '15px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#1a1a1a',
  },
  planPrice: {
    fontSize: '22px',
    fontWeight: 700,
    margin: '8px 0 16px',
    color: '#1a1a1a',
  },
  planPricePeriod: {
    fontSize: '13px',
    fontWeight: 400,
    color: '#999',
  },
  planFeatures: {
    listStyle: 'none',
    marginBottom: '16px',
    padding: 0,
  },
  planFeature: {
    padding: '4px 0',
    fontSize: '12px',
    color: '#666',
  },
  planBtn: {
    width: '100%',
    padding: '10px',
    background: '#1a1a1a',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  planBtnSpacer: {
    height: '38px',
  },
  logoutBtn: {
    width: '100%',
    padding: '12px',
    background: 'transparent',
    color: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  actionsModalContainer: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  actionsModalContent: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px 20px 0 0',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
  },
  actionsModalHeader: {
    padding: '18px 20px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  actionsModalTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1a1a1a',
  },
  actionsModalBody: {
    padding: '12px',
  },
  actionMenuItem: {
    width: '100%',
    padding: '14px 20px',
    background: 'none',
    border: 'none',
    fontSize: '15px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#1a1a1a',
    borderRadius: '10px',
    transition: 'all 0.2s',
  },
  deleteModalContainer: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1000,
    width: '90%',
    maxWidth: '400px',
  },
  deleteModalContent: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
  },
  deleteModalTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1a1a1a',
    marginBottom: '12px',
  },
  deleteModalText: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '20px',
  },
  deleteModalFooter: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
  },
  deleteCancelBtn: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#666',
  },
  deleteConfirmBtn: {
    padding: '10px 20px',
    background: '#ef4444',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'white',
  },
  mobileMenuDots: {
    position: 'absolute' as const,
    right: '8px',
    fontSize: '16px',
    color: '#999',
  },
};

const darkStyles: { [key: string]: React.CSSProperties } = {
  ...lightStyles,
  authContainer: {
    ...lightStyles.authContainer,
    background: '#0a0a0a',
  },
  authCard: {
    ...lightStyles.authCard,
    background: 'rgba(30, 30, 30, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  authLogo: {
    ...lightStyles.authLogo,
    background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
    border: '2px solid #3a3a3a',
    color: '#999',
  },
  authTitle: {
    ...lightStyles.authTitle,
    color: '#fff',
  },
  authSubtitle: {
    ...lightStyles.authSubtitle,
    color: '#999',
  },
  tabs: {
    ...lightStyles.tabs,
    background: '#1a1a1a',
  },
  tab: {
    ...lightStyles.tab,
    color: '#999',
  },
  tabActive: {
    ...lightStyles.tabActive,
    background: '#2a2a2a',
    color: '#fff',
  },
  label: {
    ...lightStyles.label,
    color: '#ccc',
  },
  input: {
    ...lightStyles.input,
    background: '#1a1a1a',
    border: '1px solid #3a3a3a',
    color: '#fff',
  },
  authBtn: {
    ...lightStyles.authBtn,
    background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
    color: '#fff',
    border: '1px solid #3a3a3a',
  },
  app: {
    ...lightStyles.app,
    background: '#0a0a0a',
  },
  sidebar: {
    ...lightStyles.sidebar,
    background: 'rgba(20, 20, 20, 0.7)',
    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
  },
  sidebarHeader: {
    ...lightStyles.sidebarHeader,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  sidebarToggle: {
    ...lightStyles.sidebarToggle,
    color: '#999',
  },
  brand: {
    ...lightStyles.brand,
    color: '#fff',
  },
  section: {
    ...lightStyles.section,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  navIcon: {
    ...lightStyles.navIcon,
    color: '#999',
  },
  navText: {
    ...lightStyles.navText,
    color: '#ccc',
  },
  sectionLabel: {
    ...lightStyles.sectionLabel,
    color: '#666',
  },
  recentItem: {
    ...lightStyles.recentItem,
    color: '#ccc',
  },
  recentItemActive: {
    ...lightStyles.recentItemActive,
    background: 'rgba(255, 255, 255, 0.06)',
    color: '#fff',
  },
  renameInput: {
    ...lightStyles.renameInput,
    background: '#1a1a1a',
    border: '1px solid #3a3a3a',
    color: '#fff',
  },
  sidebarFooter: {
    ...lightStyles.sidebarFooter,
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  },
  avatar: {
    ...lightStyles.avatar,
    background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
    border: '1px solid #3a3a3a',
    color: '#999',
  },
  main: {
    ...lightStyles.main,
    background: '#0a0a0a',
  },
  topBar: {
    ...lightStyles.topBar,
    background: 'rgba(20, 20, 20, 0.7)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  mobileMenuBtn: {
    ...lightStyles.mobileMenuBtn,
    color: '#999',
  },
  modelBadge: {
    ...lightStyles.modelBadge,
    color: '#fff',
  },
  greetingLogo: {
    ...lightStyles.greetingLogo,
    background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
    border: '2px solid #3a3a3a',
    color: '#666',
  },
  greetingText: {
    ...lightStyles.greetingText,
    color: '#fff',
  },
  messageLimitInfo: {
    ...lightStyles.messageLimitInfo,
    color: '#666',
  },
  messageBubbleUser: {
    ...lightStyles.messageBubbleUser,
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
  },
  messageBubbleAssistant: {
    ...lightStyles.messageBubbleAssistant,
    background: 'rgba(30, 30, 30, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#fff',
  },
  inputArea: {
    ...lightStyles.inputArea,
    background: 'rgba(20, 20, 20, 0.7)',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  },
  inputCard: {
    ...lightStyles.inputCard,
    background: '#1a1a1a',
    border: '1px solid #3a3a3a',
  },
  textarea: {
    ...lightStyles.textarea,
    color: '#fff',
  },
  sendBtn: {
    ...lightStyles.sendBtn,
    background: '#fff',
    color: '#000',
  },
  modelSelect: {
    ...lightStyles.modelSelect,
    color: '#666',
  },
  modalContent: {
    ...lightStyles.modalContent,
    background: 'rgba(30, 30, 30, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    ...lightStyles.modalTitle,
    color: '#fff',
  },
  modalCloseBtn: {
    ...lightStyles.modalCloseBtn,
    color: '#666',
  },
  modalHeader: {
    ...lightStyles.modalHeader,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  sectionTitle: {
    ...lightStyles.sectionTitle,
    color: '#fff',
  },
  infoLabel: {
    ...lightStyles.infoLabel,
    color: '#666',
  },
  infoValue: {
    ...lightStyles.infoValue,
    color: '#fff',
  },
  planCurrentBadge: {
    ...lightStyles.planCurrentBadge,
    background: 'rgba(255, 255, 255, 0.02)',
  },
  planBadgeLarge: {
    ...lightStyles.planBadgeLarge,
    background: '#fff',
    color: '#000',
  },
  planDescription: {
    ...lightStyles.planDescription,
    color: '#999',
  },
  progressBarContainer: {
    ...lightStyles.progressBarContainer,
    background: 'rgba(255, 255, 255, 0.06)',
  },
  progressBar: {
    ...lightStyles.progressBar,
    background: '#fff',
  },
  planCard: {
    ...lightStyles.planCard,
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  planCardActive: {
    ...lightStyles.planCardActive,
    borderColor: '#fff',
    background: 'rgba(255, 255, 255, 0.04)',
  },
  planCardTitle: {
    ...lightStyles.planCardTitle,
    color: '#fff',
  },
  planPrice: {
    ...lightStyles.planPrice,
    color: '#fff',
  },
  planFeature: {
    ...lightStyles.planFeature,
    color: '#999',
  },
  planBtn: {
    ...lightStyles.planBtn,
    background: '#fff',
    color: '#000',
  },
  deleteModalContent: {
    ...lightStyles.deleteModalContent,
    background: 'rgba(30, 30, 30, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  deleteModalTitle: {
    ...lightStyles.deleteModalTitle,
    color: '#fff',
  },
  deleteModalText: {
    ...lightStyles.deleteModalText,
    color: '#999',
  },
  deleteCancelBtn: {
    ...lightStyles.deleteCancelBtn,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#999',
  },
  actionsModalContent: {
    ...lightStyles.actionsModalContent,
    background: 'rgba(30, 30, 30, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  actionsModalHeader: {
    ...lightStyles.actionsModalHeader,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  actionsModalTitle: {
    ...lightStyles.actionsModalTitle,
    color: '#fff',
  },
  actionMenuItem: {
    ...lightStyles.actionMenuItem,
    color: '#fff',
  },
};