import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processNote, enrichNote } from "./processors/note-processor";
import { transcribeNote } from "./processors/video-processor";

// Worker, kullanicilarin sifreli API anahtarlarini cozmek zorunda; anahtar
// yoksa AI adimlari sessizce atlanir, o yuzden baslangicta uyar.
if (!process.env.ENCRYPTION_KEY && !process.env.SESSION_SECRET) {
  console.error(
    "[Worker] ENCRYPTION_KEY veya SESSION_SECRET tanimli degil. " +
      "Kayitli OpenAI anahtarlari cozulemeyecek ve AI adimlari atlanacak."
  );
}

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "note-processing",
  async (job) => {
    console.log(`[Worker] Processing job ${job.id}: ${job.name}`);

    switch (job.name) {
      case "process-note":
        await processNote(job.data.noteId, job.data.userId);
        break;
      case "enrich-note":
        await enrichNote(job.data.noteId, job.data.userId, job.data.action);
        break;
      case "transcribe-note":
        await transcribeNote(job.data.noteId, job.data.userId);
        break;
      default:
        console.warn(`[Worker] Unknown job type: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: 3,
  }
);

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on("ready", () => {
  console.log("[Worker] Ready and waiting for jobs...");
});

process.on("SIGTERM", async () => {
  console.log("[Worker] Shutting down...");
  await worker.close();
  process.exit(0);
});
