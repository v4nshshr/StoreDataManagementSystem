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
 * @access  Public / Permissive for Demo
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

    // Fallback when MongoDB is offline (e.g. Render cloud preview)
    if (mongoose.connection.readyState !== 1 && snapshot) {
      let filtered = snapshot.products || [];

      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(p => (p.name && p.name.toLowerCase().includes(s)) || (p.productId && p.productId.toLowerCase().includes(s)));
      }

      if (category) {
        filtered = filtered.filter(p => p.category === category);
      }

      if (subCategory) {
        filtered = filtered.filter(p => p.subCategory && p.subCategory.toLowerCase() === subCategory.toLowerCase());
      }

      const total = filtered.length;
      const skip = (pageNum - 1) * limitNum;
      const paginated = filtered.slice(skip, skip + limitNum);

      return res.status(200).json({
        success: true,
        count: paginated.length,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
        currentPage: pageNum,
        limit: limitNum,
        data: paginated,
        isDemoPreview: true
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
 */
const getCategories = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1 && snapshot) {
      return res.status(200).json({
        success: true,
        data: [
          { category: 'Technology', subCategories: ['Phones', 'Accessories', 'Machines', 'Copiers'] },
          { category: 'Furniture', subCategories: ['Chairs', 'Tables', 'Bookcases', 'Furnishings'] },
          { category: 'Office Supplies', subCategories: ['Paper', 'Binders', 'Storage', 'Art', 'Appliances'] }
        ]
      });
    }

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
      count: categoriesWithSubs.length,
      data: categoriesWithSubs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single product by productId
 * @route   GET /api/products/:id
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (mongoose.connection.readyState !== 1 && snapshot) {
      const prod = (snapshot.products || []).find(p => p.productId === id || p._id === id);
      if (prod) return res.status(200).json({ success: true, data: prod });
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { productId: id }] }
      : { productId: id };

    const product = await Product.findOne(query);

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
 * @desc    Create a new product (insertOne)
 * @route   POST /api/products
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

    // In memory fallback for cloud demo if DB is offline
    if (mongoose.connection.readyState !== 1) {
      const newProd = {
        _id: 'prod_' + Date.now(),
        productId: productId.trim(),
        name: name.trim(),
        category,
        subCategory: subCategory.trim()
      };
      if (snapshot && snapshot.products) {
        snapshot.products.unshift(newProd);
      }
      return res.status(201).json({
        success: true,
        message: 'Product created successfully (Demo Mode)',
        data: newProd
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
 * @desc    Update a product (updateOne with $set)
 * @route   PUT /api/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, subCategory } = req.body;

    if (mongoose.connection.readyState !== 1) {
      if (snapshot && snapshot.products) {
        const prod = snapshot.products.find(p => p.productId === id || p._id === id);
        if (prod) {
          if (name) prod.name = name.trim();
          if (category) prod.category = category;
          if (subCategory) prod.subCategory = subCategory.trim();
          return res.status(200).json({ success: true, message: 'Product updated (Demo Mode)', data: prod });
        }
      }
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

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
 * @desc    Delete a product (deleteOne)
 * @route   DELETE /api/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (mongoose.connection.readyState !== 1) {
      if (snapshot && snapshot.products) {
        snapshot.products = snapshot.products.filter(p => p.productId !== id && p._id !== id);
      }
      return res.status(200).json({
        success: true,
        message: `Product '${id}' deleted successfully (Demo Mode)`
      });
    }

    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { productId: id }] }
      : { productId: id };

    const product = await Product.findOne(query);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    await Product.deleteOne({ _id: product._id });

    res.status(200).json({
      success: true,
      message: `Product '${product.productId}' successfully deleted`
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
