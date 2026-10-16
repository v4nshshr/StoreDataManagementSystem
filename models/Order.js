const mongoose = require('mongoose');

/**
 * Order Item Sub-schema (Embedded)
 * 
 * Design Decision - Why Embed Items Inside Orders?
 * 1. Atomicity: In a retail system, an order and its constituent line items represent a single atomic business transaction.
 *    Embedding guarantees that the entire order is written or read in one single I/O operation.
 * 2. Immutable Historical Snapshot: Products in the catalog may change names or prices in the future,
 *    but historical orders must reflect the exact sales, quantities, and discounts agreed upon at the time of purchase.
 * 3. Bounded Cardinality: A typical retail order has 1 to 20 items (in Superstore data, the max is ~14 items per order).
 *    Because the array is small and bounded, embedding will never hit the 16MB document limit.
 */
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: [true, 'Product ID is required'],
      ref: 'Product'
    },
    productName: {
      type: String,
      required: [true, 'Product name is required']
    },
    sales: {
      type: Number,
      required: [true, 'Item sales amount is required'],
      min: [0, 'Sales amount cannot be negative']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    discount: {
      type: Number,
      required: [true, 'Discount is required'],
      min: [0, 'Discount cannot be less than 0'],
      max: [1, 'Discount cannot exceed 1 (100%)']
    },
    profit: {
      type: Number,
      required: [true, 'Profit is required']
    }
  },
  { _id: false }
);

/**
 * Order Totals Sub-schema (Precomputed Totals)
 * 
 * Design Decision - Precomputing Totals:
 * Storing precalculated totals (sum of sales, profit, quantity) avoids running an
 * expensive $reduce or $unwind computation every time an order list is fetched in the UI.
 */
const orderTotalsSchema = new mongoose.Schema(
  {
    sales: {
      type: Number,
      required: true,
      default: 0
    },
    profit: {
      type: Number,
      required: true,
      default: 0
    },
    quantity: {
      type: Number,
      required: true,
      default: 0
    }
  },
  { _id: false }
);

/**
 * Main Order Schema
 */
const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    customerId: {
      type: String,
      required: [true, 'Customer ID is required'],
      ref: 'Customer'
    },
    orderDate: {
      type: Date,
      required: [true, 'Order date is required'],
      index: true // Essential for time-series analytics, monthly/yearly sales pipelines, and sorting
    },
    shipDate: {
      type: Date,
      required: [true, 'Ship date is required']
    },
    shipMode: {
      type: String,
      required: [true, 'Ship mode is required'],
      enum: {
        values: ['Standard Class', 'Second Class', 'First Class', 'Same Day'],
        message: '{VALUE} is not a valid shipping mode'
      }
    },
    shippingStatus: {
      type: String,
      enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Shipped'
    },
    shippingAddress: {
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: {
        type: String,
        required: true,
        match: [/^\d{5}$/, 'Postal code must be 5 digits']
      },
      region: {
        type: String,
        required: true,
        enum: ['East', 'West', 'Central', 'South']
      }
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: 'An order must contain at least one item'
      }
    },
    totals: {
      type: orderTotalsSchema,
      required: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

/**
 * INDEX DEFINITIONS & RATIONALE:
 * 
 * 1. { orderDate: -1 }:
 *    Orders are overwhelmingly queried by recency (e.g. recent orders dashboard).
 *    Also powers yearly and monthly date-range filtering in aggregation pipelines.
 * 
 * 2. { customerId: 1 }:
 *    Enables instant lookup of all orders belonging to a specific customer without scanning the entire collection.
 * 
 * 3. { 'items.productId': 1 }:
 *    MULTICKEY INDEX: Allows rapid search for which orders contain a specific product.
 *    Crucial for product recall, inventory movement, and product-specific sales volume aggregation.
 * 
 * 4. { 'shippingAddress.state': 1, 'shippingAddress.region': 1 }:
 *    COMPOUND INDEX: Accelerates geographical aggregation pipelines and state/region order filtering.
 */
orderSchema.index({ orderDate: -1 });
orderSchema.index({ customerId: 1 });
orderSchema.index({ 'items.productId': 1 });
orderSchema.index({ 'shippingAddress.state': 1, 'shippingAddress.region': 1 });

module.exports = mongoose.model('Order', orderSchema);
