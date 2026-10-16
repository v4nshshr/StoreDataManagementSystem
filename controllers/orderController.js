const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');

/**
 * @desc    Get all orders with pagination, date filtering, and status filtering
 * @route   GET /api/orders
 * @access  Private (admin, manager, cashier)
 */
const getOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      customerId,
      orderId,
      shippingStatus,
      shipMode,
      startDate,
      endDate,
      sortBy = 'orderDate',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (orderId) {
      filter.orderId = new RegExp(orderId.trim(), 'i');
    }

    if (customerId) {
      filter.customerId = customerId.trim();
    }

    if (shippingStatus) {
      filter.shippingStatus = shippingStatus;
    }

    if (shipMode) {
      filter.shipMode = shipMode;
    }

    // Time-series date range filter
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) {
        filter.orderDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.orderDate.$lte = end;
      }
    }

    const sort = {};
    sort[sortBy] = sortOrder.toLowerCase() === 'asc' ? 1 : -1;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
      Order.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      currentPage: pageNum,
      limit: limitNum,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single order by Order ID with customer demographic population
 * @route   GET /api/orders/:id
 * @access  Private (admin, manager, cashier)
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { orderId: id }] }
      : { orderId: id };

    const order = await Order.findOne(query).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order with ID '${id}' not found`
      });
    }

    // Fetch customer details via referenced customerId
    const customer = await Customer.findOne({ customerId: order.customerId }).lean();

    res.status(200).json({
      success: true,
      data: {
        ...order,
        customerDetails: customer || null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new order with embedded line items and precalculated totals
 * @route   POST /api/orders
 * @access  Private (admin, manager, cashier)
 */
const createOrder = async (req, res, next) => {
  try {
    const {
      orderId,
      customerId,
      orderDate,
      shipDate,
      shipMode,
      shippingAddress,
      items
    } = req.body;

    // Validation
    if (!customerId || !orderDate || !shipDate || !shipMode || !shippingAddress || !items) {
      return res.status(400).json({
        success: false,
        message: 'Missing required order fields: customerId, orderDate, shipDate, shipMode, shippingAddress, items'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'An order must contain at least one item'
      });
    }

    // Verify Customer exists
    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID '${customerId}' does not exist`
      });
    }

    // Generate custom Order ID if not provided (e.g. CA-2026-XXXXXX)
    const currentYear = new Date(orderDate).getFullYear() || new Date().getFullYear();
    const finalOrderId = orderId?.trim() || `CA-${currentYear}-${Math.floor(100000 + Math.random() * 900000)}`;

    const existingOrder = await Order.findOne({ orderId: finalOrderId });
    if (existingOrder) {
      return res.status(409).json({
        success: false,
        message: `Order with ID '${finalOrderId}' already exists`
      });
    }

    // Compute order totals and sanitize item calculations
    let totalSales = 0;
    let totalProfit = 0;
    let totalQuantity = 0;

    const sanitizedItems = items.map((item) => {
      const sales = Math.round((parseFloat(item.sales) || 0) * 10000) / 10000;
      const quantity = parseInt(item.quantity, 10) || 1;
      const discount = Math.round((parseFloat(item.discount) || 0) * 100) / 100;
      const profit = Math.round((parseFloat(item.profit) || 0) * 10000) / 10000;

      totalSales += sales;
      totalProfit += profit;
      totalQuantity += quantity;

      return {
        productId: item.productId?.trim(),
        productName: item.productName?.trim(),
        sales,
        quantity,
        discount,
        profit
      };
    });

    const newOrder = await Order.create({
      orderId: finalOrderId,
      customerId,
      orderDate: new Date(orderDate),
      shipDate: new Date(shipDate),
      shipMode,
      shippingStatus: 'Processing',
      shippingAddress: {
        city: shippingAddress.city?.trim() || customer.address.city,
        state: shippingAddress.state?.trim() || customer.address.state,
        postalCode: String(shippingAddress.postalCode || customer.address.postalCode).padStart(5, '0').slice(0, 5),
        region: shippingAddress.region || customer.address.region
      },
      items: sanitizedItems,
      totals: {
        sales: Math.round(totalSales * 10000) / 10000,
        profit: Math.round(totalProfit * 10000) / 10000,
        quantity: totalQuantity
      }
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: newOrder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update order shipping status
 * @route   PATCH /api/orders/:id/status
 * @access  Private (admin, manager, cashier)
 */
const updateShippingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { shippingStatus, shipDate } = req.body;

    const validStatuses = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!shippingStatus || !validStatuses.includes(shippingStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid shipping status. Allowed values: [${validStatuses.join(', ')}]`
      });
    }

    const updateFields = { shippingStatus };
    if (shipDate) {
      updateFields.shipDate = new Date(shipDate);
    }

    const order = await Order.findOneAndUpdate(
      { orderId: id },
      { $set: updateFields },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order with ID '${id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      message: `Order '${id}' shipping status updated to '${shippingStatus}'`,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an order
 * @route   DELETE /api/orders/:id
 * @access  Private (admin only)
 */
const deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({ orderId: id });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order with ID '${id}' not found`
      });
    }

    await Order.deleteOne({ orderId: id });

    res.status(200).json({
      success: true,
      message: `Order '${id}' successfully deleted`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateShippingStatus,
  deleteOrder
};
