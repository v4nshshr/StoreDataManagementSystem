# US Retail Store Management & Analytics System

[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)
[![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)

A complete, production-grade **US Retail Store Management System** backed by **MongoDB, Node.js, Express**, and an interactive **Single-Page Dashboard with Chart.js**. 

Based on the Superstore US Retail dataset (9,994 order lines), this project models relational retail data into an optimized **NoSQL document structure** using strategic embedding, referencing, indexing, engine-level `$jsonSchema` validation, and 8 analytical aggregation pipelines.

---

## 📌 Architecture Overview

```
[ Browser Client (HTML5 / Modern CSS / Vanilla JS / Chart.js) ]
                             │
                             │ HTTP REST API (JWT Bearer Token)
                             ▼
               [ Express.js REST API Server ]
      ┌──────────────────────┼──────────────────────┐
      ▼                      ▼                      ▼
[ Auth & RBAC ]      [ CRUD Controllers ]   [ Analytics Engine ]
(JWT / bcrypt)       (Orders/Cust/Prod)     (8 Aggregation Pipelines)
      └──────────────────────┬──────────────────────┘
                             │ Mongoose ODM
                             ▼
               [ MongoDB Database Engine ]
 ├── collections: customers, products, orders, users
 ├── Engine-level validation: $jsonSchema
 └── Indexes: Multikey (items.productId), Compound (state/region, ESR rule)
```

---

## ✨ Features

1. **Dashboard Analytics (MongoDB Aggregation Pipelines):**
   - Monthly Sales & Net Profit timeline ($year & $month grouping).
   - Category and Sub-Category revenue & margin breakdown ($lookup).
   - Sales by Customer Segment (Consumer, Corporate, Home Office).
   - Profit by US Region and State (Two-tier hierarchical aggregation).
   - Discount Level impact on profitability (identifying loss-making thresholds).
   - Fulfillment transit times across shipping modes (BSON date difference).
   - Top 10 VIP Customers & Top/Bottom Products by Profit.
2. **Order Management:**
   - Multi-item order creation with live total sales, profit, and quantity calculations.
   - Status tracking (`Processing`, `Shipped`, `Delivered`, `Cancelled`).
   - Order detail modal with embedded item inspection.
3. **Customer Management:**
   - Debounced live search across name and Customer ID.
   - Demographic filters by segment and state.
   - Customer order history modal.
4. **Product Catalog & Inventory View:**
   - SKU management, category filtering, and product turnover volume metrics.
5. **Security & Role-Based Access Control (RBAC):**
   - JWT authentication with passwords hashed via `bcryptjs`.
   - 3 permission tiers: `admin` (full access), `manager` (operational access), `cashier` (POS access).
   - Quick role-switcher in the UI for live demonstration.

---

## 🗄️ Database Design (NoSQL Modeling)

| Collection | Strategy | Architectural Justification |
| :--- | :--- | :--- |
| **`orders`** | **Embedded `items`** | Atomicity for checkout, zero-join reads, and immutable transaction price snapshots. Bounded cardinality ($<20$ items/order) prevents hitting the 16MB limit. |
| **`customers`** | **Referenced (`customerId`)** | Independent lifecycle; prevents unbounded array growth from customers placing hundreds of orders over time. |
| **`products`** | **Normalized Catalog** | Central catalog for pricing and categorization updates. |
| **`users`** | **Auth & RBAC** | Username, bcrypt password hash, and assigned role (`admin`, `manager`, `cashier`). |

### Indexes
- `{ orderDate: -1 }`: Accelerated sorting and chronological aggregation.
- `{ customerId: 1, orderDate: -1 }`: Compound index satisfying the **ESR (Equality, Sort, Range)** rule.
- `{ 'items.productId': 1 }`: **Multikey Index** for scanning embedded array items.
- `{ 'shippingAddress.state': 1, 'shippingAddress.region': 1 }`: Accelerated geographical rollups.

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher)
- **MongoDB** Community Server running locally on port `27017` (or MongoDB Atlas connection string)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/<your-username>/us-retail-store-management.git
cd us-retail-store-management
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory (or copy from `.env.example`):
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/retail_store_db
JWT_SECRET=superstore_retail_jwt_secret_key_2026
JWT_EXPIRES_IN=24h
```

### 4. Initialize Database Validation & Import Data
```bash
# 1. Configure MongoDB engine-level $jsonSchema validation:
npm run init-schema

