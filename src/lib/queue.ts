import { Queue } from "bullmq";
import { redis } from "./redis";

export const noteQueue = new Queue("note-processing", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});
