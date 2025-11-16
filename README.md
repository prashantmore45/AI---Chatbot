📌 AI Chatbot – Full Stack Gemini-Powered Chatbot (Frontend + Backend)

An AI-powered chatbot web application built with:

Frontend: HTML, CSS, JavaScript
Backend: Node.js (Express)

AI Engine: Google Gemini 2.5 Flash (via Google Generative Language API)

Deployment:

Frontend: Render Static Site
Backend: Render Web Service

The chatbot provides real-time conversational responses using Google Gemini API and supports multi-turn chat history.


🚀 Live Demo

🔗 Frontend:

https://ai-chatbot-frontend-u8e6.onrender.com

🔗 Backend (API):

https://ai-chatbot-backend-vzzr.onrender.com


✨ Features

🔹 AI Features

Gemini 2.5 Flash model integration
Real-time chat responses
Multi-turn conversation (chat memory)
Markdown formatting (headings, lists, code blocks, bold, italics)

🔹 Frontend

Clean chat UI
Smooth scroll
Loading/typing animation
Mobile responsive
File upload UI (future support)

🔹 Backend

Express server
CORS protected for production
Secure API key usage
Request → Gemini → Response pipeline
Auto-updated chat history logic

🔹 Deployment

Frontend deployed on Render Static Site
Backend deployed on Render Web Service
Fully configured CORS
Clean and scalable monorepo structure


📂 Project Folder Structure
AI---Chatbot/
│
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   ├── .env           # Contains GEMINI_API_KEY
│   └── node_modules/
│
├── public/            # Frontend
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── assets/        # logos, images
│   └── gemini-logo.svg
│
└── README.md


🔑 Environment Variables

Inside backend/.env:

GEMINI_API_KEY=YOUR_API_KEY_HERE
NODE_ENV=production

⚠ Never commit .env to GitHub.

🛠 Backend Setup (Local Development)
1️⃣ Navigate to backend
cd backend

2️⃣ Install dependencies
npm install

3️⃣ Start server
node server.js

Server runs at:
http://localhost:3000


🌐 Frontend Setup (Local)

You can run the frontend by simply opening:

public/index.html

or using VS Code Live Server.


🔌 Connecting Frontend to Backend

In script.js, the API URL logic:

const PROXY_API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000/api/generate"
    : "https://ai-chatbot-backend-vzzr.onrender.com/api/generate";


🔥 Backend API Route

POST /api/generate
Request Body:
{
  "message": "hi",
  "history": [
    {
      "role": "user",
      "parts": [{ "text": "previous message" }]
    }
  ]
}

Response:
{
  "response": "Hello! How can I help you?",
  "updatedHistory": [...]
}


🔐 CORS Configuration

To allow your frontend:

res.header("Access-Control-Allow-Origin", "https://ai-chatbot-frontend-u8e6.onrender.com");
res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
res.header("Access-Control-Allow-Headers", "Content-Type");


🚀 Render Deployment Guide

✅ Backend Deployment (Web Service)

Root Directory: backend
Build Command: npm install
Start Command: node server.js
Environment Variables → add GEMINI_API_KEY

✅ Frontend Deployment (Static Site)

Root Directory: (leave empty)
Publish Directory: public
Build Command: (empty)


🧪 Testing

After deployment:

1. Visit frontend
2. Type a message (like “hi”)
3. You should get an AI response from Gemini

If you see:

❌ CORS error → Fix backend origin
❌ Failed to fetch → Wrong API URL in script.js
❌ No response → Check Gemini model & API key


🔮 Future Enhancements (Planned)

Chat UI redesign with bubbles
Typing animation (…)
Dark/light mode
Voice input & text-to-speech
File upload → Gemini Vision
Local chat history save
Conversation export (PDF/JSON)


🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you’d like to add.


📜 License

This project is MIT licensed.


🎉 Final Notes

This project demonstrates:
Full-stack app deployment
Gemini 2.5 Flash integration
Clean CORS + routing setup
Frontend ↔ Backend communication
You now have a fully deployed, production-ready AI Chatbot.