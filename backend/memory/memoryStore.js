import fs from "fs/promises"; // Use Promise-based FS
import path from "path";

const MEMORY_DIR = path.join(process.cwd(), "memory");
const MEMORY_PATH = path.join(MEMORY_DIR, "memory.json");

const EMPTY_MEMORY = {
    profile: { goal: "", preferences: "", confidence: 0, updatedAt: 0 },
    project: { name: "", techStack: "", status: "", confidence: 0, updatedAt: 0 },
    technical: { context: "", confidence: 0, updatedAt: 0 },
    summary: ""
};

// Ensure directory exists on startup
(async () => {
    try {
        await fs.mkdir(MEMORY_DIR, { recursive: true });
        try {
            await fs.access(MEMORY_PATH);
        } catch {
            await fs.writeFile(MEMORY_PATH, JSON.stringify(EMPTY_MEMORY, null, 2));
        }
    } catch (err) {
        console.error("Memory Store Init Error:", err);
    }
})();

export async function loadMemory() {
    try {
        const data = await fs.readFile(MEMORY_PATH, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        return EMPTY_MEMORY;
    }
}

export async function saveMemory(partialUpdate) {
    try {
        const current = await loadMemory();
        const updated = {
            profile: { ...current.profile, ...(partialUpdate.profile || {}) },
            project: { ...current.project, ...(partialUpdate.project || {}) },
            technical: { ...current.technical, ...(partialUpdate.technical || {}) },
            summary: partialUpdate.summary || current.summary
        };

        await fs.writeFile(MEMORY_PATH, JSON.stringify(updated, null, 2));
        return updated;
    } catch (err) {
        console.error("Failed to save memory:", err);
    }
}