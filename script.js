const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");

// API Setup
const API_KEY = "AIzaSyAvwl_JsR40FygHXCCah5QExDQtTotvNKc";
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

        //Process the response text and display it 
        const responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
        textElement.textContent = responseText;
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

    // Generate bot message HTML and add in the chats container after 600ms
    setTimeout(() => {
        const botMsgHTML = `<img src="gemini-logo.svg" class="avatar"><p class="message-text">Just a sec...</p>`;
        const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
        chatsContainer.appendChild(botMsgDiv);
        generateResponse(botMsgDiv);
    }, 600);
};

promptForm.addEventListener("submit", handleFormSubmit);
