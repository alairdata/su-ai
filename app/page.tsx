"use client";

import React, { useEffect, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
};

export default function Home() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load chats + current chat selection from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedChats = window.localStorage.getItem("chats");
      const savedCurrentId = window.localStorage.getItem("currentChatId");

      if (savedChats) {
        setChats(JSON.parse(savedChats));
      }
      if (savedCurrentId) {
        setCurrentChatId(savedCurrentId);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Persist chats
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("chats", JSON.stringify(chats));
  }, [chats]);

  // Persist current chat id
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentChatId) {
      window.localStorage.setItem("currentChatId", currentChatId);
    } else {
      window.localStorage.removeItem("currentChatId");
    }
  }, [currentChatId]);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const currentChat = currentChatId
    ? chats.find((c) => c.id === currentChatId) || null
    : null;

  const messages: Message[] = currentChat?.messages ?? [];
  const showGreeting = !currentChat || messages.length === 0;

  // Generate a chat title from the first message text
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
    // Start fresh: no active chat selected yet
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
      // First message in a brand new chat → create chat
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
      // Append to existing chat
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

      // Append Claude's reply to the same chat
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

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div className="brand brand-text">Claude</div>
        </div>

        <div className="section">
          <div className="nav-item" onClick={handleNewChat}>
            <div className="nav-icon">+</div>
            <div className="nav-text">New chat</div>
          </div>

          <div className="nav-item">
            <div className="nav-icon">💬</div>
            <div className="nav-text">Chats</div>
          </div>
        </div>

        <div className="section-label">Recent chats</div>
        <div className="recents-list">
          {chats.length === 0 && (
            <div className="recent-item" style={{ opacity: 0.6 }}>
              No chats yet
            </div>
          )}
          {chats.map((chat) => (
            <div
              key={chat.id}
              className="recent-item"
              onClick={() => handleSelectChat(chat.id)}
              style={
                chat.id === currentChatId
                  ? { background: "#efe1cf", fontWeight: 500 }
                  : {}
              }
            >
              {chat.title}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="avatar">PA</div>
          <div className="user-info">
            <div style={{ fontSize: 13 }}>Princilla Abena Koranteng</div>
            <div style={{ fontSize: 11, color: "#85735a" }}>Free plan</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <div className="top-bar">
          <div className="pill">
            <span>Free plan</span> ·
            <span className="upgrade">Upgrade</span>
          </div>
          <div className="ghost">👻</div>
        </div>

        <div className={`main-center ${showGreeting ? "empty" : ""}`}>
          {showGreeting && (
            <>
              <div className="greeting-logo">✺</div>
              <div className="greeting-text">Afternoon, Princilla</div>
            </>
          )}

          {/* Chat history – only when we’re in a chat with messages */}
          {!showGreeting && (
            <div className="chat-container">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`message-row ${
                    m.role === "user" ? "user" : "assistant"
                  }`}
                >
                  <div
                    className={`message-bubble ${
                      m.role === "user" ? "user" : "assistant"
                    }`}
                  >
                    <div>{m.content}</div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="message-row assistant">
                  <div className="message-bubble assistant">
                    <div className="typing-indicator">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Input – always visible, but layout feels different when empty vs chatting */}
          <div className="input-card">
            <div className="input-row">
              <textarea
                rows={1}
                placeholder="What's up? Spill it..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                style={
                  isLoading || !input.trim()
                    ? { opacity: 0.5, cursor: "not-allowed" }
                    : {}
                }
              >
                ↑
              </button>
            </div>
          </div>
        </div>

        <div className="model-select">
          <span>Claude 3 Haiku</span> ▼
        </div>
      </main>
    </div>
  );
}
