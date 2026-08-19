#!/bin/bash

set -e

echo "Waiting for Flink JobManager..."

until curl -s http://flink-jobmanager:8081/overview > /dev/null; do
  sleep 5
done

echo "Flink JobManager is ready."
echo "Submitting Flink SQL job..."

exec /opt/flink/bin/sql-client.sh \
  -Dexecution.target=remote \
  -Djobmanager.rpc.address=flink-jobmanager \
  -Djobmanager.rpc.port=6123 \
  -f /opt/flink/sql/job.sql