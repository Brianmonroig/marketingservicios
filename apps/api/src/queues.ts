import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

export type SendJobData = {
  messageId: string;
  tenantId: string;
};

export type JobHandlers = {
  // final es true en el último intento: ahí el handler tiene que dejar el estado cerrado.
  webhook(webhookEventId: string, final: boolean): Promise<void>;
  send(data: SendJobData, final: boolean): Promise<void>;
};

export type JobQueue = {
  enqueueWebhook(webhookEventId: string): Promise<void>;
  enqueueSend(data: SendJobData): Promise<void>;
  startWorkers(handlers: JobHandlers): void;
  counts(): Promise<Record<string, Record<string, number>>>;
  close(): Promise<void>;
};

const ATTEMPTS = 5;

function backoffDelay(): number {
  const value = Number(process.env.QUEUE_BACKOFF_MS ?? 5000);
  return Number.isFinite(value) && value > 0 ? value : 5000;
}

export function createJobQueue(options: { redisUrl: string; prefix?: string }): JobQueue {
  const prefix = options.prefix ?? "crm";
  // BullMQ exige maxRetriesPerRequest = null en las conexiones de los workers.
  const producerConnection = new Redis(options.redisUrl, { maxRetriesPerRequest: null });
  producerConnection.on("error", () => undefined);

  const defaultJobOptions = {
    attempts: ATTEMPTS,
    backoff: { type: "exponential" as const, delay: backoffDelay() },
    removeOnComplete: true,
    removeOnFail: { count: 1000 },
  };

  const webhookQueue = new Queue("webhooks", { connection: producerConnection, prefix, defaultJobOptions });
  const sendQueue = new Queue("whatsapp-send", { connection: producerConnection, prefix, defaultJobOptions });
  const workers: Worker[] = [];
  const workerConnections: Redis[] = [];

  const isFinal = (job: Job) => job.attemptsMade + 1 >= (job.opts.attempts ?? ATTEMPTS);

  return {
    async enqueueWebhook(webhookEventId) {
      await webhookQueue.add("process", { webhookEventId }, { jobId: webhookEventId });
    },
    async enqueueSend(data) {
      await sendQueue.add("send", data, { jobId: data.messageId });
    },
    startWorkers(handlers) {
      const webhookConnection = new Redis(options.redisUrl, { maxRetriesPerRequest: null });
      const sendConnection = new Redis(options.redisUrl, { maxRetriesPerRequest: null });
      webhookConnection.on("error", () => undefined);
      sendConnection.on("error", () => undefined);
      workerConnections.push(webhookConnection, sendConnection);

      workers.push(
        new Worker(
          "webhooks",
          async (job) => handlers.webhook((job.data as { webhookEventId: string }).webhookEventId, isFinal(job)),
          { connection: webhookConnection, prefix, concurrency: 5 },
        ),
        new Worker("whatsapp-send", async (job) => handlers.send(job.data as SendJobData, isFinal(job)), {
          connection: sendConnection,
          prefix,
          concurrency: 5,
        }),
      );
      for (const worker of workers) {
        worker.on("error", () => undefined);
      }
    },
    async counts() {
      const states = ["waiting", "active", "delayed", "failed"] as const;
      return {
        webhooks: await webhookQueue.getJobCounts(...states),
        "whatsapp-send": await sendQueue.getJobCounts(...states),
      };
    },
    async close() {
      await Promise.all(workers.map((worker) => worker.close()));
      await webhookQueue.close();
      await sendQueue.close();
      producerConnection.disconnect();
      for (const connection of workerConnections) connection.disconnect();
    },
  };
}
