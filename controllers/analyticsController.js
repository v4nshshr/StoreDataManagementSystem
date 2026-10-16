const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');

let snapshot = null;
try {
  snapshot = require('../data/demoSnapshot.json');
} catch (e) {}

const isDbOffline = () => mongoose.connection.readyState !== 1;

/**
 * @desc    KPI Summary Cards (Total Revenue, Profit, Order Count, Customer Count)
 * @route   GET /api/analytics/kpis
 */
const getKpis = async (req, res, next) => {
  if (isDbOffline() && snapshot) {
    return res.status(200).json({ success: true, data: snapshot.kpis, isDemoPreview: true });
  }

  try {
    const [orderMetrics, customerCount, productCount] = await Promise.all([
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$totals.sales' },
            totalProfit: { $sum: '$totals.profit' },
            totalQuantity: { $sum: '$totals.quantity' },
            totalOrders: { $sum: 1 }
          }
        }
      ]),
      Customer.countDocuments(),
      Product.countDocuments()
    ]);

    const metrics = orderMetrics[0] || {
      totalSales: 0,
      totalProfit: 0,
      totalQuantity: 0,
      totalOrders: 0
    };

    res.status(200).json({
      success: true,
      data: {
        totalSales: Math.round(metrics.totalSales * 100) / 100,
        totalProfit: Math.round(metrics.totalProfit * 100) / 100,
        totalOrders: metrics.totalOrders,
        totalQuantity: metrics.totalQuantity,
        totalCustomers: customerCount,
        totalProducts: productCount
      }
    });
  } catch (error) {
    if (snapshot) {
      return res.status(200).json({ success: true, data: snapshot.kpis, isDemoPreview: true });
    }
    next(error);
  }
};

/**
 * Pipeline 1: Total Sales and Profit by Year and Month
 * @route GET /api/analytics/sales-by-year-month
 */
const getSalesByYearMonth = async (req, res, next) => {
  if (isDbOffline() && snapshot) {
    return res.status(200).json({ success: true, count: snapshot.salesByYearMonth.length, data: snapshot.salesByYearMonth, isDemoPreview: true });
  }

  try {
    const data = await Order.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$orderDate' },
            month: { $month: '$orderDate' }
          },
          totalSales: { $sum: '$totals.sales' },
          totalProfit: { $sum: '$totals.profit' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          period: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: [
                  { $lt: ['$_id.month', 10] },
                  { $concat: ['0', { $toString: '$_id.month' }] },
                  { $toString: '$_id.month' }
                ]
              }
            ]
          },
          totalSales: { $round: ['$totalSales', 2] },
          totalProfit: { $round: ['$totalProfit', 2] },
          orderCount: 1
        }
      },
      { $sort: { year: 1, month: 1 } }
    ]);

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    if (snapshot) {
      return res.status(200).json({ success: true, count: snapshot.salesByYearMonth.length, data: snapshot.salesByYearMonth, isDemoPreview: true });
    }
    next(error);
  }
};

/**
 * Pipeline 2: Sales and Profit by Category and Sub-Category
 * @route GET /api/analytics/category-performance
 */
const getCategoryPerformance = async (req, res, next) => {
  if (isDbOffline() && snapshot) {
    return res.status(200).json({ success: true, count: snapshot.categoryPerformance.length, data: snapshot.categoryPerformance, isDemoPreview: true });
  }

  try {
    const data = await Order.aggregate([
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: 'productId',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: {
            category: '$product.category',
            subCategory: '$product.subCategory'
          },
          totalSales: { $sum: '$items.sales' },
          totalProfit: { $sum: '$items.profit' },
          totalQuantity: { $sum: '$items.quantity' }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id.category',
          subCategory: '$_id.subCategory',
          totalSales: { $round: ['$totalSales', 2] },
          totalProfit: { $round: ['$totalProfit', 2] },
          totalQuantity: 1,
          profitMargin: {
            $cond: [
              { $eq: ['$totalSales', 0] },
              0,
              { $round: [{ $multiply: [{ $divide: ['$totalProfit', '$totalSales'] }, 100] }, 2] }
            ]
          }
        }
      },
      { $sort: { category: 1, totalSales: -1 } }
    ]);

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    if (snapshot) {
      return res.status(200).json({ success: true, count: snapshot.categoryPerformance.length, data: snapshot.categoryPerformance, isDemoPreview: true });
    }
    next(error);
  }
};

/**
 * Pipeline 3: Top 10 Customers by Sales
 * @route GET /api/analytics/top-customers
 */
