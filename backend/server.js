import rateLimit from "express-rate-limit";
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { loadMemory } from "./memory/memoryStore.js";
import { saveMemory } from "./memory/memoryStore.js";

dotenv.config();

function assertEnv() {
  const required = ["GEMINI_API_KEY"];
  const missing = required.filter(k => !process.env[k]);

  if (missing.length) {
    console.error("❌ Missing environment variables:", missing.join(", "));
    process.exit(1);
  }
}

assertEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Correct path handling for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


function log(event, meta = {}) {
  console.log(JSON.stringify({
    event,
    ...meta,
    time: new Date().toISOString()
  }));
}


function isMemoryFresh(updatedAt, confidence) {
  const AGE_LIMIT = 1000 * 60 * 60 * 24 * 7; // 7 days
  const age = Date.now() - updatedAt;

  return age < AGE_LIMIT && confidence >= 0.6;
}


async function summarizeHistory(history) {
  const prompt = `
    Summarize the conversation briefly.

    Keep:
    - What the user is building
    - Goals
    - Important technical context

    Remove greetings and filler.

    Conversation:
    ${JSON.stringify(history)}
  `;

  const url =
    `https://generativelanguage.googleapis.com/v1/models/` +
    `gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}


async function summarizeProfile(history) {
  return summarizeWithPrompt(
    "Extract user goals and preferences",
    history
  );
}

async function summarizeProject(history) {
  return summarizeWithPrompt(
    "Extract project name, tech stack, and current status",
    history
  );
}

async function summarizeTechnical(history) {
  return summarizeWithPrompt(
    "Extract important technical decisions, errors, and architecture",
    history
  );
}

async function summarizeWithPrompt(instruction, history) {
  const prompt = `
${instruction}.
Be concise. No greetings.

Conversation:
${JSON.stringify(history)}
`;

  const url =
    `https://generativelanguage.googleapis.com/v1/models/` +
    `gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) return "";

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}


function selectModel({ message, overrideModel }) {
  if (overrideModel === "fast") return "gemini-2.5-flash";
  if (overrideModel === "smart") return "gemini-2.5-flash"; // for now

  if (message.length < 120) return "gemini-2.5-flash";

  return "gemini-2.5-flash"; // temporary until Pro streaming is enabled
}


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
 

function buildMemoryContext(memory, message) {
  let contextParts = [];

  if (memory.profile?.goal && message.toLowerCase().includes("goal")) {
    contextParts.push(`User goal: ${memory.profile.goal}`);
  }

  if (memory.project?.name) {
    contextParts.push(
      `Current project: ${memory.project.name}` +
      (memory.project.techStack ? ` using ${memory.project.techStack}` : "")
    );
  }

  if (
    memory.technical?.context &&
    /error|bug|issue|fix|stream|sse|api|backend|frontend/i.test(message)
  ) {
    contextParts.push(`Technical context: ${memory.technical.context}`);
  }

  if (contextParts.length === 0 && memory.summary) {
    contextParts.push(`Conversation summary: ${memory.summary}`);
  }

  return contextParts.join("\n");
}


const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);


app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    memoryLoaded: !!loadMemory(),
    timestamp: new Date().toISOString()
  });
});


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
    const memory = loadMemory();

    const memoryContext = [];

    if (isMemoryFresh(memory.profile.updatedAt, memory.profile.confidence)) {
      memoryContext.push(`User goal: ${memory.profile.goal}`);
    }

    if (isMemoryFresh(memory.project.updatedAt, memory.project.confidence)) {
      memoryContext.push(`Project: ${memory.project.name}`);
      memoryContext.push(`Tech stack: ${memory.project.techStack}`);
      memoryContext.push(`Status: ${memory.project.status}`);
    }

    if (isMemoryFresh(memory.technical.updatedAt, memory.technical.confidence)) {
      memoryContext.push(`Technical context: ${memory.technical.context}`);
    }

    const developerInstruction = `
      You are acting as a senior software engineer and technical mentor.

      Rules:
      - Do NOT ask basic or redundant questions.
      - Assume the user is building an AI chatbot using Node.js, Express, SSE streaming, and memory.
      - Give direct, actionable solutions.
      - If the user asks "what next", propose the best technical improvement and explain WHY.
      - Prefer architecture, code structure, and performance advice.
      - Avoid generic explanations.
      `;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{
            text: `INSTRUCTIONS (follow strictly):\n${developerInstruction}`
          }]
        },

        ...(memory.summary
          ? [{
              role: "user",
              parts: [{
                text: `Project memory (do not repeat):\n${memory.summary}`
              }]
            }]
          : []),

        ...(memoryContext.length
          ? [{
              role: "user",
              parts: [{
                text: `Relevant memory (do not repeat):\n${memoryContext.join("\n")}`
              }]
            }]
          : []),

        ...safeHistory,

        {
          role: "user",
          parts: [{ text: message }]
        }
      ]
    };

    const model = selectModel({
      message,
      overrideModel: req.body.model,
    });

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/` + `${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    log("stream_start", { model });

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

    if (safeHistory.length >= 8) {
      const summary = await summarizeHistory(safeHistory);
      if (summary) {
        saveMemory(summary);
        console.log("🧠 Memory updated");
      }
    }

    // Send response back to frontend
    res.json({
      response: aiText,
      updatedHistory: updatedHistory,
    });
  } catch (err) {
    log("stream_error", { message: err.message });
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
    const memory = loadMemory();

    const memoryContext = [];

    if (isMemoryFresh(memory.profile.updatedAt, memory.profile.confidence)) {
      memoryContext.push(`User goal: ${memory.profile.goal}`);
    }

    if (isMemoryFresh(memory.project.updatedAt, memory.project.confidence)) {
      memoryContext.push(`Project: ${memory.project.name}`);
      memoryContext.push(`Tech stack: ${memory.project.techStack}`);
      memoryContext.push(`Status: ${memory.project.status}`);
    }

    if (isMemoryFresh(memory.technical.updatedAt, memory.technical.confidence)) {
      memoryContext.push(`Technical context: ${memory.technical.context}`);
    }

    const developerInstruction = `
      You are acting as a senior software engineer and technical mentor.

      Rules:
      - Do NOT ask basic or redundant questions.
      - Assume the user is building an AI chatbot using Node.js, Express, SSE streaming, and memory.
      - Give direct, actionable solutions.
      - If the user asks "what next", propose the best technical improvement and explain WHY.
      - Prefer architecture, code structure, and performance advice.
      - Avoid generic explanations.
    `;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{
            text: `INSTRUCTIONS (follow strictly):\n${developerInstruction}`
          }]
        },

        ...(memory.summary
          ? [{
              role: "user",
              parts: [{
                text: `Project memory (do not repeat):\n${memory.summary}`
              }]
            }]
          : []),
        ...(memoryContext.length
          ? [{
              role: "user",
              parts: [{
                text: `Relevant memory (do not repeat):\n${memoryContext.join("\n")}`
              }]
            }]
          : []),

        ...safeHistory,

        {
          role: "user",
          parts: [{ text: message }]
        }
      ]
    };

    const model = selectModel({
      message,
      overrideModel: req.body.model,
    });

    const GEMINI_URL =
      `https://generativelanguage.googleapis.com/v1/models/` +
      `${model}:streamGenerateContent?key=${process.env.GEMINI_API_KEY}`;

    log("stream_start", { model });

    console.log("🔗 Calling Gemini stream API...");
    
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let streamResponse = response;

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Gemini stream response:", response.status, errText);

      if (response.status === 429 && model === "gemini-2.5-flash") {
        console.warn("⚠️ Flash quota exceeded, retrying with fallback model");

        const fallbackModel = "gemini-2.5-flash-lite";

        if (fallbackModel === model) {
          res.write(`event: error\ndata: "QUOTA_EXCEEDED"\n\n`);
          res.write(`event: end\ndata: ""\n\n`);
          return res.end();
        }

        const fallbackURL =
          `https://generativelanguage.googleapis.com/v1/models/` +
          `${fallbackModel}:streamGenerateContent?key=${process.env.GEMINI_API_KEY}`;

        const retryResponse = await fetch(fallbackURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!retryResponse.ok) {
          console.error("❌ Fallback model also failed");
          res.write(`event: error\ndata: "QUOTA_EXCEEDED"\n\n`);
          res.write(`event: end\ndata: ""\n\n`);
          return res.end();
        }

        // ✅ SAFE: switch stream source
        streamResponse = retryResponse;
      } else {
        res.write(`event: error\ndata: "STREAMING_NOT_AVAILABLE"\n\n`);
        res.write(`event: end\ndata: ""\n\n`);
        return res.end();
      }
    }

    let fullText = "";
    let buffer = "";

    for await (const chunk of streamResponse.body) {

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

    if (safeHistory.length >= 8) {
      Promise.all([
        summarizeProfile(safeHistory),
        summarizeProject(safeHistory),
        summarizeTechnical(safeHistory),
        summarizeHistory(safeHistory)
      ])
      .then(([profile, project, technical, summary]) => {
        const now = Date.now();

        saveMemory({
          profile: {
            goal: profile,
            preferences: profile,
            confidence: 0.8,
            updatedAt: now
          },
          project: {
            name: project,
            techStack: project,
            status: project,
            confidence: 0.9,
            updatedAt: now
          },
          technical: {
            context: technical,
            confidence: 0.85,
            updatedAt: now
          },
          summary
        });

        console.log("🧠 Structured memory updated");
      })
      .catch(() => {});
    }

    res.end();

  } catch (err) {
    log("stream_error", { message: err.message });
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

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
  log("shutdown_start");
  server.close(() => {
    log("shutdown_complete");
    process.exit(0);
  });

  setTimeout(() => {
    log("shutdown_force");
    process.exit(1);
  }, 5000);
}


const server = app.listen(PORT, () => {
  log("server_started", { port: PORT });
});

