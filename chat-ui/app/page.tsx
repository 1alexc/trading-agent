"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";

interface Thought {
  agent: string;
  type: string;
  details: string;
}

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  thoughts?: Thought[];
  timestamp: Date;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize session ID on mount
  useEffect(() => {
    const randomId = `sess-${Math.random().toString(36).substring(2, 11)}`;
    setSessionId(randomId);
    checkServerStatus();

    // Check status every 5 seconds to keep the Online/Offline status badge updated
    const interval = setInterval(checkServerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const checkServerStatus = async () => {
    try {
      const res = await fetch("/api/chat", { 
        method: "GET",
        headers: { "Cache-Control": "no-cache" }
      });
      if (res.ok) {
        setStatus("connected");
      } else {
        setStatus("disconnected");
      }
    } catch (err) {
      setStatus("disconnected");
    }
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    setError(null);
    setLoading(true);

    const userMessageId = `msg-${Date.now()}-user`;
    const userMessage: Message = {
      id: userMessageId,
      sender: "user",
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          sessionId: sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "An error occurred while calling the agent.");
      }

      const agentMessageId = `msg-${Date.now()}-agent`;
      const agentMessage: Message = {
        id: agentMessageId,
        sender: "agent",
        text: data.answer,
        thoughts: data.thoughts || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, agentMessage]);
      setStatus("connected");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to communicate with the Stocks & Crypto agent.");
      
      // Only set status to disconnected if it is a network error (e.g. server crashed/offline)
      if (err instanceof TypeError || err.message?.toLowerCase().includes("failed to fetch")) {
        setStatus("disconnected");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(inputText);
  };

  const toggleThoughts = (messageId: string) => {
    setExpandedThoughts((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    const newId = `sess-${Math.random().toString(36).substring(2, 11)}`;
    setSessionId(newId);
  };

  const quickSuggestions = [
    "what is the price of bitcoin today?",
    "what is the price of ethereum?",
    "how is Tesla stock (TSLA) doing today?",
    "give me stock market analysis for Apple (AAPL)",
  ];

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div>
          <div className={styles.brand}>
            <div className={styles.logoIcon}>$</div>
            <div className={styles.brandName}>TrAdeGent</div>
          </div>

          <h2 className={styles.sectionTitle}>Quick Queries</h2>
          <div className={styles.suggestionsList}>
            {quickSuggestions.map((query, index) => (
              <button
                key={index}
                className={styles.suggestionBtn}
                onClick={() => handleSend(query)}
                disabled={loading}
              >
                {query}
              </button>
            ))}
          </div>
        </div>

        {/* Status Indicator */}
        <div className={styles.statusContainer}>
          <div className={styles.statusItem}>
            <span>Agent Server</span>
            <span
              className={`${styles.statusBadge} ${
                status === "connected"
                  ? styles.badgeConnected
                  : status === "disconnected"
                  ? styles.badgeDisconnected
                  : ""
              }`}
            >
              {status !== "checking" && <span className={styles.dotPulse} />}
              {status === "checking"
                ? "Checking..."
                : status === "connected"
                ? "Online"
                : "Offline"}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>Session ID:</span>
            <code style={{ fontSize: "0.7rem", color: "#cbd5e1" }}>{sessionId.slice(5)}</code>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={styles.chatArea}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>
              Stocks & Crypto Coordinator
              <span className={styles.headerSubtitle}>powered by Google ADK, CoinGecko and Alpha Vantage</span>
            </h1>
          </div>
          <button className={styles.clearBtn} onClick={clearChat}>
            Reset Session
          </button>
        </header>

        {/* Messages */}
        <div className={styles.messagesWrapper}>
          {messages.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                opacity: 0.4,
                textAlign: "center",
                padding: "2rem",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>💬</div>
              <h3>Ask a question about stocks or crypto</h3>
              <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
                Type your question below or click one of the quick suggestions on the sidebar.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.messageRow} ${
                msg.sender === "user" ? styles.messageRowUser : styles.messageRowAgent
              }`}
            >
              <div
                className={`${styles.messageBubble} ${
                  msg.sender === "user" ? styles.messageUser : styles.messageAgent
                }`}
              >
                <div className={styles.senderName}>
                  {msg.sender === "user" ? "User" : "Agent"}
                </div>
                <div className={styles.messageContent}>{msg.text}</div>

                {/* Thought Process for Agent */}
                {msg.sender === "agent" && msg.thoughts && msg.thoughts.length > 0 && (
                  <div className={styles.thoughtsContainer}>
                    <div
                      className={styles.thoughtsHeader}
                      onClick={() => toggleThoughts(msg.id)}
                    >
                      <span>Thought Process ({msg.thoughts.length} steps)</span>
                      <span
                        className={`${styles.thoughtsIcon} ${
                          expandedThoughts[msg.id] ? styles.thoughtsIconOpen : ""
                        }`}
                      >
                        ▶
                      </span>
                    </div>

                    {expandedThoughts[msg.id] && (
                      <div className={styles.thoughtsList}>
                        {msg.thoughts.map((thought, idx) => (
                          <div key={idx} className={styles.thoughtItem}>
                            <span
                              className={`${styles.thoughtType} ${
                                thought.type === "handoff"
                                  ? styles.typeHandoff
                                  : thought.type === "tool_call"
                                  ? styles.typeToolCall
                                  : styles.typeToolResponse
                                  ? styles.typeToolResponse
                                  : ""
                              }`}
                            >
                              {thought.type.replace("_", " ")}
                            </span>
                            <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                              [{thought.agent}]
                            </span>{" "}
                            {thought.details}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div className={styles.messageRow}>
              <div className={styles.loadingBubble}>
                <div className={styles.typingDot}></div>
                <div className={styles.typingDot}></div>
                <div className={styles.typingDot}></div>
              </div>
            </div>
          )}
        </div>

        {/* Error notification */}
        {error && (
          <div className={styles.errorContainer}>
            <div>⚠️ {error}</div>
            <button className={styles.errorCloseBtn} onClick={() => setError(null)}>
              ✕
            </button>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about stocks or crypto (e.g., Apple stock, Bitcoin price)..."
              className={styles.textInput}
              disabled={loading}
              autoFocus
              id="chat-text-input"
            />
          </div>
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={loading || !inputText.trim()}
            id="chat-send-btn"
          >
            {loading ? "Thinking..." : "Send"}
          </button>
        </form>
      </main>
    </div>
  );
}
