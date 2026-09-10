/**
 * Error Controller - Failure Scenarios & Incident Generators
 * Designed specifically for Sentinel SDK telemetry capture and AI Root Cause Analysis (RCA)
 */

// 1. GET /errors/unauthorized (HTTP 401)
const triggerUnauthorized = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;
  const expiredTimestamp = new Date(Date.now() - 3600 * 1000).toISOString();

  sdk.captureLog('ERROR', 'JWT Authentication Failed - Token Expired', {
    component: 'AuthService',
    reason: 'TokenExpiredError',
    expiredAt: expiredTimestamp,
    authScheme: 'Bearer',
    path: req.originalUrl,
    traceId
  });

  const authError = new Error(`jwt expired at ${expiredTimestamp}`);
  authError.name = 'TokenExpiredError';
  authError.status = 401;

  sdk.captureException(authError, true, {
    component: 'AuthService',
    severity: 'MEDIUM',
    category: 'Security',
    traceId
  });

  res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token", error_description="The access token expired"');
  return res.status(401).json({
    error: 'Unauthorized',
    statusCode: 401,
    message: 'Authentication token has expired. Please refresh your session.',
    tokenExpiredAt: expiredTimestamp,
    traceId
  });
};

// 2. GET /errors/forbidden (HTTP 403)
const triggerForbidden = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;
  const attemptedRole = 'customer';
  const requiredRole = 'system:admin';

  sdk.captureLog('WARN', 'Access Forbidden - Insufficient RBAC Permissions', {
    component: 'AuthorizationEngine',
    userRole: attemptedRole,
    requiredRole,
    resource: '/api/v1/system/settings',
    traceId
  });

  const forbiddenErr = new Error(`AccessDeniedError: User with role '${attemptedRole}' lacks '${requiredRole}' permission`);
  forbiddenErr.name = 'AccessDeniedError';
  forbiddenErr.status = 403;

  sdk.captureException(forbiddenErr, true, {
    component: 'AuthorizationEngine',
    severity: 'MEDIUM',
    category: 'Security',
    traceId
  });

  return res.status(403).json({
    error: 'Forbidden',
    statusCode: 403,
    message: `Access denied. Requires '${requiredRole}' role privilege.`,
    userRole: attemptedRole,
    traceId
  });
};

// 3. GET /errors/rate-limit (HTTP 429)
const triggerRateLimit = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;
  const clientIp = req.ip || '198.51.100.24';
  const limit = 100;
  const retryAfterSeconds = 60;

  // Record rate limit metric
  sdk.recordMetric('rate_limit_breaches_total', 1, 'counter', 'breaches', { endpoint: '/errors/rate-limit' });

  sdk.captureLog('WARN', 'Rate Limit Quota Exceeded', {
    component: 'RateLimiterMiddleware',
    clientIp,
    allowedRequestsPerMinute: limit,
    exceededBy: 34,
    retryAfterSeconds,
    traceId
  });

  const rateLimitErr = new Error(`RateLimitExceededException: Client IP ${clientIp} exceeded rate limit of ${limit} req/min`);
  rateLimitErr.name = 'RateLimitExceededException';
  rateLimitErr.status = 429;

  sdk.captureException(rateLimitErr, true, {
    component: 'RateLimiter',
    severity: 'LOW',
    clientIp,
    traceId
  });

  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', '0');

  return res.status(429).json({
    error: 'Too Many Requests',
    statusCode: 429,
    message: `Too many requests from this client. Rate limit of ${limit} req/min exceeded.`,
    retryAfterSeconds,
    traceId
  });
};

