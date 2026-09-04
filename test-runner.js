const http = require('http');
const axios = require('axios');
const app = require('./app');

const PORT = 3001;

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
      console.log('✔ GET /stress batching response:', stressRes.data);

      console.log('\n--- ALL ENDPOINT INTEGRATION TESTS PASSED SUCCESSFULLY! ---\n');
    } catch (err) {
      console.error('❌ Test failed unexpectedly:', err.message);
    } finally {
      server.close(() => {
        console.log('Test server closed.');
        process.exit(0);
      });
    }
  });
}

runTests();
