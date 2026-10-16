const mongoose = require('mongoose');

/**
 * Product Schema
 * 
 * Design Decision - Referencing vs. Embedding:
 * Products are catalog entities with shared metadata across thousands of orders.
 * Storing products in a dedicated collection allows centralized price updates,
 * category restructuring, and inventory tracking without updating millions of historical lines.
 * However, product snapshots (ID, name, sale price at purchase time) are embedded in Orders
 * to preserve immutable historical transaction records.
 */
const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: [true, 'Product ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      index: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['Furniture', 'Office Supplies', 'Technology'],
        message: '{VALUE} is not a valid category'
      }
    },
    subCategory: {
      type: String,
      required: [true, 'Sub-Category is required'],
      trim: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

/**
 * Compound Index:
 * Category and Sub-Category are frequently queried together when navigating product catalogs
 * or aggregating sales metrics by hierarchical categories.
 */
productSchema.index({ category: 1, subCategory: 1 });

module.exports = mongoose.model('Product', productSchema);
