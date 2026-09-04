const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, default: 'Electronics' },
    stock: { type: Number, default: 100 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
