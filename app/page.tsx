"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input) return;
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: input }]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: input }),
    });

    // If using streaming — collect the text
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          if (updated[updated.length - 1]?.role === "assistant") {
            updated[updated.length - 1].content = fullText;
          } else {
            updated.push({ role: "assistant", content: fullText });
          }
          return updated;
        });
      }
    }

    setLoading(false);
    setInput("");
  }

  return (
    <main className="flex flex-col items-center p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">🏠 ShelterBot</h1>

      <div className="w-full bg-gray-100 rounded-xl p-4 min-h-[400px] overflow-y-auto whitespace-pre-wrap">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`mt-3 ${
              m.role === "user" ? "text-blue-700" : "text-gray-800"
            }`}
          >
            <b>{m.role === "user" ? "You" : "Bot"}:</b>
            <div className="mt-1 prose prose-sm max-w-none">
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && <div className="text-gray-500 mt-2">Thinking...</div>}
      </div>

      <div className="flex mt-4 w-full">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border rounded-l-lg p-2"
          placeholder="Ask about nearby shelters..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-blue-600 text-white px-4 rounded-r-lg disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </main>
  );
}