# 2. Run data cleaning, normalization, product deduplication & bulk import:
npm run import-data
```

### 5. Launch Application
```bash
npm start
```
Open your browser and navigate to:
```
http://localhost:5000
```

---

## 🔑 Default Seed Credentials

The import script automatically creates 3 demo accounts:

| Username | Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| **`admin`** | `AdminPassword123!` | `admin` | Full control: delete records, register users |
| **`manager`** | `ManagerPassword123!` | `manager` | Order management, catalog updates, analytics |
| **`cashier`** | `CashierPassword123!` | `cashier` | Point-of-Sale creation, shipping updates |

---

## 📡 REST API Endpoints

| Method | Endpoint | Access Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticate user & get JWT token |
| `GET` | `/api/auth/me` | Authenticated | Get current user profile |
| `GET` | `/api/customers` | All Roles | Paginated customer list with regex search |
| `POST` | `/api/customers` | `manager`, `admin` | Create new customer (validates 5-digit zip) |
| `GET` | `/api/customers/:id/orders` | All Roles | Get all historical orders by customer |
| `GET` | `/api/products` | All Roles | Paginated product list with category filters |
| `GET` | `/api/orders` | All Roles | Paginated order list with date range filters |
| `POST` | `/api/orders` | All Roles | Create order with embedded items & auto-totals |
| `PATCH`| `/api/orders/:id/status` | All Roles | Update shipping status |
| `DELETE`| `/api/orders/:id` | `admin` | Permanently delete order |
| `GET` | `/api/inventory` | All Roles | Product sales volume & movement analysis |
| `GET` | `/api/analytics/kpis` | All Roles | High-level summary metrics |
| `GET` | `/api/analytics/sales-by-year-month` | `manager`, `admin` | Monthly revenue and profit pipeline |
| `GET` | `/api/analytics/discount-impact` | `manager`, `admin` | Discount level loss-making pipeline |

---

## 📁 Project Directory Structure

```
├── config/
│   └── db.js                      # MongoDB connection setup with Mongoose
├── data/
│   └── compressed_data.csv        # Superstore retail dataset (9,994 rows)
├── models/
│   ├── Customer.js                # Customer Schema & indexes
│   ├── Product.js                 # Product Catalog Schema
│   ├── Order.js                   # Order Schema with embedded items & precomputed totals
│   └── User.js                    # User Schema with bcrypt & RBAC roles
├── controllers/
│   ├── authController.js          # User registration & JWT login
│   ├── customerController.js      # Customer CRUD & order history
│   ├── productController.js       # Product CRUD & category grouping
│   ├── orderController.js         # Order creation & status update
│   ├── inventoryController.js     # Sales volume & quantity metrics
│   └── analyticsController.js     # 8 MongoDB Aggregation Pipelines
├── routes/                        # Express API route modules
├── middleware/
│   ├── auth.js                    # JWT verification & RBAC authorization
│   └── errorHandler.js            # Centralized API error handling
├── scripts/
│   ├── importData.js              # Idempotent CSV parser, cleaner & bulk loader
│   └── initSchemaValidation.js    # Native $jsonSchema collection validator
├── public/                        # Single-Page UI (HTML, CSS, JS, Chart.js)
├── .env.example                   # Environment configuration template
├── .gitignore                     # Git exclusions
├── package.json                   # Dependencies & npm scripts
└── server.js                      # Main Express server bootstrap
```

---

## 📄 License
This project is open-source and available under the [ISC License](LICENSE).
