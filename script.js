const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");


// API Setup
const API_KEY = "";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

let userMessage = "";
let chatHistory = [];

// Function to create message elements
const createMsgElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

const scrollToBottom = () => chatsContainer.scrollTo({ top: chatsContainer.scrollHeight, behavior: "smooth"});

// Convert Gemini markdown response into HTML
const formatResponse = (rawText) => {
  return rawText
    // Headings ## or #
    .replace(/^##\s?(.*)$/gm, "<h3>$1</h3>")
    .replace(/^#\s?(.*)$/gm, "<h2>$1</h2>")
    // Bold **text**
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Italics *text*
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Inline code `code`
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Blockquotes > text
    .replace(/^>\s?(.*)$/gm, "<blockquote>$1</blockquote>")
    // Numbered lists
    .replace(/^\d+\.\s+(.*)$/gm, "<li>$1</li>")
    // Bulleted lists
    .replace(/^[-*]\s+(.*)$/gm, "<li>$1</li>")
    // Wrap consecutive <li> into <ul> or <ol>
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    // Paragraphs
    .replace(/\n{2,}/g, "</p><p>")
    // Line breaks
    .replace(/\n/g, "<br>")
    // Wrap all in <p>
    .trim();
};


// Make the API call and generate the bot's response
const generateResponse = async (botMsgDiv) => {
    const textElement = botMsgDiv.querySelector(".message-text");
    // Add user message to the chat history
    chatHistory.push({
        role: "user",
        parts: [{ text: userMessage }]
    });

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: chatHistory })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error.message);

        const rawText = data.candidates[0].content.parts[0].text;
        const formattedHTML = formatResponse(rawText);

        // Show formatted HTML directly instead of typing plain text
        textElement.innerHTML = formattedHTML;
        botMsgDiv.classList.remove("loading");

        scrollToBottom();

        
    } catch (error) {
        console.error("Error:", error);
    }
};

// Handle the Form submission
const handleFormSubmit = (e) => {
    e.preventDefault();
    userMessage = promptInput.value.trim();
    if (!userMessage) return;

    promptInput.value = "";

    // Generate user message HTML and add in the chats container
    const userMsgHTML = `<p class="message-text"></p>`;
    const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
    userMsgDiv.querySelector(".message-text").textContent = userMessage;
    chatsContainer.appendChild(userMsgDiv);
    scrollToBottom();

    // Generate bot message HTML and add in the chats container after 600ms
    setTimeout(() => {
        const botMsgHTML = `<div class="bot-message-wrapper">
            <img src="gemini-logo.svg" class="avatar">
            <div class="bot-message message loading">
                <p class="message-text">Just a sec...</p>
            </div>
        </div>`;
        const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
        chatsContainer.appendChild(botMsgDiv);
        scrollToBottom();
        generateResponse(botMsgDiv);
    }, 600);
};

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (e) => {
        fileInput.value = "";
        fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
        fileUploadWrapper.classList.add("active", "img-attached", "file-attached");
    }
});

document.querySelector("#cancel-file-btn").addEventListener("click", () => {
    fileUploadWrapper.classList.remove("active", isImage ? "img-attached" : "file-attached");
})

promptForm.addEventListener("submit", handleFormSubmit);

promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());
