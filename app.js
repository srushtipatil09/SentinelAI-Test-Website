require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const { SentinelClient } = require('./sdk/sentinel-sdk');
const { connectDB } = require('./config/db');
const requestContextMiddleware = require('./middlewares/requestContext');
// Import routes
const createMainRouter = require('./routes/index');
const createAuthRouter = require('./routes/auth');
const createProductRouter = require('./routes/products');
const createOrderRouter = require('./routes/orders');
const createPaymentRouter = require('./routes/payment');

// Initialize Sentinel SDK as specified in requirements
const sdk = new SentinelClient({
  apiKey: process.env.SENTINEL_API_KEY || process.env.OBSERVEAI_API_KEY,
  serviceName: 'test',
  endpointUrl: process.env.SENTINEL_ENDPOINT || process.env.OBSERVEAI_ENDPOINT,
  environment: 'production'
});

const app = express();
const PORT = process.env.PORT || 3000;

// Base Express Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(requestContextMiddleware);

// 1. Sentinel SDK Express Middleware
app.use(sdk.expressMiddleware());

// 2. Connect Database & Register Sentinel Mongoose Middleware
connectDB(sdk);

// 3. Register Routes
app.use('/', createAuthRouter(sdk));
app.use('/products', createProductRouter(sdk));
app.use('/orders', createOrderRouter(sdk));
app.use('/payment', createPaymentRouter(sdk));
app.use('/', createMainRouter(sdk));

// 4. Sentinel SDK Express Error Handler
app.use(sdk.expressErrorHandler());

// Standard Fallback Error Handling Middleware
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
    traceId: req.sentinel ? req.sentinel.traceId : (req.observeAi ? req.observeAi.traceId : null)
  });
});

// Start Express Application
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`  \x1b[36mSentinel Test Application running on port ${PORT}\x1b[0m`);
    console.log(`  Endpoint URL: \x1b[33m${process.env.SENTINEL_ENDPOINT || process.env.OBSERVEAI_ENDPOINT}\x1b[0m`);
    console.log(`  Service Name: \x1b[32msentinel-demo-service\x1b[0m`);
    console.log(`=============================================================\n`);
  });
}

// Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('\n[App] Graceful shutdown initiated. Flushing SDK...');
  await sdk.flush();
  if (server) {
    server.close(() => {
      console.log('[App] Server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

module.exports = app;