// 4. POST /errors/validation (HTTP 422)
const triggerValidation = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;

  const validationIssues = [
    { field: 'order.items[0].quantity', error: 'Quantity must be a positive integer greater than 0', received: -2 },
    { field: 'order.paymentMethod.cvv', error: 'CVV security code must be 3 or 4 digits', received: 'XX' },
    { field: 'order.billingAddress.postalCode', error: 'Postal code format is invalid for country US', received: 'INVALID_ZIP' }
  ];

  sdk.captureLog('ERROR', 'Payload Schema Validation Failed', {
    component: 'RequestValidator',
    invalidFieldsCount: validationIssues.length,
    issues: validationIssues,
    traceId
  });

  const valError = new Error('ValidationError: Request body failed structural validation schema checks');
  valError.name = 'ValidationError';
  valError.status = 422;

  sdk.captureException(valError, true, {
    component: 'RequestValidator',
    severity: 'LOW',
    validationIssues,
    traceId
  });

  return res.status(422).json({
    error: 'Unprocessable Entity',
    statusCode: 422,
    message: 'Validation failed for the supplied payload.',
    validationErrors: validationIssues,
    traceId
  });
};

// 5. GET /errors/not-found (HTTP 404)
const triggerNotFound = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;
  const missingEntityId = req.query.id || 'order_unknown_99999';

  sdk.captureLog('WARN', 'Requested Resource Not Found', {
    component: 'EntityResolver',
    entityType: 'Order',
    entityId: missingEntityId,
    traceId
  });

  const notFoundErr = new Error(`ResourceNotFoundException: Order with ID '${missingEntityId}' could not be resolved`);
  notFoundErr.name = 'ResourceNotFoundException';
  notFoundErr.status = 404;

  sdk.captureException(notFoundErr, true, {
    component: 'EntityResolver',
    entityId: missingEntityId,
    traceId
  });

  return res.status(404).json({
    error: 'Not Found',
    statusCode: 404,
    message: `Resource '${missingEntityId}' was not found in the database.`,
    entityId: missingEntityId,
    traceId
  });
};

// 6. GET /errors/circuit-breaker (HTTP 503)
const triggerCircuitBreaker = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;
  const downstreamService = 'InventoryService';

  sdk.captureLog('ERROR', `Circuit Breaker Tripped - [${downstreamService}] is OPEN`, {
    component: 'CircuitBreakerRegistry',
    targetService: downstreamService,
    state: 'OPEN',
    failureThresholdPct: 65,
    consecutiveFailures: 14,
    fallbackAction: 'FAST_FAIL',
    traceId
  });

  const cbError = new Error(`CircuitBreakerOpenException: Downstream service [${downstreamService}] circuit is OPEN. Requests failing fast.`);
  cbError.name = 'CircuitBreakerOpenException';
  cbError.status = 503;

  sdk.captureException(cbError, false, {
    component: 'CircuitBreaker',
    downstreamService,
    severity: 'HIGH',
    state: 'OPEN',
    traceId
  });

  return res.status(503).json({
    error: 'Service Unavailable',
    statusCode: 503,
    circuitBreaker: {
      service: downstreamService,
      state: 'OPEN',
      reason: 'Consecutive downstream dependency timeouts exceeded threshold'
    },
    message: `Downstream service '${downstreamService}' is temporarily unavailable (Circuit Breaker OPEN).`,
    traceId
  });
};

// 7. GET /errors/gateway-timeout (HTTP 504)
const triggerGatewayTimeout = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;
  const partnerApi = 'https://api.logistics-partner.external/v2/calculate-shipping';

  try {
    await sdk.startSpan('external.logistics.shipping_estimate', async () => {
      // Simulate timeout span delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      const timeoutError = new Error(`GatewayTimeoutError: Upstream shipping partner API '${partnerApi}' failed to respond within 5000ms`);
      timeoutError.name = 'GatewayTimeoutError';
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }, traceId);
  } catch (err) {
    sdk.captureLog('ERROR', 'Upstream Gateway Timeout Occurred', {
      component: 'LogisticsClient',
      upstreamUrl: partnerApi,
      timeoutMs: 5000,
      traceId
    });

    sdk.captureException(err, false, {
      component: 'LogisticsClient',
      severity: 'HIGH',
      upstreamUrl: partnerApi,
      traceId
    });

    return res.status(504).json({
      error: 'Gateway Timeout',
      statusCode: 504,
      message: `The upstream partner service '${partnerApi}' did not send a response in time.`,
      upstreamUrl: partnerApi,
      timeoutMs: 5000,
      traceId
    });
  }
};

