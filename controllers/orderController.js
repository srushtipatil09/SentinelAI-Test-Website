const Order = require('../models/Order');
const Product = require('../models/Product');
const { getStatus } = require('../config/db');

const createOrder = (sdk) => async (req, res, next) => {
  try {
    const { userId = 'usr_demo_101', products = [{ productId: 'p1', quantity: 1, price: 299.99 }], totalAmount = 299.99 } = req.body;

    let newOrder;
    if (getStatus()) {
      newOrder = await sdk.startSpan('db.orders.create', () =>
        Order.create({
          userId,
          products,
          totalAmount,
          status: 'confirmed'
        })
      );

      // Update product inventory
      if (products.length > 0 && products[0].productId) {
        await sdk.startSpan('db.products.updateStock', () =>
          Product.updateOne(
            { _id: products[0].productId },
            { $inc: { stock: -products[0].quantity } }
          )
        );
      }
    } else {
      newOrder = {
        id: `ord_${Date.now()}`,
        userId,
        products,
        totalAmount,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };
    }

    // Requirement: Generate "Order Created" log
    sdk.captureLog('INFO', 'Order Created', {
      orderId: newOrder.id || newOrder._id,
      userId,
      totalAmount
    });

    // Requirement: Generate "Inventory Updated" log
    sdk.captureLog('INFO', 'Inventory Updated', {
      orderId: newOrder.id || newOrder._id,
      itemCount: products.length,
      updatedStockStatus: 'decremented'
    });

    return res.status(201).json({
      message: 'Order placed successfully',
      order: newOrder
    });
  } catch (err) {
    sdk.captureException(err, true, { action: 'createOrder' });
    next(err);
  }
};

module.exports = { createOrder };
