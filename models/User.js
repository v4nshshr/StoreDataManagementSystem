const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema for Role-Based Access Control (RBAC)
 * Roles:
 * - admin: Full read/write/delete access across all modules
 * - manager: Read/write access to orders, products, customers, and analytics
 * - cashier: Point-of-Sale access to create orders and view catalog
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters long']
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ['admin', 'manager', 'cashier'],
        message: 'Role must be admin, manager, or cashier'
      },
      default: 'cashier'
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

/**
 * Instance method to compare candidate password with hashed password
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
