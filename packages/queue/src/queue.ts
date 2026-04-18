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
  },
});