// 8. GET /errors/upstream-failure (HTTP 502)
const triggerUpstreamFailure = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;
  const targetHost = 'internal-auth-rpc.corp.internal:9092';

  try {
    await sdk.startSpan('rpc.internal_auth.validate_ticket', async () => {
      const connErr = new Error(`BadGatewayError: ECONNREFUSED connect to upstream RPC daemon at ${targetHost}`);
      connErr.name = 'BadGatewayError';
      connErr.code = 'ECONNREFUSED';
      throw connErr;
    }, traceId);
  } catch (err) {
    sdk.captureLog('ERROR', `Upstream Service Unreachable: ${targetHost}`, {
      component: 'RpcClient',
      targetHost,
      code: 'ECONNREFUSED',
      traceId
    });

    sdk.captureException(err, false, {
      component: 'RpcClient',
      targetHost,
      severity: 'HIGH',
      traceId
    });

    return res.status(502).json({
      error: 'Bad Gateway',
      statusCode: 502,
      message: `Received invalid response or connection refused from upstream microservice: ${targetHost}`,
      targetHost,
      errorCode: 'ECONNREFUSED',
      traceId
    });
  }
};

// 9. GET /errors/dns-failure (HTTP 502)
const triggerDnsFailure = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;
  const hostname = 'idp.internal.vpc.aws.corp';

  sdk.captureLog('ERROR', `DNS Resolution Failure: ${hostname}`, {
    component: 'NetworkResolver',
    hostname,
    dnsServers: ['10.0.0.2', '8.8.8.8'],
    errorCode: 'ENOTFOUND',
    traceId
  });

  const dnsErr = new Error(`FetchError: request to https://${hostname}/oauth/token failed, reason: getaddrinfo ENOTFOUND ${hostname}`);
  dnsErr.name = 'DnsResolutionError';
  dnsErr.code = 'ENOTFOUND';

  sdk.captureException(dnsErr, false, {
    component: 'NetworkResolver',
    hostname,
    severity: 'HIGH',
    traceId
  });

  return res.status(502).json({
    error: 'Bad Gateway (DNS Failure)',
    statusCode: 502,
    message: `DNS lookup failed for upstream host '${hostname}' (ENOTFOUND).`,
    hostname,
    code: 'ENOTFOUND',
    traceId
  });
};

// 10. GET /errors/deadlock (HTTP 500)
const triggerDeadlock = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;

  try {
    await sdk.startSpan('database.transaction.acquire_lock', async () => {
      const deadlockErr = new Error(
        'DeadlockDetectedError: Transaction (Process ID 1042) was deadlocked on lock resources with another process (Process ID 1043) and has been chosen as the deadlock victim.'
      );
      deadlockErr.name = 'DeadlockDetectedError';
      deadlockErr.code = 'DEADLOCK_VICTIM';
      throw deadlockErr;
    }, traceId);
  } catch (err) {
    sdk.captureLog('ERROR', 'Database Concurrency Deadlock Detected', {
      component: 'DatabaseEngine',
      victimProcessId: 1042,
      conflictingProcessId: 1043,
      lockType: 'ExclusiveLock (X)',
      table: 'orders_inventory_balance',
      traceId
    });

    sdk.captureException(err, false, {
      component: 'DatabaseEngine',
      severity: 'CRITICAL',
      rcaTarget: true,
      traceId
    });

    return res.status(500).json({
      error: 'Deadlock Detected',
      statusCode: 500,
      message: 'Transaction failed due to concurrent resource lock contention (Deadlock Victim).',
      details: {
        victimProcessId: 1042,
        resource: 'orders_inventory_balance'
      },
      traceId
    });
  }
};

// 11. GET /errors/connection-pool-exhausted (HTTP 500)
const triggerConnectionPoolExhausted = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;

  sdk.captureLog('ERROR', 'Database Connection Pool Exhausted', {
    component: 'MongoPoolManager',
    maxPoolSize: 20,
    activeConnections: 20,
    waitingQueueSize: 85,
    acquireTimeoutMs: 5000,
    traceId
  });

  const poolErr = new Error('ConnectionPoolExhaustedError: Timed out after 5000ms waiting for available database connection (maxPoolSize=20 reached)');
  poolErr.name = 'ConnectionPoolExhaustedError';

  sdk.captureException(poolErr, false, {
    component: 'MongoPoolManager',
    severity: 'CRITICAL',
    poolStats: { max: 20, active: 20, waiting: 85 },
    traceId
  });

  return res.status(500).json({
    error: 'Connection Pool Exhausted',
    statusCode: 500,
    message: 'Unable to acquire database connection: pool capacity exhausted.',
    poolStats: { maxPoolSize: 20, activeConnections: 20, waitingRequests: 85 },
    traceId
  });
};

