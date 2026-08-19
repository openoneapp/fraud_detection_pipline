"use client";

import { AlertTriangle, Activity, Clock3, Radio, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PredictionEvent = {
  event_time: string;
  transaction_id: string;
  prediction: {
    is_fraud: boolean;
    fraud_probability: number;
    fraud_type: string | null;
    model_version: string;
    features?: { trans_amount?: number };
  };
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

export function MonitoringDashboard() {
  const [events, setEvents] = useState<PredictionEvent[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");

  useEffect(() => {
    const source = new EventSource("/api/monitoring/stream");
    source.addEventListener("ready", () => setStatus("live"));
    source.addEventListener("prediction", (event) => {
      const nextEvent = JSON.parse(event.data) as PredictionEvent;
      setEvents((current) => [nextEvent, ...current].slice(0, 30));
    });
    source.addEventListener("error", () => setStatus("offline"));
    return () => source.close();
  }, []);

  const metrics = useMemo(() => {
    const fraudEvents = events.filter((event) => event.prediction?.is_fraud);
    const volume = events.reduce((total, event) => total + (event.prediction?.features?.trans_amount || 0), 0);
    return { fraudEvents, volume };
  }, [events]);

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Operations / Stream</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Fraud monitoring</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live predictions from the detection pipeline.</p>
        </div>
        <Badge variant={status === "live" ? "default" : "secondary"} className="w-fit gap-1.5 px-3 py-1">
          <Radio className={status === "live" ? "size-3 animate-pulse" : "size-3"} />
          {status === "live" ? "Live" : status === "connecting" ? "Connecting" : "Offline"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Events received" value={events.length.toString()} hint="Current session" icon={<Activity />} />
        <MetricCard label="Fraud signals" value={metrics.fraudEvents.length.toString()} hint="Flagged predictions" icon={<AlertTriangle />} tone="warning" />
        <MetricCard label="Review rate" value={`${events.length ? Math.round((metrics.fraudEvents.length / events.length) * 100) : 0}%`} hint="Of live events" icon={<ShieldCheck />} />
        <MetricCard label="Observed volume" value={`$${metrics.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} hint="From live payloads" icon={<Clock3 />} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center justify-between gap-4 text-base">
            <span>Prediction feed</span>
            <span className="text-xs font-normal text-muted-foreground">Newest first</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Waiting for the first prediction from Kafka...
            </div>
          ) : (
            <div className="divide-y">
              {events.map((event) => (
                <div key={`${event.transaction_id}-${event.event_time}`} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${event.prediction.is_fraud ? "bg-destructive" : "bg-emerald-500"}`} />
                      <p className="truncate font-mono text-sm font-medium">{event.transaction_id}</p>
                    </div>
                    <p className="mt-1 pl-4 text-xs text-muted-foreground">{event.prediction.fraud_type || "No fraud pattern"} · {event.prediction.model_version}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-medium">{Math.round(event.prediction.fraud_probability * 100)}% probability</p>
                    <p className="text-xs text-muted-foreground">{formatTime(event.event_time)}</p>
                  </div>
                  <Badge variant={event.prediction.is_fraud ? "destructive" : "outline"}>{event.prediction.is_fraud ? "Review" : "Clear"}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, hint, icon, tone }: { label: string; value: string; hint: string; icon: React.ReactNode; tone?: "warning" }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <span className={tone === "warning" ? "text-amber-600" : "text-muted-foreground"}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}