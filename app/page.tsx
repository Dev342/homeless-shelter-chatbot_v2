"use client";

import React, { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Define message type
type Msg = { role: "user" | "assistant"; content: string };

// SVG Icons
const ShieldIcon = ({ className = "w-6 h-6" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="-1 -2 26 28"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const UserIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const SearchIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const PhoneIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const FoodIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
  </svg>
);

const SupportIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

const SendIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

// Quick action button
const QuickActionButton = ({
  icon,
  text,
  onClick,
}: {
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex items-center space-x-3 p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors duration-200"
  >
    {icon}
    <span className="text-slate-700 font-medium text-sm">{text}</span>
  </button>
);

// --- MAIN COMPONENT ---
export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // GEOLOCATION
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: "Hello, I'm here to help you find shelter and support services. How can I assist you today?",
      },
    ]);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Request geolocation
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocError("Your device does not support location.");
      return;
    }

    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setLocLoading(false);
      },
      () => {
        setLocError("Unable to get your location.");
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // SEND MESSAGE
  const sendMessage = async (messageText: string | null = null) => {
    const userMessage = messageText || input.trim();
    if (!userMessage) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const body: any = { query: userMessage };
      if (userLocation) body.userLocation = userLocation;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        const err = await response.text().catch(() => "");
        throw new Error(err || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let aiMessageContent = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiMessageContent += decoder.decode(value, { stream: true });

        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: aiMessageContent },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "**Sorry, something went wrong.** Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Hello, I'm here to help you find shelter and support services. How can I assist you today?",
      },
    ]);
  };

  const handleQuickAction = (action: string) => {
    const quickMessages: Record<string, string> = {
      "Find nearby shelters": "I need help finding a place to stay tonight",
      "Emergency contacts": "Can you provide emergency contact numbers?",
      "Food resources": "Where can I find food assistance?",
      "Support services": "What support services are available?",
    };
    sendMessage(quickMessages[action]);
  };

  return (
    <div className="h-screen bg-white font-sans text-slate-800 flex flex-col p-4 sm:p-6 lg:p-8">
      <main className="w-full max-w-3xl mx-auto flex flex-col flex-1">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-sky-100 text-sky-600 p-2 rounded-full">
              <ShieldIcon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Shelter Support Chatbot</h1>
              <p className="text-sm text-slate-500">Here to help you find resources</p>
            </div>
          </div>

          <button
            onClick={startNewChat}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm"
          >
            + New Chat
          </button>
        </header>

        {/* Welcome */}
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-6 my-6">
          <h2 className="font-semibold text-slate-900 mb-2">Welcome. You're not alone.</h2>
          <p className="text-sm text-slate-600">
            This chatbot can help you find shelter information, emergency contacts, food resources,
            and support services in your area.
          </p>
        </div>

        {/* Messages */}
        <section className="flex-1 overflow-y-auto space-y-6 p-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start space-x-4 ${
                msg.role === "user"
                  ? "ml-auto flex-row-reverse space-x-reverse"
                  : ""
              }`}
            >
              <div
                className={`flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full ${
                  msg.role === "user" ? "bg-slate-100" : "bg-sky-100"
                }`}
              >
                {msg.role === "user" ? (
                  <UserIcon className="w-5 h-5 text-slate-500" />
                ) : (
                  <ShieldIcon className="w-5 h-5 text-sky-600" />
                )}
              </div>

              <div
                className={`p-4 rounded-xl ${
                  msg.role === "user"
                    ? "bg-slate-100 rounded-tr-none"
                    : "bg-sky-100 rounded-tl-none"
                }`}
              >
                <div
                  className={`text-sm ${
                    msg.role === "user" ? "text-slate-700" : "text-sky-800"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </Markdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start space-x-4 max-w-xl">
              <div className="h-10 w-10 bg-sky-100 rounded-full flex items-center justify-center">
                <ShieldIcon className="w-5 h-5 text-sky-600" />
              </div>
              <div className="bg-sky-100 p-4 rounded-xl rounded-tl-none">
                <p className="text-sm text-sky-800">Typing...</p>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </section>

        {/* Footer */}
        <footer className="space-y-6">
          {/* Location button */}
          <button
            onClick={useMyLocation}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            {locLoading ? "Getting location…" : "Use my location"}
          </button>

          {userLocation && (
            <p className="text-xs text-slate-500">
              Using your location: {userLocation.lat.toFixed(3)},{" "}
              {userLocation.lon.toFixed(3)}
            </p>
          )}

          {locError && (
            <p className="text-xs text-red-500">{locError}</p>
          )}

          {/* Quick Actions */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-slate-600">Quick actions:</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <QuickActionButton
                icon={<SearchIcon />}
                text="Find nearby shelters"
                onClick={() => handleQuickAction("Find nearby shelters")}
              />
              <QuickActionButton
                icon={<PhoneIcon />}
                text="Emergency contacts"
                onClick={() => handleQuickAction("Emergency contacts")}
              />
              <QuickActionButton
                icon={<FoodIcon />}
                text="Food resources"
                onClick={() => handleQuickAction("Food resources")}
              />
              <QuickActionButton
                icon={<SupportIcon />}
                text="Support services"
                onClick={() => handleQuickAction("Support services")}
              />
            </div>
          </section>

          {/* Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendMessage()
              }
              className="w-full pl-4 pr-14 py-3 text-base bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <SendIcon className="w-6 h-6" />
            </button>
          </div>

          <p className="text-center text-xs text-slate-400">
            Available 24/7 • Confidential • Free to use
          </p>
        </footer>
      </main>
    </div>
  );
}
