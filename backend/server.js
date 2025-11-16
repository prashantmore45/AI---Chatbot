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

app.use((req, res, next) => {
  const allowedOrigin =
    process.env.NODE_ENV === "production"
      ? "https://ai-chatbot-b8k7.onrender.com"
      : "http://localhost:5500";

  res.header("Access-Control-Allow-Origin", allowedOrigin);
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

app.post("/api/generate", async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Build Gemini request
    const payload = {
      contents: [
        ...history,
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
    };

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;


    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);
