import { createFraudPredictionConsumer, fraudPredictionTopic } from "@/lib/kafka";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const consumer = createFraudPredictionConsumer();
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        await consumer.connect();
        await consumer.subscribe({ topic: fraudPredictionTopic, fromBeginning: false });
        send("ready", { topic: fraudPredictionTopic });
        heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 15000);

        request.signal.addEventListener("abort", () => {
          void consumer.disconnect();
          if (heartbeat) clearInterval(heartbeat);
          controller.close();
        });

        await consumer.run({
          eachMessage: async ({ message }) => {
            if (!message.value) return;
            try {
              send("prediction", JSON.parse(message.value.toString()));
            } catch {
              send("error", { message: "Received an invalid Kafka payload." });
            }
          },
        });
      } catch {
        send("error", { message: "Kafka is unavailable. Check the broker connection." });
        if (heartbeat) clearInterval(heartbeat);
        controller.close();
      }
    },
    async cancel() {
      if (heartbeat) clearInterval(heartbeat);
      await consumer.disconnect().catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}