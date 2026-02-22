import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { PLAN_LIMITS } from '@/lib/constants';
import { track, incrementUserProperty, EVENTS } from '@/lib/analytics';

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  image_url?: string;
  file_type?: string;
  file_name?: string;
  character_id?: string;
  character_name?: string;
  character_color_bg?: string;
  character_color_fg?: string;
  character_color_border?: string;
  character_color_bg_light?: string;
  character_color_tag?: string;
  isFinalized?: boolean; // True for messages that shouldn't show action buttons (e.g., pre-search messages)
  isError?: boolean; // True if this message failed to load - shows error state with retry
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  created_at: string;
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
  // Track pending chat ID during temp->real ID transition
  const pendingChatIdRef = useRef<string | null>(null);
  // AbortController for canceling ongoing requests
  const abortControllerRef = useRef<AbortController | null>(null);
  // Fire daily_limit_reached only once per session
  const dailyLimitFiredRef = useRef(false);
  // Milestone tracking refs (seeded from session on first render)
  const firstMessageSentRef = useRef(false);
  const totalMessageCountRef = useRef(0);
  const activationMilestonesRef = useRef(new Set<number>());

  // Wrapper to persist currentChatId to localStorage
  const setCurrentChatId = (chatId: string | null) => {
    setCurrentChatIdState(chatId);
    setStoredChatId(chatId);
  };

  // Track user changes (for clearing stored chat on account switch)
  const userId = session?.user?.id ?? null;
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (userId && userId !== lastUserIdRef.current) {
      // Reset local counter so it falls back to session value from DB
      setLocalMessagesUsed(null);
      // Clear stored chat when switching accounts
      if (lastUserIdRef.current !== null) {
        setStoredChatId(null);
        setCurrentChatIdState(null);
      }
      lastUserIdRef.current = userId;
    }
  }, [userId]);


  // Load chats from API when user logs in
  useEffect(() => {
    if (!session?.user) return;
    // Don't reload chats if already loaded (prevents overwriting during streaming)
    if (isChatsLoaded) return;

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
  }, [session, isChatsLoaded]);

  // Smart auto-scroll: only when message count increases
  useEffect(() => {
    const chat = chats.find(c => c.id === currentChatId || c.id === pendingChatIdRef.current);
    const currentMessageCount = chat?.messages.length || 0;

    if (currentMessageCount > previousMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    previousMessageCountRef.current = currentMessageCount;
  }, [chats, currentChatId]);

  // Find current chat - check both currentChatId and pendingChatIdRef for ID transitions
  const currentChat = currentChatId
    ? chats.find((c) => c.id === currentChatId || c.id === pendingChatIdRef.current) || null
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

  // Topic detection for analytics (reuses patterns from generateTitleFromText)
  const detectTopic = (text: string): string | null => {
    const t = text.toLowerCase();
    if (/\b(hi|hello|hey|heyy|hiii|sup|yo)\b/.test(t)) return 'greeting';
    if (t.includes('help') && t.includes('code')) return 'coding';
    if (t.includes('sql') || t.includes('query') || t.includes('database')) return 'database';
    if (t.includes('design') || t.includes('ui') || t.includes('ux')) return 'design';
    if (t.includes('data') && (t.includes('story') || t.includes('analysis'))) return 'data_analysis';
    if (t.includes('weight') || t.includes('gym') || t.includes('fitness') || t.includes('workout')) return 'fitness';
    if (t.includes('recipe') || t.includes('cook') || t.includes('food')) return 'cooking';
    if (t.includes('advice') || t.includes('should i') || t.includes('what do you think')) return 'advice';
    if (t.includes('explain') || t.includes('what is') || t.includes('how does')) return 'learning';
    if (t.includes('debug') || t.includes('error') || t.includes('bug')) return 'debugging';
    if (t.includes('relationship') || t.includes('boyfriend') || t.includes('girlfriend') || t.includes('partner') || t.includes('mama') || t.includes('dad') || t.includes('family')) return 'relationships';
    if (t.includes('business') || t.includes('startup') || t.includes('revenue') || t.includes('marketing')) return 'business';
    return null;
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
      track(EVENTS.CHAT_CREATED, { source: 'new_chat' });
      return data.chat.id;
    } catch (error) {
      console.error('Failed to create chat:', error);
      return null;
    }
  };

  // Creates a chat AND adds it to the chats list immediately (for character creation flow)
  const createChatWithEntry = async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New conversation' }),
      });

      const data = await res.json();

      if (!res.ok || !data.chat) {
        console.error('Failed to create chat:', res.status, data);
        return null;
      }

      // Add to chats list so currentChat won't be null (avoids infinite loading)
      const newChat: Chat = {
        id: data.chat.id,
        title: data.chat.title || 'New conversation',
        created_at: data.chat.created_at || new Date().toISOString(),
        messages: [],
      };
      setChats(prev => {
        // Prevent duplicates if chat already exists from a concurrent fetch
        if (prev.some(c => c.id === data.chat.id)) return prev;
        return [newChat, ...prev];
      });
      setCurrentChatId(data.chat.id);
      track(EVENTS.CHAT_CREATED, { source: 'character_flow' });
      return data.chat.id;
    } catch (error) {
      console.error('Failed to create chat:', error);
      return null;
    }
  };

  const sendMessage = async (input: string, imageUrl?: string, fileData?: { url: string; fileType: string; fileName: string }, characterId?: string) => {
    if (!input.trim() || isLoading) return;
    if (!canSendMessage()) {
      if (!dailyLimitFiredRef.current) {
        dailyLimitFiredRef.current = true;
        track(EVENTS.DAILY_LIMIT_REACHED, { plan: session?.user?.plan });
      }
      return;
    }

    // Images/files cost 2 messages, text costs 1
    const messageCost = (imageUrl || fileData) ? 2 : 1;

    setIsLoading(true);

    let activeChatId = currentChatId;
    let needsNewChat = false;

    // Check if this is the first message (new chat)
    // Check both activeChatId and pendingChatIdRef for robustness
    const existingChat = activeChatId
      ? chats.find(c => c.id === activeChatId || c.id === pendingChatIdRef.current)
      : null;
    const isFirstMessage = !activeChatId || !existingChat || existingChat.messages.length === 0;

    // Optimistically add user message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
      image_url: fileData?.url || imageUrl,
      file_type: fileData?.fileType,
      file_name: fileData?.fileName,
    };

    // Create assistant message placeholder for streaming
    let assistantMessageId = `msg-${Date.now()}`;
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
      // Track pending ID for lookups during ID transition
      pendingChatIdRef.current = optimisticId;
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
      // Check both IDs for robustness during any potential ID transitions
      setChats(prev =>
        prev.map(c =>
          (c.id === activeChatId || c.id === pendingChatIdRef.current)
            ? { ...c, messages: [...c.messages, optimisticMessage, assistantMessage] }
            : c
        )
      );
    }

    // Track message sent
    track(EVENTS.MESSAGE_SENT, {
      message_length: input.length,
      has_attachment: !!(imageUrl || fileData),
      is_first_message: isFirstMessage,
    });
    incrementUserProperty('total_messages');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('mp_message_sent'));
    }
    if (characterId) {
      track(EVENTS.CHARACTER_MENTIONED, { character_id: characterId });
    }

    // Topic detection
    const topic = detectTopic(input);
    if (topic) {
      track(EVENTS.TOPIC_DETECTED, { topic });
    }

    // First message ever + activation milestones
    if (!firstMessageSentRef.current) {
      firstMessageSentRef.current = true;
      track(EVENTS.FIRST_MESSAGE_SENT);
    }
    totalMessageCountRef.current += 1;
    const milestoneThresholds = [3, 10, 50];
    for (const threshold of milestoneThresholds) {
      if (totalMessageCountRef.current === threshold && !activationMilestonesRef.current.has(threshold)) {
        activationMilestonesRef.current.add(threshold);
        track(EVENTS.ACTIVATION_MILESTONE, { total_messages: threshold });
      }
    }

    let realChatId = activeChatId;
    let streamedContent = ''; // Declare here so it's accessible in catch block
    let responseStartTime = Date.now();

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
        // Clear pending ref after transition complete
        pendingChatIdRef.current = null;
      }

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      responseStartTime = Date.now();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: realChatId,
          message: input,
          imageUrl: imageUrl || undefined,
          fileUrl: fileData?.url || undefined,
          fileType: fileData?.fileType || undefined,
          fileName: fileData?.fileName || undefined,
          characterId: characterId || undefined,
        }),
        signal: abortControllerRef.current.signal,
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

      streamedContent = ''; // Reset for this request (declared before try block)
      let receivedDone = false;
      let receivedCharacterInfo: { name?: string } | null = null;
      let chunkCount = 0;
      const streamStartTime = Date.now();
      let streamingStartTracked = false;

      // Timeout check
      if (Date.now() - responseStartTime > 30000) {
        track(EVENTS.AI_RESPONSE_TIMEOUT, { wait_ms: Date.now() - responseStartTime });
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              // Track streaming_started on first data chunk
              if (!streamingStartTracked && !data.searching) {
                streamingStartTracked = true;
                track(EVENTS.STREAMING_STARTED);
              }

              if (data.searching !== undefined) {
                setIsSearching(data.searching);
                setSearchQuery(data.query || null);
              }

              // Handle characterInfo - apply character styling to assistant message
              if (data.characterInfo) {
                receivedCharacterInfo = { name: data.characterInfo.name };
                const ci = data.characterInfo;
                setChats(prev =>
                  prev.map(c =>
                    (c.id === realChatId || c.id === activeChatId)
                      ? {
                          ...c,
                          messages: c.messages.map(m =>
                            m.id === assistantMessageId
                              ? {
                                  ...m,
                                  character_id: ci.id,
                                  character_name: ci.name,
                                  character_color_bg: ci.color_bg,
                                  character_color_fg: ci.color_fg,
                                  character_color_border: ci.color_border,
                                  character_color_bg_light: ci.color_bg_light,
                                  character_color_tag: ci.color_tag,
                                }
                              : m
                          ),
                        }
                      : c
                  )
                );
              }

              // Handle finalizeMessage - mark current message as finalized (no action buttons)
              if (data.finalizeMessage) {
                setChats(prev =>
                  prev.map(c =>
                    (c.id === realChatId || c.id === activeChatId)
                      ? {
                          ...c,
                          messages: c.messages.map(m =>
                            m.id === assistantMessageId
                              ? { ...m, isFinalized: true }
                              : m
                          ),
                        }
                      : c
                  )
                );
              }

              // Handle newMessage - create a new assistant message for post-search content
              if (data.newMessage) {
                const newAssistantId = `msg-${Date.now()}-post`;
                const newAssistantMessage: Message = {
                  id: newAssistantId,
                  role: 'assistant',
                  content: '',
                  created_at: new Date().toISOString(),
                };
                assistantMessageId = newAssistantId;
                streamedContent = '';
                setChats(prev =>
                  prev.map(c =>
                    (c.id === realChatId || c.id === activeChatId)
                      ? { ...c, messages: [...c.messages, newAssistantMessage] }
                      : c
                  )
                );
              }

              if (data.text) {
                streamedContent += data.text;
                chunkCount++;
                // Update assistant message content in real-time
                // Check both activeChatId and realChatId in case ID update hasn't propagated
                const contentToSet = streamedContent; // Capture in closure to avoid race conditions
                setChats(prev =>
                  prev.map(c =>
                    (c.id === realChatId || c.id === activeChatId)
                      ? {
                          ...c,
                          messages: c.messages.map(m =>
                            m.id === assistantMessageId
                              // Safety: never replace existing content with empty/shorter content
                              ? { ...m, content: contentToSet.length >= (m.content?.length || 0) ? contentToSet : m.content }
                              : m
                          ),
                        }
                      : c
                  )
                );
              }

              if (data.title) {
                // Update chat title
                // Check both IDs in case update hasn't propagated
                setChats(prev =>
                  prev.map(c =>
                    (c.id === realChatId || c.id === activeChatId)
                      ? { ...c, title: data.title }
                      : c
                  )
                );
              }

              if (data.done) {
                receivedDone = true;
                // Update local message count (images/files cost 2)
                setLocalMessagesUsed(prev => (prev ?? session?.user?.messagesUsedToday ?? 0) + messageCost);
                const responseTimeMs = Date.now() - responseStartTime;
                track(EVENTS.MESSAGE_RECEIVED, {
                  response_time_ms: responseTimeMs,
                  response_length: streamedContent.length,
                  is_character: !!receivedCharacterInfo,
                  character_name: receivedCharacterInfo?.name,
                });
                if (receivedCharacterInfo) {
                  track(EVENTS.CHARACTER_RESPONSE_RECEIVED, {
                    character_name: receivedCharacterInfo.name,
                    response_time_ms: responseTimeMs,
                    response_length: streamedContent.length,
                  });
                }

                // Streaming quality events
                track(EVENTS.STREAMING_COMPLETED, {
                  total_chunks: chunkCount,
                  duration_ms: Date.now() - streamStartTime,
                });
                if (streamedContent.trim() === '') {
                  track(EVENTS.AI_RESPONSE_EMPTY);
                }

                // Conversation depth milestones
                const chatForDepth = chats.find(c => c.id === realChatId || c.id === activeChatId);
                const messageCount = (chatForDepth?.messages.length || 0) + 2; // +2 for current pair
                const depthMilestones = [5, 10, 20];
                for (const dm of depthMilestones) {
                  if (messageCount >= dm && messageCount < dm + 2) {
                    track(EVENTS.CONVERSATION_DEPTH_MILESTONE, { depth: dm });
                  }
                }
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

      // If stream ended without receiving done signal but we got content, trust local state
      // Only fetch from DB if we got NO content at all (complete failure)
      if (!receivedDone && realChatId && !streamedContent) {
        try {
          const chatRes = await fetch(`/api/chats/${realChatId}`);
          if (chatRes.ok) {
            const chatData = await chatRes.json();
            if (chatData.chat?.messages) {
              // Check both IDs in case update hasn't propagated
              setChats(prev =>
                prev.map(c =>
                  (c.id === realChatId || c.id === activeChatId)
                    ? { ...c, id: realChatId, messages: chatData.chat.messages, title: chatData.chat.title || c.title }
                    : c
                )
              );
              setLocalMessagesUsed(prev => (prev ?? session?.user?.messagesUsedToday ?? 0) + messageCost);
            }
          }
        } catch {
          // Recovery failed, but don't throw - the message might still be there on refresh
          console.warn('Stream interrupted - response may be available on refresh');
        }
      } else if (!receivedDone && streamedContent) {
        // We got content but no done signal - still count it as a message
        setLocalMessagesUsed(prev => (prev ?? session?.user?.messagesUsedToday ?? 0) + messageCost);
      }

    } catch (error) {
      // If user stopped the generation, don't show error - keep whatever was streamed
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Generation stopped by user');
        track(EVENTS.STREAMING_INTERRUPTED, {
          streamed_length: streamedContent.length,
          duration_ms: Date.now() - responseStartTime,
        });
        // Backend already counted this message, so update frontend count
        setLocalMessagesUsed(prev => (prev ?? session?.user?.messagesUsedToday ?? 0) + messageCost);
        // Remove empty assistant message if no content was streamed
        if (!streamedContent) {
          setChats(prev => prev.map(c =>
            (c.id === activeChatId || c.id === realChatId)
              ? { ...c, messages: c.messages.filter(m => m.id !== assistantMessageId) }
              : c
          ));
        }
        return;
      }

      console.error('Error sending message:', error);
      track(EVENTS.AI_RESPONSE_ERROR, {
        error_type: error instanceof Error ? error.message.slice(0, 100) : 'unknown',
      });
      // Instead of removing messages, show an error state that allows retry
      setChats(prev => {
        return prev.map(c =>
          (c.id === activeChatId || c.id === realChatId)
            ? {
                ...c,
                messages: c.messages.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: 'Something went wrong. Please try again.', isError: true }
                    : m
                )
              }
            : c
        );
      });
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      setSearchQuery(null);
      pendingChatIdRef.current = null;
      abortControllerRef.current = null;

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
      } else {
        track(EVENTS.CHAT_DELETED);
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      setChats(previousChats);
      if (wasCurrentChat) {
        setCurrentChatId(chatId);
      }
    }
  };

  // Edit a user message and resend to get new AI response
  const editMessage = async (messageId: string, newContent: string) => {
    if (!currentChatId || isLoading || !canSendMessage()) return;
    track(EVENTS.MESSAGE_EDITED);

    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    // Find the message index
    const messageIndex = chat.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    setIsLoading(true);

    // Remove all messages from this point onwards (the edited message and everything after)
    const messagesBeforeEdit = chat.messages.slice(0, messageIndex);

    // Create new user message
    const newUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: newContent,
      created_at: new Date().toISOString(),
    };

    // Create assistant message placeholder for streaming
    let assistantMessageId = `msg-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };

    // Update chat with truncated messages + new user message + assistant placeholder
    setChats(prev =>
      prev.map(c =>
        c.id === currentChatId
          ? { ...c, messages: [...messagesBeforeEdit, newUserMessage, assistantMessage] }
          : c
      )
    );

    let streamedContent = ''; // Declare here so it's accessible in catch block
    let editResponseStartTime = Date.now();

    try {
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: currentChatId,
          message: newContent,
          editFromMessageIndex: messageIndex, // Tell backend to truncate from this point
        }),
        signal: abortControllerRef.current.signal,
      });

      editResponseStartTime = Date.now();

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      // Handle streaming response (same as sendMessage)
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      streamedContent = ''; // Reset for this request (declared before try block)
      let receivedDone = false;
      let editChunkCount = 0;
      const editStreamStart = Date.now();
      let editStreamingStartTracked = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              // Track streaming_started on first data chunk
              if (!editStreamingStartTracked && !data.searching) {
                editStreamingStartTracked = true;
                track(EVENTS.STREAMING_STARTED);
              }

              if (data.searching !== undefined) {
                setIsSearching(data.searching);
                setSearchQuery(data.query || null);
              }

              // Handle finalizeMessage - mark current message as finalized (no action buttons)
              if (data.finalizeMessage) {
                setChats(prev =>
                  prev.map(c =>
                    c.id === currentChatId
                      ? {
                          ...c,
                          messages: c.messages.map(m =>
                            m.id === assistantMessageId
                              ? { ...m, isFinalized: true }
                              : m
                          ),
                        }
                      : c
                  )
                );
              }

              // Handle newMessage - create a new assistant message for post-search content
              if (data.newMessage) {
                const newAssistantId = `msg-${Date.now()}-post`;
                const newAssistantMessage: Message = {
                  id: newAssistantId,
                  role: 'assistant',
                  content: '',
                  created_at: new Date().toISOString(),
                };
                assistantMessageId = newAssistantId;
                streamedContent = '';
                setChats(prev =>
                  prev.map(c =>
                    c.id === currentChatId
                      ? { ...c, messages: [...c.messages, newAssistantMessage] }
                      : c
                  )
                );
              }

              if (data.text) {
                streamedContent += data.text;
                editChunkCount++;
                const contentToSet = streamedContent; // Capture in closure to avoid race conditions
                setChats(prev =>
                  prev.map(c =>
                    c.id === currentChatId
                      ? {
                          ...c,
                          messages: c.messages.map(m =>
                            m.id === assistantMessageId
                              // Safety: never replace existing content with empty/shorter content
                              ? { ...m, content: contentToSet.length >= (m.content?.length || 0) ? contentToSet : m.content }
                              : m
                          ),
                        }
                      : c
                  )
                );
              }

              if (data.done) {
                receivedDone = true;
                setLocalMessagesUsed(prev => (prev ?? session?.user?.messagesUsedToday ?? 0) + 1);
                track(EVENTS.STREAMING_COMPLETED, {
                  total_chunks: editChunkCount,
                  duration_ms: Date.now() - editStreamStart,
                });
                if (streamedContent.trim() === '') {
                  track(EVENTS.AI_RESPONSE_EMPTY);
                }
              }

              if (data.error) {
                throw new Error(data.error);
              }
            } catch (parseError) {
              if (parseError instanceof SyntaxError) continue;
              throw parseError;
            }
          }
        }
      }

      // Don't refetch from DB for edit - trust local state
      if (!receivedDone) {
        setLocalMessagesUsed(prev => (prev ?? session?.user?.messagesUsedToday ?? 0) + 1);
      }
    } catch (error) {
      // If user stopped the generation, don't show error - keep whatever was streamed
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Generation stopped by user');
        track(EVENTS.STREAMING_INTERRUPTED, {
          streamed_length: streamedContent.length,
          duration_ms: Date.now() - editResponseStartTime,
        });
        // Backend already counted this message, so update frontend count
        setLocalMessagesUsed(prev => (prev ?? session?.user?.messagesUsedToday ?? 0) + 1);
        if (!streamedContent) {
          setChats(prev => prev.map(c =>
            c.id === currentChatId
              ? { ...c, messages: c.messages.filter(m => m.id !== assistantMessageId) }
              : c
          ));
        }
        return;
      }

      console.error('Error editing message:', error);
      track(EVENTS.AI_RESPONSE_ERROR, {
        error_type: error instanceof Error ? error.message.slice(0, 100) : 'unknown',
      });
      // Instead of removing messages, show an error state that allows retry
      setChats(prev =>
        prev.map(c =>
          c.id === currentChatId
            ? {
                ...c,
                messages: c.messages.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: 'Something went wrong. Please try again.', isError: true }
                    : m
                )
              }
            : c
        )
      );
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      setSearchQuery(null);
      abortControllerRef.current = null;
    }
  };

  // Regenerate the AI response for a user message
  const regenerateResponse = async (userMessageId: string) => {
    if (!currentChatId || isLoading || !canSendMessage()) return;
    track(EVENTS.MESSAGE_REGENERATED);

    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    // Find the user message
    const messageIndex = chat.messages.findIndex(m => m.id === userMessageId);
    if (messageIndex === -1) return;

    const userMessage = chat.messages[messageIndex];
    if (userMessage.role !== 'user') return;

    setIsLoading(true);

    // Keep messages up to and including the user message, remove assistant response after it
    const messagesUpToUser = chat.messages.slice(0, messageIndex + 1);

    // Create assistant message placeholder for streaming
    let assistantMessageId = `msg-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };

    // Update chat with messages up to user + new assistant placeholder
    setChats(prev =>
      prev.map(c =>
        c.id === currentChatId
          ? { ...c, messages: [...messagesUpToUser, assistantMessage] }
          : c
      )
    );

    let streamedContent = ''; // Declare here so it's accessible in catch block
    let regenResponseStartTime = Date.now();

    try {
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: currentChatId,
          message: userMessage.content,
          regenerate: true,
          regenerateFromIndex: messageIndex,
        }),
        signal: abortControllerRef.current.signal,
      });

      regenResponseStartTime = Date.now();

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to regenerate');
      }

      // Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      streamedContent = ''; // Reset for this request (declared before try block)
      let receivedDone = false;
      let regenChunkCount = 0;
      const regenStreamStart = Date.now();
      let regenStreamingStartTracked = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              // Track streaming_started on first data chunk
              if (!regenStreamingStartTracked && !data.searching) {
                regenStreamingStartTracked = true;
                track(EVENTS.STREAMING_STARTED);
              }

              if (data.searching !== undefined) {
                setIsSearching(data.searching);
                setSearchQuery(data.query || null);
              }

              // Handle finalizeMessage - mark current message as finalized (no action buttons)
              if (data.finalizeMessage) {
                setChats(prev =>
                  prev.map(c =>
                    c.id === currentChatId
                      ? {
                          ...c,
                          messages: c.messages.map(m =>
                            m.id === assistantMessageId
                              ? { ...m, isFinalized: true }
                              : m
                          ),
                        }
                      : c
                  )
                );
              }

              // Handle newMessage - create a new assistant message for post-search content
              if (data.newMessage) {
                const newAssistantId = `msg-${Date.now()}-post`;
                const newAssistantMessage: Message = {
                  id: newAssistantId,
                  role: 'assistant',
                  content: '',
                  created_at: new Date().toISOString(),
                };
                assistantMessageId = newAssistantId;
                streamedContent = '';
                setChats(prev =>
                  prev.map(c =>
                    c.id === currentChatId
                      ? { ...c, messages: [...c.messages, newAssistantMessage] }
                      : c
                  )
                );
              }

              if (data.text) {
                streamedContent += data.text;
                regenChunkCount++;
                const contentToSet = streamedContent; // Capture in closure to avoid race conditions
                setChats(prev =>
                  prev.map(c =>
                    c.id === currentChatId
                      ? {
                          ...c,
                          messages: c.messages.map(m =>
                            m.id === assistantMessageId
                              // Safety: never replace existing content with empty/shorter content
                              ? { ...m, content: contentToSet.length >= (m.content?.length || 0) ? contentToSet : m.content }
                              : m
                          ),
                        }
                      : c
                  )
                );
              }

              if (data.done) {
                receivedDone = true;
                setLocalMessagesUsed(prev => (prev ?? session?.user?.messagesUsedToday ?? 0) + 1);
                track(EVENTS.STREAMING_COMPLETED, {
                  total_chunks: regenChunkCount,
                  duration_ms: Date.now() - regenStreamStart,
                });
                if (streamedContent.trim() === '') {
                  track(EVENTS.AI_RESPONSE_EMPTY);
                }
              }

              if (data.error) {
                throw new Error(data.error);
              }
            } catch (parseError) {
              if (parseError instanceof SyntaxError) continue;
              throw parseError;
            }
          }
        }
      }

      // Don't refetch from DB for regenerate - trust local state
      // The backend has already updated the DB, local state is correct
      if (!receivedDone) {
        // Just increment the message count if stream didn't send done signal
        setLocalMessagesUsed(prev => (prev ?? session?.user?.messagesUsedToday ?? 0) + 1);
      }
    } catch (error) {
      // If user stopped the generation, don't show error - keep whatever was streamed
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Generation stopped by user');
        track(EVENTS.STREAMING_INTERRUPTED, {
          streamed_length: streamedContent.length,
          duration_ms: Date.now() - regenResponseStartTime,
        });
        // Backend already counted this message, so update frontend count
        setLocalMessagesUsed(prev => (prev ?? session?.user?.messagesUsedToday ?? 0) + 1);
        if (!streamedContent) {
          setChats(prev => prev.map(c =>
            c.id === currentChatId
              ? { ...c, messages: c.messages.filter(m => m.id !== assistantMessageId) }
              : c
          ));
        }
        return;
      }

      console.error('Error regenerating response:', error);
      track(EVENTS.AI_RESPONSE_ERROR, {
        error_type: error instanceof Error ? error.message.slice(0, 100) : 'unknown',
      });
      // Instead of removing messages, show an error state that allows retry
      setChats(prev =>
        prev.map(c =>
          c.id === currentChatId
            ? {
                ...c,
                messages: c.messages.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: 'Something went wrong. Please try again.', isError: true }
                    : m
                )
              }
            : c
        )
      );
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      setSearchQuery(null);
      abortControllerRef.current = null;
    }
  };

  // Stop the current generation
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsSearching(false);
    setSearchQuery(null);
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
    createChatWithEntry,
    startNewChat,
    selectChat,
    renameChat,
    deleteChat,
    editMessage,
    regenerateResponse,
    stopGeneration,
    canSendMessage,
    getRemainingMessages,
  };
}