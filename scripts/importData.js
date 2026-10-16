require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/retail_store_db';
const CSV_FILE_PATH = path.join(__dirname, '..', 'data', 'compressed_data.csv');

/**
 * Helper: Parse dates in MM-DD-YYYY or M/D/YYYY into ISO Date objects
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const cleanStr = String(dateStr).trim();
  const parts = cleanStr.split(/[-\/]/);
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1; // 0-indexed month
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const dateObj = new Date(Date.UTC(year, month, day));
    if (!isNaN(dateObj.getTime())) {
      return dateObj;
    }
  }
  const fallback = new Date(cleanStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Helper: Zero-pad postal code to 5 digits
 */
function cleanPostalCode(postalCode) {
  if (!postalCode) return '00000';
  const digitsOnly = String(postalCode).trim().replace(/\D/g, '');
  return digitsOnly.padStart(5, '0').slice(0, 5);
}

/**
 * Main Ingestion Pipeline
 */
async function importDataset() {
  console.log('='.repeat(70));
  console.log('STARTING RETAIL DATASET IMPORT & CLEANING PIPELINE');
  console.log('='.repeat(70));

  const startTime = Date.now();

  try {
    // 1. Connect to Database
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to MongoDB at ${MONGO_URI}`);

    if (!fs.existsSync(CSV_FILE_PATH)) {
      throw new Error(`CSV file not found at: ${CSV_FILE_PATH}`);
    }

    console.log(`Reading and streaming CSV dataset from: ${CSV_FILE_PATH}`);

    // In-memory accumulation maps for transformation & deduplication
    const rawRows = [];
    const customerMap = new Map();
    const productFrequencyMap = new Map(); // productId -> { name -> count, category, subCategory }
    const orderMap = new Map(); // orderId -> Order Object with items array
    let rejectedRows = 0;
    let totalCsvRows = 0;

    // 2. Stream and Parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
          totalCsvRows++;

          // Basic validation for mandatory row fields
          if (!row['Order ID'] || !row['Customer ID'] || !row['Product ID']) {
            rejectedRows++;
            return;
          }
          rawRows.push(row);

          // Track Product Name Frequencies for Deduplication
          const pId = row['Product ID'].trim();
          const pName = row['Product Name'].trim();
          const category = row['Category'].trim();
          const subCategory = row['Sub-Category'].trim();

          if (!productFrequencyMap.has(pId)) {
            productFrequencyMap.set(pId, {
              names: {},
              category,
              subCategory
            });
          }
          const pData = productFrequencyMap.get(pId);
          pData.names[pName] = (pData.names[pName] || 0) + 1;
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Parsed ${totalCsvRows} rows from CSV.`);

    // 3. Resolve Product Name Deduplication
    // Architectural Decision: 32 Product IDs have multiple product names in the raw dataset.
    // We select the most frequently occurring Product Name for each Product ID as canonical.
    const canonicalProducts = new Map();
    for (const [productId, meta] of productFrequencyMap.entries()) {
      let maxCount = -1;
      let mostFrequentName = '';

      for (const [name, count] of Object.entries(meta.names)) {
        if (count > maxCount) {
          maxCount = count;
          mostFrequentName = name;
        }
      }

      canonicalProducts.set(productId, {
        productId,
        name: mostFrequentName,
        category: meta.category,
        subCategory: meta.subCategory
      });
    }

    // 4. Process Rows into Customers and Grouped Orders
    for (const row of rawRows) {
      const customerId = row['Customer ID'].trim();
      const customerName = row['Customer Name'].trim();
      const segment = row['Segment'].trim();
      const city = row['City'].trim();
      const state = row['State'].trim();
      const postalCode = cleanPostalCode(row['Postal Code']);
      const region = row['Region'].trim();

      // Collect Unique Customers (keeps latest address info)
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          name: customerName,
          segment,
          address: { city, state, postalCode, region }
        });
      }

      // Group Line Items by Order ID
      const orderId = row['Order ID'].trim();
      const orderDate = parseDate(row['Order Date']);
      const shipDate = parseDate(row['Ship Date']);
      const shipMode = row['Ship Mode'].trim();

      const productId = row['Product ID'].trim();
      const productName = canonicalProducts.get(productId)?.name || row['Product Name'].trim();
      const sales = parseFloat(row['Sales']) || 0;
      const quantity = parseInt(row['Quantity'], 10) || 1;
      const discount = parseFloat(row['Discount']) || 0;
      const profit = parseFloat(row['Profit']) || 0;

      const item = {
        productId,
        productName,
        sales: Math.round(sales * 10000) / 10000,
        quantity,
        discount: Math.round(discount * 100) / 100,
        profit: Math.round(profit * 10000) / 10000
      };

      if (!orderMap.has(orderId)) {
        orderMap.set(orderId, {
          orderId,
          customerId,
          orderDate,
          shipDate,
          shipMode,
          shippingStatus: 'Shipped',
          shippingAddress: { city, state, postalCode, region },
          items: [item],
          totals: {
            sales: item.sales,
            profit: item.profit,
            quantity: item.quantity
          }
        });
      } else {
        const order = orderMap.get(orderId);
        order.items.push(item);
        order.totals.sales = Math.round((order.totals.sales + item.sales) * 10000) / 10000;
        order.totals.profit = Math.round((order.totals.profit + item.profit) * 10000) / 10000;
        order.totals.quantity += item.quantity;
      }
    }

    // 5. Database Reset and Bulk Insertion (Ensures Idempotency)
    console.log('Resetting collections for clean idempotent load...');
    await Promise.all([
      Customer.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({})
    ]);

    console.log('Performing Bulk Inserts into MongoDB...');

    const customerDocs = Array.from(customerMap.values());
    const productDocs = Array.from(canonicalProducts.values());
    const orderDocs = Array.from(orderMap.values());

    // Bulk insert customers
    const insertedCustomers = await Customer.insertMany(customerDocs, { ordered: false });
    // Bulk insert products
    const insertedProducts = await Product.insertMany(productDocs, { ordered: false });
    // Bulk insert orders in chunks of 1000 to manage memory & network buffers
    const CHUNK_SIZE = 1000;
    let insertedOrderCount = 0;
    for (let i = 0; i < orderDocs.length; i += CHUNK_SIZE) {
      const chunk = orderDocs.slice(i, i + CHUNK_SIZE);
      const res = await Order.insertMany(chunk, { ordered: false });
      insertedOrderCount += res.length;
    }

    // 6. Seed Default Users for Authentication (admin, manager, cashier)
    console.log('Ensuring default RBAC users exist...');
    const defaultUsers = [
      { username: 'admin', password: 'AdminPassword123!', role: 'admin' },
      { username: 'manager', password: 'ManagerPassword123!', role: 'manager' },
      { username: 'cashier', password: 'CashierPassword123!', role: 'cashier' }
    ];

    for (const u of defaultUsers) {
      const existingUser = await User.findOne({ username: u.username });
      if (!existingUser) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(u.password, salt);
        await User.create({
          username: u.username,
          passwordHash,
          role: u.role
        });
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 7. Print Summary Report
    console.log('='.repeat(70));
    console.log('DATA IMPORT & CLEANING SUMMARY REPORT');
    console.log('='.repeat(70));
    console.log(`Total CSV Rows Read:           ${totalCsvRows}`);
    console.log(`Rejected Rows:                 ${rejectedRows}`);
    console.log(`Customers Inserted:            ${insertedCustomers.length} (Expected: 793)`);
    console.log(`Products Inserted:             ${insertedProducts.length} (Expected: 1862)`);
    console.log(`Orders Inserted (Grouped):     ${insertedOrderCount} (Expected: 5009)`);
    console.log(`Time Taken:                    ${duration} seconds`);
    console.log('Default Seed Users Available:');
    console.log('  1. admin   / AdminPassword123!   (Role: admin)');
    console.log('  2. manager / ManagerPassword123! (Role: manager)');
    console.log('  3. cashier / CashierPassword123! (Role: cashier)');
    console.log('='.repeat(70));
    console.log('Data import completed successfully!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Data import failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  importDataset();
}

module.exports = importDataset;
