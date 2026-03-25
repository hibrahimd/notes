import { Queue } from "bullmq";
import { getRedis } from "./redis";

let _noteQueue: Queue | null = null;

export function getNoteQueue(): Queue {
  if (!_noteQueue) {
    _noteQueue = new Queue("note-processing", {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }
  return _noteQueue;
}
