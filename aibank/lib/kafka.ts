import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "aibank-monitor",
  brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || "localhost:9092")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean),
});

export const fraudPredictionTopic =
  process.env.KAFKA_FRAUD_PREDICTION_TOPIC || "fraud-predictions";

export function createFraudPredictionConsumer() {
  return kafka.consumer({
    groupId: `aibank-monitor-${crypto.randomUUID()}`,
  });
}