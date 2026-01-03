import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

console.log("------------------------------------------------");
if (!apiKey) {
    console.error("❌ ERROR: No API Key found. Check your .env file.");
} else {
    // Show only first 4 chars for security to verify it matches your new key
    console.log(`🔑 Key loaded: ${apiKey.substring(0, 4)}... (Check if this matches your NEW key)`);
}
console.log("------------------------------------------------");

const genAI = new GoogleGenerativeAI(apiKey);

async function listAvailableModels() {
    try {
        console.log("📡 Connecting to Google to fetch model list...");
        // This is the specific "ListModels" call the error message suggested
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.models) {
            console.log("⚠️ No models returned. API Key might be invalid or Project has no access.");
        } else {
            console.log("✅ SUCCESS! Your API Key supports these models:");
            console.log(data.models.map(m => m.name.replace("models/", "")).join("\n"));
        }

    } catch (error) {
        console.error("❌ FAILED to list models:", error.message);
    }
}

listAvailableModels();