// 12. GET /errors/null-pointer (HTTP 500)
const triggerNullPointer = (sdk) => (req, res, next) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;

  sdk.captureLog('ERROR', 'Runtime TypeError - Null Pointer Dereference', {
    component: 'OrderBillingService',
    attemptedProperty: 'billingAddress.postalCode',
    traceId
  });

  // Deliberate runtime unhandled exception
  const order = null;
  try {
    const zip = order.customer.billingAddress.postalCode;
    return res.send(zip);
  } catch (err) {
    sdk.captureException(err, false, {
      component: 'OrderBillingService',
      severity: 'HIGH',
      bugType: 'NullPointer',
      traceId
    });

    return res.status(500).json({
      error: 'TypeError (Null Reference)',
      statusCode: 500,
      message: err.message,
      stack: err.stack,
      traceId
    });
  }
};

// 13. GET /errors/memory-leak (HTTP 500)
const triggerMemoryLeak = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;
  const simulatedHeapMb = 1840.45;

  // Record an emergency memory spike metric
  sdk.recordMetric('memory_heap_used_mb', simulatedHeapMb, 'gauge', 'MB', { alert: 'heap_critical' });
  sdk.recordMetric('memory_heap_limit_mb', 2048, 'gauge', 'MB');

  sdk.captureLog('ERROR', 'Process Memory Heap Near Limit - OOM Risk', {
    component: 'NodeRuntime',
    heapUsedMb: simulatedHeapMb,
    heapTotalMb: 2048,
    memoryUsagePercentage: 89.8,
    traceId
  });

  const oomErr = new Error('RangeError: Array buffer allocation failed (simulated Node.js JavaScript heap out of memory)');
  oomErr.name = 'RangeError';

  sdk.captureException(oomErr, false, {
    component: 'NodeRuntime',
    severity: 'CRITICAL',
    heapUsedMb: simulatedHeapMb,
    rcaTarget: true,
    traceId
  });

  return res.status(500).json({
    error: 'Memory Pressure / Allocation Failure',
    statusCode: 500,
    message: oomErr.message,
    memoryStats: {
      heapUsedMb: simulatedHeapMb,
      heapLimitMb: 2048,
      percentage: '89.8%'
    },
    traceId
  });
};

// 14. GET /errors/disk-full (HTTP 500)
const triggerDiskFull = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;
  const targetPath = '/var/data/telemetry_storage/spool.wal';

  sdk.captureLog('ERROR', 'Storage Write Failed - ENOSPC Disk Full', {
    component: 'DiskStorageDriver',
    path: targetPath,
    availableBytes: 0,
    requestedBytes: 1048576,
    errorCode: 'ENOSPC',
    traceId
  });

  const diskErr = new Error(`ENOSPC: no space left on device, write '${targetPath}'`);
  diskErr.name = 'SystemError';
  diskErr.code = 'ENOSPC';

  sdk.captureException(diskErr, false, {
    component: 'DiskStorageDriver',
    path: targetPath,
    severity: 'CRITICAL',
    traceId
  });

  return res.status(500).json({
    error: 'Disk Space Exhausted',
    statusCode: 500,
    message: diskErr.message,
    errorCode: 'ENOSPC',
    path: targetPath,
    traceId
  });
};

