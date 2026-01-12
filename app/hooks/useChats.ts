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

const PLAN_LIMITS = {
  'Free': 50,
  'Pro': 100,
  'Enterprise': Infinity
};

export function useChats() {
  const { data: session } = useSession();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);

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

  const canSendMessage = (): boolean => {
    if (!session?.user) return false;
    const limit = PLAN_LIMITS[session.user.plan as keyof typeof PLAN_LIMITS] || 50;
    return session.user.messagesUsedToday < limit;
  };

  const getRemainingMessages = (): number => {
    if (!session?.user) return 0;
    const limit = PLAN_LIMITS[session.user.plan as keyof typeof PLAN_LIMITS] || 50;
    if (limit === Infinity) return Infinity;
    return Math.max(0, limit - session.user.messagesUsedToday);
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
      const newChat = { ...data.chat, messages: [] };
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

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatId: activeChatId, 
          message: input 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
      };

      // Add assistant response and update title if returned
      setChats(prev =>
        prev.map(c =>
          c.id === activeChatId
            ? {
                ...c,
                messages: [...c.messages, assistantMessage],
                ...(data.title && { title: data.title }),
              }
            : c
        )
      );

    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setChats(prev =>
        prev.map(c =>
          c.id === activeChatId
            ? { ...c, messages: c.messages.filter(m => m.id !== optimisticMessage.id) }
            : c
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const selectChat = (id: string) => {
    setCurrentChatId(id);
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    try {
      const res = await fetch('/api/chats/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, title: newTitle }),
      });

      if (res.ok) {
        setChats(prev =>
          prev.map(c =>
            c.id === chatId ? { ...c, title: newTitle } : c
          )
        );
      }
    } catch (error) {
      console.error('Failed to rename chat:', error);
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      const res = await fetch('/api/chats/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      });

      if (res.ok) {
        setChats(prev => prev.filter(c => c.id !== chatId));
        if (currentChatId === chatId) {
          setCurrentChatId(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  return {
    chats,
    currentChat,
    currentChatId,
    isLoading,
    messagesEndRef,
    sendMessage,
    createNewChat,
    selectChat,
    renameChat,
    deleteChat,
    canSendMessage,
    getRemainingMessages,
  };
}