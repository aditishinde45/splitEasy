const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please enter a group name'],
      trim: true,
      maxlength: [80, 'Group name cannot exceed 80 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      required: [true, 'Please select a group category'],
      enum: ['Trip', 'Hostel', 'Flat / Roommates', 'Family', 'Party', 'Other'],
      default: 'Other',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: {
      type: [memberSchema],
      validate: [
        (val) => val.length >= 1,
        'A group must have at least one member',
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Index to quickly find all groups where a user is a member
groupSchema.index({ 'members.user': 1 });

module.exports = mongoose.model('Group', groupSchema);
