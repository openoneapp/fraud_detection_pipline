import pandas as pd
import numpy as np
from pathlib import Path
from sqlalchemy import create_engine

# ============================================================
# DATABASE
# ============================================================

DATABASE_URL = (
    "postgresql+psycopg2://"
    "postgres:postgres"
    "@localhost:5432/"
    "aibank"
)

engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)


# ============================================================
# LOAD DATA
# ============================================================

def load_data():

    print("Fetching transactions...")

    transactions = pd.read_sql(
        """
        SELECT
            id,
            amount,
            sender_account_id,
            receiver_account_id,
            latitude,
            longitude,
            created_at,
            is_fraud,
            fraud_type
        FROM public.transactions
        ORDER BY created_at ASC
        """,
        engine
    )

    print(
        f"Loaded {len(transactions):,} transactions"
    )

    print("Fetching bank accounts...")

    bank_accounts = pd.read_sql(
        """
        SELECT
            id,
            account_number,
            created_at
        FROM public.bank_accounts
        """,
        engine
    )

    print(
        f"Loaded {len(bank_accounts):,} bank accounts"
    )

    return transactions, bank_accounts


# ============================================================
# PREPARE TARGET DATASET
# ============================================================

def prepare_target(
    transactions: pd.DataFrame,
    bank_accounts: pd.DataFrame
) -> pd.DataFrame:

    print("Preparing transaction dataset...")

    tx = transactions.copy()

    accounts = bank_accounts.copy()

    # Convert dates
    tx["created_at"] = pd.to_datetime(
        tx["created_at"],
        errors="coerce"
    )

    accounts["created_at"] = pd.to_datetime(
        accounts["created_at"],
        errors="coerce"
    )

    # Sort transactions
    tx = tx.sort_values(
        "created_at"
    ).reset_index(
        drop=True
    )

    # --------------------------------------------------------
    # SENDER ACCOUNT
    # --------------------------------------------------------

    sender_accounts = accounts[
        [
            "id",
            "account_number",
            "created_at"
        ]
    ].rename(
        columns={
            "id": "sender_account_id",
            "account_number": "sender_account",
            "created_at": "sender_open_acc_date"
        }
    )

    # --------------------------------------------------------
    # RECEIVER ACCOUNT
    # --------------------------------------------------------

    receiver_accounts = accounts[
        [
            "id",
            "account_number"
        ]
    ].rename(
        columns={
            "id": "receiver_account_id",
            "account_number": "receiver_account"
        }
    )

    # --------------------------------------------------------
    # MERGE ACCOUNT DATA
    # --------------------------------------------------------

    target = (
        tx
        .merge(
            sender_accounts,
            on="sender_account_id",
            how="left"
        )
        .merge(
            receiver_accounts,
            on="receiver_account_id",
            how="left"
        )
    )

    # --------------------------------------------------------
    # BASIC FEATURES
    # --------------------------------------------------------

    target["trans_date"] = (
        target["created_at"]
    )

    target["trans_amount"] = (
        target["amount"]
    )

    target["age_hours_open_acc"] = (
        target["trans_date"]
        - target["sender_open_acc_date"]
    ).dt.total_seconds() / 3600

    print(
        "Transaction dataset prepared"
    )

    return target


# ============================================================
# RECEIVER CONSOLIDATION
# ============================================================