// 15. GET /errors/unhandled-rejection (HTTP 500)
const triggerUnhandledRejection = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;

  // Simulate an async background task failure
  const bgError = new Error('UnhandledPromiseRejection: Background worker [sync_stripe_webhooks] failed with ECONNRESET');
  bgError.name = 'UnhandledPromiseRejection';

  sdk.captureLog('ERROR', 'Unhandled Asynchronous Rejection in Worker Task', {
    component: 'BackgroundWorkerPool',
    taskName: 'sync_stripe_webhooks',
    workerId: 'worker_04',
    traceId
  });

  sdk.captureException(bgError, false, {
    component: 'BackgroundWorkerPool',
    severity: 'HIGH',
    task: 'sync_stripe_webhooks',
    traceId
  });

  return res.status(500).json({
    error: 'Unhandled Asynchronous Rejection',
    statusCode: 500,
    message: bgError.message,
    task: 'sync_stripe_webhooks',
    traceId
  });
};

// 16. ANY /errors/simulate (Parameterized dynamic simulator)
// Query params: status (default 500), type, message, component, delay
const triggerDynamicSimulation = (sdk) => async (req, res) => {
  const traceId = req.sentinel ? req.sentinel.traceId : null;

  const statusCode = parseInt(req.query.status || (req.body && req.body.status), 10) || 500;
  const errorType = req.query.type || (req.body && req.body.type) || 'SimulatedCustomError';
  const errorMessage = req.query.message || (req.body && req.body.message) || `Custom simulated failure (${statusCode})`;
  const component = req.query.component || (req.body && req.body.component) || 'DynamicTestHarness';
  const delayMs = parseInt(req.query.delay || (req.body && req.body.delay), 10) || 0;

  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 10000)));
  }

  const simError = new Error(errorMessage);
  simError.name = errorType;
  simError.status = statusCode;

  const logLevel = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';

  sdk.captureLog(logLevel, `Dynamic Error Injected: ${errorType}`, {
    component,
    statusCode,
    message: errorMessage,
    injectedVia: 'dynamic_simulator',
    delayMs,
    traceId
  });

  if (statusCode >= 400) {
    sdk.captureException(simError, statusCode < 500, {
      component,
      severity: statusCode >= 500 ? 'HIGH' : 'MEDIUM',
      injectedVia: 'dynamic_simulator',
      traceId
    });
  }

  return res.status(statusCode).json({
    error: errorType,
    statusCode,
    message: errorMessage,
    component,
    simulated: true,
    delayMs,
    traceId
  });
};

// 17. GET /errors/burst (Multi-error rapid burst generator for Anomaly/Incident Detectors)
const triggerErrorBurst = (sdk) => async (req, res) => {
  const count = Math.min(Math.max(parseInt(req.query.count, 10) || 12, 5), 50);
  const traceId = req.sentinel ? req.sentinel.traceId : null;

  sdk.captureLog('WARN', `Generating rapid burst of ${count} diverse failure events for Incident Detector`, {
    burstCount: count,
    traceId
  });

  const errorCatalog = [
    { name: 'DatabaseTimeoutException', component: 'MongoDB', status: 504, msg: 'Query timed out after 3000ms' },
    { name: 'PaymentGatewayDeclined', component: 'PaymentService', status: 502, msg: 'Upstream gateway returned HTTP 502' },
    { name: 'TokenExpiredError', component: 'AuthService', status: 401, msg: 'JWT signature verification expired' },
    { name: 'CircuitBreakerOpen', component: 'InventoryService', status: 503, msg: 'Fast failing requests to InventoryService' },
    { name: 'DeadlockDetectedError', component: 'DatabaseEngine', status: 500, msg: 'Transaction victim in concurrency race' },
    { name: 'RateLimitExceeded', component: 'RateLimiter', status: 429, msg: 'API quota exhausted' }
  ];

  const generatedErrors = [];

  for (let i = 0; i < count; i++) {
    const template = errorCatalog[i % errorCatalog.length];
    const generatedErr = new Error(`[Burst Event #${i + 1}] ${template.msg}`);
    generatedErr.name = template.name;

    sdk.captureException(generatedErr, template.status < 500, {
      burstIndex: i + 1,
      component: template.component,
      statusCode: template.status,
      severity: template.status >= 500 ? 'HIGH' : 'MEDIUM',
      traceId
    });

    sdk.captureLog(template.status >= 500 ? 'ERROR' : 'WARN', `Burst Failure #${i + 1}: ${template.name}`, {
      iteration: i + 1,
      component: template.component,
      statusCode: template.status
    });

    generatedErrors.push({
      iteration: i + 1,
      type: template.name,
      component: template.component,
      statusCode: template.status
    });
  }

  // Force SDK buffer flush so the backend immediately receives the incident burst
  const flushed = await sdk.flush();

  return res.status(200).json({
    status: 'burst_completed',
    message: `Generated ${count} simulated error events to trigger Incident Detection alert thresholds.`,
    totalGenerated: count,
    sdkFlushed: flushed,
    sampleEvents: generatedErrors
  });
};

