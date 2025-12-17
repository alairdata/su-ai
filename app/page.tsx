"use client";

import React, { useEffect, useState, useRef } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
};

type User = {
  id: string;
  email: string;
  password: string;
  name: string;
  plan: "Free" | "Pro" | "Enterprise";
  createdAt: number;
};

type View = "login" | "signup" | "chat";

export default function Home() {
  const [currentView, setCurrentView] = useState<View>("login");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  
  // Auth form states
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");

  // Chat states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Ref for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, isLoading, currentChatId]);

  // Load user session on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedUserId = window.localStorage.getItem("currentUserId");
      if (savedUserId) {
        const users = getUsers();
        const user = users.find((u) => u.id === savedUserId);
        if (user) {
          setCurrentUser(user);
          setCurrentView("chat");
          loadUserData(savedUserId);
        }
      }
    } catch {
      // ignore errors
    }
  }, []);

  // Persist theme
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // User management functions
  const getUsers = (): User[] => {
    if (typeof window === "undefined") return [];
    const users = window.localStorage.getItem("users");
    return users ? JSON.parse(users) : [];
  };

  const saveUsers = (users: User[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("users", JSON.stringify(users));
  };

  const loadUserData = (userId: string) => {
    if (typeof window === "undefined") return;
    const savedChats = window.localStorage.getItem(`chats_${userId}`);
    const savedCurrentId = window.localStorage.getItem(`currentChatId_${userId}`);
    const savedTheme = window.localStorage.getItem("theme") as "light" | "dark" | null;

    if (savedChats) {
      setChats(JSON.parse(savedChats));
    }
    if (savedCurrentId) {
      setCurrentChatId(savedCurrentId);
    }
    if (savedTheme) {
      setTheme(savedTheme);
    }
  };

  // Persist chats for current user
  useEffect(() => {
    if (typeof window === "undefined" || !currentUser) return;
    window.localStorage.setItem(`chats_${currentUser.id}`, JSON.stringify(chats));
  }, [chats, currentUser]);

  // Persist current chat id for current user
  useEffect(() => {
    if (typeof window === "undefined" || !currentUser) return;
    if (currentChatId) {
      window.localStorage.setItem(`currentChatId_${currentUser.id}`, currentChatId);
    } else {
      window.localStorage.removeItem(`currentChatId_${currentUser.id}`);
    }
  }, [currentChatId, currentUser]);

  // Auth handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const users = getUsers();
    const user = users.find(
      (u) => u.email === authEmail && u.password === authPassword
    );

    if (user) {
      setCurrentUser(user);
      window.localStorage.setItem("currentUserId", user.id);
      setCurrentView("chat");
      loadUserData(user.id);
      setAuthEmail("");
      setAuthPassword("");
    } else {
      setAuthError("Invalid email or password");
    }
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters");
      return;
    }

    const users = getUsers();
    
    if (users.find((u) => u.email === authEmail)) {
      setAuthError("Email already exists");
      return;
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      email: authEmail,
      password: authPassword,
      name: authName,
      plan: "Free",
      createdAt: Date.now(),
    };

    users.push(newUser);
    saveUsers(users);
    
    setCurrentUser(newUser);
    window.localStorage.setItem("currentUserId", newUser.id);
    setCurrentView("chat");
    setAuthEmail("");
    setAuthPassword("");
    setAuthName("");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setChats([]);
    setCurrentChatId(null);
    setShowAccountModal(false);
    window.localStorage.removeItem("currentUserId");
    setCurrentView("login");
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const upgradePlan = (newPlan: "Free" | "Pro" | "Enterprise") => {
    if (!currentUser) return;
    
    const users = getUsers();
    const updatedUsers = users.map((u) =>
      u.id === currentUser.id ? { ...u, plan: newPlan } : u
    );
    saveUsers(updatedUsers);
    setCurrentUser({ ...currentUser, plan: newPlan });
  };

  const currentChat = currentChatId
    ? chats.find((c) => c.id === currentChatId) || null
    : null;

  const messages: Message[] = currentChat?.messages ?? [];
  const showGreeting = !currentChat || messages.length === 0;

  const generateTitleFromText = (text: string): string => {
    const t = text.toLowerCase();

    if (/\b(hi|hello|hey|heyy|hiii)\b/.test(t)) return "User greeting";
    if (t.includes("sql") || t.includes("query")) return "SQL question";
    if (t.includes("data") && t.includes("story")) return "Data storytelling";
    if (t.includes("weight") || t.includes("gym") || t.includes("body"))
      return "Body & wellness chat";

    const trimmed = text.trim();
    if (!trimmed) return `Chat ${chats.length + 1}`;
    return trimmed.length > 30 ? trimmed.slice(0, 30) + "..." : trimmed;
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setInput("");
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setInput("");
    setIsLoading(true);

    let activeChatId: string;

    if (!currentChat) {
      activeChatId = Date.now().toString();
      const title = generateTitleFromText(userMessage.content);
      const newChat: Chat = {
        id: activeChatId,
        title,
        messages: [userMessage],
      };
      setChats((prev) => [newChat, ...prev]);
      setCurrentChatId(activeChatId);
    } else {
      activeChatId = currentChat.id;
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? { ...c, messages: [...c.messages, userMessage] }
            : c
        )
      );
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });

      const data = await res.json();
      const botMessage: Message = {
        role: "assistant",
        content: data.reply ?? "No reply from Claude.",
      };

      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? { ...c, messages: [...c.messages, botMessage] }
            : c
        )
      );
    } catch (err) {
      console.error(err);
      const errorMessage: Message = {
        role: "assistant",
        content: "Something went wrong talking to Claude.",
      };
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? { ...c, messages: [...c.messages, errorMessage] }
            : c
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectChat = (id: string) => {
    setCurrentChatId(id);
  };

  // Render login view
  if (currentView === "login") {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={styles.authLogo}>
            <div style={styles.logoIcon}></div>
            <h1 style={styles.authTitle}>UnFiltered-AI</h1>
            <p style={styles.authSubtitle}>Sign in to continue</p>
          </div>

          {authError && <div style={styles.authError}>{authError}</div>}

          <form onSubmit={handleLogin}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={styles.input}
              />
            </div>
            <button type="submit" style={styles.authBtn}>
              Sign In
            </button>
          </form>

          <div style={styles.authSwitch}>
            Don't have an account?{" "}
            <a onClick={() => setCurrentView("signup")} style={styles.authLink}>
              Sign up
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Render signup view
  if (currentView === "signup") {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={styles.authLogo}>
            <div style={styles.logoIcon}></div>
            <h1 style={styles.authTitle}>UnFiltered-AI</h1>
            <p style={styles.authSubtitle}>Create your account</p>
          </div>

          {authError && <div style={styles.authError}>{authError}</div>}

          <form onSubmit={handleSignup}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Name</label>
              <input
                type="text"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="Your name"
                required
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
                style={styles.input}
              />
            </div>
            <button type="submit" style={styles.authBtn}>
              Create Account
            </button>
          </form>

          <div style={styles.authSwitch}>
            Already have an account?{" "}
            <a onClick={() => setCurrentView("login")} style={styles.authLink}>
              Sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Render chat view
  return (
    <>
      <div style={styles.app}>
        <aside style={{...styles.sidebar, ...(sidebarCollapsed ? styles.sidebarCollapsed : {})}}>
          <div style={styles.sidebarTop}>
            <div style={styles.sidebarHeader}>
              <button
                style={styles.sidebarToggle}
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
              >
                ☰
              </button>
              <div style={{...styles.brand, ...(sidebarCollapsed ? {display: 'none'} : {})}}>UnFiltered-AI</div>
            </div>

            <div style={styles.section}>
              <div style={styles.navItem} onClick={handleNewChat}>
                <div style={styles.navIcon}>+</div>
                <div style={{...styles.navText, ...(sidebarCollapsed ? {display: 'none'} : {})}}>New chat</div>
              </div>
            </div>

            <div style={{...styles.sectionLabel, ...(sidebarCollapsed ? {display: 'none'} : {})}}>Recent chats</div>
            <div style={{...styles.recentsList, ...(sidebarCollapsed ? {display: 'none'} : {})}}>
              {chats.length === 0 && (
                <div style={{...styles.recentItem, opacity: 0.6}}>
                  No chats yet
                </div>
              )}
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  style={{
                    ...styles.recentItem,
                    ...(chat.id === currentChatId ? styles.recentItemActive : {})
                  }}
                  onClick={() => handleSelectChat(chat.id)}
                >
                  {chat.title}
                </div>
              ))}
            </div>
          </div>

          <div style={styles.sidebarFooter} onClick={() => setShowAccountModal(true)}>
            <div style={styles.avatar}>
              {currentUser?.name.substring(0, 2).toUpperCase()}
            </div>
            <div style={{...styles.userInfo, ...(sidebarCollapsed ? {display: 'none'} : {})}}>
              <div style={{ fontSize: 13 }}>{currentUser?.name}</div>
              <div style={{ fontSize: 11, color: "#666" }}>
                {currentUser?.plan} plan
              </div>
            </div>
          </div>
        </aside>

        <main style={styles.main}>
          <div style={styles.topBar}>
            <div style={styles.topBarLeft}>
              <div style={styles.modelBadge}>UnFiltered-AI 5.2</div>
            </div>
            <div style={styles.topBarRight}>
              <button style={styles.iconBtn} onClick={toggleTheme} title="Toggle theme">
                {theme === "light" ? "🌙" : "☀️"}
              </button>
            </div>
          </div>

          <div style={styles.chatWrapper}>
            <div style={styles.messagesArea}>
              {showGreeting && (
                <div style={styles.emptyState}>
                  <div style={styles.greetingLogo}></div>
                  <div style={styles.greetingText}>What's good?</div>
                </div>
              )}

              {!showGreeting && (
                <div style={styles.chatMessages}>
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      style={m.role === "user" ? styles.messageRowUser : styles.messageRowAssistant}
                    >
                      <div
                        style={m.role === "user" ? styles.messageBubbleUser : styles.messageBubbleAssistant}
                      >
                        <div style={styles.messageText}>{m.content}</div>
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div style={styles.messageRowAssistant}>
                      <div style={styles.messageBubbleAssistant}>
                        <div style={styles.typingIndicator}>
                          <span style={styles.typingDot} />
                          <span style={{...styles.typingDot, animationDelay: '0.2s'}} />
                          <span style={{...styles.typingDot, animationDelay: '0.4s'}} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Invisible element at the bottom for auto-scroll */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div style={styles.inputArea}>
              <div style={styles.inputWrapper}>
                <div style={styles.inputCard}>
                  <div style={styles.inputRow}>
                    <textarea
                      rows={1}
                      placeholder="What's up? Time to spill it..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading}
                      style={styles.textarea}
                    />
                    <button
                      style={{
                        ...styles.sendBtn,
                        ...(isLoading || !input.trim() ? styles.sendBtnDisabled : {})
                      }}
                      onClick={handleSend}
                      disabled={isLoading || !input.trim()}
                    >
                      ↑
                    </button>
                  </div>
                </div>
                <div style={styles.modelSelect}>
                  <span>UnFiltered-AI can make mistakes. Check important info.</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Account Modal - Only closes on X button click */}
      {showAccountModal && (
        <>
          <div style={styles.modalOverlay} />
          <div style={styles.modalContainer}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Account Settings</h2>
                <button style={styles.modalCloseBtn} onClick={() => setShowAccountModal(false)}>
                  ×
                </button>
              </div>

              <div style={styles.modalBody}>
                <div style={styles.modalSection}>
                  <h3 style={styles.modalSectionTitle}>Profile Information</h3>
                  <div style={styles.modalInfoRow}>
                    <span style={styles.modalLabel}>Name:</span>
                    <span style={styles.modalValue}>{currentUser?.name}</span>
                  </div>
                  <div style={styles.modalInfoRow}>
                    <span style={styles.modalLabel}>Email:</span>
                    <span style={styles.modalValue}>{currentUser?.email}</span>
                  </div>
                  <div style={styles.modalInfoRow}>
                    <span style={styles.modalLabel}>Member since:</span>
                    <span style={styles.modalValue}>
                      {currentUser && new Date(currentUser.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div style={styles.modalSection}>
                  <h3 style={styles.modalSectionTitle}>Current Plan</h3>
                  <div style={styles.planCurrentBadge}>
                    <div style={styles.planBadgeLarge}>{currentUser?.plan}</div>
                    <div style={styles.planDescription}>
                      {currentUser?.plan === "Free" && "10 messages per day"}
                      {currentUser?.plan === "Pro" && "100 messages per day"}
                      {currentUser?.plan === "Enterprise" && "Unlimited messages"}
                    </div>
                  </div>

                  <h4 style={styles.modalSubsectionTitle}>Upgrade Your Plan</h4>
                  <div style={styles.plansGrid}>
                    <div style={{...styles.planCard, ...(currentUser?.plan === "Free" ? styles.planCardActive : {})}}>
                      <h5 style={styles.planCardTitle}>Free</h5>
                      <div style={styles.planPrice}>$0<span style={styles.planPricePeriod}>/mo</span></div>
                      <ul style={styles.planFeatures}>
                        <li style={styles.planFeature}>✓ 10 messages/day</li>
                        <li style={styles.planFeature}>✓ Basic support</li>
                      </ul>
                      {currentUser?.plan !== "Free" && (
                        <button
                          style={styles.planBtn}
                          onClick={() => {
                            upgradePlan("Free");
                            setShowAccountModal(false);
                          }}
                        >
                          Downgrade to Free
                        </button>
                      )}
                      {currentUser?.plan === "Free" && (
                        <div style={styles.planBtnCurrent}>Current Plan</div>
                      )}
                    </div>

                    <div style={{...styles.planCard, ...(currentUser?.plan === "Pro" ? styles.planCardActive : {})}}>
                      <h5 style={styles.planCardTitle}>Pro</h5>
                      <div style={styles.planPrice}>$19<span style={styles.planPricePeriod}>/mo</span></div>
                      <ul style={styles.planFeatures}>
                        <li style={styles.planFeature}>✓ 100 messages/day</li>
                        <li style={styles.planFeature}>✓ Priority support</li>
                        <li style={styles.planFeature}>✓ Advanced features</li>
                      </ul>
                      {currentUser?.plan !== "Pro" && (
                        <button
                          style={styles.planBtn}
                          onClick={() => {
                            upgradePlan("Pro");
                            setShowAccountModal(false);
                          }}
                        >
                          {currentUser?.plan === "Free" ? "Upgrade to Pro" : "Switch to Pro"}
                        </button>
                      )}
                      {currentUser?.plan === "Pro" && (
                        <div style={styles.planBtnCurrent}>Current Plan</div>
                      )}
                    </div>

                    <div style={{...styles.planCard, ...(currentUser?.plan === "Enterprise" ? styles.planCardActive : {})}}>
                      <h5 style={styles.planCardTitle}>Enterprise</h5>
                      <div style={styles.planPrice}>$99<span style={styles.planPricePeriod}>/mo</span></div>
                      <ul style={styles.planFeatures}>
                        <li style={styles.planFeature}>✓ Unlimited messages</li>
                        <li style={styles.planFeature}>✓ 24/7 support</li>
                        <li style={styles.planFeature}>✓ Custom integrations</li>
                      </ul>
                      {currentUser?.plan !== "Enterprise" && (
                        <button
                          style={styles.planBtn}
                          onClick={() => {
                            upgradePlan("Enterprise");
                            setShowAccountModal(false);
                          }}
                        >
                          Upgrade to Enterprise
                        </button>
                      )}
                      {currentUser?.plan === "Enterprise" && (
                        <div style={styles.planBtnCurrent}>Current Plan</div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={styles.modalSection}>
                  <button style={styles.logoutBtn} onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// Inline styles object
const styles: { [key: string]: React.CSSProperties } = {
  // Auth styles
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
  // App styles
  app: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  sidebar: {
    width: '260px',
    background: '#f9f9f9',
    borderRight: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'width 0.3s ease',
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
    transition: 'opacity 0.3s ease',
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
    transition: 'opacity 0.3s ease',
  },
  sectionLabel: {
    padding: '12px 16px 8px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    transition: 'opacity 0.3s ease',
  },
  recentsList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 12px',
    transition: 'opacity 0.3s ease',
  },
  recentItem: {
    padding: '10px 12px',
    marginBottom: '4px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#000',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  recentItemActive: {
    background: '#e8e8e8',
    fontWeight: 500,
  },
  sidebarFooter: {
    padding: '16px',
    borderTop: '1px solid #e0e0e0',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    transition: 'background 0.2s',
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
    transition: 'opacity 0.3s ease',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'white',
    overflow: 'hidden',
  },
  topBar: {
    padding: '12px 24px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  modelBadge: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#000',
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '8px 12px',
    borderRadius: '8px',
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
    display: 'flex',
    flexDirection: 'column' as const,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingLogo: {
    width: '64px',
    height: '64px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '16px',
    marginBottom: '24px',
  },
  greetingText: {
    fontSize: '32px',
    fontWeight: 600,
    color: '#000',
    marginBottom: '48px',
  },
  chatMessages: {
    maxWidth: '768px',
    width: '100%',
    margin: '0 auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
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
    fontSize: '15px',
    lineHeight: 1.5,
    wordWrap: 'break-word' as const,
    background: '#000',
    color: '#fff',
  },
  messageBubbleAssistant: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '15px',
    lineHeight: 1.6,
    wordWrap: 'break-word' as const,
    background: '#f4f4f4',
    color: '#000',
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
  },
  inputWrapper: {
    maxWidth: '768px',
    width: '100%',
    margin: '0 auto',
    padding: '16px 24px',
  },
  inputCard: {
    width: '100%',
    background: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '24px',
    padding: '8px 12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
  },
  textarea: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: '15px',
    resize: 'none' as const,
    outline: 'none',
    color: '#000',
    padding: '8px',
    maxHeight: '200px',
  },
  sendBtn: {
    width: '32px',
    height: '32px',
    border: 'none',
    borderRadius: '50%',
    background: '#000',
    color: 'white',
    fontSize: '18px',
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
    padding: '12px 0 0',
    textAlign: 'center' as const,
    fontSize: '12px',
    color: '#666',
  },
  // Centered Modal Window - Stays open until X is clicked
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
    maxWidth: '900px',
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
  },
  modalContent: {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  modalHeader: {
    padding: '24px 32px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '24px',
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
    padding: '32px',
  },
  modalSection: {
    marginBottom: '32px',
  },
  modalSectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#000',
  },
  modalSubsectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginTop: '24px',
    marginBottom: '16px',
    color: '#000',
  },
  modalInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #e0e0e0',
  },
  modalLabel: {
    fontWeight: 600,
    color: '#000',
  },
  modalValue: {
    color: '#666',
  },
  planCurrentBadge: {
    padding: '24px',
    background: '#f9f9f9',
    borderRadius: '12px',
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  planBadgeLarge: {
    display: 'inline-block',
    padding: '8px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    borderRadius: '24px',
    fontWeight: 600,
    fontSize: '18px',
    marginBottom: '12px',
  },
  planDescription: {
    color: '#666',
    fontSize: '14px',
  },
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
  },
  planCard: {
    padding: '24px',
    background: '#f9f9f9',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    transition: 'all 0.2s',
  },
  planCardActive: {
    borderColor: '#667eea',
    background: 'rgba(102, 126, 234, 0.05)',
  },
  planCardTitle: {
    fontSize: '18px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#000',
  },
  planPrice: {
    fontSize: '28px',
    fontWeight: 700,
    margin: '12px 0 20px',
    color: '#000',
  },
  planPricePeriod: {
    fontSize: '16px',
    fontWeight: 400,
    color: '#666',
  },
  planFeatures: {
    listStyle: 'none',
    marginBottom: '20px',
    padding: 0,
  },
  planFeature: {
    padding: '6px 0',
    fontSize: '14px',
    color: '#666',
  },
  planBtn: {
    width: '100%',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  planBtnCurrent: {
    width: '100%',
    padding: '10px 20px',
    background: 'transparent',
    color: '#667eea',
    border: '2px solid #667eea',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    textAlign: 'center' as const,
  },
  logoutBtn: {
    width: '100%',
    padding: '12px 24px',
    background: 'transparent',
    color: '#ef4444',
    border: '2px solid #ef4444',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};