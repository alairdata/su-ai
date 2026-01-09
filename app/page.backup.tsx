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

  // Auth form states
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

  // Check for verification status from URL
  useEffect(() => {
    const verified = searchParams.get('verified');
    const error = searchParams.get('error');

    if (verified === 'true') {
      setAuthSuccess('Email verified! You can now log in.');
      setCurrentView('login');
    } else if (error === 'invalid-token') {
      setAuthError('Invalid or expired verification link.');
    } else if (error === 'token-expired') {
      setAuthError('Verification link expired. Please sign up again.');
    } else if (error === 'verification-failed') {
      setAuthError('Verification failed. Please try again.');
    }
  }, [searchParams]);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Apply theme to body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Show chat view when authenticated
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

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!session?.user) return 0;
    const limits = { Free: 10, Pro: 100, Enterprise: Infinity };
    const limit = limits[session.user.plan as keyof typeof limits];
    if (limit === Infinity) return 100;
    return (session.user.messagesUsedToday / limit) * 100;
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
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          password: authPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "Signup failed");
        return;
      }

      // Show success message and switch to login
      setAuthSuccess(data.message || "Account created! Check your email to verify.");
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
      
      // Switch to login view after 2 seconds
      setTimeout(() => {
        setCurrentView("login");
      }, 2000);

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
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const upgradePlan = async (newPlan: "Free" | "Pro" | "Enterprise") => {
  if (!session?.user) return;
  
  // Downgrade to Free - no payment needed
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
      console.error("Failed to downgrade plan:", error);
    }
    return;
  }

  // Upgrade to Pro or Enterprise - requires payment
  try {
    const res = await fetch("/api/payment/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: newPlan }),
    });

    const data = await res.json();

    if (res.ok && data.authorizationUrl) {
      // Redirect to Paystack checkout
      window.location.href = data.authorizationUrl;
    } else {
      alert(data.error || 'Failed to initialize payment');
    }
  } catch (error) {
    console.error("Failed to initialize payment:", error);
    alert('Failed to initialize payment. Please try again.');
  }
};

  const currentStyles = theme === 'dark' ? darkStyles : lightStyles;

  if (isAuthLoading) {
    return (
      <div style={currentStyles.loadingContainer}>
        <div style={currentStyles.loadingSpinner}>Loading...</div>
      </div>
    );
  }

  if (currentView === "login") {
    return (
      <div style={currentStyles.authContainer}>
        <div style={currentStyles.authCard}>
          <div style={currentStyles.authLogo}>
            <div style={currentStyles.logoIcon}></div>
            <h1 style={currentStyles.authTitle}>UnFiltered-AI</h1>
            <p style={currentStyles.authSubtitle}>Sign in to continue</p>
          </div>

          {authError && <div style={currentStyles.authError}>{authError}</div>}
          {authSuccess && <div style={currentStyles.authSuccess}>{authSuccess}</div>}

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
              Sign In
            </button>
          </form>

          <div style={currentStyles.authSwitch}>
            Don't have an account?{" "}
            <a onClick={() => {
              setCurrentView("signup");
              setAuthError("");
              setAuthSuccess("");
            }} style={currentStyles.authLink}>
              Sign up
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "signup") {
    return (
      <div style={currentStyles.authContainer}>
        <div style={currentStyles.authCard}>
          <div style={currentStyles.authLogo}>
            <div style={currentStyles.logoIcon}></div>
            <h1 style={currentStyles.authTitle}>UnFiltered-AI</h1>
            <p style={currentStyles.authSubtitle}>Create your account</p>
          </div>

          {authError && <div style={currentStyles.authError}>{authError}</div>}
          {authSuccess && <div style={currentStyles.authSuccess}>{authSuccess}</div>}

          <form onSubmit={handleSignup}>
            <div style={currentStyles.formGroup}>
              <label style={currentStyles.label}>Name</label>
              <input
                type="text"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="Your name"
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
              Create Account
            </button>
          </form>

          <div style={currentStyles.authSwitch}>
            Already have an account?{" "}
            <a onClick={() => {
              setCurrentView("login");
              setAuthError("");
              setAuthSuccess("");
            }} style={currentStyles.authLink}>
              Sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
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
            left: sidebarOpen ? 0 : '-260px',
            top: 0,
            bottom: 0,
            zIndex: 1000,
            width: '260px',
          } : {})
        }}>
          <div style={currentStyles.sidebarTop}>
            <div style={currentStyles.sidebarHeader}>
              <button
                style={currentStyles.sidebarToggle}
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
              >
                ☰
              </button>
              <div style={{...currentStyles.brand, ...(sidebarCollapsed && !isMobile ? {display: 'none'} : {})}}>
                UnFiltered-AI
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
              Recent chats
            </div>
            <div style={{...currentStyles.recentsList, ...(sidebarCollapsed && !isMobile ? {display: 'none'} : {})}}>
              {chats.length === 0 && (
                <div style={{...currentStyles.recentItem, opacity: 0.6}}>
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
                          if (e.key === 'Enter') {
                            handleRenameSubmit(chat.id);
                          } else if (e.key === 'Escape') {
                            handleRenameCancel();
                          }
                        }}
                        style={currentStyles.renameInput}
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenameSubmit(chat.id)}
                        style={currentStyles.renameBtn}
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleRenameCancel}
                        style={currentStyles.cancelBtn}
                      >
                        ✕
                      </button>
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
                            title="Rename"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(chat.id);
                            }}
                            style={currentStyles.actionBtn}
                            title="Delete"
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
              <div style={{ fontSize: 13 }}>{session?.user?.name}</div>
              <div style={{ fontSize: 11, color: theme === 'dark' ? '#999' : '#666' }}>
                {session?.user?.plan} plan
              </div>
            </div>
          </div>
        </aside>

        <main style={currentStyles.main}>
          <div style={currentStyles.topBar}>
            <div style={currentStyles.topBarLeft}>
              {isMobile && (
                <button
                  style={currentStyles.mobileMenuBtn}
                  onClick={() => setSidebarOpen(true)}
                >
                  ☰
                </button>
              )}
              <div style={currentStyles.modelBadge}>UnFiltered-AI 5.2</div>
            </div>
            <div style={currentStyles.topBarRight}>
              <button style={currentStyles.iconBtn} onClick={toggleTheme} title="Toggle theme">
                {theme === "light" ? "🌙" : "☀️"}
              </button>
            </div>
          </div>

          <div style={currentStyles.chatWrapper}>
            <div style={currentStyles.messagesArea}>
              {showGreeting && (
                <div style={currentStyles.emptyState}>
                  <div style={currentStyles.greetingLogo}></div>
                  <div style={currentStyles.greetingText}>What's good?</div>
                  {remainingMessages !== Infinity && (
                    <div style={currentStyles.messageLimitInfo}>
                      {remainingMessages} messages remaining today
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
                      <div
                        style={m.role === "user" ? currentStyles.messageBubbleUser : currentStyles.messageBubbleAssistant}
                      >
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
              <div style={{
                ...currentStyles.inputWrapper,
                ...(isMobile ? currentStyles.inputWrapperMobile : {})
              }}>
                {!canSendMessage() && (
                  <div style={currentStyles.limitWarning}>
                    <strong>Daily limit reached!</strong> You've used all your messages for today.
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
                  <div style={currentStyles.inputRow}>
                    <textarea
                      rows={1}
                      placeholder={canSendMessage() ? "What's up? Time to spill it..." : "Daily limit reached. Upgrade to continue."}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={chatLoading || !canSendMessage()}
                      style={currentStyles.textarea}
                    />
                    <button
                      style={{
                        ...currentStyles.sendBtn,
                        ...(chatLoading || !input.trim() || !canSendMessage() ? currentStyles.sendBtnDisabled : {})
                      }}
                      onClick={handleSend}
                      disabled={chatLoading || !input.trim() || !canSendMessage()}
                    >
                      ↑
                    </button>
                  </div>
                </div>
                <div style={currentStyles.modelSelect}>
                  <span>UnFiltered-AI can make mistakes. Check important info.</span>
                  {remainingMessages !== Infinity && canSendMessage() && !isMobile && (
                    <span style={currentStyles.remainingMessages}>
                      {" "}· {remainingMessages} messages left today
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Account Modal */}
      {showAccountModal && (
        <>
          <div style={currentStyles.modalOverlay} onClick={() => setShowAccountModal(false)} />
          <div style={currentStyles.modalContainer}>
            <div style={currentStyles.modalContent}>
              <div style={currentStyles.modalHeader}>
                <h2 style={currentStyles.modalTitle}>Account Settings</h2>
                <button style={currentStyles.modalCloseBtn} onClick={() => setShowAccountModal(false)}>
                  ×
                </button>
              </div>

              <div style={currentStyles.modalBody}>
                <div style={currentStyles.modalSection}>
                  <h3 style={currentStyles.modalSectionTitle}>Profile Information</h3>
                  <div style={currentStyles.modalInfoRow}>
                    <span style={currentStyles.modalLabel}>Name:</span>
                    <span style={currentStyles.modalValue}>{session?.user?.name}</span>
                  </div>
                  <div style={currentStyles.modalInfoRow}>
                    <span style={currentStyles.modalLabel}>Email:</span>
                    <span style={currentStyles.modalValue}>{session?.user?.email}</span>
                  </div>
                </div>

                <div style={currentStyles.modalSection}>
                  <h3 style={currentStyles.modalSectionTitle}>Current Plan</h3>
                  <div style={currentStyles.planCurrentBadge}>
                    <div style={currentStyles.planBadgeLarge}>{session?.user?.plan}</div>
                    <div style={currentStyles.planDescription}>
                      {session?.user?.plan === "Free" && `${session.user.messagesUsedToday}/10 messages used today`}
                      {session?.user?.plan === "Pro" && `${session.user.messagesUsedToday}/100 messages used today`}
                      {session?.user?.plan === "Enterprise" && "Unlimited messages"}
                    </div>
                    
                    {/* Progress Bar */}
                    {session?.user?.plan !== "Enterprise" && (
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
                  <div style={currentStyles.plansGrid}>
                    <div style={{...currentStyles.planCard, ...(session?.user?.plan === "Free" ? currentStyles.planCardActive : {})}}>
                      <h5 style={currentStyles.planCardTitle}>Free</h5>
                      <div style={currentStyles.planPrice}>$0<span style={currentStyles.planPricePeriod}>/mo</span></div>
                      <ul style={currentStyles.planFeatures}>
                        <li style={currentStyles.planFeature}>✓ 10 messages/day</li>
                        <li style={currentStyles.planFeature}>✓ Basic support</li>
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
                        <div style={currentStyles.planBtnSpacer} />
                      )}
                    </div>

                    <div style={{...currentStyles.planCard, ...(session?.user?.plan === "Pro" ? currentStyles.planCardActive : {})}}>
                      <h5 style={currentStyles.planCardTitle}>Pro</h5>
                      <div style={currentStyles.planPrice}>$19<span style={currentStyles.planPricePeriod}>/mo</span></div>
                      <ul style={currentStyles.planFeatures}>
                        <li style={currentStyles.planFeature}>✓ 100 messages/day</li>
                        <li style={currentStyles.planFeature}>✓ Priority support</li>
                        <li style={currentStyles.planFeature}>✓ Advanced features</li>
                      </ul>
                      {session?.user?.plan !== "Pro" && (
                        <button
                          style={currentStyles.planBtn}
                          onClick={() => upgradePlan("Pro")}
                        >
                          {session?.user?.plan === "Free" ? "Upgrade to Pro" : "Switch to Pro"}
                        </button>
                      )}
                      {session?.user?.plan === "Pro" && (
                        <div style={currentStyles.planBtnSpacer} />
                      )}
                    </div>

                    <div style={{...currentStyles.planCard, ...(session?.user?.plan === "Enterprise" ? currentStyles.planCardActive : {})}}>
                      <h5 style={currentStyles.planCardTitle}>Enterprise</h5>
                      <div style={currentStyles.planPrice}>$99<span style={currentStyles.planPricePeriod}>/mo</span></div>
                      <ul style={currentStyles.planFeatures}>
                        <li style={currentStyles.planFeature}>✓ Unlimited messages</li>
                        <li style={currentStyles.planFeature}>✓ 24/7 support</li>
                        <li style={currentStyles.planFeature}>✓ Custom integrations</li>
                      </ul>
                      {session?.user?.plan !== "Enterprise" && (
                        <button
                          style={currentStyles.planBtn}
                          onClick={() => upgradePlan("Enterprise")}
                        >
                          Upgrade to Enterprise
                        </button>
                      )}
                      {session?.user?.plan === "Enterprise" && (
                        <div style={currentStyles.planBtnSpacer} />
                      )}
                    </div>
                  </div>
                </div>

                <div style={currentStyles.modalSection}>
                  <button style={currentStyles.logoutBtn} onClick={handleLogout}>
                    Logout
                  </button>
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
                  <span style={currentStyles.actionMenuIcon}>✏️</span>
                  Rename
                </button>
                <button
                  style={{...currentStyles.actionMenuItem, ...currentStyles.actionMenuItemDanger}}
                  onClick={() => handleDeleteClick(selectedChatForActions.id)}
                >
                  <span style={currentStyles.actionMenuIcon}>🗑️</span>
                  Delete
                </button>
                <button
                  style={currentStyles.actionMenuItem}
                  onClick={() => setShowChatActionsModal(false)}
                >
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
          <div style={currentStyles.modalOverlay} />
          <div style={currentStyles.deleteModalContainer}>
            <div style={currentStyles.deleteModalContent}>
              <div style={currentStyles.deleteModalHeader}>
                <h3 style={currentStyles.deleteModalTitle}>Delete Chat?</h3>
              </div>
              <div style={currentStyles.deleteModalBody}>
                <p style={currentStyles.deleteModalText}>
                  Are you sure you want to delete this chat? This action cannot be undone.
                </p>
              </div>
              <div style={currentStyles.deleteModalFooter}>
                <button
                  onClick={handleDeleteCancel}
                  style={currentStyles.deleteCancelBtn}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  style={currentStyles.deleteConfirmBtn}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// Light Mode Styles
const lightStyles: { [key: string]: React.CSSProperties } = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f9f9f9',
  },
  loadingSpinner: {
    fontSize: '18px',
    color: '#666',
  },
  limitWarning: {
    padding: '12px 16px',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '8px',
    marginBottom: '12px',
    fontSize: '14px',
    color: '#f59e0b',
  },
  upgradeLink: {
    color: '#667eea',
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: 'underline',
  },
  messageLimitInfo: {
    fontSize: '14px',
    color: '#666',
    marginTop: '16px',
  },
  remainingMessages: {
    color: '#999',
    fontSize: '11px',
  },
  authContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: '#f9f9f9',
  },
  authCard: {
    width: '100%',
    maxWidth: '420px',
    padding: '48px 40px',
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  authLogo: {
    textAlign: 'center' as const,
    marginBottom: '32px',
  },
  logoIcon: {
    width: '64px',
    height: '64px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '16px',
    margin: '0 auto 16px',
  },
  authTitle: {
    fontSize: '28px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#000',
  },
  authSubtitle: {
    fontSize: '14px',
    color: '#666',
  },
  authError: {
    padding: '12px 16px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderLeft: '4px solid #ef4444',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '14px',
    marginBottom: '24px',
  },
  authSuccess: {
    padding: '12px 16px',
    background: 'rgba(16, 185, 129, 0.1)',
    borderLeft: '4px solid #10b981',
    borderRadius: '8px',
    color: '#10b981',
    fontSize: '14px',
    marginBottom: '24px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#000',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '14px',
    background: 'white',
    color: '#000',
    boxSizing: 'border-box' as const,
  },
  authBtn: {
    width: '100%',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
  },
  authSwitch: {
    textAlign: 'center' as const,
    marginTop: '24px',
    fontSize: '14px',
    color: '#666',
  },
  authLink: {
    color: '#667eea',
    cursor: 'pointer',
    fontWeight: 600,
  },
  app: {
    display: 'flex',
    height: '100vh',
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
  },
  mobileMenuBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
    color: '#000',
    marginRight: '12px',
  },
  mobileMenuDots: {
    position: 'absolute' as const,
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '18px',
    padding: '4px 8px',
    color: '#666',
  },
  sidebar: {
    width: '260px',
    background: '#f9f9f9',
    borderRight: '1px solid #e0e0e0',
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
    borderBottom: '1px solid #e0e0e0',
  },
  sidebarToggle: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px',
    color: '#000',
  },
  brand: {
    fontWeight: 600,
    fontSize: '16px',
    color: '#000',
    whiteSpace: 'nowrap' as const,
  },
  section: {
    padding: '12px',
    borderBottom: '1px solid #e0e0e0',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '4px',
  },
  navIcon: {
    fontSize: '18px',
    width: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: '14px',
    color: '#000',
  },
  sectionLabel: {
    padding: '12px 16px 8px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#666',
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
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#000',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    position: 'relative' as const,
  },
  recentItemActive: {
    background: '#e8e8e8',
    fontWeight: 500,
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
    gap: '4px',
    width: '100%',
    padding: '4px',
  },
  renameInput: {
    flex: 1,
    padding: '6px 8px',
    border: '1px solid #667eea',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
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
    borderTop: '1px solid #e0e0e0',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
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
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'white',
    overflow: 'hidden',
    maxWidth: '100%',
  },
  topBar: {
    padding: '12px 16px',
    borderBottom: '1px solid #e0e0e0',
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
    fontSize: '14px',
    fontWeight: 600,
    color: '#000',
    whiteSpace: 'nowrap' as const,
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
    borderRadius: '8px',
  },
  chatWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    maxWidth: '100%',
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
    width: '64px',
    height: '64px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '16px',
    marginBottom: '24px',
  },
  greetingText: {
    fontSize: '28px',
    fontWeight: 600,
    color: '#000',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  chatMessages: {
    maxWidth: '768px',
    width: '100%',
    margin: '0 auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    boxSizing: 'border-box' as const,
  },
  chatMessagesMobile: {
    padding: '16px 24px',
    maxWidth: '100%',
    boxSizing: 'border-box' as const,
  },
  messageRowUser: {
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-end',
    maxWidth: '100%',
  },
  messageRowAssistant: {
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-start',
    maxWidth: '100%',
  },
  messageBubbleUser: {
    maxWidth: '85%',
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '15px',
    lineHeight: 1.5,
    wordWrap: 'break-word' as const,
    background: '#000',
    color: '#fff',
    boxSizing: 'border-box' as const,
  },
  messageBubbleAssistant: {
    maxWidth: '85%',
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '15px',
    lineHeight: 1.6,
    wordWrap: 'break-word' as const,
    background: '#f4f4f4',
    color: '#000',
    boxSizing: 'border-box' as const,
  },
  messageText: {
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  typingIndicator: {
    display: 'flex',
    gap: '6px',
    padding: '4px 0',
  },
  typingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#666',
  },
  inputArea: {
    borderTop: '1px solid #e0e0e0',
    background: 'white',
    padding: '0',
    maxWidth: '100%',
  },
  inputWrapper: {
    maxWidth: '768px',
    width: '100%',
    margin: '0 auto',
    padding: '16px 24px',
    boxSizing: 'border-box' as const,
  },
  inputWrapperMobile: {
    padding: '12px 16px',
    maxWidth: '100%',
    boxSizing: 'border-box' as const,
  },
  inputCard: {
    width: '100%',
    background: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '24px',
    padding: '6px 8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    boxSizing: 'border-box' as const,
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
    fontSize: '15px',
    fontFamily: 'inherit',
    resize: 'none' as const,
    outline: 'none',
    color: '#000',
    padding: '6px 8px',
    maxHeight: '120px',
    minHeight: '24px',
    lineHeight: '1.5',
    width: '100%',
  },
  sendBtn: {
    width: '32px',
    height: '32px',
    minWidth: '32px',
    minHeight: '32px',
    border: 'none',
    borderRadius: '50%',
    background: '#000',
    color: 'white',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  modelSelect: {
    padding: '8px 0 0',
    textAlign: 'center' as const,
    fontSize: '11px',
    color: '#666',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  modalContainer: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1000,
    maxWidth: '750px',
    width: '90%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
  },
  modalContent: {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  modalHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#000',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: '32px',
    cursor: 'pointer',
    color: '#666',
    lineHeight: 1,
    padding: 0,
  },
  modalBody: {
    padding: '20px 24px',
  },
  modalSection: {
    marginBottom: '24px',
  },
  modalSectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#000',
  },
  modalSubsectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '12px',
    marginTop: '16px',
    color: '#000',
  },
  modalInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid #e0e0e0',
    fontSize: '14px',
  },
  modalLabel: {
    fontWeight: 600,
    color: '#000',
  },
  modalValue: {
    color: '#666',
  },
  planCurrentBadge: {
    padding: '20px',
    background: '#f9f9f9',
    borderRadius: '12px',
    textAlign: 'center' as const,
    marginBottom: '16px',
  },
  planBadgeLarge: {
    display: 'inline-block',
    padding: '6px 16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    borderRadius: '24px',
    fontWeight: 600,
    fontSize: '14px',
    marginBottom: '8px',
  },
  planDescription: {
    color: '#666',
    fontSize: '13px',
    marginBottom: '12px',
  },
  progressBarContainer: {
    width: '100%',
    height: '8px',
    background: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  planCard: {
    padding: '16px',
    background: '#f9f9f9',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    minHeight: '220px',
  },
  planCardActive: {
    borderColor: '#667eea',
    background: 'rgba(102, 126, 234, 0.05)',
  },
  planCardTitle: {
    fontSize: '15px',
    fontWeight: 700,
    marginBottom: '6px',
    color: '#000',
  },
  planPrice: {
    fontSize: '22px',
    fontWeight: 700,
    margin: '8px 0 12px',
    color: '#000',
  },
  planPricePeriod: {
    fontSize: '13px',
    fontWeight: 400,
    color: '#666',
  },
  planFeatures: {
    listStyle: 'none',
    marginBottom: '14px',
    padding: 0,
  },
  planFeature: {
    padding: '4px 0',
    fontSize: '12px',
    color: '#666',
  },
  planBtn: {
    width: '100%',
    padding: '8px 12px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  planBtnSpacer: {
    width: '100%',
    height: '32px',
  },
  logoutBtn: {
    width: '100%',
    padding: '10px 20px',
    background: 'transparent',
    color: '#ef4444',
    border: '2px solid #ef4444',
    borderRadius: '8px',
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
    background: 'white',
    borderRadius: '16px 16px 0 0',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.2)',
  },
  actionsModalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #e0e0e0',
  },
  actionsModalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#000',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  actionsModalBody: {
    padding: '8px',
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
    color: '#000',
    borderRadius: '8px',
  },
  actionMenuItemDanger: {
    color: '#ef4444',
  },
  actionMenuIcon: {
    fontSize: '18px',
    width: '24px',
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
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  deleteModalHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0',
  },
  deleteModalTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#000',
    margin: 0,
  },
  deleteModalBody: {
    padding: '20px 24px',
  },
  deleteModalText: {
    fontSize: '15px',
    color: '#666',
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
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#000',
  },
  deleteConfirmBtn: {
    padding: '10px 20px',
    background: '#ef4444',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'white',
  },
};