const getTopCustomers = async (req, res, next) => {
  if (isDbOffline() && snapshot) {
    return res.status(200).json({ success: true, count: snapshot.topCustomers.length, data: snapshot.topCustomers, isDemoPreview: true });
  }

  try {
    const limit = parseInt(req.query.limit, 10) || 10;

    const data = await Order.aggregate([
      {
        $group: {
          _id: '$customerId',
          totalSales: { $sum: '$totals.sales' },
          totalProfit: { $sum: '$totals.profit' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: 'customerId',
          as: 'customer'
        }
      },
      { $unwind: '$customer' },
      {
        $project: {
          _id: 0,
          customerId: '$_id',
          customerName: '$customer.name',
          segment: '$customer.segment',
          state: '$customer.address.state',
          region: '$customer.address.region',
          totalSales: { $round: ['$totalSales', 2] },
          totalProfit: { $round: ['$totalProfit', 2] },
          orderCount: 1
        }
      }
    ]);

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    if (snapshot) {
      return res.status(200).json({ success: true, count: snapshot.topCustomers.length, data: snapshot.topCustomers, isDemoPreview: true });
    }
    next(error);
  }
};

/**
 * Pipeline 4: Top 10 and Bottom 10 Products by Profit
 * @route GET /api/analytics/products-by-profit
 */
const getProductsByProfit = async (req, res, next) => {
  if (isDbOffline() && snapshot) {
    return res.status(200).json({ success: true, data: snapshot.productsByProfit, isDemoPreview: true });
  }

  try {
    const limit = parseInt(req.query.limit, 10) || 10;

    const [topProducts, bottomProducts] = await Promise.all([
      // Top 10 Profitable Products
      Order.aggregate([
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            productName: { $first: '$items.productName' },
            totalProfit: { $sum: '$items.profit' },
            totalSales: { $sum: '$items.sales' },
            totalQuantity: { $sum: '$items.quantity' }
          }
        },
        { $sort: { totalProfit: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            productName: 1,
            totalProfit: { $round: ['$totalProfit', 2] },
            totalSales: { $round: ['$totalSales', 2] },
            totalQuantity: 1
          }
        }
      ]),
      // Bottom 10 Loss-Making Products
      Order.aggregate([
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            productName: { $first: '$items.productName' },
            totalProfit: { $sum: '$items.profit' },
            totalSales: { $sum: '$items.sales' },
            totalQuantity: { $sum: '$items.quantity' }
          }
        },
        { $sort: { totalProfit: 1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            productName: 1,
            totalProfit: { $round: ['$totalProfit', 2] },
            totalSales: { $round: ['$totalSales', 2] },
            totalQuantity: 1
          }
        }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        topProfitable: topProducts,
        bottomLossMaking: bottomProducts
      }
    });
  } catch (error) {
    if (snapshot) {
      return res.status(200).json({ success: true, data: snapshot.productsByProfit, isDemoPreview: true });
    }
    next(error);
  }
};

/**
 * Pipeline 5: Profit by Region and State
 * @route GET /api/analytics/profit-by-geography
 */
