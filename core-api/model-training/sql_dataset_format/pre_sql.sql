WITH target_transactions AS (
    SELECT
        t.id,
        t.sender_account_id,
        t.receiver_account_id,
        sender.account_number AS sender_account,
        receiver.account_number AS receiver_account,

        sender.created_at AS sender_open_acc_date,
        t.created_at AS trans_date,
        t.amount AS trans_amount,

        t.latitude AS trans_lat,
        t.longitude AS trans_lon,

        EXTRACT(EPOCH FROM (
                t.created_at - sender.created_at
            )
        ) / 3600.0 AS age_hours_open_acc,

        t.is_fraud,
        t.fraud_type

    FROM public.transactions t
    LEFT JOIN public.bank_accounts sender ON t.sender_account_id = sender.id
    LEFT JOIN public.bank_accounts receiver ON t.receiver_account_id = receiver.id
    ORDER BY t.created_at ASC

),

/*
====================================================
1. RECEIVER CONSOLIDATION
====================================================

Example:

A ──┐
B ──┤
C ──┼──> Receiver X
D ──┤
E ──┘

Features:
- Number of incoming transactions
- Number of unique senders
*/
receiver_metrics AS (
    SELECT
        target.id,

        COUNT(previous_tx.id)
            AS receiver_txn_count_last_3d,

        COUNT(
            DISTINCT previous_tx.sender_account_id
        ) AS unique_senders_last_3d

    FROM target_transactions target

    LEFT JOIN public.transactions previous_tx
        ON previous_tx.receiver_account_id =
           target.receiver_account_id

       AND previous_tx.id != target.id

       AND previous_tx.created_at >=
           target.trans_date - INTERVAL '3 days'

       AND previous_tx.created_at <
           target.trans_date

    GROUP BY target.id
),

/*
====================================================
2. MULTIPLE SAME AMOUNT
====================================================

Example:

Sender A
   ├── $2,500 → B
   ├── $2,500 → C
   ├── $2,500 → D
   └── $2,500 → E

Same:
- Sender
- Amount
- Time window
*/
same_amount_metrics AS (
    SELECT
        target.id,

        COUNT(previous_tx.id)
            AS multi_same_amt_count_2d

    FROM target_transactions target

    LEFT JOIN public.transactions previous_tx
        ON previous_tx.sender_account_id =
           target.sender_account_id

       AND previous_tx.amount =
           target.trans_amount

       AND previous_tx.id != target.id

       AND previous_tx.created_at >=
           target.trans_date - INTERVAL '2 days'

       AND previous_tx.created_at <
           target.trans_date

    GROUP BY target.id
),

/*
====================================================
3. SENDER VELOCITY
====================================================

Number and total value of outgoing
transactions within previous 1 hour.
*/
sender_velocity AS (
    SELECT
        target.id,

        COUNT(previous_tx.id)
            AS sender_txn_count_last_1h,

        COALESCE(
            SUM(previous_tx.amount),
            0
        ) AS sender_volume_last_1h

    FROM target_transactions target

    LEFT JOIN public.transactions previous_tx
        ON previous_tx.sender_account_id =
           target.sender_account_id

       AND previous_tx.id != target.id

       AND previous_tx.created_at >=
           target.trans_date - INTERVAL '1 hour'

       AND previous_tx.created_at <
           target.trans_date

    GROUP BY target.id
),

/*
====================================================
4. DORMANCY
====================================================

Find the immediately previous transaction
from the same sender.
*/
previous_transaction AS (
    SELECT DISTINCT ON (
        target.id
    )

        target.id,

        previous_tx.created_at
            AS previous_trans_date

    FROM target_transactions target

    LEFT JOIN public.transactions previous_tx
        ON previous_tx.sender_account_id =
           target.sender_account_id

       AND previous_tx.id != target.id

       AND previous_tx.created_at <
           target.trans_date

    ORDER BY
        target.id,
        previous_tx.created_at DESC
),

dormancy_metrics AS (
    SELECT
        id,

        EXTRACT(
            EPOCH FROM (
                trans_date -
                previous_trans_date
            )
        ) / 86400.0
        AS days_since_last_trans

    FROM (
        SELECT
            target.id,
            target.trans_date,
            previous.previous_trans_date

        FROM target_transactions target

        LEFT JOIN previous_transaction previous
            ON target.id = previous.id
    ) x
),

