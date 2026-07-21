# 🛡️ Real-Time Fraud Detection System

A high-performance, real-time banking fraud detection platform built as a comprehensive final capstone project. This project integrates full-stack software development, streaming data pipelines, distributed message brokers, change data capture (CDC), and trained Artificial Intelligence models to analyze, detect, and intercept fraudulent behavior in real time.

---

## 📊 Analytics & AI Core
This project demonstrates complete end-to-end expertise in data analysis (**Excel, Power BI, SQL, Python, R**) and **Machine Learning / AI Training**. The intelligent detection engine is engineered and trained against **six (6) critical, real-world banking fraud vectors**:

### 🧠 Trained Fraud Scenarios

1. **Immediate Large Transfer After Account Creation**
   * *The Pattern:* Normal users typically test new accounts with small sums or let them sit idle. Depositing or moving massive amounts immediately after registration is a textbook indicator of a **Money Mule Account** (set up specifically to launder or siphon stolen funds before discovery).

2. **Many-to-One Consolidation (Layering/Structuring)**
   * *The Pattern:* Multiple compromised or mule accounts routing rapid streams of small-to-medium transfers into a single centralized "hub" account. This is a classic signature of layering before a physical or external cash-out.

3. **Multiple Same-Amount Transactions**
   * *The Pattern:* Real human transaction frequencies and values vary significantly. Seeing identical amounts transferred consecutively in a tight window indicates automated **Bot Activity**, **Card-Testing Fraud**, or structural attempts to bypass single-transaction threshold reporting.

4. **Velocity Spikes (Rapid-Fire Attacks)**
   * *The Pattern:* A massive cluster of transactions executed in an ultra-short timeframe. Because attackers expect stolen cards or compromised credentials to be frozen quickly, they execute a high-frequency **Velocity Attack** to completely drain or disperse funds within minutes.

5. **Drastic Geolocation / Address Changes**
   * *The Pattern:* A transaction originates from a physical IP address or location in **Cambodia**, followed 10 minutes later by a transaction from an IP or bank branch in **Europe**. Because physical travel is impossible, this flags an immediate **Account Takeover (ATO)** or proxy/VPN spoofing.

6. **The "Sleep and Wake" Pattern**
   * *The Pattern:* An account remains completely dormant or inactive for months, suddenly "wakes up" to handle a massive volume of high-value transactions within a 48-hour window, and immediately goes dark again.

---

## 🚀 Architecture & Infrastructure Components

The orchestration ecosystem routes financial transactions from application states to the streaming analytics framework instantly:

| Service Component | Internal Routing URL | Purpose |
| :--- | :--- | :--- |
| **AIBank Web UI** | [http://localhost:3000](http://localhost:3000) | Frontend application and banking simulator interface |
| **Kafka UI** | [http://localhost:8080](http://localhost:8080) | Visualization and monitoring dashboard for Kafka Topics & Streams |
| **Debezium Connect** | [http://localhost:8083/connectors](http://localhost:8083/connectors) | Distributed CDC engine linking relational state mutations to Kafka |

---

## 🛠️ Step-by-Step Deployment Guide

### Phase 1: Initialize the Multi-Container Cluster
Ensure you are at the project root directory before executing setup commands.

```bash
# Navigate to the project root directory
cd AI-FINAL-PROJECT

# Compile, build, and lift all services in detached mode
docker compose --build -d
```
```bash
# To check the seeding logs
docker logs ai-bank-app
```
```bash
# Wait untill the seeding finish
Seeding register sign-on satrotana@gmail.com, completed! ✅
Seeding register sign-on povsokny@gmail.com, completed! ✅
.......
Seeded 985000/1000000 transactions...
Seeded 990000/1000000 transactions...
Seeded 995000/1000000 transactions...
Seeded 1000000/1000000 transactions...
Transaction seeding complete. Created 1000000 transactions.
▲ Next.js 16.2.10
- Local:         http://localhost:3000
- Network:       http://localhost:3000
✓ Ready in 0ms
```

> ⏳ *Note: Please wait a few moments for all database, messaging brokers, and applications to successfully initialize and enter a healthy state.*

### Phase 2: Establish the Change Data Capture (CDC) Pipeline
Once the cluster is online, you must provision a Debezium connector to stream ledger state changes out of the PostgreSQL database (`public.transactions,public.bank_account`) directly into Apache Kafka.

Execute the following **`POST`** request using your preferred API Client (cURL, Postman, or Thunder Client):

* **HTTP Method:** `POST`
* **Target Endpoint:** `http://localhost:8083/connectors`
* **Headers:** `Content-Type: application/json`

#### Request Payload Body:
```json
{
  "name": "aibank-transactions",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "aibank",
    "database.port": "5432",
    "database.user": "postgres",
    "database.password": "postgres",
    "database.dbname": "aibank",
    "topic.prefix": "aibank",
    "table.include.list": "public.transactions",
    "plugin.name": "pgoutput",
    "slot.name": "aibank_transactions_slot",
    "publication.name": "aibank_transactions_publication",
    "decimal.handling.mode": "double",
    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.add.fields": "op,table,source.ts_ms",
    "transforms.unwrap.delete.handling.mode": "rewrite"
  }
}
```
#### Request Payload Body:
```json
{
  "name": "aibank-bank_accounts",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",

    "database.hostname": "aibank",
    "database.port": "5432",
    "database.user": "postgres",
    "database.password": "postgres",
    "database.dbname": "aibank",

    "topic.prefix": "aibank",

    "table.include.list": "public.bank_accounts",

    "plugin.name": "pgoutput",

    "slot.name": "aibank_bank_accounts_slot",
    "publication.name": "aibank_bank_accounts_publication",

    "decimal.handling.mode": "double",

    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.add.fields": "op,table,source.ts_ms",
    "transforms.unwrap.delete.handling.mode": "rewrite"
  }
}
```

### Phase 3: Verify Streaming Status
To ensure that your log event streaming is operating flawlessly without bottlenecks, check the health of the newly initiated connector:

```http
GET http://localhost:8083/connectors/aibank-transactions/config
GET http://localhost:8083/connectors/aibank-bank_accounts/config
```
### Phase 4: Verify Streaming kafka
To ensure that your log event streaming is consumming with kafka topic which was created dynamicly from debezium connection

```http
http://localhost:8080/ui/clusters/local/all-topics
```