import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Get correct path handling for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ CORS setup – allow frontend domain
app.use(cors({
  origin: [
    "https://ai-chatbot-b8k7.onrender.com", // frontend Render URL
    "http://localhost:5500" // for local testing
  ],
  methods: ["GET", "POST"],
  credentials: true
}));

// ✅ Middleware
app.use(express.json());

// ✅ Serve frontend (public) folder
app.use(express.static(path.join(__dirname, "../public")));

// ✅ API endpoint for Gemini or proxy
app.post("/api/generate", async (req, res) => {
  try {
    const { message, history } = req.body;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: history }),
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Fallback route (for SPA or reloads)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ✅ Start server
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
