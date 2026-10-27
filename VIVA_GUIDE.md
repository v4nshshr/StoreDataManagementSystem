# NoSQL & MongoDB Viva Examination Guide
## US Retail Store Management System

> **Subject:** NoSQL Database Systems / Advanced Database Management  
> **Tech Stack:** MongoDB, Mongoose, Node.js, Express, Vanilla JS  
> **Dataset:** 9,994 Retail Transaction Rows (Grouped into 5,009 Atomic Orders)

---

## 1. Project Overview & Architecture

### What is this project?
A full-stack retail data management system built specifically to demonstrate **MongoDB document data modeling**, **CRUD operations**, **multikey/compound indexing**, and **multi-stage aggregation pipelines**.

### Collections in `retail_store_db`:
| Collection | Document Count | Modeling Strategy | Purpose |
| :--- | :--- | :--- | :--- |
| **`customers`** | 793 | Normalized / Referenced | Customer identity, segment, and postal address |
| **`products`** | 1,862 | Normalized / Referenced | Centralized catalog with categories and subcategories |
| **`orders`** | 5,009 | **Hybrid (Embedded + Ref)** | Transactions with embedded items & referenced customerId |

---

## 2. Top 15 Viva Questions & Word-for-Word Answers

### Q1: What is NoSQL and how does MongoDB differ from SQL (MySQL/PostgreSQL)?
> **Answer:**  
> In SQL, data is strictly organized into rectangular, two-dimensional tables with fixed schemas, and relationships are resolved at query time using expensive `JOIN` operations.  
> In MongoDB (NoSQL), data is stored as self-contained **BSON (Binary JSON) documents** organized into collections. Documents can have nested sub-documents and arrays, allowing related data to be read and written together in a single atomic I/O operation without joins.

---

### Q2: Why did you EMBED order items instead of creating an `OrderItems` collection?
*(Professors ask this in almost every NoSQL evaluation!)*
> **Answer:**  
> 1. **Atomicity:** An order and its line items represent a single transaction created at the exact same moment. Embedding guarantees they are stored in one atomic write.
> 2. **Immutable Historical Snapshot:** Catalog prices and product names change over time. By embedding the product name, price, quantity, and discount inside the order, we preserve an immutable record of what the customer actually purchased.
> 3. **Bounded Cardinality (1-to-Few):** An order typically contains between 1 and 15 items. Because the array is strictly bounded, it will never exceed MongoDB's **16 MB document size limit**.

---

### Q3: Why did you REFERENCE Customers instead of embedding all orders in the Customer document?
> **Answer:**  
> 1. **Unbounded Growth (1-to-Squillions):** A loyal customer can place hundreds or thousands of orders over years. If we embedded all orders inside a customer document, the document size would grow without bound and eventually crash upon reaching the 16 MB limit.
> 2. **Avoid Duplication & Inconsistency:** Customers frequently change addresses. Updating one document in `customers` is much cleaner than updating hundreds of historical order documents.

---

### Q4: What is BSON and how is it different from JSON?
> **Answer:**  
> BSON stands for **Binary JSON**. While standard JSON is human-readable text supporting only basic types (string, number, boolean, array, object, null), BSON is a binary serialization format used internally by MongoDB that:
> - Encodes data with type and length prefixes for fast traversal and indexing.
> - Supports rich native data types absent in JSON: `Date`, `ObjectId`, `Int32`, `Int64`, `Decimal128`, and raw binary data.

---

### Q5: What is the `_id` field and what is inside an `ObjectId`?
> **Answer:**  
> In MongoDB, every document must have a unique `_id` field as its primary key. If not provided, MongoDB generates an **ObjectId**, which is a **12-byte (24-hex-character)** unique value composed of:
> - **4 bytes:** Unix timestamp (seconds since epoch) — this makes ObjectIds naturally chronological!
> - **5 bytes:** Random value unique to the machine and process.
> - **3 bytes:** Incrementing counter starting at a random number.

---

### Q6: What are the 4 fundamental CRUD operations in MongoDB?
> **Answer:**  
> | Operation | Method | Shell Example |
> | :--- | :--- | :--- |
> | **Create** | `insertOne()` / `insertMany()` | `db.products.insertOne({ productId: "TEC-101", name: "Mouse" })` |
> | **Read** | `find()` / `findOne()` | `db.products.find({ category: "Technology" })` |
> | **Update** | `updateOne()` / `updateMany()` | `db.orders.updateOne({ orderId: "CA-101" }, { $set: { shippingStatus: "Shipped" } })` |
> | **Delete** | `deleteOne()` / `deleteMany()` | `db.products.deleteOne({ productId: "TEC-101" })` |

---

### Q7: What is an Aggregation Pipeline?
> **Answer:**  
> An Aggregation Pipeline is MongoDB's multi-stage framework for advanced data analytics and transformation. Documents enter a pipeline of sequential stages where each stage transforms the documents and passes the output to the next stage like an assembly line:
> - `$match`: Filters documents (like SQL `WHERE`).
> - `$unwind`: Deconstructs an array field so each element becomes a separate document.
> - `$group`: Groups documents by an identifier and calculates aggregates using accumulators like `$sum`, `$avg`, `$min`, `$max` (like SQL `GROUP BY`).
> - `$project`: Reshapes document fields or computes calculated values (like SQL `SELECT`).
> - `$sort`: Reorders the documents (like SQL `ORDER BY`).
> - `$lookup`: Performs a left-outer join with another collection (like SQL `LEFT JOIN`).
> - `$limit` / `$skip`: Paginates results.

