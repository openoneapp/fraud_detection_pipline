CREATE TABLE bank_accounts (
    payload ROW<
        id STRING,
        account_number STRING,
        account_name STRING,
        account_type STRING,
        status STRING,
        balance DECIMAL(18, 2),
        currency STRING,
        user_id STRING,
        created_at STRING,
        updated_at STRING,
        __deleted STRING,
        __op STRING,
        __table STRING,
        __source_ts_ms BIGINT
    >
) WITH (
    'connector' = 'kafka',
    'topic' = 'aibank.public.bank_accounts',
    'properties.bootstrap.servers' = 'kafka:9093',
    'properties.group.id' = 'flink-fraud-detection',
    'scan.startup.mode' = 'earliest-offset',
    'format' = 'json',
    'json.ignore-parse-errors' = 'true'
);