// script.js — Frontend for Secure Gemini Chatbot

const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");

// API Proxy Endpoint
const PROXY_API_URL = "http://localhost:3000/api/generate";

let userMessage = "";
let chatHistory = [];
let attachedFile = null;

// Utility: Smooth scroll
const scrollToBottom = () =>
  chatsContainer.scrollTo({
    top: chatsContainer.scrollHeight,
    behavior: "smooth",
  });

// Utility: Convert markdown-ish Gemini output into readable HTML
const formatResponse = (rawText = "") => {
  return rawText
    // Headings
    .replace(/^##\s?(.*)$/gm, "<h3>$1</h3>")
    .replace(/^#\s?(.*)$/gm, "<h2>$1</h2>")
    // Bold, italics
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Blockquotes
    .replace(/^>\s?(.*)$/gm, "<blockquote>$1</blockquote>")
    // Lists
    .replace(/^\d+\.\s+(.*)$/gm, "<li>$1</li>")
    .replace(/^[-*]\s+(.*)$/gm, "<li>$1</li>")
    // Wrap consecutive list items
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    // Paragraphs and line breaks
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .trim();
};

// Utility: Create message element
const createMsgElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

// Main: Call the backend proxy
const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");

  // Push user's message into chat history
  chatHistory.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  try {
    const response = await fetch(PROXY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        history: chatHistory,
      }),
    });

    const data = await response.json();
    console.log("✅ API Response:", data);

    // --- Handle non-OK response ---
    if (!response.ok) {
      const errMsg = data.error || "Unexpected API error";
      throw new Error(errMsg);
    }

    // --- Extract bot reply safely ---
    const rawText = data.response || "⚠️ No response from server.";
    const formattedHTML = formatResponse(rawText);

    // --- Update local history with server’s updated version ---
    chatHistory = data.updatedHistory || chatHistory;

    // --- Show formatted message ---
    textElement.innerHTML = formattedHTML;
    botMsgDiv.classList.remove("loading");
    scrollToBottom();
  } catch (error) {
    console.error("❌ Error:", error);
    textElement.innerHTML = `<p class="message-text">Error: ${error.message}</p>`;
    botMsgDiv.classList.remove("loading");
  }
};

// Handle user message submission
const handleFormSubmit = (e) => {
  e.preventDefault();
  userMessage = promptInput.value.trim();
  if (!userMessage) return;

  promptInput.value = "";

  // --- Display user message ---
  const userMsgHTML = `<p class="message-text">${userMessage}</p>`;
  const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

  // --- Add bot typing placeholder ---
  setTimeout(() => {
    const botMsgHTML = `
      <div class="bot-message-wrapper">
        <img src="gemini-logo.svg" class="avatar" alt="AI">
        <div class="bot-message message loading">
          <p class="message-text">Generating response...</p>
        </div>
      </div>
    `;
    const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();

    generateResponse(botMsgDiv);
  }, 500);
};

// --- File handling (future multimodal) ---
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  attachedFile = file;

  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();
  reader.readAsDataURL(file);

  reader.onload = (e) => {
    fileInput.value = "";
    const preview = fileUploadWrapper.querySelector(".file-preview");
    preview.src = e.target.result;
    fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");
  };
});

document.querySelector("#cancel-file-btn").addEventListener("click", () => {
  attachedFile = null;
  const preview = fileUploadWrapper.querySelector(".file-preview");
  preview.src = "#";
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
});

promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());

// --- Initialize event listener ---
promptForm.addEventListener("submit", handleFormSubmit);
