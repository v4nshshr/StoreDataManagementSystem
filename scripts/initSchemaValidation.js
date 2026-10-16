require('dotenv').config();
const { MongoClient } = require('mongodb');

/**
 * MongoDB Database-Level $jsonSchema Validator Setup
 * 
 * Why $jsonSchema at the database level?
 * While Mongoose enforces schema validation at the application tier, database-level
 * $jsonSchema validation guarantees data integrity even when operations are executed
 * through raw MongoDB shell (mongosh), external scripts, or MongoDB Compass.
 */
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/retail_store_db';

const customerValidationSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['customerId', 'name', 'segment', 'address'],
    properties: {
      customerId: {
        bsonType: 'string',
        description: 'must be a string and is required'
      },
      name: {
        bsonType: 'string',
        description: 'must be a string and is required'
      },
      segment: {
        enum: ['Consumer', 'Corporate', 'Home Office'],
        description: 'can only be one of the enum values and is required'
      },
      address: {
        bsonType: 'object',
        required: ['city', 'state', 'postalCode', 'region'],
        properties: {
          city: { bsonType: 'string' },
          state: { bsonType: 'string' },
          postalCode: {
            bsonType: 'string',
            pattern: '^[0-9]{5}$',
            description: 'must be a 5-digit zero-padded string'
          },
          region: {
            enum: ['East', 'West', 'Central', 'South'],
            description: 'must be East, West, Central, or South'
          }
        }
      }
    }
  }
};

const productValidationSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['productId', 'name', 'category', 'subCategory'],
    properties: {
      productId: {
        bsonType: 'string',
        description: 'must be a string and is required'
      },
      name: {
        bsonType: 'string',
        description: 'must be a string and is required'
      },
      category: {
        enum: ['Furniture', 'Office Supplies', 'Technology'],
        description: 'must be Furniture, Office Supplies, or Technology'
      },
      subCategory: {
        bsonType: 'string',
        description: 'must be a string and is required'
      }
    }
  }
};

const orderValidationSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['orderId', 'customerId', 'orderDate', 'shipDate', 'shipMode', 'shippingAddress', 'items', 'totals'],
    properties: {
      orderId: { bsonType: 'string' },
      customerId: { bsonType: 'string' },
      orderDate: { bsonType: 'date' },
      shipDate: { bsonType: 'date' },
      shipMode: {
        enum: ['Standard Class', 'Second Class', 'First Class', 'Same Day']
      },
      shippingAddress: {
        bsonType: 'object',
        required: ['city', 'state', 'postalCode', 'region'],
        properties: {
          city: { bsonType: 'string' },
          state: { bsonType: 'string' },
          postalCode: { bsonType: 'string', pattern: '^[0-9]{5}$' },
          region: { enum: ['East', 'West', 'Central', 'South'] }
        }
      },
      items: {
        bsonType: 'array',
        minItems: 1,
        items: {
          bsonType: 'object',
          required: ['productId', 'productName', 'sales', 'quantity', 'discount', 'profit'],
          properties: {
            productId: { bsonType: 'string' },
            productName: { bsonType: 'string' },
            sales: { bsonType: ['double', 'int', 'long', 'decimal'] },
            quantity: { bsonType: ['int', 'long', 'double'], minimum: 1 },
            discount: { bsonType: ['double', 'int', 'decimal'], minimum: 0, maximum: 1 },
            profit: { bsonType: ['double', 'int', 'long', 'decimal'] }
          }
        }
      },
      totals: {
        bsonType: 'object',
        required: ['sales', 'profit', 'quantity'],
        properties: {
          sales: { bsonType: ['double', 'int', 'long', 'decimal'] },
          profit: { bsonType: ['double', 'int', 'long', 'decimal'] },
          quantity: { bsonType: ['int', 'long', 'double'] }
        }
      }
    }
  }
};

const userValidationSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['username', 'passwordHash', 'role'],
    properties: {
      username: { bsonType: 'string' },
      passwordHash: { bsonType: 'string' },
      role: {
        enum: ['admin', 'manager', 'cashier']
      }
    }
  }
};

async function applyValidation() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB for schema validation setup...');
    const db = client.db();

    const collections = [
      { name: 'customers', validator: customerValidationSchema },
      { name: 'products', validator: productValidationSchema },
      { name: 'orders', validator: orderValidationSchema },
      { name: 'users', validator: userValidationSchema }
    ];

    const existingCollections = (await db.listCollections().toArray()).map((c) => c.name);

    for (const { name, validator } of collections) {
      if (existingCollections.includes(name)) {
        console.log(`Modifying existing collection validator for: ${name}`);
        await db.command({
          collMod: name,
          validator: validator,
          validationLevel: 'moderate',
          validationAction: 'error'
        });
      } else {
        console.log(`Creating collection with $jsonSchema validator: ${name}`);
        await db.createCollection(name, {
          validator: validator,
          validationLevel: 'moderate',
          validationAction: 'error'
        });
      }
    }

    console.log('Successfully configured database-level $jsonSchema validation for all collections.');
  } catch (error) {
    console.error('Failed to configure schema validation:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  applyValidation();
}

module.exports = {
  customerValidationSchema,
  productValidationSchema,
  orderValidationSchema,
  userValidationSchema,
  applyValidation
};
