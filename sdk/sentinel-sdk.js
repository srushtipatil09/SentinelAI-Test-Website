const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class SentinelClient {
  /**
   * Initialize Sentinel SDK Client
   * @param {Object} config
   * @param {string} config.apiKey - Sentinel SDK Project API Key
   * @param {string} config.serviceName - Microservice identifier
   * @param {string} [config.endpointUrl] - Ingestion backend URL
   * @param {string} [config.environment] - Deployment environment
   * @param {number} [config.maxBatchSize] - Max items before auto-flush
   * @param {number} [config.flushIntervalMs] - Auto-flush interval in ms
   */
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.SENTINEL_API_KEY || process.env.OBSERVEAI_API_KEY || '';
    this.serviceName = config.serviceName || 'sentinel-demo-service';
    this.endpointUrl = config.endpointUrl || process.env.SENTINEL_ENDPOINT || process.env.OBSERVEAI_ENDPOINT || 'http://127.0.0.1:8000/api/v1/sdk/ingest';
    this.environment = config.environment || 'development';
    this.maxBatchSize = config.maxBatchSize || 50;
    this.flushIntervalMs = config.flushIntervalMs || 10000;

    this.buffer = {
      logs: [],
      exceptions: [],
      traces: [],
      metrics: [],
      deployments: []
    };

    this.requestMetrics = {
      totalRequests: 0,
      totalErrors: 0,
      totalDurationMs: 0,
      activeUsers: 42 // Simulated active users baseline
    };

    // Auto-flush interval
    if (this.flushIntervalMs > 0) {
      this.timer = setInterval(() => {
        this.flush().catch((err) => {
          console.error('[Sentinel SDK] Background auto-flush error:', err.message);
        });
      }, this.flushIntervalMs);

      // Don't prevent Node process exit
      if (this.timer.unref) {
        this.timer.unref();
      }
    }

    // Process shutdown listeners
    process.on('beforeExit', async () => {
      await this.flush();
    });
  }

  /**
   * Express Middleware to automatically track traces, logs, durations, and status codes for HTTP requests
   */
  expressMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const traceId = req.headers['x-trace-id'] || uuidv4();
      const spanId = uuidv4();

      req.sentinel = {
        traceId,
        spanId,
        startTime
      };
      // Backward compatibility alias
      req.observeAi = req.sentinel;

      // Set trace response header
      res.setHeader('X-Trace-ID', traceId);

      res.on('finish', () => {
        const durationMs = Date.now() - startTime;
        const statusCode = res.statusCode;
        const routePath = req.route ? req.route.path : req.path;
        const operationName = `${req.method} ${req.baseUrl || ''}${routePath}`;

        // Record metrics internal counter
        this.requestMetrics.totalRequests += 1;
        this.requestMetrics.totalDurationMs += durationMs;
        if (statusCode >= 400) {
          this.requestMetrics.totalErrors += 1;
        }

        // Trace span
        this.buffer.traces.push({
          timestamp: new Date().toISOString(),
          trace_id: traceId,
          span_id: spanId,
          parent_span_id: null,
          operation_name: operationName,
          duration_ms: Math.max(0.1, durationMs),
          status_code: statusCode,
          attributes: {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'] || 'unknown',
            query: req.query || {}
          }
        });

        // HTTP log
        const logLevel = statusCode >= 400 ? 'ERROR' : 'INFO';
        const logMessage = `HTTP ${req.method} ${req.originalUrl} - Status ${statusCode} - ${durationMs}ms`;

        this.buffer.logs.push({
          timestamp: new Date().toISOString(),
          level: logLevel,
          message: logMessage,
          logger_name: this.serviceName,
          trace_id: traceId,
          span_id: spanId,
          attributes: {
            method: req.method,
            statusCode,
            durationMs
          }
        });

        this._flushIfNeeded();
      });

      next();
    };
  }

  /**
   * Express Error Handling Middleware to capture unhandled HTTP route exceptions
   */
  expressErrorHandler() {
    return (err, req, res, next) => {
      const traceId = (req.sentinel || req.observeAi) ? (req.sentinel || req.observeAi).traceId : uuidv4();

      this.captureException(err, false, {
        path: req.originalUrl,
        method: req.method,
        traceId
      });

      this.captureLog('ERROR', `Unhandled Route Error: ${err.message}`, {
        path: req.originalUrl,
        method: req.method,
        stack: err.stack
      });

      next(err);
    };
  }

  /**
   * Mongoose Middleware Plugin to instrument DB query operations
   */
  mongooseMiddleware() {
    const self = this;
    return function (schema) {
      const queries = [
        'find',
        'findOne',
        'findOneAndUpdate',
        'updateMany',
        'deleteOne',
        'deleteMany',
        'countDocuments'
      ];

      queries.forEach((op) => {
        schema.pre(op, function () {
          this._sentinelStartTime = Date.now();
          this._sentinelSpanId = uuidv4();
        });

        schema.post(op, function (res, next) {
          const durationMs = Date.now() - (this._sentinelStartTime || Date.now());
          const modelName = this.model ? this.model.modelName : 'Collection';

          self.buffer.traces.push({
            timestamp: new Date().toISOString(),
            trace_id: uuidv4(),
            span_id: this._sentinelSpanId || uuidv4(),
            operation_name: `mongoose.${modelName}.${op}`,
            duration_ms: durationMs,
            status_code: 200,
            attributes: {
              model: modelName,
              operation: op,
              filter: JSON.stringify(this.getFilter ? this.getFilter() : {})
            }
          });

          self.captureLog('INFO', `Database queryExecuted: ${modelName}.${op}`, {
            durationMs,
            model: modelName
          });

          if (typeof next === 'function') next();
        });
      });

      schema.pre('save', function (next) {
        this._sentinelSaveStart = Date.now();
        if (typeof next === 'function') next();
      });

      schema.post('save', function (doc, next) {
        const durationMs = Date.now() - (this._sentinelSaveStart || Date.now());
        const modelName = this.constructor ? this.constructor.modelName : 'Document';

        self.buffer.traces.push({
          timestamp: new Date().toISOString(),
          trace_id: uuidv4(),
          span_id: uuidv4(),
          operation_name: `mongoose.${modelName}.save`,
          duration_ms: durationMs,
          status_code: 200,
          attributes: {
            model: modelName,
            docId: doc._id ? doc._id.toString() : null
          }
        });

        self.captureLog('INFO', `Database documentSaved: ${modelName}`, {
          durationMs,
          model: modelName
        });

        if (typeof next === 'function') next();
      });
    };
  }

  /**
   * Log Capture
   */
  captureLog(level, message, attributes = {}) {
    const validLevels = ['INFO', 'ERROR', 'WARN', 'DEBUG'];
    const normLevel = validLevels.includes(String(level).toUpperCase())
      ? String(level).toUpperCase()
      : 'INFO';

    this.buffer.logs.push({
      timestamp: new Date().toISOString(),
      level: normLevel,
      message,
      logger_name: this.serviceName,
      trace_id: attributes.traceId || uuidv4(),
      span_id: attributes.spanId || uuidv4(),
      attributes
    });

    this._flushIfNeeded();
  }

  /**
   * Exception Capture with Stack Trace parsing
   */
  captureException(error, handled = false, attributes = {}) {
    const errObj = error instanceof Error ? error : new Error(String(error));
    const stack = errObj.stack || '';
    const stackLines = stack.split('\n');

    // Basic stack trace frame parsing
    let fileName = null;
    let lineNumber = null;
    let functionName = null;

    if (stackLines.length > 1) {
      const topFrame = stackLines[1].trim();
      const match = topFrame.match(/at\s+(?:([^\s(]+)\s+\()?([^:]+):(\d+):(\d+)\)?/);
      if (match) {
        functionName = match[1] || 'anonymous';
        fileName = match[2];
        lineNumber = parseInt(match[3], 10);
      }
    }

    this.buffer.exceptions.push({
      timestamp: new Date().toISOString(),
      exception_type: errObj.name || 'Error',
      message: errObj.message || 'Unknown Exception',
      stacktrace: stack,
      file_name: fileName,
      line_number: lineNumber,
      function_name: functionName,
      handled,
      trace_id: attributes.traceId || uuidv4()
    });

    this._flushIfNeeded();
  }

  /**
   * Execute child spans for operations (DB, Payment, External API)
   */
  async startSpan(operationName, fn, parentTraceId = null) {
    const traceId = parentTraceId || uuidv4();
    const spanId = uuidv4();
    const startTime = Date.now();
    let statusCode = 200;

    try {
      const result = await fn({ traceId, spanId });
      return result;
    } catch (err) {
      statusCode = 500;
      this.captureException(err, true, { traceId, spanId, operationName });
      throw err;
    } finally {
      const durationMs = Date.now() - startTime;
      this.buffer.traces.push({
        timestamp: new Date().toISOString(),
        trace_id: traceId,
        span_id: spanId,
        parent_span_id: parentTraceId,
        operation_name: operationName,
        duration_ms: Math.max(0.1, durationMs),
        status_code: statusCode,
        attributes: { operationName }
      });
      this._flushIfNeeded();
    }
  }

  /**
   * Record custom metrics
   */
  recordMetric(name, value, metricType = 'gauge', unit = '', tags = {}) {
    this.buffer.metrics.push({
      timestamp: new Date().toISOString(),
      name,
      metric_type: metricType,
      value: Number(value),
      unit,
      tags
    });

    this._flushIfNeeded();
  }

  /**
   * Check if batch size exceeded
   */
  _flushIfNeeded() {
    const totalItems =
      this.buffer.logs.length +
      this.buffer.exceptions.length +
      this.buffer.traces.length +
      this.buffer.metrics.length +
      this.buffer.deployments.length;

    if (totalItems >= this.maxBatchSize) {
      this.flush().catch((err) => {
        console.error('[Sentinel SDK] Auto-flush error:', err.message);
      });
    }
  }

  /**
   * Flush telemetry batch to Sentinel Backend endpoint
   */
  async flush() {
    const totalItems =
      this.buffer.logs.length +
      this.buffer.exceptions.length +
      this.buffer.traces.length +
      this.buffer.metrics.length +
      this.buffer.deployments.length;

    if (totalItems === 0) {
      return true;
    }

    const payload = {
      api_key: this.apiKey,
      service_name: this.serviceName,
      environment: this.environment,
      logs: [...this.buffer.logs],
      exceptions: [...this.buffer.exceptions],
      traces: [...this.buffer.traces],
      metrics: [...this.buffer.metrics],
      deployments: [...this.buffer.deployments]
    };

    // Clear buffer immediately before HTTP call to prevent duplicate sends
    this.buffer = {
      logs: [],
      exceptions: [],
      traces: [],
      metrics: [],
      deployments: []
    };

    try {
      const response = await axios.post(this.endpointUrl, payload, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      if (response.status === 202 || response.status === 200) {
        console.log(
          `\x1b[32m[Sentinel SDK]\x1b[0m Flushed ${totalItems} telemetry items successfully to ${this.endpointUrl} (Status: ${response.status})`
        );
        return true;
      } else {
        console.error(
          `\x1b[31m[Sentinel SDK]\x1b[0m Telemetry ingestion returned HTTP ${response.status}`
        );
        return false;
      }
    } catch (error) {
      const errMsg = error.response
        ? `HTTP ${error.response.status} - ${JSON.stringify(error.response.data)}`
        : error.message;

      console.error(`\x1b[31m[Sentinel SDK]\x1b[0m Flush failed: ${errMsg}`);
      return false;
    }
  }

  /**
   * Helper to get system runtime metrics summary
   */
  getSystemMetrics() {
    const mem = process.memoryUsage();
    const avgResponseTimeMs =
      this.requestMetrics.totalRequests > 0
        ? Math.round(this.requestMetrics.totalDurationMs / this.requestMetrics.totalRequests)
        : 0;
    const errorRate =
      this.requestMetrics.totalRequests > 0
        ? Number((this.requestMetrics.totalErrors / this.requestMetrics.totalRequests).toFixed(4))
        : 0;

    return {
      cpuUsagePct: Number((Math.random() * 15 + 10).toFixed(2)), // Simulated 10-25% CPU
      memoryRssMb: Number((mem.rss / (1024 * 1024)).toFixed(2)),
      memoryHeapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
      activeUsers: this.requestMetrics.activeUsers,
      totalRequests: this.requestMetrics.totalRequests,
      errorRate,
      averageResponseTimeMs: avgResponseTimeMs
    };
  }
}

module.exports = {
  SentinelClient,
  SentinelAIClient: SentinelClient,
  ObserveAIClient: SentinelClient
};
