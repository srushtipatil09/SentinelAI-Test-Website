const express = require('express');
const {
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
} = require('../controllers/errorController');

const createErrorRouter = (sdk) => {
  const router = express.Router();

  // Directory / Catalog of all error endpoints
  router.get('/', getErrorCatalog(sdk));

  // 1. Authentication & Security
  router.get('/unauthorized', triggerUnauthorized(sdk));
  router.get('/forbidden', triggerForbidden(sdk));
  router.get('/rate-limit', triggerRateLimit(sdk));

  // 2. Client & Validation Errors
  router.post('/validation', triggerValidation(sdk));
  router.get('/validation', triggerValidation(sdk)); // Allow GET for quick browser/curl validation
  router.get('/not-found', triggerNotFound(sdk));

  // 3. Upstream & Microservice Dependencies
  router.get('/circuit-breaker', triggerCircuitBreaker(sdk));
  router.get('/gateway-timeout', triggerGatewayTimeout(sdk));
  router.get('/upstream-failure', triggerUpstreamFailure(sdk));
  router.get('/dns-failure', triggerDnsFailure(sdk));

  // 4. Database & Concurrency
  router.get('/deadlock', triggerDeadlock(sdk));
  router.get('/connection-pool-exhausted', triggerConnectionPoolExhausted(sdk));

  // 5. Runtime Bugs & System Resources
  router.get('/null-pointer', triggerNullPointer(sdk));
  router.get('/memory-leak', triggerMemoryLeak(sdk));
  router.get('/disk-full', triggerDiskFull(sdk));
  router.get('/unhandled-rejection', triggerUnhandledRejection(sdk));

  // 6. Dynamic Simulator & Incident Burst
  router.all('/simulate', triggerDynamicSimulation(sdk));
  router.get('/burst', triggerErrorBurst(sdk));

  return router;
};

module.exports = createErrorRouter;
