// script.js — Frontend for Secure Gemini Chatbot

const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");


const PROXY_API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000/api/generate"
    : "https://ai-chatbot.onrender.com/api/generate";

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

const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");

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
    console.log("🎯 FULL API Response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      const errMsg = data.error || "Unexpected server error";
      throw new Error(errMsg);
    }

    // Correct AI text from backend
    const rawText = data.response || "⚠️ No response from server.";
    const formattedHTML = formatResponse(rawText);

    // Update frontend history with backend-updated history
    chatHistory = data.updatedHistory || chatHistory;

    // Display formatted AI response
    textElement.innerHTML = formattedHTML;
    botMsgDiv.classList.remove("loading");
    scrollToBottom();

  } catch (error) {
    console.error("❌ Error:", error);
    textElement.innerHTML = `<p>Error: ${error.message}</p>`;
    botMsgDiv.classList.remove("loading");
  }
};

const handleFormSubmit = (e) => {
  e.preventDefault();
  userMessage = promptInput.value.trim();
  if (!userMessage) return;

  promptInput.value = "";

  const userMsgHTML = `<p class="message-text">${userMessage}</p>`;
  const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

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
    fileUploadWrapper.classList.add(
      "active",
      isImage ? "img-attached" : "file-attached"
    );
  };
});

document
  .querySelector("#cancel-file-btn")
  .addEventListener("click", () => {
    attachedFile = null;
    const preview = fileUploadWrapper.querySelector(".file-preview");
    preview.src = "#";
    fileUploadWrapper.classList.remove(
      "active",
      "img-attached",
      "file-attached"
    );
  });

promptForm.querySelector("#add-file-btn").addEventListener("click", () => {
  fileInput.click();
});

// Initialize form listener
promptForm.addEventListener("submit", handleFormSubmit);
