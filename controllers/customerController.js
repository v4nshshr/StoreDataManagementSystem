const Customer = require('../models/Customer');
const Order = require('../models/Order');
const mongoose = require('mongoose');

let snapshot = null;
try {
  snapshot = require('../data/demoSnapshot.json');
} catch (e) {}

/**
 * @desc    Get all customers with pagination, sorting, search, and filtering
 * @route   GET /api/customers
 * @access  Private (admin, manager, cashier)
 */
const getCustomers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      segment,
      state,
      region,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    if (mongoose.connection.readyState !== 1 && snapshot) {
      return res.status(200).json({
        success: true,
        count: snapshot.customers.length,
        total: snapshot.kpis?.totalCustomers || snapshot.customers.length,
        totalPages: 1,
        currentPage: 1,
        limit: limitNum,
        data: snapshot.customers
      });
    }

    const skip = (pageNum - 1) * limitNum;

    // Build dynamic MongoDB query filter
    const filter = {};

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { customerId: searchRegex }];
    }

    if (segment) {
      filter.segment = segment;
    }

    if (state) {
      filter['address.state'] = new RegExp(`^${state.trim()}$`, 'i');
    }

    if (region) {
      filter['address.region'] = region;
    }

    // Determine sort field and direction
    const sort = {};
    sort[sortBy] = sortOrder.toLowerCase() === 'desc' ? -1 : 1;

    // Execute query with pagination & count
    const [customers, total] = await Promise.all([
      Customer.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
      Customer.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      count: customers.length,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      currentPage: pageNum,
      limit: limitNum,
      data: customers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single customer by Customer ID
 * @route   GET /api/customers/:id
 * @access  Private (admin, manager, cashier)
 */
const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Search by custom customerId (e.g. 'CG-12520') or MongoDB _id
    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { customerId: id }] }
      : { customerId: id };

    const customer = await Customer.findOne(query).lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID '${id}' not found`
      });
    }

    // Attach order summary for this customer
    const orderCount = await Order.countDocuments({ customerId: customer.customerId });

    res.status(200).json({
      success: true,
      data: {
        ...customer,
        totalOrdersPlaced: orderCount
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all orders placed by a customer
 * @route   GET /api/customers/:id/orders
 * @access  Private (admin, manager, cashier)
 */
const getCustomerOrders = async (req, res, next) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findOne({ customerId: id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID '${id}' not found`
      });
    }

    const orders = await Order.find({ customerId: id }).sort({ orderDate: -1 }).lean();

    res.status(200).json({
      success: true,
      customerId: id,
      customerName: customer.name,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new customer
 * @route   POST /api/customers
 * @access  Private (admin, manager)
 */
const createCustomer = async (req, res, next) => {
  try {
    const { customerId, name, segment, address } = req.body;

    if (!customerId || !name || !segment || !address) {
      return res.status(400).json({
        success: false,
        message: 'Missing required customer fields: customerId, name, segment, and address are required'
      });
    }

    const existing = await Customer.findOne({ customerId: customerId.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Customer with ID '${customerId}' already exists`
      });
    }

    // Zero-pad postal code if necessary
    const cleanedPostalCode = String(address.postalCode || '').padStart(5, '0').slice(0, 5);

    const newCustomer = await Customer.create({
      customerId: customerId.trim(),
      name: name.trim(),
      segment,
      address: {
        city: address.city?.trim(),
        state: address.state?.trim(),
        postalCode: cleanedPostalCode,
        region: address.region
      }
    });

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: newCustomer
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update customer details
 * @route   PUT /api/customers/:id
 * @access  Private (admin, manager)
 */
const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, segment, address } = req.body;

    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { customerId: id }] }
      : { customerId: id };

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (segment) updateData.segment = segment;
    if (address) {
      if (address.city) updateData['address.city'] = address.city.trim();
      if (address.state) updateData['address.state'] = address.state.trim();
      if (address.postalCode) {
        updateData['address.postalCode'] = String(address.postalCode).padStart(5, '0').slice(0, 5);
      }
      if (address.region) updateData['address.region'] = address.region;
    }

    const updatedCustomer = await Customer.findOneAndUpdate(query, { $set: updateData }, {
      new: true,
      runValidators: true
    });

    if (!updatedCustomer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID '${id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a customer
 * @route   DELETE /api/customers/:id
 * @access  Private (admin only)
 */
const deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findOne({ customerId: id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID '${id}' not found`
      });
    }

    // Referential integrity check: Check if customer has associated orders
    const orderCount = await Order.countDocuments({ customerId: id });
    if (orderCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete customer '${id}': ${orderCount} associated order(s) exist. Maintain referential integrity.`
      });
    }

    await Customer.deleteOne({ customerId: id });

    res.status(200).json({
      success: true,
      message: `Customer '${id}' successfully deleted`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  getCustomerOrders,
  createCustomer,
  updateCustomer,
  deleteCustomer
};