/*
====================================================
5. LOCATION JUMP
====================================================

Find previous transaction location
and calculate required travel speed.
*/
previous_location AS (
    SELECT DISTINCT ON (
        target.id
    )

        target.id,

        previous_tx.latitude
            AS previous_lat,

        previous_tx.longitude
            AS previous_lon,

        previous_tx.created_at
            AS previous_trans_date
    FROM target_transactions target
    LEFT JOIN public.transactions previous_tx
        ON previous_tx.sender_account_id =
           target.sender_account_id
       AND previous_tx.id != target.id
       AND previous_tx.created_at <
           target.trans_date
    ORDER BY
        target.id,
        previous_tx.created_at DESC
)
, location_jump_metrics AS (
    SELECT
        target.id,
        CASE
            WHEN previous.previous_lat IS NULL
                OR previous.previous_lon IS NULL
                OR target.trans_lat IS NULL
                OR target.trans_lon IS NULL
                THEN 0
            WHEN NULLIF(
                EXTRACT(
                    EPOCH FROM (
                        target.trans_date -
                        previous.previous_trans_date
                    )
                ) / 3600.0,
                0
            ) IS NULL
            THEN 0
            ELSE
                (
                    6371.0 *
                    ACOS(
                        LEAST(
                            1.0,
                            GREATEST(
                                -1.0,
                                COS(
                                    RADIANS(
                                        target.trans_lat::double precision
                                    )
                                )
                                *
                                COS(
                                    RADIANS(
                                        previous.previous_lat::double precision
                                    )
                                )
                                *
                                COS(
                                    RADIANS(
                                        target.trans_lon::double precision
                                    )
                                    -
                                    RADIANS(
                                        previous.previous_lon::double precision
                                    )
                                )
                                +
                                SIN(
                                    RADIANS(
                                        target.trans_lat::double precision
                                    )
                                )
                                *
                                SIN(
                                    RADIANS(
                                        previous.previous_lat::double precision
                                    )
                                )
                            )
                        )
                    )
                )
                /
                NULLIF(
                    EXTRACT(
                        EPOCH FROM (
                            target.trans_date -
                            previous.previous_trans_date
                        )
                    ) / 3600.0,
                    0
                )
        END AS geo_speed_kmh
    FROM target_transactions target
    LEFT JOIN previous_location previous ON target.id = previous.id
)
/*
====================================================
FINAL ML FEATURE DATASET
====================================================
*/
SELECT
    target.id AS transaction_id,
    target.trans_amount,
    /*
    Feature 1:
    Immediate large transfer
    */
    target.age_hours_open_acc,
    /*
    Feature 2:
    Many-to-one consolidation
    */
    COALESCE(receiver.receiver_txn_count_last_3d,0) AS receiver_txn_count_last_3d,
    COALESCE(receiver.unique_senders_last_3d,0) AS unique_senders_last_3d,
    /*
    Feature 3:
    Multiple same amount
    */
    COALESCE(same_amount.multi_same_amt_count_2d,0) AS multi_same_amt_count_2d,
    /*
    Feature 4:
    Velocity spike
    */
    COALESCE(velocity.sender_txn_count_last_1h,0) AS sender_txn_count_last_1h,
    COALESCE(velocity.sender_volume_last_1h,0) AS sender_volume_last_1h,
    /*
    Feature 5:
    Sleep and wake
    */
    COALESCE(dormancy.days_since_last_trans,9999) AS days_since_last_trans,
    /*
    Feature 6:
    Location jump
    */
    COALESCE(location.geo_speed_kmh,0) AS geo_speed_kmh,
    /*
    Target variables
    */
    target.is_fraud,
    target.fraud_type
FROM target_transactions target
LEFT JOIN receiver_metrics receiver ON target.id = receiver.id
LEFT JOIN same_amount_metrics same_amount ON target.id = same_amount.id
LEFT JOIN sender_velocity velocity ON target.id = velocity.id
LEFT JOIN dormancy_metrics dormancy ON target.id = dormancy.id
LEFT JOIN location_jump_metrics location ON target.id = location.id
ORDER BY target.trans_date ASC;