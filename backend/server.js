import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Correct path handling for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// app.use((req, res, next) => {
//   const allowedOrigin =
//     process.env.NODE_ENV === "production"
//       ? "https://ai-chatbot-frontend-u8e6.onrender.com"
//       : "http://localhost:5500";

//   res.header("Access-Control-Allow-Origin", allowedOrigin);
//   res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
//   res.header("Access-Control-Allow-Headers", "Content-Type");

//   if (req.method === "OPTIONS") {
//     return res.sendStatus(200);
//   }
//   next();
// });

const allowedOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "https://ai-chatbot-frontend-u8e6.onrender.com",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));
 
app.post("/api/generate", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!Array.isArray(history)) {
      return res.status(400).json({ error: "Invalid history format" });
    }

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const safeHistory = history.slice(-8);

    // Build Gemini request
    const payload = {
      contents: [
        ...safeHistory,
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
    };

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;


    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({
          error: "QUOTA_EXCEEDED",
          message: "API quota exceeded. Please wait a minute and try again.",
          retryAfter: 60
        });
      }

      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    // Debug log
    console.log("🎯 FULL API Response:", JSON.stringify(data, null, 2));

    // Extract AI message
    const aiText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ No response received from Gemini API.";

    // Updated chat history
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: message }] },
      { role: "model", parts: [{ text: aiText }] },
    ];

    // Send response back to frontend
    res.json({
      response: aiText,
      updatedHistory: updatedHistory,
    });
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/generate-stream", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const safeHistory = history.slice(-8);

    const payload = {
      contents: [
        ...safeHistory,
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
    };

    const GEMINI_URL =
      `https://generativelanguage.googleapis.com/v1/models/` +
      `gemini-2.5-flash:streamGenerateContent?key=${process.env.GEMINI_API_KEY}`;

    console.log("🔗 Calling Gemini stream API...");

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Gemini stream response:", response.status, errText);

      if (response.status === 429) {
        res.write(`event: error\ndata: "QUOTA_EXCEEDED"\n\n`);
        res.write(`event: end\ndata: ""\n\n`);
        return res.end();
      }

      throw new Error("Gemini streaming failed");
    }

    let fullText = "";
    let buffer = "";

    for await (const chunk of response.body) {
      buffer += chunk.toString("utf-8");

      // Extract all text fields safely
      const textMatches = buffer.match(/"text"\s*:\s*"([^"]*)"/g);

      if (textMatches) {
        for (const match of textMatches) {
          const text = match
            .replace(/"text"\s*:\s*"/, "")
            .replace(/"$/, "");

          if (text) {
            fullText += text;
            res.write(`data: ${JSON.stringify(text)}\n\n`);
          }
        }

        // Clear buffer once extracted
        buffer = "";
      }
    }

    // Stream end
    res.write(`event: end\ndata: ${JSON.stringify(fullText)}\n\n`);
    res.end();

  } catch (err) {
    console.error("❌ STREAM ERROR:", err);
    // Inform client gracefully
    res.write(`event: error\ndata: "STREAMING_NOT_AVAILABLE"\n\n`);
    res.write(`event: end\ndata: ""\n\n`);

    // Let browser finish cleanly
    setTimeout(() => {
      res.end();
    }, 50);
  }
});


app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);
