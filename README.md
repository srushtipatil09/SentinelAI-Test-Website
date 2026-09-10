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
PORT=3001
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
| `GET` | `/` | Root Welcome & Status | `INFO` log, HTTP Trace Span, Full API Docs |
| `GET` | `/health` | Service Health check | Returns `{ status: "healthy", service: "sentinel-demo-service", version: "1.0.0" }` |
| `GET` | `/products` | View catalog | Log: `Product Viewed`, Mongoose child trace span |
| `GET` | `/products/:id` | View item detail | Log: `Product Viewed`, Item trace span |
| `POST` | `/login` | User authentication | Log: `User Logged In`, Auth trace span |
| `POST` | `/register` | User registration | Log: `User Registered`, DB insert span |
| `POST` | `/orders` | Place order | Logs: `Order Created`, `Inventory Updated`, DB transaction spans |
| `POST` | `/payment` | Payment processing | **30% random failure rate**. Logs: `Payment Initiated` / `Payment Failed`, Payment service span |
| `GET` | `/users` | Get user list | Log: `Users List Retrieved`, DB find span |
| `GET` | `/analytics` | System telemetry metrics | Emits CPU %, RSS memory, Heap memory, Active Users, Error Rate, Avg Response Time |

### 💥 Error Telemetry Suite for AI RCA & Incident Analysis (`/errors/*`)

| Method | Endpoint | HTTP Status | Exception / Failure Simulated | AI RCA / Incident Target |
|---|---|---|---|---|
| `GET` | `/errors` | `200` | Catalog of all failure endpoints | Service discovery & automated crawlers |
| `GET` | `/errors/unauthorized` | `401` | `TokenExpiredError: jwt expired` | Security incident, auth token expiration |
| `GET` | `/errors/forbidden` | `403` | `AccessDeniedError: Missing 'system:admin' role` | RBAC authorization violation |
| `GET` | `/errors/rate-limit` | `429` | `RateLimitExceededException: 100 req/min exceeded` | API quota breach & spike detection |
| `POST` / `GET` | `/errors/validation` | `422` | `ValidationError: Schema validation failed` | Malformed payload / bad request diagnostics |
| `GET` | `/errors/not-found` | `404` | `ResourceNotFoundException: Order not found` | Missing resource lookup tracing |
| `GET` | `/errors/circuit-breaker` | `503` | `CircuitBreakerOpenException: Downstream circuit OPEN` | Microservice cascading failure detection |
| `GET` | `/errors/gateway-timeout` | `504` | `GatewayTimeoutError: Upstream partner timed out (5000ms)` | External partner latency / timeout tracing |
| `GET` | `/errors/upstream-failure` | `502` | `BadGatewayError: ECONNREFUSED 10.0.4.15:9092` | Network partition / downstream crash |
| `GET` | `/errors/dns-failure` | `502` | `DnsResolutionError: ENOTFOUND idp.internal.aws` | DNS resolution failure |
| `GET` | `/errors/deadlock` | `500` | `DeadlockDetectedError: Transaction deadlock victim` | Database concurrency contention |
| `GET` | `/errors/connection-pool-exhausted` | `500` | `ConnectionPoolExhaustedError: Pool capacity 20 reached` | Database resource saturation |
| `GET` | `/errors/null-pointer` | `500` | `TypeError: Cannot read properties of undefined` | Code bug & unhandled exception RCA |
| `GET` | `/errors/memory-leak` | `500` | `RangeError: Array buffer allocation failed` | Memory pressure & OOM risk anomaly |
| `GET` | `/errors/disk-full` | `500` | `SystemError: ENOSPC: no space left on device` | Storage exhaustion & infrastructure failure |
| `GET` | `/errors/unhandled-rejection` | `500` | `UnhandledPromiseRejection: Background worker failed` | Async background queue failure |
| `ALL` | `/errors/simulate` | *Any* | Dynamic error parameterized by `?status=&type=&component=&message=&delay=` | Arbitrary test scenario injection |
| `GET` | `/errors/burst` | `200` | Generates 10-20 rapid mixed exceptions & flushes SDK | Sudden incident threshold trigger |

### 🛠️ Legacy Failure & Stress Routes

| Method | Endpoint | Description | Telemetry Captured |
|---|---|---|---|
| `GET` | `/error` | Forced Exception | Throws `Error("Payment Gateway Connection Failed")`, Exception capture & Error log |
| `GET` | `/slow` | Latency simulation | Delays 3-5 seconds, High-latency trace span |
| `GET` | `/database` | DB Timeout simulation | Throws `MongooseError("Operation timed out after 3000ms")`, Log: `Database Timeout` |
| `GET` | `/crash` | RCA Crash simulation | Throws multi-level nested cause exception chain for AI RCA |
| `GET` | `/stress` | SDK Batching validator | Generates **100 logs**, **20 traces**, **10 exceptions**, then calls `sdk.flush()` |

---

## 🔍 Validation Checklist

1. **Basic Request Tracking**:
   Visit `http://localhost:3001/` or `http://localhost:3001/health`. Check console for HTTP trace span generation.
2. **Error Catalog**:
   Visit `http://localhost:3001/errors` to inspect all available failure scenarios.
3. **Dynamic Error Injection**:
   Visit `http://localhost:3001/errors/simulate?status=503&type=CustomServiceError&component=BillingService`.
4. **Trigger Incident Wave for AI RCA**:
   Visit `http://localhost:3001/errors/burst?count=15`. Check Sentinel AI backend dashboard for detected incidents.
5. **Run Integration Test Suite**:
   ```bash
   node test-runner.js
   ```

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