def calculate_receiver_consolidation(
    target: pd.DataFrame
) -> pd.DataFrame:

    print(
        "Calculating receiver consolidation..."
    )

    df = target[
        [
            "id",
            "receiver_account_id",
            "sender_account_id",
            "trans_date"
        ]
    ].copy()

    df = df.sort_values(
        [
            "receiver_account_id",
            "trans_date"
        ]
    )

    # --------------------------------------------------------
    # Previous transactions within 3 days
    # --------------------------------------------------------

    # For count, use a time-based rolling window.
    # The current transaction is excluded by shifting after
    # calculating the rolling count.

    df["receiver_txn_count_last_3d"] = (
        df
        .set_index("trans_date")
        .groupby("receiver_account_id")["id"]
        .rolling(
            "3D",
            closed="left"
        )
        .count()
        .reset_index(
            level=0,
            drop=True
        )
        .to_numpy()
    )

    # --------------------------------------------------------
    # Unique senders within 3 days
    # --------------------------------------------------------

    # Pandas rolling().nunique() is not directly supported
    # efficiently for datetime windows.
    #
    # We calculate this using a sorted group-based
    # two-pointer window algorithm.

    unique_senders = np.zeros(
        len(df),
        dtype=np.int32
    )

    receiver_groups = (
        df
        .groupby(
            "receiver_account_id",
            sort=False
        )
    )

    for _, group in receiver_groups:

        timestamps = (
            group["trans_date"]
            .astype("int64")
            .to_numpy()
        )

        senders = (
            group["sender_account_id"]
            .to_numpy()
        )

        left = 0

        sender_counts = {}

        values = np.zeros(
            len(group),
            dtype=np.int32
        )

        for right in range(len(group)):

            current_sender = senders[right]

            sender_counts[current_sender] = (
                sender_counts.get(
                    current_sender,
                    0
                ) + 1
            )

            current_time = timestamps[right]

            window_start = (
                current_time
                - pd.Timedelta(
                    days=3
                ).value
            )

            while (
                left < right
                and timestamps[left]
                < window_start
            ):

                old_sender = senders[left]

                sender_counts[old_sender] -= 1

                if (
                    sender_counts[old_sender]
                    == 0
                ):
                    del sender_counts[
                        old_sender
                    ]

                left += 1

            # Current transaction is excluded
            current_sender_count = (
                sender_counts.get(
                    current_sender,
                    0
                )
            )

            if (
                current_sender_count > 0
                and right >= left
            ):

                values[right] = (
                    len(sender_counts)
                    - (
                        1
                        if current_sender_count == 1
                        else 0
                    )
                )

            else:

                values[right] = 0

        unique_senders[
            group.index
        ] = values

    df[
        "unique_senders_last_3d"
    ] = unique_senders

    result = df[
        [
            "id",
            "receiver_txn_count_last_3d",
            "unique_senders_last_3d"
        ]
    ].rename(
        columns={
            "id": "transaction_id"
        }
    )

    print(
        "Receiver consolidation completed"
    )

    return result


# ============================================================
# MULTIPLE SAME AMOUNT
# ============================================================

def calculate_same_amount(
    target: pd.DataFrame
) -> pd.DataFrame:

    print(
        "Calculating multiple same amount..."
    )

    df = target[
        [
            "id",
            "sender_account_id",
            "amount",
            "trans_date"
        ]
    ].copy()

    df = df.sort_values(
        [
            "sender_account_id",
            "amount",
            "trans_date"
        ]
    )

    df[
        "multi_same_amt_count_2d"
    ] = (
        df
        .set_index("trans_date")
        .groupby(
            [
                "sender_account_id",
                "amount"
            ]
        )["id"]
        .rolling(
            "2D",
            closed="left"
        )
        .count()
        .reset_index(
            level=[
                0,
                1
            ],
            drop=True
        )
        .to_numpy()
    )

    result = df[
        [
            "id",
            "multi_same_amt_count_2d"
        ]
    ].rename(
        columns={
            "id": "transaction_id"
        }
    )

    print(
        "Multiple same amount completed"
    )

    return result


# ============================================================
# SENDER VELOCITY
# ============================================================

def calculate_velocity(
    target: pd.DataFrame
) -> pd.DataFrame:

    print(
        "Calculating sender velocity..."
    )

    df = target[
        [
            "id",
            "sender_account_id",
            "amount",
            "trans_date"
        ]
    ].copy()

    df = df.sort_values(
        [
            "sender_account_id",
            "trans_date"
        ]
    )

    # --------------------------------------------------------
    # Transaction count in previous 1 hour
    # --------------------------------------------------------

    df[
        "sender_txn_count_last_1h"
    ] = (
        df
        .set_index("trans_date")
        .groupby(
            "sender_account_id"
        )["id"]
        .rolling(
            "1h",
            closed="left"
        )
        .count()
        .reset_index(
            level=0,
            drop=True
        )
        .to_numpy()
    )

    # --------------------------------------------------------
    # Transaction volume in previous 1 hour
    # --------------------------------------------------------

    df[
        "sender_volume_last_1h"
    ] = (
        df
        .set_index("trans_date")
        .groupby(
            "sender_account_id"
        )["amount"]
        .rolling(
            "1h",
            closed="left"
        )
        .sum()
        .reset_index(
            level=0,
            drop=True
        )
        .to_numpy()
    )

    result = df[
        [
            "id",
            "sender_txn_count_last_1h",
            "sender_volume_last_1h"
        ]
    ].rename(
        columns={
            "id": "transaction_id"
        }
    )

    print(
        "Sender velocity completed"
    )

    return result


