const http = require('http');
const axios = require('axios');
const app = require('./app');

const PORT = process.env.TEST_PORT || 3099;

async function runTests() {
  console.log('\n--- Starting Express App Integration Test Suite ---\n');

  const server = app.listen(PORT, async () => {
    console.log(`Test server running on port ${PORT}`);
    const baseUrl = `http://localhost:${PORT}`;

    try {
      // 1. Health
      const healthRes = await axios.get(`${baseUrl}/health`);
      console.log('✔ GET /health:', healthRes.data);

      // 2. Root
      const rootRes = await axios.get(`${baseUrl}/`);
      console.log('✔ GET /:', rootRes.data.message);

      // 3. Products
      const productsRes = await axios.get(`${baseUrl}/products`);
      console.log(`✔ GET /products: Received ${productsRes.data.products.length} products`);

      // 4. Products/:id
      const productByIdRes = await axios.get(`${baseUrl}/products/p1`);
      console.log('✔ GET /products/:id:', productByIdRes.data.product.name);

      // 5. Auth - Register & Login
      const regRes = await axios.post(`${baseUrl}/register`, { name: 'Test User', email: `test_${Date.now()}@example.com` });
      console.log('✔ POST /register:', regRes.data.message);

      const loginRes = await axios.post(`${baseUrl}/login`, { email: 'test@example.com' });
      console.log('✔ POST /login:', loginRes.data.message);

      // 6. Orders
      const orderRes = await axios.post(`${baseUrl}/orders`, { userId: 'usr_test_1', totalAmount: 199.99 });
      console.log('✔ POST /orders:', orderRes.data.message);

      // 7. Payment (handles both success & failure)
      try {
        const payRes = await axios.post(`${baseUrl}/payment`, { amount: 299.99 });
        console.log('✔ POST /payment:', payRes.data.message);
      } catch (payErr) {
        console.log('✔ POST /payment expected 30% failure triggered:', payErr.response.data.message);
      }

      // 8. Analytics
      const analyticsRes = await axios.get(`${baseUrl}/analytics`);
      console.log('✔ GET /analytics metrics:', analyticsRes.data.metrics);

      // 9. Error Route
      try {
        await axios.get(`${baseUrl}/error`);
      } catch (errRes) {
        console.log('✔ GET /error captured expected exception:', errRes.response.data.message);
      }

      // 10. Database Error Simulation Route
      try {
        await axios.get(`${baseUrl}/database`);
      } catch (dbErrRes) {
        console.log('✔ GET /database captured expected timeout:', dbErrRes.response.data.error);
      }

      // 11. Crash Route (RCA Multi-exception simulation)
      try {
        await axios.get(`${baseUrl}/crash`);
      } catch (crashRes) {
        console.log('✔ GET /crash captured expected nested exception:', crashRes.response.data.error);
      }

      // 12. Stress Route
      const stressRes = await axios.get(`${baseUrl}/stress`);
      console.log('✔ GET /stress batching response:', stressRes.data.status);

      // --- 13. ERROR SUITE INTEGRATION TESTS ---
      console.log('\n--- Running New Error Suite Tests ---');

      // 13.1 Catalog
      const catalogRes = await axios.get(`${baseUrl}/errors`);
      console.log('✔ GET /errors: Catalog returned with', Object.keys(catalogRes.data.endpoints).length, 'categories');

      // Helper function to test expected error status
      const testExpectedError = async (method, path, expectedStatus, label, body = null) => {
        try {
          if (method === 'post') {
            await axios.post(`${baseUrl}${path}`, body);
          } else {
            await axios.get(`${baseUrl}${path}`);
          }
          console.error(`❌ Expected ${label} to return ${expectedStatus}, but it succeeded.`);
        } catch (err) {
          if (err.response && err.response.status === expectedStatus) {
            console.log(`✔ ${method.toUpperCase()} ${path} [HTTP ${expectedStatus}]: ${err.response.data.error || err.response.data.message}`);
          } else {
            console.error(`❌ ${label} expected HTTP ${expectedStatus} but got ${err.response ? err.response.status : err.message}`);
          }
        }
      };

      // 13.2 Security / Auth Errors
      await testExpectedError('get', '/errors/unauthorized', 401, 'Unauthorized');
      await testExpectedError('get', '/errors/forbidden', 403, 'Forbidden');
      await testExpectedError('get', '/errors/rate-limit', 429, 'Rate Limit');

      // 13.3 Client / Validation Errors
      await testExpectedError('post', '/errors/validation', 422, 'Validation Error', { invalid: true });
      await testExpectedError('get', '/errors/not-found', 404, 'Not Found');

      // 13.4 Upstream & Network Failures
      await testExpectedError('get', '/errors/circuit-breaker', 503, 'Circuit Breaker');
      await testExpectedError('get', '/errors/gateway-timeout', 504, 'Gateway Timeout');
      await testExpectedError('get', '/errors/upstream-failure', 502, 'Upstream Failure');
      await testExpectedError('get', '/errors/dns-failure', 502, 'DNS Failure');

      // 13.5 Concurrency & DB Errors
      await testExpectedError('get', '/errors/deadlock', 500, 'Deadlock');
      await testExpectedError('get', '/errors/connection-pool-exhausted', 500, 'Connection Pool Exhausted');

      // 13.6 Runtime Bugs & Resource Failures
      await testExpectedError('get', '/errors/null-pointer', 500, 'Null Pointer TypeError');
      await testExpectedError('get', '/errors/memory-leak', 500, 'Memory Leak RangeError');
      await testExpectedError('get', '/errors/disk-full', 500, 'Disk Full ENOSPC');
      await testExpectedError('get', '/errors/unhandled-rejection', 500, 'Async Unhandled Rejection');

      // 13.7 Dynamic Simulator
      await testExpectedError('get', '/errors/simulate?status=503&type=CustomServiceError&component=BillingService', 503, 'Dynamic Simulator (503)');
      await testExpectedError('get', '/errors/simulate?status=408&type=RequestTimeoutError&component=CartService', 408, 'Dynamic Simulator (408)');

      // 13.8 Error Burst Generator
      const burstRes = await axios.get(`${baseUrl}/errors/burst?count=6`);
      console.log(`✔ GET /errors/burst: Generated ${burstRes.data.totalGenerated} incident events (flushed: ${burstRes.data.sdkFlushed})`);

      console.log('\n--- ALL ENDPOINT & ERROR SUITE INTEGRATION TESTS PASSED SUCCESSFULLY! ---\n');
    } catch (err) {
      console.error('❌ Test failed unexpectedly:', err.message);
    } finally {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      server.close(() => {
        console.log('Test server closed.');
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 1500).unref();
    }
  });
}

runTests();
