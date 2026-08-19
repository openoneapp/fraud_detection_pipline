-- ============================================================
-- FLINK FRAUD DETECTION PIPELINE (MODIFIED)
--
-- Flink:
--   1.20.1
--
-- Kafka:
--   kafka:9093
--
-- Debezium:
--   3.0.0.Final
--
-- Input:
--   aibank.public.bank_accounts
--   aibank.public.transactions
--
-- Output:
--   target-transaction-events
--
-- CHANGES FROM ORIGINAL:
--   1. Dates normalized to TIMESTAMP(3) once, in the base views,
--      instead of doing raw BIGINT millis arithmetic inline in
--      every join predicate. Window joins now use INTERVAL
--      literals instead of "trans_date - 259200000" style math.
--   2. receiver_metrics / same_amount_metrics / sender_velocity
--      collapsed into a single self-join against transaction_events
--      (via CASE WHEN conditional aggregation) instead of three
--      separate self-joins. This avoids transaction_events being
--      independently expanded 4 times across different views,
--      which was triggering:
--        java.lang.AssertionError: ... belongs to a different
--        planner than is currently being used
-- ============================================================
SET 'table.exec.state.ttl' = '4 d';

-- ============================================================
-- 1. BANK ACCOUNTS SOURCE
-- ============================================================
CREATE TABLE bank_accounts (
    `before` ROW<
        id STRING,
        account_number STRING,
        account_name STRING,
        account_type STRING,
        status STRING,
        balance DOUBLE,
        currency STRING,
        user_id STRING,
        created_at BIGINT,
        updated_at BIGINT
    >,
    `after` ROW<
        id STRING,
        account_number STRING,
        account_name STRING,
        account_type STRING,
        status STRING,
        balance DOUBLE,
        currency STRING,
        user_id STRING,
        created_at BIGINT,
        updated_at BIGINT
    >,
    op STRING,
    ts_ms BIGINT,
    ts_us BIGINT,
    ts_ns BIGINT
) WITH (
    'connector' = 'kafka',
    'topic' = 'aibank.public.bank_accounts',
    'properties.bootstrap.servers' = 'kafka:9093',
    'properties.group.id' = 'flink-bank-accounts',
    'scan.startup.mode' = 'earliest-offset',
    'format' = 'json',
    'json.ignore-parse-errors' = 'true'
);

-- ============================================================
-- 2. TRANSACTIONS SOURCE
-- ============================================================
CREATE TABLE transactions (
    `before` ROW<
        id STRING,
        amount DOUBLE,
        currency STRING,
        reference STRING,
        description STRING,
        sender_account_id STRING,
        receiver_account_id STRING,
        created_at BIGINT,
        latitude DOUBLE,
        longitude DOUBLE,
        fraud_type STRING,
        is_fraud BOOLEAN,
        risk_score INT
    >,
    `after` ROW<
        id STRING,
        amount DOUBLE,
        currency STRING,
        reference STRING,
        description STRING,
        sender_account_id STRING,
        receiver_account_id STRING,
        created_at BIGINT,
        latitude DOUBLE,
        longitude DOUBLE,
        fraud_type STRING,
        is_fraud BOOLEAN,
        risk_score INT
    >,
    op STRING,
    ts_ms BIGINT,
    ts_us BIGINT,
    ts_ns BIGINT
) WITH (
    'connector' = 'kafka',
    'topic' = 'aibank.public.transactions',
    'properties.bootstrap.servers' = 'kafka:9093',
    'properties.group.id' = 'flink-transactions',
    'scan.startup.mode' = 'earliest-offset',
    'format' = 'json',
    'json.ignore-parse-errors' = 'true'
);

-- ============================================================
-- 3. KAFKA OUTPUT
--
-- IMPORTANT:
--
-- Use normal Kafka connector, NOT upsert-kafka.
--
-- This feature stream is treated as append-only.
-- ============================================================
CREATE TABLE target_transaction_events_kafka (
    transaction_id STRING,
    trans_amount DOUBLE,
    age_hours_open_acc DOUBLE,
    receiver_txn_count_last_3d BIGINT,
    unique_senders_last_3d BIGINT,
    multi_same_amt_count_2d BIGINT,
    sender_txn_count_last_1h BIGINT,
    sender_volume_last_1h DOUBLE,

    PRIMARY KEY (transaction_id) NOT ENFORCED
) WITH (
    'connector' = 'upsert-kafka',
    'topic' = 'target-transaction-events',
    'properties.bootstrap.servers' = 'kafka:9093',
    'key.format' = 'json',
    'value.format' = 'json',
    'key.json.ignore-parse-errors' = 'true',
    'value.json.ignore-parse-errors' = 'true'
);

