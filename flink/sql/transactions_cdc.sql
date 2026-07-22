CREATE TABLE transactions (
    payload ROW<
        id STRING,
        amount DOUBLE,
        currency STRING,
        reference STRING,
        description STRING,
        sender_account_id STRING,
        receiver_account_id STRING,
        created_at BIGINT,
        latitude STRING,
        longitude STRING,
        fraud_type STRING,
        is_fraud BOOLEAN,
        risk_score INT,
        __deleted STRING,
        __op STRING,
        __table STRING,
        __source_ts_ms BIGINT
    >
) WITH (
    'connector' = 'kafka',
    'topic' = 'aibank.public.transactions',
    'properties.bootstrap.servers' = 'kafka:9093',
    'properties.group.id' = 'flink-fraud-detection',
    'scan.startup.mode' = 'earliest-offset',
    'format' = 'json',
    'json.ignore-parse-errors' = 'true'
);