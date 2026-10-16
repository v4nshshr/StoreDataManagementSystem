const Order = require('../models/Order');

/**
 * @desc    Inventory-style view: product sales volume, quantity sold, order count, and profit
 * @route   GET /api/inventory
 * @access  Private (admin, manager, cashier)
 */
const getInventoryView = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      sortBy = 'totalQuantitySold',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Aggregation pipeline to calculate inventory metrics across embedded items
    const pipeline = [
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
      // Join with catalog to fetch Category & Sub-Category
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
      }
    ];

    // Optional search match
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      pipeline.push({
        $match: {
          $or: [{ productName: searchRegex }, { productId: searchRegex }]
        }
      });
    }

    if (category) {
      pipeline.push({
        $match: { category }
      });
    }

    // Sort stage
    const sortStage = {};
    sortStage[sortBy] = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
    pipeline.push({ $sort: sortStage });

    // Use $facet for simultaneous pagination and total count
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: skip }, { $limit: limitNum }]
      }
    });

    const results = await Order.aggregate(pipeline);

    const metadata = results[0]?.metadata[0] || { total: 0 };
    const data = results[0]?.data || [];

    res.status(200).json({
      success: true,
      count: data.length,
      total: metadata.total,
      totalPages: Math.ceil(metadata.total / limitNum) || 1,
      currentPage: pageNum,
      limit: limitNum,
      data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInventoryView
};
