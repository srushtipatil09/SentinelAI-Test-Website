const getRoot = (sdk) => (req, res) => {
  sdk.captureLog('INFO', 'Root endpoint accessed', {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  return res.status(200).json({
    message: 'Sentinel Express SDK Testing Application',
    description: 'Telemetry Generator and SDK Validation Harness',
    docs: {
      health: '/health',
      products: '/products',
      login: 'POST /login',
      register: 'POST /register',
      orders: 'POST /orders',
      payment: 'POST /payment',
      analytics: '/analytics',
      errorTest: '/error',
      slowTest: '/slow',
      databaseTest: '/database',
      crashTest: '/crash',
      stressTest: '/stress'
    }
  });
};

const getHealth = (sdk) => (req, res) => {
  sdk.captureLog('INFO', 'Health check requested');
  return res.status(200).json({
    status: 'healthy',
    service: 'sentinel-demo-service',
    version: '1.0.0'
  });
};

const getAnalytics = (sdk) => (req, res) => {
  const metrics = sdk.getSystemMetrics();

  // Record metrics to Sentinel SDK
  sdk.recordMetric('cpu_usage_percentage', metrics.cpuUsagePct, 'gauge', '%');
  sdk.recordMetric('memory_rss_mb', metrics.memoryRssMb, 'gauge', 'MB');
  sdk.recordMetric('memory_heap_used_mb', metrics.memoryHeapUsedMb, 'gauge', 'MB');
  sdk.recordMetric('active_users', metrics.activeUsers, 'gauge', 'users');
  sdk.recordMetric('request_count', metrics.totalRequests, 'counter', 'requests');
  sdk.recordMetric('error_rate', metrics.errorRate, 'gauge', 'ratio');
  sdk.recordMetric('average_response_time_ms', metrics.averageResponseTimeMs, 'gauge', 'ms');

  sdk.captureLog('INFO', 'System analytics generated and telemetry metrics recorded', {
    metrics
  });

  return res.status(200).json({
    status: 'success',
    timestamp: new Date().toISOString(),
    metrics
  });
};

const triggerError = (sdk) => (req, res, next) => {
  // Requirement: Throw Error("Payment Gateway Connection Failed")
  sdk.captureLog('ERROR', 'External API Failed', {
    service: 'PaymentGatewayAPI',
    endpoint: 'https://api.payments.external/v1/charge'
  });

  const err = new Error('Payment Gateway Connection Failed');
  err.code = 'ETIMEDOUT';
  throw err;
};

const triggerSlow = (sdk) => async (req, res) => {
  const delayMs = Math.floor(Math.random() * 2000) + 3000; // 3-5 seconds delay

  sdk.captureLog('WARN', 'Slow Request Triggered - Simulating High Latency', { delayMs });

  await sdk.startSpan('simulation.slow_database_indexing', async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  });

  return res.status(200).json({
    message: 'Slow response completed',
    latencyMs: delayMs
  });
};

const triggerDatabaseError = (sdk) => (req, res, next) => {
  // Requirement: Simulate MongoDB Timeout and generate "Database Timeout" log
  sdk.captureLog('ERROR', 'Database Timeout', {
    operation: 'find',
    collection: 'orders',
    timeoutMs: 3000
  });

  const dbErr = new Error('MongooseError: Operation `orders.find()` timed out after 3000ms');
  dbErr.name = 'MongooseServerSelectionError';

  sdk.captureException(dbErr, true, { component: 'MongoDB' });

  return res.status(500).json({
    error: 'Database Timeout Error',
    message: dbErr.message
  });
};

const triggerCrash = (sdk) => (req, res) => {
  // Requirement: Throw multiple nested exceptions for AI RCA
  try {
    try {
      try {
        throw new Error('LowLevelIOException: Connection reset by peer on socket 0.0.0.0:27017');
      } catch (e1) {
        const e2 = new Error(`DatabasePoolException: Connection pool exhausted caused by [${e1.message}]`);
        e2.cause = e1;
        throw e2;
      }
    } catch (e2) {
      const e3 = new Error(`OrderProcessingServiceError: Failed to finalize order due to [${e2.message}]`);
      e3.cause = e2;
      throw e3;
    }
  } catch (finalError) {
    sdk.captureException(finalError, false, {
      component: 'OrderService',
      severity: 'CRITICAL',
      rcaTarget: true
    });

    sdk.captureLog('ERROR', 'Critical Application Crash Simulated', {
      errorChain: finalError.message,
      stack: finalError.stack
    });

    return res.status(500).json({
      error: 'Critical Application Crash',
      message: finalError.message,
      stack: finalError.stack
    });
  }
};

const triggerStress = (sdk) => async (req, res) => {
  sdk.captureLog('INFO', 'Starting SDK Stress Test Validation');

  const logCount = 100;
  const traceCount = 20;
  const exceptionCount = 10;

  // 1. Generate 100 logs
  for (let i = 1; i <= logCount; i++) {
    sdk.captureLog(
      i % 5 === 0 ? 'ERROR' : 'INFO',
      `Stress Test Log Event #${i}`,
      { iteration: i, batchTest: true }
    );
  }

  // 2. Generate 20 traces
  for (let t = 1; t <= traceCount; t++) {
    await sdk.startSpan(`stress.test.span_${t}`, async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }

  // 3. Generate 10 exceptions
  for (let e = 1; e <= exceptionCount; e++) {
    const testErr = new Error(`Stress Test Exception Event #${e}`);
    sdk.captureException(testErr, true, { exceptionIndex: e });
  }

  // 4. Flush SDK immediately
  const flushSuccess = await sdk.flush();

  return res.status(200).json({
    status: 'completed',
    stressMetrics: {
      generatedLogs: logCount,
      generatedTraces: traceCount,
      generatedExceptions: exceptionCount,
      sdkFlushResult: flushSuccess ? 'SUCCESS' : 'FAILED'
    }
  });
};

module.exports = {
  getRoot,
  getHealth,
  getAnalytics,
  triggerError,
  triggerSlow,
  triggerDatabaseError,
  triggerCrash,
  triggerStress
};