const getProfitByGeography = async (req, res, next) => {
  if (isDbOffline() && snapshot) {
    return res.status(200).json({ success: true, count: snapshot.profitByGeography.length, data: snapshot.profitByGeography, isDemoPreview: true });
  }

  try {
    const data = await Order.aggregate([
      {
        $group: {
          _id: {
            region: '$shippingAddress.region',
            state: '$shippingAddress.state'
          },
          totalSales: { $sum: '$totals.sales' },
          totalProfit: { $sum: '$totals.profit' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.region',
          regionSales: { $sum: '$totalSales' },
          regionProfit: { $sum: '$totalProfit' },
          stateBreakdown: {
            $push: {
              state: '$_id.state',
              sales: { $round: ['$totalSales', 2] },
              profit: { $round: ['$totalProfit', 2] },
              orders: '$orderCount'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          region: '$_id',
          regionSales: { $round: ['$regionSales', 2] },
          regionProfit: { $round: ['$regionProfit', 2] },
          stateBreakdown: {
            $sortArray: { input: '$stateBreakdown', sortBy: { profit: -1 } }
          }
        }
      },
      { $sort: { regionProfit: -1 } }
    ]);

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    if (snapshot) {
      return res.status(200).json({ success: true, count: snapshot.profitByGeography.length, data: snapshot.profitByGeography, isDemoPreview: true });
    }
    next(error);
  }
};

/**
 * Pipeline 6: Impact of Discount Level on Profit (Flag Loss-Making Orders)
 * @route GET /api/analytics/discount-impact
 */
const getDiscountImpact = async (req, res, next) => {
  if (isDbOffline() && snapshot) {
    return res.status(200).json({ success: true, count: snapshot.discountImpact.length, data: snapshot.discountImpact, isDemoPreview: true });
  }

  try {
    const data = await Order.aggregate([
      { $unwind: '$items' },
      {
        $addFields: {
          discountBracket: {
            $switch: {
              branches: [
                { case: { $eq: ['$items.discount', 0] }, then: '0% (No Discount)' },
                { case: { $lte: ['$items.discount', 0.1] }, then: '1% - 10%' },
                { case: { $lte: ['$items.discount', 0.2] }, then: '11% - 20%' },
                { case: { $lte: ['$items.discount', 0.3] }, then: '21% - 30%' },
                { case: { $lte: ['$items.discount', 0.5] }, then: '31% - 50%' }
              ],
              default: 'Over 50%'
            }
          },
          isLossMaking: {
            $cond: [{ $lt: ['$items.profit', 0] }, 1, 0]
          }
        }
      },
      {
        $group: {
          _id: '$discountBracket',
          totalSales: { $sum: '$items.sales' },
          totalProfit: { $sum: '$items.profit' },
          itemCount: { $sum: 1 },
          lossMakingCount: { $sum: '$isLossMaking' },
          avgDiscount: { $avg: '$items.discount' }
        }
      },
      {
        $project: {
          _id: 0,
          discountBracket: '$_id',
          totalSales: { $round: ['$totalSales', 2] },
          totalProfit: { $round: ['$totalProfit', 2] },
          itemCount: 1,
          lossMakingCount: 1,
          lossRatePercent: {
            $round: [{ $multiply: [{ $divide: ['$lossMakingCount', '$itemCount'] }, 100] }, 2]
          },
          avgDiscountPercent: {
            $round: [{ $multiply: ['$avgDiscount', 100] }, 1]
          }
        }
      },
      { $sort: { avgDiscountPercent: 1 } }
    ]);

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    if (snapshot) {
      return res.status(200).json({ success: true, count: snapshot.discountImpact.length, data: snapshot.discountImpact, isDemoPreview: true });
    }
    next(error);
  }
};

/**
 * Pipeline 7: Average Shipping Time by Ship Mode
 * @route GET /api/analytics/shipping-time
 */
const getShippingTimeByMode = async (req, res, next) => {
  if (isDbOffline() && snapshot) {
    return res.status(200).json({ success: true, count: snapshot.shippingTime.length, data: snapshot.shippingTime, isDemoPreview: true });
  }

  try {
    const data = await Order.aggregate([
      {
        $project: {
          shipMode: 1,
          shippingDays: {
            $divide: [
              { $subtract: ['$shipDate', '$orderDate'] },
              1000 * 60 * 60 * 24 // Milliseconds to Days
            ]
          }
        }
      },
      {
        $group: {
          _id: '$shipMode',
          avgShippingDays: { $avg: '$shippingDays' },
          minDays: { $min: '$shippingDays' },
          maxDays: { $max: '$shippingDays' },
          totalOrders: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          shipMode: '$_id',
          avgShippingDays: { $round: ['$avgShippingDays', 2] },
          minDays: 1,
          maxDays: 1,
          totalOrders: 1
        }
      },
      { $sort: { avgShippingDays: 1 } }
    ]);

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    if (snapshot) {
      return res.status(200).json({ success: true, count: snapshot.shippingTime.length, data: snapshot.shippingTime, isDemoPreview: true });
    }
    next(error);
  }
};

/**
 * Pipeline 8: Sales by Customer Segment
 * @route GET /api/analytics/sales-by-segment
 */
const getSalesBySegment = async (req, res, next) => {
  if (isDbOffline() && snapshot) {
    return res.status(200).json({ success: true, count: snapshot.salesBySegment.length, data: snapshot.salesBySegment, isDemoPreview: true });
  }

  try {
    const data = await Order.aggregate([
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: 'customerId',
          as: 'customer'
        }
      },
      { $unwind: '$customer' },
      {
        $group: {
          _id: '$customer.segment',
          totalSales: { $sum: '$totals.sales' },
          totalProfit: { $sum: '$totals.profit' },
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$totals.quantity' }
        }
      },
      {
        $project: {
          _id: 0,
          segment: '$_id',
          totalSales: { $round: ['$totalSales', 2] },
          totalProfit: { $round: ['$totalProfit', 2] },
          totalOrders: 1,
          totalQuantity: 1,
          profitMargin: {
            $round: [{ $multiply: [{ $divide: ['$totalProfit', '$totalSales'] }, 100] }, 2]
          }
        }
      },
      { $sort: { totalSales: -1 } }
    ]);

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    if (snapshot) {
      return res.status(200).json({ success: true, count: snapshot.salesBySegment.length, data: snapshot.salesBySegment, isDemoPreview: true });
    }
    next(error);
  }
};

module.exports = {
  getKpis,
  getSalesByYearMonth,
  getCategoryPerformance,
  getTopCustomers,
  getProductsByProfit,
  getProfitByGeography,
  getDiscountImpact,
  getShippingTimeByMode,
  getSalesBySegment
};
