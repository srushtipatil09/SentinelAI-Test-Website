const express = require('express');
const { getProducts, getProductById } = require('../controllers/productController');

const createProductRouter = (sdk) => {
  const router = express.Router();

  router.get('/', getProducts(sdk));
  router.get('/:id', getProductById(sdk));

  return router;
};

module.exports = createProductRouter;
