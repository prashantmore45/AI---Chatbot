import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ No API Key found in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    console.log("🔍 Checking available models for your API key...");
    
    // Note: We use the generic 'getGenerativeModel' to test connection first
    // but to list models we need the model manager (not exposed directly in all SDK versions easily), 
    // so we will try a simple generation test with the most basic model name.
    
    const modelsToCheck = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-001",
      "gemini-1.5-pro",
      "gemini-pro"
    ];

    for (const modelName of modelsToCheck) {
      process.stdout.write(`Testing ${modelName}... `);
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        await model.generateContent("Hello");
        console.log("✅ AVAILABLE");
      } catch (error) {
        if (error.message.includes("404") || error.message.includes("Not Found")) {
            console.log("❌ NOT FOUND");
        } else if (error.message.includes("429")) {
            console.log("⚠️ QUOTA FULL (But model exists)");
        } else {
            console.log(`❌ ERROR: ${error.message.split('[')[0]}`); // Print short error
        }
      }
    }

  } catch (error) {
    console.error("Fatal Error:", error);
  }
}

listModels();