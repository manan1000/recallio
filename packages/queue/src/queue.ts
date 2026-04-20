import { Queue } from "bullmq";
import { redis } from "./redis";

export type DocumentJobData = {
  documentId: string;
  userId: string;
};

export const documentQueue = new Queue<DocumentJobData>("document-processing", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep for 24 hours
      count: 100,     // keep last 100 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep failed jobs for 7 days for debugging
    },
  },
});