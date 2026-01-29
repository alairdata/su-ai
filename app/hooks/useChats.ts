import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  created_at: string;
};

const PLAN_LIMITS: Record<string, number> = {
  'Free': 10,
  'Pro': 100,
  'Plus': 300
};

// Helper to safely access localStorage (handles SSR)
const getStoredChatId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('currentChatId');
  } catch {
    return null;
  }
};

const setStoredChatId = (chatId: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (chatId && !chatId.startsWith('temp-')) {
      localStorage.setItem('currentChatId', chatId);
    } else {
      localStorage.removeItem('currentChatId');
    }
  } catch {
    // Ignore localStorage errors
  }
};

export function useChats() {
  const { data: session } = useSession();
  const [chats, setChats] = useState<Chat[]>([]);
  // Initialize from localStorage immediately to avoid flash
  const [currentChatId, setCurrentChatIdState] = useState<string | null>(() => getStoredChatId());
  const [isLoading, setIsLoading] = useState(false);
  const [isChatsLoaded, setIsChatsLoaded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [localMessagesUsed, setLocalMessagesUsed] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);

  // Wrapper to persist currentChatId to localStorage
  const setCurrentChatId = (chatId: string | null) => {
    setCurrentChatIdState(chatId);
    setStoredChatId(chatId);
  };

  // Sync local message count from session on initial load or user change
  const userId = session?.user?.id ?? null;
  const sessionMessagesUsed = session?.user?.messagesUsedToday ?? 0;
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only sync when user changes (login) or on first load
    if (userId && userId !== lastUserIdRef.current) {
      setLocalMessagesUsed(sessionMessagesUsed);
      // Clear stored chat when user changes (different user logging in)
      if (lastUserIdRef.current !== null) {
        setStoredChatId(null);
        setCurrentChatIdState(null);
      }
      lastUserIdRef.current = userId;
    }
  }, [userId, sessionMessagesUsed]);

  // Load chats from API when user logs in
  useEffect(() => {
    if (!session?.user) return;

    const loadChats = async () => {
      try {
        const res = await fetch('/api/chats');
        const data = await res.json();
        // Only show chats that have messages
        const chatsWithMessages = (data.chats || []).filter((chat: Chat) => chat.messages && chat.messages.length > 0);
        setChats(chatsWithMessages);

        // Validate stored chat ID still exists (clear if chat was deleted)
        const storedChatId = getStoredChatId();
        if (storedChatId && !chatsWithMessages.some((c: Chat) => c.id === storedChatId)) {
          setCurrentChatId(null);
        }
      } catch (error) {
        console.error('Failed to load chats:', error);
      } finally {
        setIsChatsLoaded(true);
      }
    };

    loadChats();
  }, [session]);

  // Smart auto-scroll: only when message count increases
  useEffect(() => {
    const currentChat = chats.find(c => c.id === currentChatId);
    const currentMessageCount = currentChat?.messages.length || 0;

    if (currentMessageCount > previousMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    previousMessageCountRef.current = currentMessageCount;
  }, [chats, currentChatId]);

  const currentChat = currentChatId 
    ? chats.find((c) => c.id === currentChatId) || null 
    : null;

  // Use local count for real-time updates
  const messagesUsed = localMessagesUsed ?? session?.user?.messagesUsedToday ?? 0;

  const canSendMessage = (): boolean => {
    if (!session?.user) return false;
    const limit = PLAN_LIMITS[session.user.plan as keyof typeof PLAN_LIMITS] || 50;
    return messagesUsed < limit;
  };

  const getRemainingMessages = (): number => {
    if (!session?.user) return 0;
    const limit = PLAN_LIMITS[session.user.plan as keyof typeof PLAN_LIMITS] || 50;
    if (limit === Infinity) return Infinity;
    return Math.max(0, limit - messagesUsed);
  };

  // Generate SMART chat title from first message
  const generateTitleFromText = (text: string): string => {
    const t = text.toLowerCase();

    // Pattern matching for common topics
    if (/\b(hi|hello|hey|heyy|hiii|sup|yo)\b/.test(t)) return "Casual greeting";
    if (t.includes("help") && t.includes("code")) return "Coding help";
    if (t.includes("sql") || t.includes("query") || t.includes("database")) return "Database question";
    if (t.includes("design") || t.includes("ui") || t.includes("ux")) return "Design discussion";
    if (t.includes("data") && (t.includes("story") || t.includes("analysis"))) return "Data analysis";
    if (t.includes("weight") || t.includes("gym") || t.includes("fitness") || t.includes("workout")) return "Fitness chat";
    if (t.includes("recipe") || t.includes("cook") || t.includes("food")) return "Cooking question";
    if (t.includes("advice") || t.includes("should i") || t.includes("what do you think")) return "Advice needed";
    if (t.includes("explain") || t.includes("what is") || t.includes("how does")) return "Learning question";
    if (t.includes("debug") || t.includes("error") || t.includes("bug")) return "Debugging help";
    if (t.includes("mama") || t.includes("dad") || t.includes("family")) return "Family talk";
    
    // Extract key nouns/topics (simple approach)
    const words = text.split(' ').filter(w => w.length > 4);
    if (words.length > 0) {
      const firstWords = words.slice(0, 3).join(' ');
      return firstWords.length > 30 ? firstWords.slice(0, 30) + "..." : firstWords;
    }

    // Fallback to truncated message
    const trimmed = text.trim();
    return trimmed.length > 30 ? trimmed.slice(0, 30) + "..." : trimmed;
  };

  const createNewChat = async () => {
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });

      const data = await res.json();

      if (!res.ok || !data.chat) {
        console.error('Failed to create chat - API response:', res.status, data);
        return null;
      }

      // DON'T add to chats list yet - wait for first message
      setCurrentChatId(data.chat.id);
      return data.chat.id;
    } catch (error) {
      console.error('Failed to create chat:', error);
      return null;
    }
  };

  const sendMessage = async (input: string) => {
    if (!input.trim() || isLoading || !canSendMessage()) return;

    setIsLoading(true);

    let activeChatId = currentChatId;
    let needsNewChat = false;

    // Check if this is the first message (new chat)
    const existingChat = activeChatId ? chats.find(c => c.id === activeChatId) : null;
    const isFirstMessage = !activeChatId || !existingChat || existingChat.messages.length === 0;

    // Optimistically add user message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    };

    // Create assistant message placeholder for streaming
    const assistantMessageId = `msg-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };

    if (!activeChatId) {
      // Generate optimistic ID for instant UI update
      const optimisticId = `temp-chat-${Date.now()}`;
      activeChatId = optimisticId;
      needsNewChat = true;
      // Don't setCurrentChatId yet - wait until chat is added to avoid race condition
    }

    if (isFirstMessage) {
      // Create the chat in UI with smart title immediately
      const smartTitle = generateTitleFromText(input);
      const newChat: Chat = {
        id: activeChatId!,
        title: smartTitle,
        messages: [optimisticMessage, assistantMessage],
        created_at: new Date().toISOString(),
      };
      // Add chat FIRST, then set currentChatId to avoid race condition
      setChats(prev => [newChat, ...prev]);
      setCurrentChatId(activeChatId!);
    } else {
      // Add both messages to existing chat immediately
      setChats(prev =>
        prev.map(c =>
          c.id === activeChatId
            ? { ...c, messages: [...c.messages, optimisticMessage, assistantMessage] }
            : c
        )
      );
    }

    let realChatId = activeChatId;

    try {
      // Create chat in background if needed, then send message
      if (needsNewChat) {
        const newChatId = await createNewChat();
        if (!newChatId) {
          throw new Error('Failed to create chat');
        }
        realChatId = newChatId;
        // Update the optimistic chat ID with real ID
        setChats(prev => prev.map(c =>
          c.id === activeChatId ? { ...c, id: realChatId } : c
        ));
        setCurrentChatId(realChatId);
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: realChatId,
          message: input
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      // Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let streamedContent = '';
      let receivedDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.searching !== undefined) {
                setIsSearching(data.searching);
                setSearchQuery(data.query || null);
              }

              if (data.text) {
                streamedContent += data.text;
                // Update assistant message content in real-time
                setChats(prev =>
                  prev.map(c =>
                    c.id === realChatId
                      ? {
                          ...c,
                          messages: c.messages.map(m =>
                            m.id === assistantMessageId
                              ? { ...m, content: streamedContent }
                              : m
                          ),
                        }
                      : c
                  )
                );
              }

              if (data.title) {
                // Update chat title
                setChats(prev =>
                  prev.map(c =>
                    c.id === realChatId
                      ? { ...c, title: data.title }
                      : c
                  )
                );
              }

              if (data.done) {
                receivedDone = true;
                // Update local message count
                setLocalMessagesUsed(prev => (prev ?? 0) + 1);
              }

              if (data.error) {
                throw new Error(data.error);
              }
            } catch (parseError) {
              // Only skip JSON parse errors (incomplete chunks), re-throw everything else
              if (parseError instanceof SyntaxError) {
                // Skip incomplete JSON chunks
                continue;
              }
              throw parseError;
            }
          }
        }
      }

      // If stream ended without receiving done signal, fetch the actual response from DB
      if (!receivedDone && realChatId) {
        try {
          const chatRes = await fetch(`/api/chats/${realChatId}`);
          if (chatRes.ok) {
            const chatData = await chatRes.json();
            if (chatData.chat?.messages) {
              setChats(prev =>
                prev.map(c =>
                  c.id === realChatId
                    ? { ...c, messages: chatData.chat.messages, title: chatData.chat.title || c.title }
                    : c
                )
              );
              setLocalMessagesUsed(prev => (prev ?? 0) + 1);
            }
          }
        } catch {
          // Recovery failed, but don't throw - the message might still be there on refresh
          console.warn('Stream interrupted - response may be available on refresh');
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      // Remove failed chat or messages on error
      setChats(prev => {
        // If it was a new chat that failed, remove the whole chat
        if (needsNewChat) {
          return prev.filter(c => c.id !== activeChatId && c.id !== realChatId);
        }
        // Otherwise just remove the failed messages
        return prev.map(c =>
          (c.id === activeChatId || c.id === realChatId)
            ? {
                ...c,
                messages: c.messages.filter(m =>
                  m.id !== optimisticMessage.id && m.id !== assistantMessageId
                )
              }
            : c
        );
      });
      if (needsNewChat) {
        setCurrentChatId(null);
      }
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      setSearchQuery(null);
    }
  };

  const selectChat = (id: string) => {
    setCurrentChatId(id);
  };

  // Instant UI action - just clears the current chat
  const startNewChat = () => {
    setCurrentChatId(null);
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    // Optimistic update - instant UI feedback
    const previousChats = [...chats];
    setChats(prev =>
      prev.map(c =>
        c.id === chatId ? { ...c, title: newTitle } : c
      )
    );

    // API call in background
    try {
      const res = await fetch('/api/chats/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, title: newTitle }),
      });

      if (!res.ok) {
        // Revert on failure
        setChats(previousChats);
      }
    } catch (error) {
      console.error('Failed to rename chat:', error);
      setChats(previousChats);
    }
  };

  const deleteChat = async (chatId: string) => {
    // Optimistic update - instant UI feedback
    const previousChats = [...chats];
    const wasCurrentChat = currentChatId === chatId;

    setChats(prev => prev.filter(c => c.id !== chatId));
    if (wasCurrentChat) {
      setCurrentChatId(null);
    }

    // API call in background
    try {
      const res = await fetch('/api/chats/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      });

      if (!res.ok) {
        // Revert on failure
        setChats(previousChats);
        if (wasCurrentChat) {
          setCurrentChatId(chatId);
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      setChats(previousChats);
      if (wasCurrentChat) {
        setCurrentChatId(chatId);
      }
    }
  };

  return {
    chats,
    currentChat,
    currentChatId,
    isLoading,
    isChatsLoaded,
    isSearching,
    searchQuery,
    messagesEndRef,
    messagesUsed,
    sendMessage,
    createNewChat,
    startNewChat,
    selectChat,
    renameChat,
    deleteChat,
    canSendMessage,
    getRemainingMessages,
  };
}