-- ============================================================
-- 4. START PIPELINE
--
-- IMPORTANT — WHY THIS IS ONE SINGLE STATEMENT:
--
-- No CREATE VIEW objects are used anywhere in this script
-- anymore (only CREATE TABLE for sources/sink). All logic
-- that used to live in bank_account_events, transaction_events,
-- and target_transaction_events is now inlined as CTEs inside
-- this one INSERT INTO ... SELECT.
--
-- Root cause being avoided: when CREATE VIEW objects are
-- referenced across separate executeSql() statements in the
-- same session/script, Flink/Calcite can reuse a cached
-- RelNode that was built under a different planner instance
-- than the one optimizing the current statement, throwing:
--   java.lang.AssertionError: ... belongs to a different
--   planner than is currently being used
-- A single statement is parsed and optimized under exactly
-- one planner instance from start to finish, so there is no
-- view boundary left for Calcite to trip over.
-- ============================================================
INSERT INTO target_transaction_events_kafka
WITH bank_account_events AS (
    SELECT
        `after`.id AS account_id,
        `after`.created_at AS account_created_at_ms,
        TO_TIMESTAMP_LTZ(`after`.created_at, 3) AS account_created_at
    FROM bank_accounts
    WHERE `after`.id IS NOT NULL
      AND (op <> 'd' OR op IS NULL)
),
transaction_events AS (
    SELECT
        `after`.id AS transaction_id,
        CAST(`after`.amount AS DOUBLE) AS trans_amount,
        `after`.sender_account_id AS sender_account_id,
        `after`.receiver_account_id AS receiver_account_id,
        `after`.created_at AS trans_date_ms,
        TO_TIMESTAMP_LTZ(`after`.created_at, 3) AS trans_date
    FROM transactions
    WHERE `after`.id IS NOT NULL
      AND (op <> 'd' OR op IS NULL)
)
SELECT
    target.transaction_id,
    target.trans_amount,

    CASE
        WHEN a.account_created_at IS NULL THEN NULL
        ELSE TIMESTAMPDIFF(SECOND, a.account_created_at, target.trans_date) / 3600.0
    END AS age_hours_open_acc,

    COUNT(
        CASE WHEN previous.receiver_account_id = target.receiver_account_id
                  AND previous.trans_date >= target.trans_date - INTERVAL '3' DAY
                  AND previous.trans_date < target.trans_date
             THEN previous.transaction_id END
    ) AS receiver_txn_count_last_3d,

    COUNT(
        DISTINCT CASE WHEN previous.receiver_account_id = target.receiver_account_id
                           AND previous.trans_date >= target.trans_date - INTERVAL '3' DAY
                           AND previous.trans_date < target.trans_date
                      THEN previous.sender_account_id END
    ) AS unique_senders_last_3d,

    COUNT(
        CASE WHEN previous.sender_account_id = target.sender_account_id
                  AND previous.trans_amount = target.trans_amount
                  AND previous.trans_date >= target.trans_date - INTERVAL '2' DAY
                  AND previous.trans_date < target.trans_date
             THEN previous.transaction_id END
    ) AS multi_same_amt_count_2d,

    COUNT(
        CASE WHEN previous.sender_account_id = target.sender_account_id
                  AND previous.trans_date >= target.trans_date - INTERVAL '1' HOUR
                  AND previous.trans_date < target.trans_date
             THEN previous.transaction_id END
    ) AS sender_txn_count_last_1h,

    COALESCE(
        SUM(
            CASE WHEN previous.sender_account_id = target.sender_account_id
                      AND previous.trans_date >= target.trans_date - INTERVAL '1' HOUR
                      AND previous.trans_date < target.trans_date
                 THEN previous.trans_amount END
        ),
        0.0
    ) AS sender_volume_last_1h

FROM transaction_events target
LEFT JOIN bank_account_events a
    ON target.sender_account_id = a.account_id
LEFT JOIN transaction_events previous
    ON previous.transaction_id <> target.transaction_id
   AND (
        (previous.receiver_account_id = target.receiver_account_id
            AND previous.trans_date >= target.trans_date - INTERVAL '3' DAY
            AND previous.trans_date < target.trans_date)
     OR (previous.sender_account_id = target.sender_account_id
            AND previous.trans_amount = target.trans_amount
            AND previous.trans_date >= target.trans_date - INTERVAL '2' DAY
            AND previous.trans_date < target.trans_date)
     OR (previous.sender_account_id = target.sender_account_id
            AND previous.trans_date >= target.trans_date - INTERVAL '1' HOUR
            AND previous.trans_date < target.trans_date)
   )
GROUP BY
    target.transaction_id,
    target.trans_amount,
    target.trans_date,
    a.account_created_at;