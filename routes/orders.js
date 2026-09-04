const express = require('express');
const { createOrder } = require('../controllers/orderController');

const createOrderRouter = (sdk) => {
  const router = express.Router();

  router.post('/', createOrder(sdk));

  return router;
};

module.exports = createOrderRouter;