# ============================================================
# DORMANCY
# ============================================================

def calculate_dormancy(
    target: pd.DataFrame
) -> pd.DataFrame:

    print(
        "Calculating dormancy..."
    )

    df = target[
        [
            "id",
            "sender_account_id",
            "trans_date"
        ]
    ].copy()

    df = df.sort_values(
        [
            "sender_account_id",
            "trans_date"
        ]
    )

    df[
        "previous_trans_date"
    ] = (
        df
        .groupby(
            "sender_account_id"
        )["trans_date"]
        .shift(1)
    )

    df[
        "days_since_last_trans"
    ] = (
        df["trans_date"]
        - df["previous_trans_date"]
    ).dt.total_seconds() / 86400

    df[
        "days_since_last_trans"
    ] = (
        df[
            "days_since_last_trans"
        ]
        .fillna(9999)
    )

    result = df[
        [
            "id",
            "days_since_last_trans"
        ]
    ].rename(
        columns={
            "id": "transaction_id"
        }
    )

    print(
        "Dormancy completed"
    )

    return result


# ============================================================
# LOCATION JUMP
# ============================================================

def calculate_location_speed(
    target: pd.DataFrame
) -> pd.DataFrame:

    print(
        "Calculating location speed..."
    )

    df = target[
        [
            "id",
            "sender_account_id",
            "trans_date",
            "latitude",
            "longitude"
        ]
    ].copy()

    df = df.sort_values(
        [
            "sender_account_id",
            "trans_date"
        ]
    )

    # --------------------------------------------------------
    # Previous location
    # --------------------------------------------------------

    df[
        "previous_lat"
    ] = (
        df
        .groupby(
            "sender_account_id"
        )["latitude"]
        .shift(1)
    )

    df[
        "previous_lon"
    ] = (
        df
        .groupby(
            "sender_account_id"
        )["longitude"]
        .shift(1)
    )

    df[
        "previous_location_date"
    ] = (
        df
        .groupby(
            "sender_account_id"
        )["trans_date"]
        .shift(1)
    )

    # --------------------------------------------------------
    # Elapsed hours
    # --------------------------------------------------------

    elapsed_hours = (
        df["trans_date"]
        - df["previous_location_date"]
    ).dt.total_seconds() / 3600

    # --------------------------------------------------------
    # Convert coordinates
    # --------------------------------------------------------

    lat1 = np.radians(
        pd.to_numeric(
            df["previous_lat"],
            errors="coerce"
        )
    )

    lon1 = np.radians(
        pd.to_numeric(
            df["previous_lon"],
            errors="coerce"
        )
    )

    lat2 = np.radians(
        pd.to_numeric(
            df["latitude"],
            errors="coerce"
        )
    )

    lon2 = np.radians(
        pd.to_numeric(
            df["longitude"],
            errors="coerce"
        )
    )

    # --------------------------------------------------------
    # Haversine distance
    # --------------------------------------------------------

    dlat = lat2 - lat1

    dlon = lon2 - lon1

    a = (
        np.sin(dlat / 2) ** 2
        + np.cos(lat1)
        * np.cos(lat2)
        * np.sin(dlon / 2) ** 2
    )

    a = np.clip(
        a,
        0,
        1
    )

    distance_km = (
        6371
        * 2
        * np.arcsin(
            np.sqrt(a)
        )
    )

    # --------------------------------------------------------
    # Speed
    # --------------------------------------------------------

    df[
        "geo_speed_kmh"
    ] = (
        distance_km
        / elapsed_hours
    )

    df[
        "geo_speed_kmh"
    ] = (
        df[
            "geo_speed_kmh"
        ]
        .replace(
            [
                np.inf,
                -np.inf
            ],
            0
        )
        .fillna(0)
    )

    result = df[
        [
            "id",
            "geo_speed_kmh"
        ]
    ].rename(
        columns={
            "id": "transaction_id"
        }
    )

    print(
        "Location speed completed"
    )

    return result


