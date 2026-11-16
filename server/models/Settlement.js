const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please specify who paid the settlement'],
      index: true,
    },
    paidTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please specify who received the settlement'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Please enter the settlement amount'],
      min: [0.01, 'Settlement amount must be greater than zero'],
    },
    status: {
      type: String,
      enum: ['completed', 'pending'],
      default: 'completed',
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

settlementSchema.index({ groupId: 1, paymentDate: -1 });

module.exports = mongoose.model('Settlement', settlementSchema);
