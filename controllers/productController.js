const Product = require('../models/Product');
const { getStatus } = require('../config/db');

const initialProducts = [
  { id: 'p1', name: 'Sentinel Enterprise Monitor', price: 299.99, category: 'Software', stock: 50 },
  { id: 'p2', name: 'Cloud Telemetry Collector', price: 99.99, category: 'Hardware', stock: 120 },
  { id: 'p3', name: 'AI Incident Detector Appliance', price: 499.00, category: 'AI', stock: 15 }
];

const getProducts = (sdk) => async (req, res, next) => {
  try {
    let products = [];
    if (getStatus()) {
      products = await sdk.startSpan('db.products.find', () => Product.find());
      if (products.length === 0) {
        await Product.insertMany(initialProducts);
        products = await Product.find();
      }
    } else {
      products = initialProducts;
    }

    // Requirement: Generate "Product Viewed" log
    sdk.captureLog('INFO', 'Product Viewed', {
      action: 'view_all',
      itemCount: products.length
    });

    return res.status(200).json({
      status: 'success',
      products
    });
  } catch (err) {
    sdk.captureException(err, true, { action: 'getProducts' });
    next(err);
  }
};

const getProductById = (sdk) => async (req, res, next) => {
  try {
    const { id } = req.params;
    let product;

    if (getStatus()) {
      product = await sdk.startSpan('db.products.findById', () => Product.findById(id));
    } else {
      product = initialProducts.find((p) => p.id === id) || initialProducts[0];
    }

    if (!product) {
      sdk.captureLog('WARN', 'Product Not Found', { productId: id });
      return res.status(404).json({ error: 'Product not found' });
    }

    // Requirement: Generate "Product Viewed" log
    sdk.captureLog('INFO', 'Product Viewed', {
      productId: id,
      productName: product.name,
      price: product.price
    });

    return res.status(200).json({
      status: 'success',
      product
    });
  } catch (err) {
    sdk.captureException(err, true, { action: 'getProductById', productId: req.params.id });
    next(err);
  }
};

module.exports = { getProducts, getProductById };
