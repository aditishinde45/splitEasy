const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: [
        'group_created',
        'group_updated',
        'member_added',
        'member_removed',
        'expense_created',
        'expense_updated',
        'expense_deleted',
        'settlement_recorded',
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.index({ groupId: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
