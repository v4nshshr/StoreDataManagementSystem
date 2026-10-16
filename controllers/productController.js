const Product = require('../models/Product');
const Order = require('../models/Order');
const mongoose = require('mongoose');

let snapshot = null;
try {
  snapshot = require('../data/demoSnapshot.json');
} catch (e) {}

/**
 * @desc    Get all products with pagination, sorting, search, and category filters
 * @route   GET /api/products
 * @access  Private (admin, manager, cashier)
 */
const getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      subCategory,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    if (mongoose.connection.readyState !== 1 && snapshot) {
      return res.status(200).json({
        success: true,
        count: snapshot.products.length,
        total: snapshot.kpis?.totalProducts || snapshot.products.length,
        totalPages: 1,
        currentPage: 1,
        limit: limitNum,
        data: snapshot.products
      });
    }

    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { productId: searchRegex }];
    }

    if (category) {
      filter.category = category;
    }

    if (subCategory) {
      filter.subCategory = new RegExp(`^${subCategory.trim()}$`, 'i');
    }

    const sort = {};
    sort[sortBy] = sortOrder.toLowerCase() === 'desc' ? -1 : 1;

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      currentPage: pageNum,
      limit: limitNum,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get distinct categories and their sub-categories
 * @route   GET /api/products/categories
 * @access  Private (admin, manager, cashier)
 */
const getCategories = async (req, res, next) => {
  try {
    const categoriesWithSubs = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          subCategories: { $addToSet: '$subCategory' }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          subCategories: { $sortArray: { input: '$subCategories', sortBy: 1 } }
        }
      },
      { $sort: { category: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: categoriesWithSubs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product by Product ID
 * @route   GET /api/products/:id
 * @access  Private (admin, manager, cashier)
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { productId: id }] }
      : { productId: id };

    const product = await Product.findOne(query).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new product
 * @route   POST /api/products
 * @access  Private (admin, manager)
 */
const createProduct = async (req, res, next) => {
  try {
    const { productId, name, category, subCategory } = req.body;

    if (!productId || !name || !category || !subCategory) {
      return res.status(400).json({
        success: false,
        message: 'Missing required product fields: productId, name, category, and subCategory are required'
      });
    }

    const existing = await Product.findOne({ productId: productId.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Product with ID '${productId}' already exists`
      });
    }

    const newProduct = await Product.create({
      productId: productId.trim(),
      name: name.trim(),
      category,
      subCategory: subCategory.trim()
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: newProduct
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a product
 * @route   PUT /api/products/:id
 * @access  Private (admin, manager)
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, subCategory } = req.body;

    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { productId: id }] }
      : { productId: id };

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (category) updateData.category = category;
    if (subCategory) updateData.subCategory = subCategory.trim();

    const updatedProduct = await Product.findOneAndUpdate(query, { $set: updateData }, {
      new: true,
      runValidators: true
    });

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a product
 * @route   DELETE /api/products/:id
 * @access  Private (admin only)
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({ productId: id });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    // Check if product is referenced in existing orders
    const ordersWithProduct = await Order.countDocuments({ 'items.productId': id });
    if (ordersWithProduct > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete product '${id}': Product is referenced in ${ordersWithProduct} existing order line items.`
      });
    }

    await Product.deleteOne({ productId: id });

    res.status(200).json({
      success: true,
      message: `Product '${id}' successfully deleted`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getCategories,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