// Dark Mode Styles
const darkStyles: { [key: string]: React.CSSProperties } = {
  ...lightStyles,
  loadingContainer: {
    ...lightStyles.loadingContainer,
    background: '#1a1a1a',
  },
  loadingSpinner: {
    ...lightStyles.loadingSpinner,
    color: '#999',
  },
  authContainer: {
    ...lightStyles.authContainer,
    background: '#1a1a1a',
  },
  authCard: {
    ...lightStyles.authCard,
    background: '#2a2a2a',
  },
  authTitle: {
    ...lightStyles.authTitle,
    color: '#fff',
  },
  authSubtitle: {
    ...lightStyles.authSubtitle,
    color: '#999',
  },
  label: {
    ...lightStyles.label,
    color: '#fff',
  },
  input: {
    ...lightStyles.input,
    background: '#1a1a1a',
    border: '1px solid #3a3a3a',
    color: '#fff',
  },
  authSwitch: {
    ...lightStyles.authSwitch,
    color: '#999',
  },
  authSuccess: {
    ...lightStyles.authSuccess,
    background: 'rgba(16, 185, 129, 0.2)',
  },
  mobileMenuBtn: {
    ...lightStyles.mobileMenuBtn,
    color: '#fff',
  },
  mobileMenuDots: {
    ...lightStyles.mobileMenuDots,
    color: '#999',
  },
  sidebar: {
    ...lightStyles.sidebar,
    background: '#1a1a1a',
    borderRight: '1px solid #3a3a3a',
  },
  sidebarHeader: {
    ...lightStyles.sidebarHeader,
    borderBottom: '1px solid #3a3a3a',
  },
  sidebarToggle: {
    ...lightStyles.sidebarToggle,
    color: '#fff',
  },
  brand: {
    ...lightStyles.brand,
    color: '#fff',
  },
  section: {
    ...lightStyles.section,
    borderBottom: '1px solid #3a3a3a',
  },
  navText: {
    ...lightStyles.navText,
    color: '#fff',
  },
  sectionLabel: {
    ...lightStyles.sectionLabel,
    color: '#999',
  },
  recentItem: {
    ...lightStyles.recentItem,
    color: '#fff',
  },
  recentItemActive: {
    ...lightStyles.recentItemActive,
    background: '#3a3a3a',
  },
  renameInput: {
    ...lightStyles.renameInput,
    background: '#2a2a2a',
    color: '#fff',
    border: '1px solid #667eea',
  },
  sidebarFooter: {
    ...lightStyles.sidebarFooter,
    borderTop: '1px solid #3a3a3a',
  },
  main: {
    ...lightStyles.main,
    background: '#2a2a2a',
  },
  topBar: {
    ...lightStyles.topBar,
    borderBottom: '1px solid #3a3a3a',
  },
  modelBadge: {
    ...lightStyles.modelBadge,
    color: '#fff',
  },
  greetingText: {
    ...lightStyles.greetingText,
    color: '#fff',
  },
  messageLimitInfo: {
    ...lightStyles.messageLimitInfo,
    color: '#999',
  },
  messageBubbleUser: {
    ...lightStyles.messageBubbleUser,
    background: '#3a3a3a',
  },
  messageBubbleAssistant: {
    ...lightStyles.messageBubbleAssistant,
    background: '#1a1a1a',
    color: '#fff',
  },
  inputArea: {
    ...lightStyles.inputArea,
    background: '#2a2a2a',
    borderTop: '1px solid #3a3a3a',
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
    color: '#999',
  },
  remainingMessages: {
    ...lightStyles.remainingMessages,
    color: '#666',
  },
  modalContent: {
    ...lightStyles.modalContent,
    background: '#2a2a2a',
  },
  modalTitle: {
    ...lightStyles.modalTitle,
    color: '#fff',
  },
  modalCloseBtn: {
    ...lightStyles.modalCloseBtn,
    color: '#999',
  },
  modalHeader: {
    ...lightStyles.modalHeader,
    borderBottom: '1px solid #3a3a3a',
  },
  modalSectionTitle: {
    ...lightStyles.modalSectionTitle,
    color: '#fff',
  },
  modalSubsectionTitle: {
    ...lightStyles.modalSubsectionTitle,
    color: '#fff',
  },
  modalInfoRow: {
    ...lightStyles.modalInfoRow,
    borderBottom: '1px solid #3a3a3a',
  },
  modalLabel: {
    ...lightStyles.modalLabel,
    color: '#fff',
  },
  modalValue: {
    ...lightStyles.modalValue,
    color: '#999',
  },
  planCurrentBadge: {
    ...lightStyles.planCurrentBadge,
    background: '#1a1a1a',
  },
  planDescription: {
    ...lightStyles.planDescription,
    color: '#999',
  },
  progressBarContainer: {
    ...lightStyles.progressBarContainer,
    background: '#3a3a3a',
  },
  planCard: {
    ...lightStyles.planCard,
    background: '#1a1a1a',
    border: '2px solid #3a3a3a',
  },
  planCardTitle: {
    ...lightStyles.planCardTitle,
    color: '#fff',
  },
  planPrice: {
    ...lightStyles.planPrice,
    color: '#fff',
  },
  planPricePeriod: {
    ...lightStyles.planPricePeriod,
    color: '#999',
  },
  planFeature: {
    ...lightStyles.planFeature,
    color: '#999',
  },
  actionsModalContent: {
    ...lightStyles.actionsModalContent,
    background: '#2a2a2a',
  },
  actionsModalHeader: {
    ...lightStyles.actionsModalHeader,
    borderBottom: '1px solid #3a3a3a',
  },
  actionsModalTitle: {
    ...lightStyles.actionsModalTitle,
    color: '#fff',
  },
  actionMenuItem: {
    ...lightStyles.actionMenuItem,
    color: '#fff',
  },
  deleteModalContent: {
    ...lightStyles.deleteModalContent,
    background: '#2a2a2a',
  },
  deleteModalHeader: {
    ...lightStyles.deleteModalHeader,
    borderBottom: '1px solid #3a3a3a',
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
    border: '1px solid #3a3a3a',
    color: '#fff',
  },
};

// Wrap in Suspense for useSearchParams
export default function Home() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', 
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