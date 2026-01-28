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
  'Pro': 150,
  'Plus': 300
};

export function useChats() {
  const { data: session } = useSession();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [localMessagesUsed, setLocalMessagesUsed] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);

  // Sync local message count from session on initial load or user change
  const userId = session?.user?.id ?? null;
  const sessionMessagesUsed = session?.user?.messagesUsedToday ?? 0;
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only sync when user changes (login) or on first load
    if (userId && userId !== lastUserIdRef.current) {
      setLocalMessagesUsed(sessionMessagesUsed);
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
      } catch (error) {
        console.error('Failed to load chats:', error);
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
    
    let activeChatId = currentChatId;

    // Create new chat if none exists
    if (!activeChatId) {
      const newChatId = await createNewChat();
      if (!newChatId) return;
      activeChatId = newChatId;
    }

    setIsLoading(true);

    // Check if this is the first message
    const existingChat = chats.find(c => c.id === activeChatId);
    const isFirstMessage = !existingChat || existingChat.messages.length === 0;

    // Optimistically add user message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    };

    if (isFirstMessage) {
      // Create the chat in UI with smart title
      const smartTitle = generateTitleFromText(input);
      const newChat: Chat = {
        id: activeChatId!,
        title: smartTitle,
        messages: [optimisticMessage],
        created_at: new Date().toISOString(),
      };
      setChats(prev => [newChat, ...prev]);
    } else {
      // Add message to existing chat
      setChats(prev =>
        prev.map(c =>
          c.id === activeChatId
            ? { ...c, messages: [...c.messages, optimisticMessage] }
            : c
        )
      );
    }

    // Create assistant message placeholder for streaming
    const assistantMessageId = `msg-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };

    // Add empty assistant message immediately
    setChats(prev =>
      prev.map(c =>
        c.id === activeChatId
          ? { ...c, messages: [...c.messages, assistantMessage] }
          : c
      )
    );

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChatId,
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
                    c.id === activeChatId
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
                    c.id === activeChatId
                      ? { ...c, title: data.title }
                      : c
                  )
                );
              }

              if (data.done) {
                // Update local message count
                setLocalMessagesUsed(prev => (prev ?? 0) + 1);
              }

              if (data.error) {
                throw new Error(data.error);
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      // Remove both messages on error
      setChats(prev =>
        prev.map(c =>
          c.id === activeChatId
            ? {
                ...c,
                messages: c.messages.filter(m =>
                  m.id !== optimisticMessage.id && m.id !== assistantMessageId
                )
              }
            : c
        )
      );
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
    isSearching,
    searchQuery,
    messagesEndRef,
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