---

### Q8: Explain Pipeline 1: Sales & Profit by Product Category.
> **Answer:**  
> ```javascript
> db.orders.aggregate([
>   // Stage 1: Flatten items array so each order line is an individual document
>   { $unwind: "$items" },
> 
>   // Stage 2: Left outer join with products catalog on productId
>   {
>     $lookup: {
>       from: "products",
>       localField: "items.productId",
>       foreignField: "productId",
>       as: "product"
>     }
>   },
>   { $unwind: "$product" },
> 
>   // Stage 3: Group by Category and compute sum of sales and profit
>   {
>     $group: {
>       _id: "$product.category",
>       totalSales: { $sum: "$items.sales" },
>       totalProfit: { $sum: "$items.profit" }
>     }
>   },
> 
>   // Stage 4: Sort by totalSales descending
>   { $sort: { totalSales: -1 } }
> ])
> ```

---

### Q9: Explain Pipeline 2: Monthly Timeline Trends.
> **Answer:**  
> We extract the year and month directly from the BSON `orderDate` field using MongoDB date aggregation operators:
> ```javascript
> db.orders.aggregate([
>   {
>     $group: {
>       _id: {
>         year: { $year: "$orderDate" },
>         month: { $month: "$orderDate" }
>       },
>       totalSales: { $sum: "$totals.sales" },
>       totalProfit: { $sum: "$totals.profit" }
>     }
>   },
>   { $sort: { "_id.year": 1, "_id.month": 1 } }
> ])
> ```

---

### Q10: Explain Pipeline 3: Shipping Transit Days Arithmetic.
> **Answer:**  
> We compute date subtraction arithmetic inside `$project` by subtracting `orderDate` from `shipDate` (which yields milliseconds) and dividing by $86,400,000$ ($1000 \times 60 \times 60 \times 24$) to obtain days:
> ```javascript
> db.orders.aggregate([
>   {
>     $project: {
>       shipMode: 1,
>       shippingDays: {
>         $divide: [{ $subtract: ["$shipDate", "$orderDate"] }, 86400000]
>       }
>     }
>   },
>   {
>     $group: {
>       _id: "$shipMode",
>       avgShippingDays: { $avg: "$shippingDays" }
>     }
>   },
>   { $sort: { avgShippingDays: 1 } }
> ])
> ```

---

### Q11: What indexes did you build and why?
> **Answer:**  
> 1. **Multikey Index on `items.productId` (`orders` collection):**  
>    Because `items` is an array of sub-documents, MongoDB creates a multikey index pointing to every product inside every order line. This enables queries filtering by product in $O(\log N)$ time rather than scanning 5,009 orders.
> 2. **Compound Index on `{ category: 1, subCategory: 1 }` (`products` collection):**  
>    Speeds up hierarchical catalog lookups following the prefix rule.
> 3. **Compound Index on `{ orderDate: -1, customerId: 1 }` (`orders` collection):**  
>    Follows the **ESR (Equality, Sort, Range)** indexing best practice rule for customer order history.

---

### Q12: What data cleaning problems did you solve during CSV import?
> **Answer:**  
> 1. **Date Parsing:** Converted string dates in mixed formats (`MM-DD-YYYY` and `M/D/YYYY`) into proper native BSON `ISODate` objects.
> 2. **Postal Code Zero-Padding:** 449 postal codes lost their leading zero during spreadsheet export (4-digit numbers). We zero-padded them to 5 digits and stored them as strings so arithmetic is not performed.
> 3. **Order Line Grouping:** Grouped 9,994 individual line items into 5,009 atomic orders by `orderId`.
> 4. **Product Deduplication:** 32 Product IDs had slight name variations; we deduplicated them by keeping the most frequent name.

---

### Q13: What is native database-level `$jsonSchema` validation?
> **Answer:**  
> While Mongoose enforces validation in JavaScript at the application layer, MongoDB allows defining native **`$jsonSchema` validation rules directly in the database engine**. Any invalid document inserted via `mongosh`, external scripts, or MongoDB Compass is immediately rejected by the database engine itself.

---

### Q14: What is the CAP Theorem and where does MongoDB stand?
> **Answer:**  
> The CAP Theorem states a distributed data store can guarantee at most 2 out of 3 properties: **Consistency**, **Availability**, and **Partition Tolerance**.  
> MongoDB is historically classified as a **CP system** (prioritizing Consistency and Partition Tolerance). If a network partition occurs, the primary node steps down until an election is held, ensuring stale writes are avoided. With configurable write concerns (`w: "majority"`) and read preferences, it can also be tuned for high availability.

---

### Q15: How can you run these commands directly in the MongoDB Shell (`mongosh`)?
> **Answer:**  
> Open terminal and run:
> ```bash
> mongosh mongodb://127.0.0.1:27017/retail_store_db
> ```
> Useful commands:
> ```javascript
> show collections;
> db.customers.countDocuments();       // 793
> db.products.countDocuments();        // 1,862
> db.orders.countDocuments();          // 5,009
> db.orders.findOne();                 // View sample order
> db.orders.getIndexes();              // View indexes
> ```
