const mongoose = require('mongoose');

/**
 * Customer Schema
 * 
 * Design Decision - Referencing vs. Embedding:
 * Customers exist independently of orders. In a retail system, one customer can
 * place hundreds of orders over time. Embedding all orders inside a customer
 * document would cause the document to grow unboundedly (risking MongoDB's 16MB document limit)
 * and make querying order analytics inefficient.
 * Hence, Customers are maintained in a dedicated collection and referenced by Order documents.
 */
const customerSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: [true, 'Customer ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      index: true // Indexed for rapid customer search by name
    },
    segment: {
      type: String,
      required: [true, 'Customer segment is required'],
      enum: {
        values: ['Consumer', 'Corporate', 'Home Office'],
        message: '{VALUE} is not a valid customer segment'
      },
      index: true // Indexed for segment-based filtering
    },
    address: {
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true
      },
      state: {
        type: String,
        required: [true, 'State is required'],
        trim: true
      },
      postalCode: {
        type: String,
        required: [true, 'Postal code is required'],
        trim: true,
        match: [/^\d{5}$/, 'Postal code must be exactly 5 digits']
      },
      region: {
        type: String,
        required: [true, 'Region is required'],
        enum: ['East', 'West', 'Central', 'South']
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

/**
 * Compound Index:
 * Supports geographical queries and aggregation filtering on customers by state and region.
 */
customerSchema.index({ 'address.state': 1, 'address.region': 1 });

module.exports = mongoose.model('Customer', customerSchema);
