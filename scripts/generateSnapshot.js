const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/retail_store_db';

async function generate() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to local MongoDB to generate demo snapshot...');

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

  const metrics = orderMetrics[0] || {};
  const kpis = {
    totalSales: Math.round((metrics.totalSales || 0) * 100) / 100,
    totalProfit: Math.round((metrics.totalProfit || 0) * 100) / 100,
    totalOrders: metrics.totalOrders || 0,
    totalQuantity: metrics.totalQuantity || 0,
    totalCustomers: customerCount,
    totalProducts: productCount
  };

  const salesByYearMonth = await Order.aggregate([
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

  const categoryPerformance = await Order.aggregate([
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.productId',
        foreignField: 'productId',
        as: 'productDetails'
      }
    },
    { $unwind: '$productDetails' },
    {
      $group: {
        _id: {
          category: '$productDetails.category',
          subCategory: '$productDetails.subCategory'
        },
        totalSales: { $sum: '$items.sales' },
        totalProfit: { $sum: '$items.profit' },
        totalQuantity: { $sum: '$items.quantity' },
        orderLinesCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.category',
        categorySales: { $sum: '$totalSales' },
        categoryProfit: { $sum: '$totalProfit' },
        subCategories: {
          $push: {
            subCategory: '$_id.subCategory',
            sales: { $round: ['$totalSales', 2] },
            profit: { $round: ['$totalProfit', 2] },
            quantity: '$totalQuantity'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        categorySales: { $round: ['$categorySales', 2] },
        categoryProfit: { $round: ['$categoryProfit', 2] },
        subCategories: 1
      }
    },
    { $sort: { categorySales: -1 } }
  ]);

  const topCustomers = await Order.aggregate([
    {
      $group: {
        _id: '$customerId',
        totalSpent: { $sum: '$totals.sales' },
        totalProfitGenerated: { $sum: '$totals.profit' },
        totalOrders: { $sum: 1 }
      }
    },
    { $sort: { totalSpent: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'customers',
        localField: '_id',
        foreignField: 'customerId',
        as: 'customerDetails'
      }
    },
    { $unwind: '$customerDetails' },
    {
      $project: {
        _id: 0,
        customerId: '$_id',
        name: '$customerDetails.name',
        segment: '$customerDetails.segment',
        city: '$customerDetails.address.city',
        state: '$customerDetails.address.state',
        totalSpent: { $round: ['$totalSpent', 2] },
        totalProfitGenerated: { $round: ['$totalProfitGenerated', 2] },
        totalOrders: 1
      }
    }
  ]);

  const topProducts = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$items.productName' },
        totalProfit: { $sum: '$items.profit' },
        totalSales: { $sum: '$items.sales' },
        totalQuantity: { $sum: '$items.quantity' }
      }
    },
    { $sort: { totalProfit: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        name: 1,
        totalProfit: { $round: ['$totalProfit', 2] },
        totalSales: { $round: ['$totalSales', 2] },
        totalQuantity: 1
      }
    }
  ]);

  const bottomProducts = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$items.productName' },
        totalProfit: { $sum: '$items.profit' },
        totalSales: { $sum: '$items.sales' },
        totalQuantity: { $sum: '$items.quantity' }
      }
    },
    { $sort: { totalProfit: 1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        name: 1,
        totalProfit: { $round: ['$totalProfit', 2] },
        totalSales: { $round: ['$totalSales', 2] },
        totalQuantity: 1
      }
    }
  ]);

  const profitByGeography = await Order.aggregate([
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
        states: {
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
        states: 1
      }
    },
    { $sort: { regionProfit: -1 } }
  ]);

  const discountImpact = await Order.aggregate([
    { $unwind: '$items' },
    {
      $bucket: {
        groupBy: '$items.discount',
        boundaries: [0, 0.1, 0.2, 0.3, 0.5, 0.9],
        default: 'Other',
        output: {
          totalSales: { $sum: '$items.sales' },
          totalProfit: { $sum: '$items.profit' },
          orderLines: { $sum: 1 },
          lossMakingLines: {
            $sum: { $cond: [{ $lt: ['$items.profit', 0] }, 1, 0] }
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        discountTier: {
          $switch: {
            branches: [
              { case: { $eq: ['$_id', 0] }, then: '0% - 10%' },
              { case: { $eq: ['$_id', 0.1] }, then: '10% - 20%' },
              { case: { $eq: ['$_id', 0.2] }, then: '20% - 30%' },
              { case: { $eq: ['$_id', 0.3] }, then: '30% - 50%' },
              { case: { $eq: ['$_id', 0.5] }, then: '50% - 80%' }
            ],
            default: '80%+'
          }
        },
        totalSales: { $round: ['$totalSales', 2] },
        totalProfit: { $round: ['$totalProfit', 2] },
        orderLines: 1,
        lossMakingLines: 1,
        lossPercentage: {
          $round: [
            {
              $multiply: [
                { $divide: ['$lossMakingLines', '$orderLines'] },
                100
              ]
            },
            1
          ]
        }
      }
    }
  ]);

  const shippingTime = await Order.aggregate([
    {
      $project: {
        shipMode: 1,
        shippingDays: {
          $divide: [
            { $subtract: ['$shipDate', '$orderDate'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    },
    {
      $group: {
        _id: '$shipMode',
        avgDays: { $avg: '$shippingDays' },
        minDays: { $min: '$shippingDays' },
        maxDays: { $max: '$shippingDays' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        shipMode: '$_id',
        avgDays: { $round: ['$avgDays', 1] },
        minDays: 1,
        maxDays: 1,
        orderCount: 1
      }
    },
    { $sort: { avgDays: 1 } }
  ]);

  const salesBySegment = await Order.aggregate([
    {
      $lookup: {
        from: 'customers',
        localField: 'customerId',
        foreignField: 'customerId',
        as: 'customerDetails'
      }
    },
    { $unwind: '$customerDetails' },
    {
      $group: {
        _id: '$customerDetails.segment',
        totalSales: { $sum: '$totals.sales' },
        totalProfit: { $sum: '$totals.profit' },
        totalOrders: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        segment: '$_id',
        totalSales: { $round: ['$totalSales', 2] },
        totalProfit: { $round: ['$totalProfit', 2] },
        totalOrders: 1,
        profitMargin: {
          $round: [
            {
              $multiply: [
                { $divide: ['$totalProfit', '$totalSales'] },
                100
              ]
            },
            2
          ]
        }
      }
    },
    { $sort: { totalSales: -1 } }
  ]);

  const customers = await Customer.find().limit(25).lean();
  const products = await Product.find().limit(25).lean();
  const orders = await Order.find().limit(25).lean();

  const inventory = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        productName: { $first: '$items.productName' },
        totalSalesVolume: { $sum: '$items.sales' },
        totalQuantitySold: { $sum: '$items.quantity' },
        totalProfit: { $sum: '$items.profit' },
        orderOccurrences: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: 'productId',
        as: 'catalogInfo'
      }
    },
    {
      $unwind: {
        path: '$catalogInfo',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        productName: 1,
        category: '$catalogInfo.category',
        subCategory: '$catalogInfo.subCategory',
        totalSalesVolume: { $round: ['$totalSalesVolume', 2] },
        totalQuantitySold: 1,
        totalProfit: { $round: ['$totalProfit', 2] },
        orderOccurrences: 1
      }
    },
    { $sort: { totalQuantitySold: -1 } },
    { $limit: 25 }
  ]);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    kpis,
    salesByYearMonth,
    categoryPerformance,
    topCustomers,
    productsByProfit: { top: topProducts, bottom: bottomProducts },
    profitByGeography,
    discountImpact,
    shippingTime,
    salesBySegment,
    inventory,
    customers,
    products,
    orders
  };

  fs.writeFileSync(
    path.join(__dirname, '../data/demoSnapshot.json'),
    JSON.stringify(snapshot, null, 2)
  );

  console.log('Snapshot successfully written to data/demoSnapshot.json!');
  await mongoose.disconnect();
}

generate().catch(console.error);
