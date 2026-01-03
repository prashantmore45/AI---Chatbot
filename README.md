# ✦ Gemini AI Chatbot (Production Ready)

![Gemini AI Badge](https://img.shields.io/badge/AI-Gemini%202.5-blue?style=for-the-badge&logo=google)
![NodeJS Badge](https://img.shields.io/badge/Backend-Node.js-green?style=for-the-badge&logo=nodedotjs)
![Status Badge](https://img.shields.io/badge/Status-Deployed-success?style=for-the-badge)

A fully functional, mobile-responsive AI Chatbot that replicates the official Google Gemini interface. Built with **Node.js** and the latest **Google Generative AI SDK**, it features real-time text streaming, multimodal image analysis, and persistent chat memory.

## 🌟 Key Features

* **⚡ Latest AI Models:** Powered by **Gemini 2.5 Flash** (fast) and **Gemini 2.5 Pro** (reasoning).
* **🌊 Real-Time Streaming:** Uses Server-Sent Events (SSE) for buttery-smooth, typewriter-style text generation.
* **🖼️ Multimodal Support:** Upload images (drag & drop or select) to ask questions about visual content.
* **🧠 Conversation Memory:** Remembers context from previous messages during the session.
* **🎨 Professional UI:**
    * Exact replica of Gemini's Dark Mode aesthetic.
    * Floating input bar with "pill" design.
    * Fully responsive (works perfectly on Mobile keyboards).
    * Markdown rendering for code blocks, tables, and lists.
* **🛡️ Robust Error Handling:** Gracefully handles API rate limits and network issues.

---

## 🛠️ Tech Stack

### Frontend
* **HTML5 / CSS3:** Custom CSS variables for theming (Dark/Light mode).
* **Vanilla JavaScript:** Lightweight, fast, and dependency-free frontend logic.
* **Libraries:** `marked.js` (Markdown parsing), `DOMPurify` (Security/Sanitization).

### Backend
* **Node.js & Express:** REST API and Stream handling.
* **@google/generative-ai:** Official Google SDK for model interaction.
* **File System (fs/promises):** Asynchronous JSON-based memory storage.

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18 or higher recommended)
* A Google Cloud API Key (Get it from [Google AI Studio](https://aistudio.google.com/))

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
    cd your-repo-name
    ```

2.  **Install Dependencies**
    Navigate to the backend folder and install the required packages:
    ```bash
    cd backend
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the `backend` directory:
    ```env
    PORT=3000
    GEMINI_API_KEY=your_actual_api_key_here
    ```

4.  **Run the Server**
    ```bash
    node server.js
    ```

5.  **Launch**
    Open your browser and visit: `http://localhost:3000`

---

## 📂 Project Structure

```text
├── public/                 # Frontend Assets
│   ├── index.html          # Main UI Structure
│   ├── style.css           # Gemini Dark/Light Theme Styles
│   └── script.js           # Frontend Logic (Fetch, Streaming, UI)
│
├── backend/                # Server Side
│   ├── memory/             # JSON Storage for Chat History
│   ├── node_modules/       # Dependencies
│   ├── server.js           # Express Server & API Routes
│   ├── package.json        # Project Manifest
│   └── .env                # API Keys (Not shared in repo)
│
└── README.md               # Documentation