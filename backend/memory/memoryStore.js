import fs from "fs";
import path from "path";

const MEMORY_DIR = path.join(process.cwd(), "memory");
const MEMORY_PATH = path.join(MEMORY_DIR, "memory.json");

const EMPTY_MEMORY = {
  profile: { goal: "", preferences: "", confidence: 0, updatedAt: 0 },
  project: { name: "", techStack: "", status: "", confidence: 0, updatedAt: 0 },
  technical: { context: "", confidence: 0, updatedAt: 0 }
};

export function loadMemory() {
  if (!fs.existsSync(MEMORY_PATH)) {
    return EMPTY_MEMORY;
  }

  return {
    ...EMPTY_MEMORY,
    ...JSON.parse(fs.readFileSync(MEMORY_PATH, "utf-8"))
  };
}

export function saveMemory(partialUpdate) {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }

  const current = loadMemory();

  const updated = {
    profile: {
      ...current.profile,
      ...partialUpdate.profile
    },
    project: {
      ...current.project,
      ...partialUpdate.project
    },
    technical: {
      ...current.technical,
      ...partialUpdate.technical
    },
    summary: partialUpdate.summary || current.summary
  };

  fs.writeFileSync(
    MEMORY_PATH,
    JSON.stringify(updated, null, 2)
  );
}

