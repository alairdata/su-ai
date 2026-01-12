"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useChats } from "./hooks/useChats";
import { useTheme } from "./hooks/useTheme";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";

type View = "auth" | "chat";
type AuthMode = "signin" | "signup";

function HomePage() {
  const { data: session, status, update: updateSession } = useSession();
  const { theme, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  
  const [currentView, setCurrentView] = useState<View>("auth");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showCheckEmail, setShowCheckEmail] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showResetEmailSent, setShowResetEmailSent] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
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
      setAuthMode('signin');
    } else if (error === 'invalid-token') {
      setAuthError('Invalid or expired verification link.');
    } else if (error === 'token-expired') {
      setAuthError('Verification link expired. Please sign up again.');
    } else if (error === 'verification-failed') {
      setAuthError('Verification failed. Please try again.');
    } else if (error === 'OAuthAccountNotLinked') {
      setAuthError('This email is already registered with a different sign-in method.');
    }
  }, [searchParams]);

  // Check if user is new (OAuth first-time user)
  useEffect(() => {
    if (session?.user && (session.user as any).isNewUser) {
      setShowWelcome(true);
    }
  }, [session]);

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
      setCurrentView("auth");
    }
  }, [isAuthenticated, isAuthLoading]);

  const messages = currentChat?.messages ?? [];
  const showGreeting = !currentChat || messages.length === 0;
  const remainingMessages = getRemainingMessages();

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    const userName = session?.user?.name?.split(' ')[0] || '';

    const morningGreetings = [
      "Morning already?! Howdy!",
      "Coffee first. Talk later.",
      "Rise and grind!",
      "Morning! What's up?",
      "Brain loading... Go!",
      "Mornings suck. Anyway...",
    ];

    const afternoonGreetings = [
      "Afternoon slump? Got you.",
      "Post-lunch vibes. Shoot!",
      "PM mode. What's good?",
      "Still standing? Nice!",
      "Spice up the day!",
      "Lunch coma? Same. Go!",
    ];

    const eveningGreetings = [
      "Evening mode. Shoot!",
      "Sun's setting. Talk!",
      "Almost done? What's up?",
      "Golden hour. Thoughts?",
      "Wrapping up? Or nah?",
      "End of day grind!",
    ];

    const nightGreetings = [
      "Midnight oil? Respect.",
      "Night owl! What's up?",
      "Sleep's overrated. Go!",
      "Late night thoughts?",
      "Built different. Shoot!",
      "Insomnia gang! Talk.",
      "World's asleep. Not us!",
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
    return userName ? `${userName}! ${randomGreeting}` : randomGreeting;
  };

  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    setGreeting(getGreeting());
  }, [session, currentChat]);

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!session?.user) return 0;
    const limits = { Free: 50, Pro: 100, Enterprise: Infinity };
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

      // Show the check email screen
      setSignupEmail(authEmail);
      setShowCheckEmail(true);
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");

    } catch (error) {
      setAuthError("Signup failed. Please try again.");
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
        setResetEmail(forgotEmail);
        setShowResetEmailSent(true);
        setShowForgotPassword(false);
        setForgotEmail("");
      } else {
        setAuthError(data.error || "Failed to send reset email");
      }
    } catch (error) {
      setAuthError("Failed to send reset email. Please try again.");
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

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatTimestamp = (date: Date) => {
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
            <div style={currentStyles.logoIcon} className="auth-logo-glow">✦</div>
            <h1 style={currentStyles.authTitle}>UnFiltered-AI</h1>
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
                We've sent a verification link to
              </p>
              <p style={currentStyles.checkEmailAddress}>{signupEmail}</p>
              <p style={currentStyles.checkEmailSubtext}>
                Click the link in the email to verify your account. If you don't see it, check your spam folder.
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
                We've sent a password reset link to
              </p>
              <p style={currentStyles.checkEmailAddress}>{resetEmail}</p>
              <p style={currentStyles.checkEmailSubtext}>
                Click the link in the email to reset your password. The link expires in 1 hour. Don't forget to check your spam folder!
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
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
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
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
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
            <h2 style={currentStyles.checkEmailTitle}>Welcome to UnFiltered-AI!</h2>
            <p style={currentStyles.checkEmailText}>
              Your account has been created successfully.
            </p>
            <p style={currentStyles.checkEmailSubtext}>
              You're all set! Start chatting with our AI assistant and explore unlimited possibilities.
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
                  <div style={currentStyles.greetingLogo}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5"/>
                      <path d="M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <div style={currentStyles.greetingText}>{greeting}</div>
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
                      <div style={currentStyles.messageWrapper}>
                        <div
                          className="message-bubble"
                          style={m.role === "user" ? currentStyles.messageBubbleUser : currentStyles.messageBubbleAssistant}
                        >
                          <div style={currentStyles.messageText}>
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        </div>
                        <div style={currentStyles.messageActions}>
                          <button
                            onClick={() => handleCopyMessage(m.content, m.id || String(idx))}
                            style={currentStyles.actionButton}
                            title="Copy message"
                          >
                            {copiedMessageId === (m.id || String(idx)) ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            )}
                          </button>
                          {m.role === "assistant" && (
                            <button
                              onClick={() => {/* TODO: regenerate */}}
                              style={currentStyles.actionButton}
                              title="Regenerate response"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 4 23 10 17 10"/>
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                              </svg>
                            </button>
                          )}
                        </div>
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
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
                      {session?.user?.plan === "Free" && `${session.user.messagesUsedToday}/50 messages used today`}
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
                        <li style={currentStyles.planFeature}>✓ 50 messages/day</li>
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
    color: '#1a1a1a',
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
    padding: '20px',
    background: '#f8f9fa',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  authThemeToggle: {
    position: 'absolute' as const,
    top: '24px',
    right: '24px',
    background: '#fafafa',
    border: '1px solid #e0e0e0',
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
    background: 'rgba(255, 255, 255, 0.65)',
    borderRadius: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
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
    width: '48px',
    height: '48px',
    background: 'linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 100%)',
    border: '2px solid #d0d0d0',
    borderRadius: '14px',
    margin: '0 auto 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: '#666',
  },
  authTitle: {
    fontSize: '26px',
    fontWeight: 600,
    marginBottom: '6px',
    color: '#1a1a1a',
    letterSpacing: '-0.02em',
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
    background: '#f5f5f5',
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
    color: '#666',
    transition: 'all 0.3s ease',
  },
  tabActive: {
    background: '#fff',
    color: '#1a1a1a',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
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
    color: '#444',
  },
  forgotLink: {
    fontSize: '12px',
    color: '#666',
    cursor: 'pointer',
    fontWeight: 400,
    transition: 'color 0.3s ease',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    fontSize: '14px',
    background: '#fafafa',
    color: '#1a1a1a',
    boxSizing: 'border-box' as const,
    transition: 'all 0.3s ease',
    outline: 'none',
  },
  authBtn: {
    width: '100%',
    padding: '13px 24px',
    border: '1px solid #d0d0d0',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 100%)',
    color: '#1a1a1a',
    transition: 'all 0.3s ease',
    marginTop: '20px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '20px 0',
    color: '#999',
    fontSize: '12px',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: '#e0e0e0',
  },
  dividerText: {
    padding: '0 16px',
    fontSize: '12px',
    color: '#999',
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
    color: '#666',
  },
  authLink: {
    color: '#1a1a1a',
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
    background: 'linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 100%)',
    border: '2px solid #d0d0d0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
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
    border: '2px solid #d0d0d0',
    zIndex: 1,
  },
  checkEmailTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#1a1a1a',
    marginBottom: '12px',
  },
  checkEmailText: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '4px',
  },
  checkEmailAddress: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1a1a1a',
    marginBottom: '16px',
  },
  checkEmailSubtext: {
    fontSize: '13px',
    color: '#888',
    marginBottom: '24px',
    lineHeight: 1.5,
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
    border: '1px solid #1a1a1a',
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
    background: 'linear-gradient(135deg, #1a1a1a 0%, #3d3d3d 100%)',
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
    width: '72px',
    height: '72px',
    background: 'linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 100%)',
    border: '2px solid #d0d0d0',
    borderRadius: '20px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
  },
  greetingText: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#1a1a1a',
    marginBottom: '24px',
    textAlign: 'center' as const,
    maxWidth: '500px',
    lineHeight: 1.4,
  },
  chatMessages: {
    maxWidth: '768px',
    width: '100%',
    margin: '0 auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
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
  },
  messageRowAssistant: {
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-start',
    maxWidth: '100%',
  },
  messageBubbleUser: {
    maxWidth: '90%',
    padding: '14px 18px',
    borderRadius: '18px 18px 4px 18px',
    fontSize: '14px',
    lineHeight: 1.6,
    wordWrap: 'break-word' as const,
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
    color: '#fff',
    boxSizing: 'border-box' as const,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    alignSelf: 'flex-end' as const,
  },
  messageBubbleAssistant: {
    maxWidth: '90%',
    padding: '14px 18px',
    borderRadius: '18px 18px 18px 4px',
    fontSize: '14px',
    lineHeight: 1.6,
    wordWrap: 'break-word' as const,
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    color: '#1a1a1a',
    boxSizing: 'border-box' as const,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
  },
  messageText: {
    wordBreak: 'break-word' as const,
  },
  messageWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  messageActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingLeft: '4px',
    opacity: 0.6,
  },
  messageTimestamp: {
    fontSize: '11px',
    color: '#888',
  },
  actionButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    color: '#888',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
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
    maxWidth: '500px',
    width: '90%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
  },
  modalContent: {
    background: 'rgba(255, 255, 255, 0.85)',
    borderRadius: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
  },
  modalHeader: {
    padding: '24px 28px 20px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1a1a1a',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%)',
    border: '1px solid #d0d0d0',
    borderRadius: '10px',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#666',
    transition: 'all 0.2s ease',
  },
  modalBody: {
    padding: '20px 28px 28px',
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
    background: 'linear-gradient(135deg, #1a1a1a 0%, #3d3d3d 100%)',
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
    background: 'linear-gradient(135deg, #1a1a1a 0%, #3d3d3d 100%)',
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
    border: '2px solid #1a1a1a',
    background: 'rgba(26, 26, 26, 0.05)',
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
    padding: '10px 14px',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.2s ease',
  },
  planBtnSpacer: {
    width: '100%',
    height: '36px',
  },
  logoutBtn: {
    width: '100%',
    padding: '13px 24px',
    background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  actionsModalContainer: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1000,
    width: '90%',
    maxWidth: '340px',
  },
  actionsModalContent: {
    background: 'rgba(255, 255, 255, 0.85)',
    borderRadius: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    overflow: 'hidden',
  },
  actionsModalHeader: {
    padding: '20px 24px 16px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
  },
  actionsModalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1a1a1a',
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
    background: 'linear-gradient(135deg, #f0f0f0 0%, #fafafa 100%)',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    color: '#1a1a1a',
  },
  actionMenuItemDanger: {
    background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
    border: '1px solid #fca5a5',
    color: '#dc2626',
  },
  actionMenuIcon: {
    fontSize: '16px',
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
    background: '#0a0a0a',
  },
  authThemeToggle: {
    ...lightStyles.authThemeToggle,
    background: 'rgba(30, 30, 40, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#fff',
  },
  authCard: {
    ...lightStyles.authCard,
    background: 'rgba(20, 20, 30, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  authTitle: {
    ...lightStyles.authTitle,
    color: '#fff',
  },
  authSubtitle: {
    ...lightStyles.authSubtitle,
    color: '#999',
  },
  tabContainer: {
    ...lightStyles.tabContainer,
    background: 'rgba(255, 255, 255, 0.05)',
  },
  tab: {
    ...lightStyles.tab,
    color: '#999',
  },
  tabActive: {
    ...lightStyles.tabActive,
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  labelRow: {
    ...lightStyles.labelRow,
  },
  label: {
    ...lightStyles.label,
    color: '#fff',
  },
  forgotLink: {
    ...lightStyles.forgotLink,
    color: '#a78bfa',
  },
  input: {
    ...lightStyles.input,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#fff',
  },
  divider: {
    ...lightStyles.divider,
  },
  dividerLine: {
    ...lightStyles.dividerLine,
    background: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    ...lightStyles.dividerText,
    color: '#666',
  },
  socialButtons: {
    ...lightStyles.socialButtons,
  },
  authSwitch: {
    ...lightStyles.authSwitch,
    color: '#999',
  },
  authLink: {
    ...lightStyles.authLink,
    color: '#a78bfa',
  },
  authSuccess: {
    ...lightStyles.authSuccess,
    background: 'rgba(16, 185, 129, 0.2)',
  },
  emailIcon: {
    ...lightStyles.emailIcon,
    background: 'rgba(255, 255, 255, 0.1)',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    color: '#999',
  },
  emailIconRing: {
    ...lightStyles.emailIconRing,
    border: '2px solid rgba(255, 255, 255, 0.15)',
  },
  checkEmailTitle: {
    ...lightStyles.checkEmailTitle,
    color: '#fff',
  },
  checkEmailText: {
    ...lightStyles.checkEmailText,
    color: '#999',
  },
  checkEmailAddress: {
    ...lightStyles.checkEmailAddress,
    color: '#fff',
  },
  checkEmailSubtext: {
    ...lightStyles.checkEmailSubtext,
    color: '#777',
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
    border: '1px solid #555',
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
  greetingLogo: {
    ...lightStyles.greetingLogo,
    background: 'rgba(255, 255, 255, 0.1)',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    color: '#999',
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
    background: 'linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%)',
  },
  messageBubbleAssistant: {
    ...lightStyles.messageBubbleAssistant,
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
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
    background: 'rgba(30, 30, 40, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    ...lightStyles.modalTitle,
    color: '#fff',
  },
  modalCloseBtn: {
    ...lightStyles.modalCloseBtn,
    background: 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)',
    border: '1px solid #4a4a4a',
    color: '#999',
  },
  modalHeader: {
    ...lightStyles.modalHeader,
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
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
  planCardActive: {
    border: '2px solid #fff',
    background: 'rgba(255, 255, 255, 0.05)',
  },
  upgradeLink: {
    ...lightStyles.upgradeLink,
    color: '#fff',
  },
  actionsModalContent: {
    ...lightStyles.actionsModalContent,
    background: 'rgba(30, 30, 40, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  actionsModalHeader: {
    ...lightStyles.actionsModalHeader,
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  actionsModalTitle: {
    ...lightStyles.actionsModalTitle,
    color: '#fff',
  },
  actionMenuItem: {
    ...lightStyles.actionMenuItem,
    background: 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)',
    border: '1px solid #4a4a4a',
    color: '#fff',
  },
  actionMenuItemDanger: {
    ...lightStyles.actionMenuItemDanger,
    background: 'linear-gradient(135deg, #4a1c1c 0%, #3a1515 100%)',
    border: '1px solid #7f1d1d',
    color: '#fca5a5',
  },
  logoutBtn: {
    ...lightStyles.logoutBtn,
    background: 'linear-gradient(135deg, #4a1c1c 0%, #3a1515 100%)',
    border: '1px solid #7f1d1d',
    color: '#fca5a5',
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