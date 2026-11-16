const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shareAmount: {
      type: Number,
      required: true,
      min: [0, 'Share amount cannot be negative'],
    },
    sharePercentage: {
      type: Number,
      min: [0, 'Share percentage cannot be negative'],
      max: [100, 'Share percentage cannot exceed 100%'],
    },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Please enter an expense description'],
      trim: true,
      maxlength: [150, 'Description cannot exceed 150 characters'],
    },
    amount: {
      type: Number,
      required: [true, 'Please enter the expense amount'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please specify who paid for the expense'],
      index: true,
    },
    participants: {
      type: [participantSchema],
      validate: [
        (val) => val.length > 0,
        'Expense must include at least one participant',
      ],
    },
    splitType: {
      type: String,
      enum: ['equal', 'custom', 'percentage'],
      default: 'equal',
      required: true,
    },
    category: {
      type: String,
      enum: [
        'Food',
        'Travel',
        'Shopping',
        'Groceries',
        'Rent',
        'Entertainment',
        'Utilities',
        'Other',
      ],
      default: 'Other',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying expenses by group and date
expenseSchema.index({ groupId: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
