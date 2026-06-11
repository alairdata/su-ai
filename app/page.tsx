"use client";

import React, { useState, useEffect, Suspense, useRef, useCallback, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useChats } from "./hooks/useChats";
import MessageRow from "./components/MessageRow";
import { lightStyles, darkStyles } from "./page.styles";
import { useTheme } from "./hooks/useTheme";
import { useMemories } from "./hooks/useMemories";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { track, EVENTS } from "@/lib/analytics";
import dynamic from "next/dynamic";

const LimitModal = dynamic(() => import("./components/LimitModal"), { ssr: false });
const CharacterModal = dynamic(() => import("./components/CharacterModal"), { ssr: false });
const AccountSettingsModal = dynamic(() => import("./components/AccountSettingsModal"), { ssr: false });
const WhatsNewModal = dynamic(() => import("./components/WhatsNewModal"), { ssr: false });

import type { ChatCharacter } from "./components/CharacterModal";
import { CHARACTER_COLORS } from "./components/CharacterModal";

type View = "auth" | "chat";
type AuthMode = "signin" | "signup";


import { BoltLogo } from "./components/BoltLogo";
import { OnboardingScreen1, OnboardingScreen2, OnboardingScreen3 } from "./components/OnboardingScreens";

function HomePage() {
  const { data: session, status, update: updateSession } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { memories, isLoading: isMemoriesLoading, plan: memoryPlan, fetchMemories, deleteMemory: deleteMemoryItem, clearAll: clearAllMemories } = useMemories();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showCheckEmail, setShowCheckEmail] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showResetEmailSent, setShowResetEmailSent] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingScreen, setOnboardingScreen] = useState(1);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [whatsNewScreen, setWhatsNewScreen] = useState(1);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportSent, setSupportSent] = useState(false);
  const [showImageGenModal, setShowImageGenModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitCountdown, setLimitCountdown] = useState({ h: 0, m: 0, s: 0 });
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; onClick?: () => void } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success', onClick?: () => void) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type, onClick });
    toastTimerRef.current = setTimeout(() => setToast(null), onClick ? 6000 : 3000);
  }, []);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [selectedChatForActions, setSelectedChatForActions] = useState<{id: string, title: string} | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [showScrollButton, setShowScrollButton] = useState(false);
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
  const editStateRef = useRef({ id: editingMessageId, content: editingMessageContent });
  editStateRef.current = { id: editingMessageId, content: editingMessageContent };

  // Message feedback state (like/dislike)
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'like' | 'dislike'>>({});
  const messageFeedbackRef = useRef(messageFeedback);
  messageFeedbackRef.current = messageFeedback;

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
    messagesAreaRef,
    messagesUsed,
    dailyLimit,
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
    refreshMessageCount,
    isMessageCountLoaded,
  } = useChats();

  // Stable refs so useCallback handlers never need to be recreated during streaming
  const regenerateResponseRef = useRef(regenerateResponse);
  regenerateResponseRef.current = regenerateResponse;
  const editMessageRef = useRef(editMessage);
  editMessageRef.current = editMessage;
  const currentChatRef = useRef(currentChat);
  currentChatRef.current = currentChat;
  const currentChatIdRef = useRef(currentChatId);
  currentChatIdRef.current = currentChatId;

  const isAuthLoading = status === "loading";
  const isAuthenticated = !!session?.user;
  const isUnauthenticated = status === "unauthenticated";

  // Auto-open upgrade modal when landing from email campaign
  useEffect(() => {
    if (searchParams.get('upgrade') === 'true' && session?.user) {
      setShowLimitModal(true);
    }
  }, [searchParams, session]);

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

  // Silently dismiss welcome flag for new users — onboarding handles the flow
  useEffect(() => {
    if (session?.user && session.user.isNewUser) {
      fetch('/api/user/dismiss-welcome', { method: 'POST' }).catch(() => {});
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

  // Close plus menu when clicking/touching outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    if (showPlusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
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

  const lastAssistantIndex = useMemo(
    () => messages.reduce((lastIdx, m, idx) => m.role === 'assistant' ? idx : lastIdx, -1),
    [messages]
  );

  // ── TEXTING-STYLE BUBBLE REVEAL ──
  // Paragraphs reveal one at a time with a typing pause between each.
  // Queue-based: each \n\n adds one slot; slots drain one per timer fire.
  // Continues draining even after streaming ends so remaining bubbles still sequence in.
  const [revealedParaCount, setRevealedParaCount] = useState(1);
  const revealStateRef = useRef<{
    prevTotalParas: number;
    pendingReveals: number;
    timer: ReturnType<typeof setTimeout> | null;
    streamingDone: boolean;
  }>({ prevTotalParas: 1, pendingReveals: 0, timer: null, streamingDone: false });
  const wasLoadingRef = useRef(false);

  const scheduleNextReveal = useRef<(() => void) | undefined>(undefined);
  scheduleNextReveal.current = () => {
    const s = revealStateRef.current;
    if (s.pendingReveals <= 0 || s.timer) return;
    // Shorter delay once streaming is done (content already ready, just pacing the reveal)
    const delay = s.streamingDone ? 700 : 1800;
    s.timer = setTimeout(() => {
      s.timer = null;
      s.pendingReveals = Math.max(0, s.pendingReveals - 1);
      setRevealedParaCount(prev => prev + 1);
      scheduleNextReveal.current?.();
    }, delay);
  };

  // Content of the last assistant message (drives the timing effect)
  const lastAssistantContent = chatLoading
    ? (messages.slice().reverse().find(m => m.role === 'assistant')?.content ?? '')
    : '';

  useEffect(() => {
    const s = revealStateRef.current;

    if (chatLoading && !wasLoadingRef.current) {
      // Streaming just started — full reset
      setRevealedParaCount(1);
      s.prevTotalParas = 1;
      s.pendingReveals = 0;
      s.streamingDone = false;
      if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    }
    wasLoadingRef.current = chatLoading;

    if (!chatLoading) {
      // Streaming done — mark it so remaining reveals use shorter delay
      s.streamingDone = true;
      if (s.pendingReveals === 0) {
        // Nothing queued — show everything right away
        setRevealedParaCount(9999);
      } else {
        // Kick the queue with the shorter post-stream delay
        if (s.timer) { clearTimeout(s.timer); s.timer = null; }
        scheduleNextReveal.current?.();
      }
      return;
    }

    if (!lastAssistantContent) return;

    const totalParas = lastAssistantContent.split(/\n\n+/).filter(p => p.trim()).length;
    if (totalParas > s.prevTotalParas) {
      s.pendingReveals += totalParas - s.prevTotalParas;
      s.prevTotalParas = totalParas;
      scheduleNextReveal.current?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAssistantContent, chatLoading]);

  // Scroll to bottom when a paragraph bubble is revealed, but only if the user
  // is already near the bottom — don't yank them away if they've scrolled up to read.
  useEffect(() => {
    if (chatLoading && revealedParaCount > 1) {
      const area = messagesAreaRef.current;
      if (area) {
        const isNearBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 150;
        if (isNearBottom) area.scrollTop = area.scrollHeight;
      }
    }
  }, [revealedParaCount, chatLoading]);

  // Don't show greeting while chats are loading (prevents flash when restoring from localStorage)
  // Also don't show if we're waiting for a stored chat to load
  const isWaitingForStoredChat = currentChatId && !currentChat;
  const showGreeting = isChatsLoaded && !chatLoading && !isWaitingForStoredChat && (!currentChat || messages.length === 0);

  // Track whether this chat session started as a new conversation
  const newChatSessionRef = useRef<string | null>(null);
  // When there's no currentChat (new conversation), mark the session
  if (!currentChatId) {
    newChatSessionRef.current = '__new__';
  } else if (newChatSessionRef.current === '__new__' && currentChatId) {
    // Chat was just created from a new session — keep showing intro
    newChatSessionRef.current = currentChatId;
  } else if (currentChatId && newChatSessionRef.current !== currentChatId && newChatSessionRef.current !== '__new__') {
    // Switched to a different existing chat — not a new session
    newChatSessionRef.current = null;
  }
  const showIntroMessage = newChatSessionRef.current !== null;
  const remainingMessages = getRemainingMessages();

  // Auto-show limit modal — only after real count is loaded from DB, not stale JWT
  const canSend = canSendMessage();
  useEffect(() => {
    if (!canSend && session?.user && isMessageCountLoaded) {
      setShowLimitModal(true);
    }
    if (canSend && isMessageCountLoaded) {
      setShowLimitModal(false);
    }
  }, [canSend, session?.user, isMessageCountLoaded]);

  // Live countdown timer for limit modal — resets state when midnight passes
  useEffect(() => {
    if (!showLimitModal) return;
    // If midnight already passed, fetch real count and close if reset
    fetch('/api/user/message-count').then(r => r.json()).then(d => {
      if (typeof d.count === 'number') {
        refreshMessageCount();
        const plan = session?.user?.plan || 'Free';
        const limit = plan === 'Special' ? 10 : plan === 'Pro' ? 100 : plan === 'Plus' ? 300 : 5;
        if (d.count < limit) setShowLimitModal(false);
      }
    }).catch(() => {});
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));

      if (diff === 0) {
        // Midnight just passed — re-fetch real count and close modal
        refreshMessageCount().then(() => setShowLimitModal(false));
      }

      setLimitCountdown({
        h: Math.floor(diff / 3600),
        m: Math.floor((diff % 3600) / 60),
        s: diff % 60,
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [showLimitModal]);

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
    const limits: Record<string, number> = { Free: 5, Special: 10, Pro: 100, Plus: 300 };
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

  // Fetch user points on load
  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/checkin', { method: 'GET' }).then(r => r.json()).then(d => {
      if (typeof d.points === 'number') setUserPoints(d.points);
      if (d.already_checked_in) setCheckinDone(true);
    }).catch(() => {});
  }, [session?.user?.id]);

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

  const handleCopyMessage = useCallback(async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      track(EVENTS.MESSAGE_COPIED);
      setCopiedMessageId(messageId);
      showToast('Copied to clipboard');
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {
      showToast('Failed to copy', 'error');
    }
  }, [showToast]);

  const handleEditContentChange = useCallback((content: string) => {
    setEditingMessageContent(content);
  }, []);

  // Edit message handlers
  const handleEditStart = useCallback((messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingMessageContent(content);
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null);
    setEditingMessageContent("");
  }, []);

  const handleEditSave = useCallback(async () => {
    const { id, content } = editStateRef.current;
    if (!id || !content.trim()) return;
    await editMessageRef.current(id, content);
    setEditingMessageId(null);
    setEditingMessageContent("");
  }, []);

  // Regenerate handler
  const handleRegenerate = useCallback(async (userMessageId: string) => {
    await regenerateResponseRef.current(userMessageId);
  }, []);

  // Like/Dislike feedback handler
  const handleFeedback = useCallback(async (messageId: string, type: 'like' | 'dislike') => {
    if (messageFeedbackRef.current[messageId] === type) {
      setMessageFeedback(prev => {
        const updated = { ...prev };
        delete updated[messageId];
        return updated;
      });
      return;
    }
    setMessageFeedback(prev => ({ ...prev, [messageId]: type }));
    track(EVENTS.MESSAGE_FEEDBACK, { type });
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          chatId: currentChatIdRef.current,
          feedback: type,
        }),
      });
    } catch (error) {
      console.error('Failed to send feedback:', error);
    }
  }, []);

  // Find the user message that preceded an AI message (for regenerate on AI side)
  const findPrecedingUserMessageId = useCallback((aiMessageId: string): string | null => {
    if (!currentChatRef.current) return null;
    const msgs = currentChatRef.current.messages;
    const aiIndex = msgs.findIndex(m => m.id === aiMessageId);
    if (aiIndex <= 0) return null;
    for (let i = aiIndex - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        return msgs[i].id;
      }
    }
    return null;
  }, []);

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
    const area = messagesAreaRef.current;
    if (area) area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
  }, [messagesAreaRef]);

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

  // Compress images to stay under Vercel's 4.5MB body limit
  const MAX_UPLOAD_SIZE = 4 * 1024 * 1024; // 4MB (safe margin under Vercel's 4.5MB)
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      // Skip if already small enough
      if (file.size <= MAX_UPLOAD_SIZE) { resolve(file); return; }
      // GIFs can't be compressed via canvas (loses animation)
      if (file.type === "image/gif") { resolve(file); return; }

      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Scale down if very large
        const maxDim = 2048;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);

        // Try progressively lower quality until under limit
        const tryQuality = (quality: number) => {
          canvas.toBlob((blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size <= MAX_UPLOAD_SIZE || quality <= 0.3) {
              const compressed = new File([blob], file.name, { type: 'image/jpeg', lastModified: file.lastModified });
              resolve(compressed);
            } else {
              tryQuality(quality - 0.1);
            }
          }, 'image/jpeg', quality);
        };
        tryQuality(0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    // Compress images that are too large for Vercel's body limit
    const finalFile = isImage ? await compressImage(file) : file;

    const fType = classifyFile(finalFile);
    track(EVENTS.FILE_SELECTED, { file_type: fType, file_size_kb: Math.round(finalFile.size / 1024) });
    setSelectedFile(finalFile);
    setSelectedFileType(fType);
    setFilePreviewUrl(fType === "image" ? URL.createObjectURL(finalFile) : null);

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
      showConfirm('Character Limit', 'You can have a maximum of 5 characters per chat. Remove one to add a new one.', 'OK', () => {});
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
      showToast(`${name} added to chat`);
      setNewCharName('');
      setNewCharPersonality('');
      setSelectedColorIndex(0);
      setShowCharacterModal(false);
    } catch (err) {
      console.error('Failed to add character:', err);
      showToast('Failed to add character', 'error');
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

  const checkinNudgedRef = useRef(false);

  const handleSend = async () => {
    if (!canSendMessage()) {
      setShowLimitModal(true);
      return;
    }
    if ((!input.trim() && !selectedFile) || chatLoading) return;

    // Nudge check-in after first message of the session if not yet checked in
    if (!checkinDone && !checkinNudgedRef.current) {
      checkinNudgedRef.current = true;
      setTimeout(() => {
        setShowRedeemModal(true);
      }, 1500);
    }

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
          showToast(err.error || "Failed to upload file.", 'error');
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
        showToast("Failed to upload file. Please try again.", 'error');
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

    // Detect @mention for character routing
    const mentionMatch = messageToSend.match(/@(\w+)/);
    const mentionedChar = mentionMatch
      ? chatCharacters.find(c => c.name.toLowerCase() === mentionMatch[1].toLowerCase())
      : null;

    setShowMentionDropdown(false);

    await sendMessage(
      messageToSend,
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
    setShowLimitModal(true);
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
                  : "No going back from here."}
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
              <h2 style={currentStyles.checkEmailTitle}>We sent you a link.</h2>
              <p style={currentStyles.checkEmailText}>
                Most people check their email and never come back.
              </p>
              <p style={currentStyles.checkEmailAddress}>{signupEmail}</p>
              <p style={currentStyles.checkEmailSubtext}>
                Don&apos;t be most people. (Check spam if you don&apos;t see it.)
              </p>
              <button
                onClick={() => {
                  setShowCheckEmail(false);
                  setAuthMode("signin");
                }}
                style={currentStyles.authBtn}
                className="auth-btn-ripple"
              >
                Going to check now
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
            <h2 style={currentStyles.checkEmailTitle}>Account created. Now the real work starts.</h2>
            <p style={currentStyles.checkEmailText}>
              Most people won&apos;t make it past the first honest conversation.
            </p>
            <p style={currentStyles.checkEmailSubtext}>
              Let&apos;s see if you&apos;re different.
            </p>
            <button
              onClick={handleDismissWelcome}
              style={currentStyles.authBtn}
              className="auth-btn-ripple"
            >
              I&apos;m ready
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
          zIndex: 400,
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
            {[1, 3].map(i => (
              <div key={i} style={{
                width: onboardingScreen === i ? '24px' : '8px',
                height: '8px',
                borderRadius: onboardingScreen === i ? '4px' : '50%',
                background: onboardingScreen === i ? '#E8A04C' : (i < onboardingScreen ? '#E8A04C' : '#7A7680'),
                opacity: onboardingScreen === i ? 1 : (i < onboardingScreen ? 0.5 : 0.3),
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>

          {onboardingScreen === 1 && (
            <OnboardingScreen1
              onNext={() => { track(EVENTS.ONBOARDING_SCREEN_VIEWED, { screen_number: 3 }); setOnboardingScreen(3); }}
              onSkip={() => completeOnboarding(1)}
            />
          )}

          {onboardingScreen === 3 && (
            <OnboardingScreen3
              onComplete={() => completeOnboarding()}
            />
          )}
        </div>
      )}

      <div style={{ ...currentStyles.app, height: '100dvh' }}>
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

            <div style={{ padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

              {session?.user?.plan !== 'Plus' && (
                <button
                  onMouseEnter={() => router.prefetch('/checkout')}
                  onClick={() => router.push('/checkout')}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
                    border: 'none',
                    color: '#0C0C0E',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    letterSpacing: '-0.01em',
                    transition: 'all 0.25s ease',
                    opacity: 1,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 100 100" fill="none">
                    <path d="M56 4L30 48H50L28 96L74 44H52L72 4Z" fill="#0C0C0E"/>
                  </svg>
                  {session?.user?.plan === 'Free' ? 'Upgrade' : 'Upgrade to Plus'}
                </button>
              )}
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
                              ...(isMobile ? { padding: '10px 48px 10px 12px' } : {}),
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
                            <span style={{ fontSize: '11px', color: theme === 'dark' ? '#7A7680' : '#9A9590', flexShrink: 0, whiteSpace: 'nowrap' as const }}>
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

          <div style={{ position: 'relative' }}>
          {showProfileMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setShowProfileMenu(false)} />
              <div style={{
                position: 'absolute', bottom: '100%', left: '12px', right: '12px', marginBottom: '8px',
                background: theme === 'dark' ? '#1A1A1E' : '#FFFFFF',
                border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                overflow: 'hidden', zIndex: 201,
              }}>
                {/* User header */}
                <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: theme === 'dark' ? '#F0EDE8' : '#1A1918' }}>{session?.user?.name}</div>
                  <div style={{ fontSize: '12px', color: theme === 'dark' ? '#7A7680' : '#9A9590', marginTop: '2px' }}>{session?.user?.email}</div>
                </div>
                {/* Menu items */}
                {[
                  { label: 'Settings', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, onClick: () => { setShowProfileMenu(false); setShowAccountModal(true); } },
                  { label: 'Check in', icon: <span style={{ fontSize: '14px' }}>🔥</span>, onClick: () => { setShowProfileMenu(false); setShowRedeemModal(true); } },
                  ...(session?.user?.plan !== 'Plus' ? [{ label: 'Upgrade plan', icon: <svg width="15" height="15" viewBox="0 0 100 100" fill="none"><path d="M56 4L30 48H50L28 96L74 44H52L72 4Z" fill={theme === 'dark' ? '#E8A04C' : '#D08A30'}/></svg>, onClick: () => { setShowProfileMenu(false); router.push('/checkout'); }, accent: true }] : []),
                  { label: 'Contact support', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, onClick: () => { setShowProfileMenu(false); setShowSupportModal(true); } },
                ].map((item: { label: string; icon: React.ReactNode; onClick: () => void; accent?: boolean }) => (
                  <button key={item.label} onClick={item.onClick} style={{
                    width: '100%', padding: '11px 16px', background: 'none', border: 'none',
                    display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                    fontSize: '14px', fontWeight: 500, textAlign: 'left' as const,
                    color: item.accent ? (theme === 'dark' ? '#E8A04C' : '#D08A30') : (theme === 'dark' ? '#C8C4CC' : '#3A3640'),
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >{item.icon}{item.label}</button>
                ))}
                {/* Divider + Log out */}
                <div style={{ borderTop: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }} />
                <button onClick={() => { setShowProfileMenu(false); handleLogout(); }} style={{
                  width: '100%', padding: '11px 16px', background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 500, color: '#ef4444', textAlign: 'left' as const,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Log out
                </button>
              </div>
            </>
          )}
          <div style={currentStyles.sidebarFooter} onClick={() => setShowProfileMenu(p => !p)}>
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
              color: theme === 'dark' ? '#7A7680' : '#9A9590',
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
              /{session?.user?.plan === 'Free' ? 5 : session?.user?.plan === 'Special' ? 10 : session?.user?.plan === 'Pro' ? 100 : 300}
            </div>
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
                  color: theme === 'dark' ? '#7A7680' : '#9A9590',
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
                    color: theme === 'light' ? '#D08A30' : (theme === 'dark' ? '#7A7680' : '#9A9590'),
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

              {isChatsLoaded && !isWaitingForStoredChat && (
                <div style={{
                  ...currentStyles.chatMessages,
                  ...(isMobile ? currentStyles.chatMessagesMobile : {})
                }}>
                  {/* Intro message - always shown as the first message */}
                  <div style={currentStyles.messageRowAssistant}>
                    <div style={currentStyles.messageWrapper}>
                      <div
                        className="message-bubble"
                        style={currentStyles.messageBubbleAssistant}
                      >
                        <div style={currentStyles.messageText}>
                          <p style={{ margin: 0, display: 'block' }}>
                            I&apos;m not here to hold your hand or tell you what you want to hear.{' '}
                            <span style={{ color: theme === 'dark' ? '#E8A04C' : '#D08A30' }}>
                              So let&apos;s skip the small talk and get to it{greeting.name ? `, ${greeting.name}` : ''}.
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {messages.map((m, index) => {
                    const isLast = m.role === 'assistant' && index === lastAssistantIndex;
                    if (m.role === "assistant" && !m.content && (!isLast || isSearching)) {
                      return null;
                    }
                    return (
                      <MessageRow
                        key={m.id}
                        m={m}
                        isLastAssistant={isLast}
                        isSearching={isSearching}
                        chatLoading={chatLoading}
                        theme={theme}
                        isMobile={isMobile}
                        styles={currentStyles}
                        revealedParaCount={isLast ? revealedParaCount : 9999}
                        isEditing={editingMessageId === m.id}
                        editingContent={editingMessageId === m.id ? editingMessageContent : ''}
                        isCopied={copiedMessageId === m.id}
                        feedback={messageFeedback[m.id] ?? null}
                        onRegenerate={handleRegenerate}
                        onEditStart={handleEditStart}
                        onEditCancel={handleEditCancel}
                        onEditSave={handleEditSave}
                        onEditContentChange={handleEditContentChange}
                        onCopyMessage={handleCopyMessage}
                        onFeedback={handleFeedback}
                        onFindPrecedingUser={findPrecedingUserMessageId}
                      />
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
              )}
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

            {/* Bottom input area */}
            {(
              <div style={currentStyles.inputArea}>
                <div style={{
                  ...currentStyles.inputWrapper,
                  ...(isMobile ? currentStyles.inputWrapperMobile : {})
                }}>

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
                              setTimeout(() => fileInputRef.current?.click(), 50);
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
                              setTimeout(() => docInputRef.current?.click(), 50);
                            }}>
                              <div style={currentStyles.plusMenuItemContent}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <span>Add Files</span>
                              </div>
                            </button>
                            <button style={currentStyles.plusMenuItem} onClick={() => { setShowPlusMenu(false); setShowImageGenModal(true); }}>
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
                        style={{ ...currentStyles.textarea, caretColor: 'auto' }}
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
                    {!isMobile && <span style={currentStyles.inputHint}>{chatCharacters.length > 0 ? 'Type @ to mention a character' : 'Verify what matters.'}</span>}
                    <span style={{ fontSize: '11px', color: theme === 'dark' ? '#6B6660' : '#9A9590', fontFamily: "'JetBrains Mono', 'SF Mono', 'Courier New', monospace" }}>
                      <span style={{ color: theme === 'dark' ? '#E8A04C' : '#D08A30', fontWeight: 600 }}>{messagesUsed}</span>
                      {' of '}
                      <span style={{ color: theme === 'dark' ? '#E8A04C' : '#D08A30', fontWeight: 600 }}>
                        {dailyLimit}
                      </span>
                      {' messages used today'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Daily Limit Modal */}
      {showLimitModal && (
        <LimitModal
          theme={theme}
          plan={session?.user?.plan || 'Free'}
          limitCountdown={limitCountdown}
          onClose={() => setShowLimitModal(false)}
        />
      )}

      {showImageGenModal && (
        <>
          <div style={currentStyles.modalOverlay} onClick={() => setShowImageGenModal(false)} />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '440px',
            maxHeight: '90vh',
            overflowY: 'auto' as const,
            background: theme === 'dark' ? '#141416' : '#ffffff',
            border: `1px solid ${theme === 'dark' ? '#1E1E22' : '#e5e5e5'}`,
            borderRadius: '20px',
            zIndex: 400,
            padding: '32px 28px',
          }}>
            {/* Close button */}
            <button
              onClick={() => setShowImageGenModal(false)}
              style={{
                position: 'absolute' as const,
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: theme === 'dark' ? '#7A7680' : '#999',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Icon */}
            <div style={{ textAlign: 'center' as const, marginBottom: '20px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #7C4DFF 0%, #E040FB 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h3 style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '18px',
              fontWeight: 700,
              color: theme === 'dark' ? '#F0EDE8' : '#1a1a1a',
              textAlign: 'center' as const,
              margin: '0 0 8px',
            }}>AI Image Generation</h3>

            <p style={{
              fontSize: '13px',
              color: theme === 'dark' ? '#8A8690' : '#666',
              textAlign: 'center' as const,
              margin: '0 0 24px',
              lineHeight: 1.5,
            }}>You need the <strong style={{ color: '#E8A04C' }}>Plus Plan</strong> to unlock this feature.</p>

            {/* Features list */}
            <div style={{
              background: theme === 'dark' ? '#0C0C0E' : '#f8f8f8',
              borderRadius: '14px',
              padding: '20px',
              marginBottom: '24px',
            }}>
              {[
                { icon: '🎨', title: 'Text to Image', desc: 'Describe anything, AI creates it instantly' },
                { icon: '⚡', title: 'Multiple Styles', desc: 'Realistic, anime, 3D, pixel art and more' },
                { icon: '🔄', title: 'Unlimited Generations', desc: 'Create as many images as you want' },
                { icon: '📐', title: 'High Resolution', desc: 'Crisp, detailed images ready to download' },
                { icon: '💬', title: 'In-Chat Creation', desc: 'Generate images right inside your conversations' },
              ].map((feature, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 0',
                  borderBottom: i < 4 ? `1px solid ${theme === 'dark' ? '#1E1E22' : '#eee'}` : 'none',
                }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{feature.icon}</span>
                  <div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: theme === 'dark' ? '#F0EDE8' : '#1a1a1a',
                      marginBottom: '2px',
                    }}>{feature.title}</div>
                    <div style={{
                      fontSize: '11px',
                      color: theme === 'dark' ? '#7A7680' : '#888',
                      lineHeight: 1.4,
                    }}>{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Plus plan card */}
            <div style={{
              background: theme === 'dark' ? 'linear-gradient(135deg, #1A1330 0%, #141416 100%)' : 'linear-gradient(135deg, #f3eeff 0%, #fff 100%)',
              border: `1px solid ${theme === 'dark' ? '#2D1B4E' : '#d4c4f0'}`,
              borderRadius: '14px',
              padding: '20px',
              textAlign: 'center' as const,
              marginBottom: '16px',
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase' as const,
                color: '#B388FF',
                marginBottom: '8px',
              }}>PLUS PLAN</div>
              <div style={{
                fontSize: '32px',
                fontWeight: 700,
                color: theme === 'dark' ? '#F0EDE8' : '#1a1a1a',
                marginBottom: '4px',
              }}>$9.99<span style={{ fontSize: '14px', fontWeight: 400, color: theme === 'dark' ? '#7A7680' : '#888' }}>/mo</span></div>
              <div style={{
                fontSize: '12px',
                color: theme === 'dark' ? '#8A8690' : '#666',
                marginBottom: '16px',
              }}>300 messages/day + Image Generation + everything in Pro</div>
              <button
                onClick={() => {
                  setShowImageGenModal(false);
                  upgradePlan('Plus');
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #E8A04C 0%, #F0C070 100%)',
                  color: '#0C0C0E',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >Upgrade to Plus →</button>
            </div>

            <p style={{
              fontSize: '11px',
              color: theme === 'dark' ? '#3A3640' : '#bbb',
              textAlign: 'center' as const,
              margin: 0,
            }}>Cancel anytime. No questions asked.</p>
          </div>
        </>
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <AccountSettingsModal
          theme={theme}
          session={session}
          messagesUsed={messagesUsed}
          showMemorySection={showMemorySection}
          setShowMemorySection={setShowMemorySection}
          isEditingName={isEditingName}
          setIsEditingName={setIsEditingName}
          editNameValue={editNameValue}
          setEditNameValue={setEditNameValue}
          isSavingName={isSavingName}
          updateName={updateName}
          memoryPlan={memoryPlan}
          memories={memories}
          isMemoriesLoading={isMemoriesLoading}
          isCancellingSubscription={isCancellingSubscription}
          getProgressPercentage={getProgressPercentage}
          upgradePlan={upgradePlan}
          cancelSubscription={cancelSubscription}
          handleLogout={handleLogout}
          showConfirm={showConfirm}
          deleteMemoryItem={deleteMemoryItem}
          clearAllMemories={clearAllMemories}
          onClose={() => setShowAccountModal(false)}
          hideUpgradeSections={true}
        />
      )}

      {/* Check-in & Redeem Modal */}
      {showRedeemModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, backdropFilter: 'blur(4px)' }} onClick={() => setShowRedeemModal(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1101, width: '90%', maxWidth: '420px',
            background: theme === 'dark' ? '#141416' : '#F5F4F0',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: '20px', padding: '28px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: theme === 'dark' ? '#F0EDE8' : '#1A1918', letterSpacing: '-0.02em' }}>Check in</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: theme === 'dark' ? '#7A7680' : '#9A9590' }}>
                  🔥 <strong style={{ color: theme === 'dark' ? '#E8A04C' : '#D08A30' }}>{userPoints ?? 0}</strong> / 150 pts
                </p>
              </div>
              <button onClick={() => setShowRedeemModal(false)} style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme === 'dark' ? '#F0EDE8' : '#1A1918' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Check-in button */}
            <button
              disabled={checkinLoading || checkinDone}
              onClick={async () => {
                setCheckinLoading(true);
                try {
                  const res = await fetch('/api/checkin', { method: 'POST' });
                  const data = await res.json();
                  if (data.success) { setUserPoints(data.points); setCheckinDone(true); }
                  else if (data.already_checked_in) { setCheckinDone(true); }
                  else { showToast(data.error || 'Could not check in', 'error'); }
                } catch { showToast('Could not check in', 'error'); }
                finally { setCheckinLoading(false); }
              }}
              style={{
                width: '100%', padding: '14px', marginBottom: '24px', borderRadius: '12px', border: 'none',
                fontSize: '14px', fontWeight: 700, transition: 'all 0.2s',
                cursor: (checkinLoading || checkinDone) ? 'not-allowed' : 'pointer',
                background: checkinDone ? 'rgba(16,185,129,0.12)' : 'linear-gradient(135deg,#E8A04C,#E8624C)',
                color: checkinDone ? '#10b981' : '#0C0C0E',
              }}
            >
              {checkinLoading ? 'Checking in...' : checkinDone ? '✓ Checked in today' : 'Check in  +10 pts'}
            </button>

            {/* Divider */}
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: theme === 'dark' ? '#5A5660' : '#9A9590', textTransform: 'uppercase', marginBottom: '12px' }}>Redeem points</div>

            {/* Tiers */}
            {[
              { points: 30, label: '+2 msgs/day for the next 7 days' },
              { points: 70, label: '+4 msgs/day for the next 7 days' },
              { points: 150, label: '+8 msgs/day for the next 7 days' },
            ].map(tier => {
              const canAfford = (userPoints ?? 0) >= tier.points;
              return (
                <button
                  key={tier.points}
                  disabled={!canAfford || redeemLoading}
                  onClick={async () => {
                    setRedeemLoading(true);
                    try {
                      const res = await fetch('/api/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier_points: tier.points }) });
                      const data = await res.json();
                      if (data.success) { setUserPoints(data.points_remaining); setShowRedeemModal(false); showToast(`${tier.label} unlocked!`, 'success'); refreshMessageCount(); }
                      else { showToast(data.error || 'Could not redeem', 'error'); }
                    } catch { showToast('Could not redeem', 'error'); }
                    finally { setRedeemLoading(false); }
                  }}
                  style={{
                    width: '100%', padding: '12px 16px', marginBottom: '8px', borderRadius: '12px',
                    cursor: canAfford ? 'pointer' : 'not-allowed', opacity: canAfford ? 1 : 0.4,
                    border: `1px solid ${canAfford ? (theme === 'dark' ? 'rgba(232,160,76,0.25)' : 'rgba(208,138,48,0.25)') : (theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}`,
                    background: canAfford ? (theme === 'dark' ? 'rgba(232,160,76,0.07)' : 'rgba(208,138,48,0.05)') : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: canAfford ? (theme === 'dark' ? '#E8A04C' : '#D08A30') : (theme === 'dark' ? '#7A7680' : '#9A9590') }}>{tier.label}</div>
                    <div style={{ fontSize: '12px', color: theme === 'dark' ? '#5A5660' : '#9A9590', marginTop: '2px' }}>{tier.points} pts</div>
                  </div>
                  {canAfford && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme === 'dark' ? '#E8A04C' : '#D08A30'} strokeWidth="2" strokeLinecap="round"><polyline points="9 6 15 12 9 18"/></svg>}
                </button>
              );
            })}
            {(userPoints ?? 0) >= 150 && (
              <p style={{ fontSize: '12px', color: theme === 'dark' ? '#7A7680' : '#9A9590', textAlign: 'center', marginTop: '8px' }}>
                You&apos;re at the cap — redeem first, then keep earning.
              </p>
            )}
          </div>
        </>
      )}

      {/* Contact Support Modal */}
      {showSupportModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, backdropFilter: 'blur(4px)' }} onClick={() => { setShowSupportModal(false); setSupportSent(false); setSupportMessage(''); }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1101, width: '90%', maxWidth: '460px',
            background: theme === 'dark' ? '#141416' : '#F5F4F0',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: '20px', padding: '28px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: theme === 'dark' ? '#F0EDE8' : '#1A1918', letterSpacing: '-0.02em' }}>Contact support</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: theme === 'dark' ? '#7A7680' : '#9A9590' }}>We usually reply within a few hours.</p>
              </div>
              <button onClick={() => { setShowSupportModal(false); setSupportSent(false); setSupportMessage(''); }} style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme === 'dark' ? '#F0EDE8' : '#1A1918' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {supportSent ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: theme === 'dark' ? '#F0EDE8' : '#1A1918', marginBottom: '6px' }}>Message sent.</div>
                <div style={{ fontSize: '13px', color: theme === 'dark' ? '#7A7680' : '#9A9590' }}>We'll get back to you at {session?.user?.email}</div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px', padding: '12px 14px', background: theme === 'dark' ? '#1A1A1E' : '#ECEAE6', borderRadius: '10px', fontSize: '13px', color: theme === 'dark' ? '#7A7680' : '#9A9590', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  {session?.user?.email}
                </div>
                <textarea
                  value={supportMessage}
                  onChange={e => setSupportMessage(e.target.value)}
                  placeholder="Describe your issue or question..."
                  rows={5}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '12px', resize: 'none' as const,
                    background: theme === 'dark' ? '#1A1A1E' : '#ECEAE6',
                    border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    color: theme === 'dark' ? '#F0EDE8' : '#1A1918', fontSize: '14px',
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
                  }}
                />
                <button
                  disabled={!supportMessage.trim() || supportSending}
                  onClick={async () => {
                    if (!supportMessage.trim()) return;
                    setSupportSending(true);
                    try {
                      await fetch('/api/support', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: supportMessage }),
                      });
                      setSupportSent(true);
                      setSupportMessage('');
                    } catch {
                      // fail silently — show sent anyway
                      setSupportSent(true);
                    } finally {
                      setSupportSending(false);
                    }
                  }}
                  style={{
                    marginTop: '12px', width: '100%', padding: '14px',
                    background: supportMessage.trim() ? 'linear-gradient(135deg,#E8A04C,#E8624C)' : (theme === 'dark' ? '#2A2A2E' : '#DDDBD7'),
                    border: 'none', borderRadius: '12px', cursor: supportMessage.trim() ? 'pointer' : 'not-allowed',
                    color: supportMessage.trim() ? '#0C0C0E' : (theme === 'dark' ? '#5A5660' : '#9A9590'),
                    fontSize: '14px', fontWeight: 700, transition: 'all 0.2s',
                  }}
                >
                  {supportSending ? 'Sending...' : 'Send message'}
                </button>
              </>
            )}
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
        <CharacterModal
          theme={theme}
          chatCharacters={chatCharacters}
          newCharName={newCharName}
          setNewCharName={setNewCharName}
          newCharPersonality={newCharPersonality}
          setNewCharPersonality={setNewCharPersonality}
          selectedColorIndex={selectedColorIndex}
          setSelectedColorIndex={setSelectedColorIndex}
          isAddingCharacter={isAddingCharacter}
          addChatCharacter={addChatCharacter}
          removeChatCharacter={removeChatCharacter}
          onClose={() => setShowCharacterModal(false)}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div
          onClick={() => { if (toast.onClick) { toast.onClick(); setToast(null); } }}
          style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 10002,
            padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 500,
            background: toast.type === 'success' ? (theme === 'dark' ? '#1a3a1a' : '#e8f5e9')
              : toast.type === 'error' ? (theme === 'dark' ? '#3a1a1a' : '#fbe9e7')
              : (theme === 'dark' ? '#1a2a3a' : '#e3f2fd'),
            color: toast.type === 'success' ? '#4caf50'
              : toast.type === 'error' ? '#ef5350'
              : '#42a5f5',
            border: `1px solid ${toast.type === 'success' ? 'rgba(76,175,80,0.3)'
              : toast.type === 'error' ? 'rgba(239,83,80,0.3)'
              : 'rgba(66,165,245,0.3)'}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'fadeSlideIn 0.3s ease-out',
            display: 'flex', alignItems: 'center', gap: '8px',
            cursor: toast.onClick ? 'pointer' : 'default',
          }}
        >
          {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'} {toast.message}
          {toast.onClick && <span style={{ fontSize: '12px', opacity: 0.7, marginLeft: '4px' }}>Tap to open →</span>}
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
        <WhatsNewModal
          whatsNewScreen={whatsNewScreen}
          setWhatsNewScreen={setWhatsNewScreen}
          dismissWhatsNew={dismissWhatsNew}
        />
      )}
    </>
  );
}

// Light Mode Styles

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