const express = require('express');
const { processPayment } = require('../controllers/paymentController');

const createPaymentRouter = (sdk) => {
  const router = express.Router();

  router.post('/', processPayment(sdk));

  return router;
};

module.exports = createPaymentRouter;
