# Sentinel Test & Telemetry Generator Application

A realistic Express.js web application engineered specifically to test the **Sentinel SDK** against the Sentinel production ingestion backend (`/api/v1/sdk/ingest`), Supabase PostgreSQL, Incident Detector, LangGraph, Gemini 2.5 AI Root Cause Analysis, and ChromaDB Knowledge Storage.

This application simulates real production traffic, generates high-volume telemetry (logs, traces, exceptions, metrics), and provides dedicated failure-injection endpoints to validate batching, exception capture, latency tracing, and AI RCA pipelines.

---

## 🏗️ Project Architecture

```
sentinel-test-app/
├── app.js                    # Express app initialization & Sentinel SDK middleware binding
├── package.json              # App dependencies (express, mongoose, axios, morgan, dotenv, uuid)
├── README.md                 # Documentation & pipeline testing guide
├── .env                      # Environment configuration
├── .env.example              # Environment template
├── config/
│   └── db.js                 # MongoDB connection & Mongoose SDK plugin registration
├── sdk/
│   ├── sentinel-sdk.js       # Sentinel Client, Middlewares, Spans, Ingestion & Flush Engine
│   └── observeai-sdk.js      # Backward-compatible alias
├── models/
│   ├── User.js               # Mongoose User schema
│   ├── Product.js            # Mongoose Product schema
│   └── Order.js              # Mongoose Order schema
├── controllers/
│   ├── authController.js     # User registration, login, and user listing
│   ├── productController.js  # Product catalog & item detail view handlers
│   ├── orderController.js    # Order placement & stock inventory updating
│   ├── paymentController.js  # Flaky payment service (30% failure rate simulation)
│   └── testController.js     # Health, analytics, error, slow, database, crash, & stress routes
├── routes/
│   ├── auth.js               # POST /login, POST /register
│   ├── products.js           # GET /products, GET /products/:id
│   ├── orders.js             # POST /orders
│   ├── payment.js            # POST /payment
│   └── index.js              # GET /, /health, /users, /analytics, /error, /slow, /database, /crash, /stress
└── middlewares/
    └── requestContext.js     # Request context middleware
```

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
cd sentinel-test-app
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your `.env` contains:
```env
PORT=3000
SENTINEL_API_KEY=test_sdk_api_key_12345
SENTINEL_ENDPOINT=http://127.0.0.1:8000/api/v1/sdk/ingest
MONGO_URI=mongodb://localhost:27017/sentinel_demo
```

### 3. Start the Express Application
```bash
npm start
```
Or run with auto-reload:
```bash
npm run dev
```

---

## 🧪 Available Endpoints & Telemetry Generation

| Method | Endpoint | Description | Telemetry Captured |
|---|---|---|---|
| `GET` | `/` | Root Welcome & Status | `INFO` log, HTTP Trace Span |
| `GET` | `/health` | Service Health check | Returns `{ status: "healthy", service: "sentinel-demo-service", version: "1.0.0" }` |
| `GET` | `/products` | View catalog | Log: `Product Viewed`, Mongoose child trace span |
| `GET` | `/products/:id` | View item detail | Log: `Product Viewed`, Item trace span |
| `POST` | `/login` | User authentication | Log: `User Logged In`, Auth trace span |
| `POST` | `/register` | User registration | Log: `User Registered`, DB insert span |
| `POST` | `/orders` | Place order | Logs: `Order Created`, `Inventory Updated`, DB transaction spans |
| `POST` | `/payment` | Payment processing | **30% random failure rate**. Logs: `Payment Initiated` / `Payment Failed`, Payment service span |
| `GET` | `/users` | Get user list | Log: `Users List Retrieved`, DB find span |
| `GET` | `/analytics` | System telemetry metrics | Emits CPU %, RSS memory, Heap memory, Active Users, Error Rate, Avg Response Time |
| `GET` | `/error` | Forced Exception | Throws `Error("Payment Gateway Connection Failed")`, Exception capture & Error log |
| `GET` | `/slow` | Latency simulation | Delays 3-5 seconds, High-latency trace span |
| `GET` | `/database` | DB Timeout simulation | Throws `MongooseError("Operation timed out after 3000ms")`, Log: `Database Timeout` |
| `GET` | `/crash` | RCA Crash simulation | Throws multi-level nested cause exception chain for AI RCA |
| `GET` | `/stress` | SDK Batching validator | Generates **100 logs**, **20 traces**, **10 exceptions**, then calls `sdk.flush()` |

---

## 🔍 Validation Checklist

1. **Basic Request Tracking**:
   Visit `http://localhost:3000/` or `http://localhost:3000/health`. Check console for HTTP trace span generation.
2. **Error & RCA Capture**:
   Visit `http://localhost:3000/error`. Verify that `sdk.captureException` logs the stacktrace and sends an `ERROR` log to backend.
3. **Latency Verification**:
   Visit `http://localhost:3000/slow`. Verify that duration telemetry records 3000-5000ms span latency.
4. **Stress & Batching Verification**:
   Visit `http://localhost:3000/stress`. Verify console log output:
   `[Sentinel SDK] Flushed 130 telemetry items successfully to http://127.0.0.1:8000/api/v1/sdk/ingest (Status: 202)`

---

## 🔄 End-to-End Pipeline Overview

```
Express Test Application
   ├── expressMiddleware (Request tracing, duration, status codes)
   ├── expressErrorHandler (Exception capture & stacktrace extraction)
   └── Mongoose Plugin (DB operation child spans)
            │
            ▼
      Sentinel SDK Client (Auto-buffering & Batching Engine)
            │  (HTTP POST X-API-Key)
            ▼
   Sentinel Backend Ingestion API (/api/v1/sdk/ingest)
            │
            ▼
  Supabase PostgreSQL / Incident Detector / LangGraph AI RCA / ChromaDB
```