# ============================================================
# BUILD FRAUD FEATURES
# ============================================================

def build_features(
    target: pd.DataFrame
) -> pd.DataFrame:

    print("")
    print(
        "========================================"
    )
    print(
        "STARTING FRAUD FEATURE CALCULATION"
    )
    print(
        "========================================"
    )

    # --------------------------------------------------------
    # Calculate each feature
    # --------------------------------------------------------

    receiver_metrics = (
        calculate_receiver_consolidation(
            target
        )
    )

    same_amount_metrics = (
        calculate_same_amount(
            target
        )
    )

    velocity_metrics = (
        calculate_velocity(
            target
        )
    )

    dormancy_metrics = (
        calculate_dormancy(
            target
        )
    )

    location_metrics = (
        calculate_location_speed(
            target
        )
    )

    # --------------------------------------------------------
    # Base result
    # --------------------------------------------------------

    result = target[
        [
            "id",
            "amount",
            "age_hours_open_acc",
            "is_fraud",
            "fraud_type"
        ]
    ].rename(
        columns={
            "id": "transaction_id",
            "amount": "trans_amount"
        }
    )

    # --------------------------------------------------------
    # Merge features
    # --------------------------------------------------------

    result = (
        result
        .merge(
            receiver_metrics,
            on="transaction_id",
            how="left"
        )
        .merge(
            same_amount_metrics,
            on="transaction_id",
            how="left"
        )
        .merge(
            velocity_metrics,
            on="transaction_id",
            how="left"
        )
        .merge(
            dormancy_metrics,
            on="transaction_id",
            how="left"
        )
        .merge(
            location_metrics,
            on="transaction_id",
            how="left"
        )
    )

    # --------------------------------------------------------
    # Fill missing numeric values
    # --------------------------------------------------------

    numeric_columns = [
        "receiver_txn_count_last_3d",
        "unique_senders_last_3d",
        "multi_same_amt_count_2d",
        "sender_txn_count_last_1h",
        "sender_volume_last_1h",
        "geo_speed_kmh",
        "days_since_last_trans"
    ]

    for column in numeric_columns:

        if column in result.columns:

            result[column] = (
                result[column]
                .fillna(0)
            )

    print("")
    print(
        "========================================"
    )
    print(
        "FRAUD FEATURE CALCULATION COMPLETED"
    )
    print(
        "========================================"
    )

    return result


# ============================================================
# SAVE TO DATABASE
# ============================================================

def save_features(
    features: pd.DataFrame
):

    print("")
    print(
        "Writing fraud features to PostgreSQL..."
    )

    # change connection from db source to analysis db
    DATABASE_URL = (
    "postgresql+psycopg2://"
    "postgres:postgres"
    "@localhost:5433/"
    "analysis"
    )
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True
    )

    features.to_sql(
        "fraud_features",
        engine,
        schema="public",
        if_exists="replace",
        index=False,
        chunksize=20_000,
        method="multi"
    )

    filepath = Path("dataset/dataset.csv")
    filepath.parent.mkdir(parents=True, exist_ok=True)
    features.to_csv(filepath,index=False)

    print(
        "Fraud features successfully saved!"
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print("")
    print(
        "========================================"
    )
    print(
        "FRAUD DATASET GENERATION STARTED"
    )
    print(
        "========================================"
    )

    # --------------------------------------------------------
    # Load data
    # --------------------------------------------------------

    transactions, bank_accounts = (
        load_data()
    )

    # --------------------------------------------------------
    # Prepare target
    # --------------------------------------------------------

    target = prepare_target(
        transactions,
        bank_accounts
    )

    # --------------------------------------------------------
    # Build fraud features
    # --------------------------------------------------------

    features = build_features(
        target
    )

    # --------------------------------------------------------
    # Save to PostgreSQL
    # --------------------------------------------------------

    save_features(
        features
    )

    print("")
    print(
        "Dataset preview:"
    )

    print(
        features.head()
    )

    print("")
    print(
        "Dataset shape:",
        features.shape
    )

    print("")
    print(
        "========================================"
    )
    print(
        "DATASET GENERATION FINISHED"
    )
    print(
        "========================================"
    )


# ============================================================
# WINDOWS-SAFE ENTRY POINT
# ============================================================

if __name__ == "__main__":

    main()