// 18. GET /errors (Directory / Catalog of all error endpoints)
const getErrorCatalog = (sdk) => (req, res) => {
  return res.status(200).json({
    service: 'Sentinel Telemetry Failure Injection Suite',
    description: 'Comprehensive error endpoints designed for Sentinel AI Root Cause Analysis, Incident Detection, and LangGraph pipelines',
    endpoints: {
      auth_security: {
        unauthorized: { method: 'GET', path: '/errors/unauthorized', status: 401, type: 'TokenExpiredError' },
        forbidden: { method: 'GET', path: '/errors/forbidden', status: 403, type: 'AccessDeniedError' },
        rate_limit: { method: 'GET', path: '/errors/rate-limit', status: 429, type: 'RateLimitExceededException' }
      },
      client_validation: {
        validation: { method: 'POST', path: '/errors/validation', status: 422, type: 'ValidationError' },
        not_found: { method: 'GET', path: '/errors/not-found', status: 404, type: 'ResourceNotFoundException' }
      },
      upstream_dependencies: {
        circuit_breaker: { method: 'GET', path: '/errors/circuit-breaker', status: 503, type: 'CircuitBreakerOpenException' },
        gateway_timeout: { method: 'GET', path: '/errors/gateway-timeout', status: 504, type: 'GatewayTimeoutError' },
        upstream_failure: { method: 'GET', path: '/errors/upstream-failure', status: 502, type: 'BadGatewayError' },
        dns_failure: { method: 'GET', path: '/errors/dns-failure', status: 502, type: 'DnsResolutionError' }
      },
      database_concurrency: {
        deadlock: { method: 'GET', path: '/errors/deadlock', status: 500, type: 'DeadlockDetectedError' },
        pool_exhausted: { method: 'GET', path: '/errors/connection-pool-exhausted', status: 500, type: 'ConnectionPoolExhaustedError' },
        timeout: { method: 'GET', path: '/database', status: 500, type: 'MongooseServerSelectionError' }
      },
      runtime_resources: {
        null_pointer: { method: 'GET', path: '/errors/null-pointer', status: 500, type: 'TypeError' },
        memory_leak: { method: 'GET', path: '/errors/memory-leak', status: 500, type: 'RangeError' },
        disk_full: { method: 'GET', path: '/errors/disk-full', status: 500, type: 'ENOSPC' },
        unhandled_rejection: { method: 'GET', path: '/errors/unhandled-rejection', status: 500, type: 'UnhandledPromiseRejection' },
        nested_crash_chain: { method: 'GET', path: '/crash', status: 500, type: 'OrderProcessingServiceError (Multi-level Cause)' }
      },
      testing_tools: {
        dynamic_simulator: {
          method: 'ALL',
          path: '/errors/simulate',
          params: ['status', 'type', 'message', 'component', 'delay'],
          example: '/errors/simulate?status=503&type=CustomServiceError&component=Billing'
        },
        incident_burst: {
          method: 'GET',
          path: '/errors/burst',
          params: ['count'],
          example: '/errors/burst?count=15'
        }
      }
    }
  });
};

module.exports = {
  triggerUnauthorized,
  triggerForbidden,
  triggerRateLimit,
  triggerValidation,
  triggerNotFound,
  triggerCircuitBreaker,
  triggerGatewayTimeout,
  triggerUpstreamFailure,
  triggerDnsFailure,
  triggerDeadlock,
  triggerConnectionPoolExhausted,
  triggerNullPointer,
  triggerMemoryLeak,
  triggerDiskFull,
  triggerUnhandledRejection,
  triggerDynamicSimulation,
  triggerErrorBurst,
  getErrorCatalog
};
