const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const connectDB = require('../config/db');

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();
    console.log('[Seed] Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Group.deleteMany({}),
      Expense.deleteMany({}),
      Settlement.deleteMany({}),
      Activity.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    console.log('[Seed] Creating demo users...');
    // Create Aman, Riya, Karan, and Sarah
    const aman = await User.create({
      name: 'Aman Sharma',
      email: 'aman@example.com',
      password: 'password123',
      profilePicture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    });

    const riya = await User.create({
      name: 'Riya Patel',
      email: 'riya@example.com',
      password: 'password123',
      profilePicture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
    });

    const karan = await User.create({
      name: 'Karan Verma',
      email: 'karan@example.com',
      password: 'password123',
      profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    });

    const sneha = await User.create({
      name: 'Sneha Rao',
      email: 'sneha@example.com',
      password: 'password123',
      profilePicture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=250&q=80',
    });

    console.log('[Seed] Creating demo groups...');
    // Group 1: Goa Beach Vacation (Aman, Riya, Karan) - Exactly matching Section 7 test case
    const goaTrip = await Group.create({
      name: 'Goa Beach Vacation',
      description: 'Trip to North Goa with friends',
      category: 'Trip',
      createdBy: aman._id,
      members: [
        { user: aman._id, role: 'admin', joinedAt: new Date(Date.now() - 5 * 86400000) },
        { user: riya._id, role: 'member', joinedAt: new Date(Date.now() - 5 * 86400000) },
        { user: karan._id, role: 'member', joinedAt: new Date(Date.now() - 5 * 86400000) },
      ],
    });

    // Group 2: Apartment 402 Flatmates (Aman, Karan, Sneha)
    const apartmentGroup = await Group.create({
      name: 'Apartment 402 Flatmates',
      description: 'Monthly flat rent, groceries and utilities',
      category: 'Flat / Roommates',
      createdBy: aman._id,
      members: [
        { user: aman._id, role: 'admin', joinedAt: new Date(Date.now() - 20 * 86400000) },
        { user: karan._id, role: 'member', joinedAt: new Date(Date.now() - 20 * 86400000) },
        { user: sneha._id, role: 'member', joinedAt: new Date(Date.now() - 20 * 86400000) },
      ],
    });

    console.log('[Seed] Adding Goa Trip expenses (Section 7 standard)...');
    // Expense 1: Aman paid ₹900 for Dinner (split equally)
    await Expense.create({
      groupId: goaTrip._id,
      description: 'Dinner at Fisherman’s Wharf',
      amount: 900,
      paidBy: aman._id,
      splitType: 'equal',
      category: 'Food',
      date: new Date(Date.now() - 2 * 86400000),
      createdBy: aman._id,
      participants: [
        { user: aman._id, shareAmount: 300, sharePercentage: 33.33 },
        { user: riya._id, shareAmount: 300, sharePercentage: 33.33 },
        { user: karan._id, shareAmount: 300, sharePercentage: 33.33 },
      ],
    });

    // Expense 2: Riya paid ₹300 for Snacks (split equally)
    await Expense.create({
      groupId: goaTrip._id,
      description: 'Beach Snacks & Drinks',
      amount: 300,
      paidBy: riya._id,
      splitType: 'equal',
      category: 'Food',
      date: new Date(Date.now() - 1 * 86400000),
      createdBy: riya._id,
      participants: [
        { user: aman._id, shareAmount: 100, sharePercentage: 33.33 },
        { user: riya._id, shareAmount: 100, sharePercentage: 33.33 },
        { user: karan._id, shareAmount: 100, sharePercentage: 33.33 },
      ],
    });

    console.log('[Seed] Adding Apartment Flatmates expenses...');
    // High-speed WiFi
    await Expense.create({
      groupId: apartmentGroup._id,
      description: 'Fiber Internet Bill (March)',
      amount: 1500,
      paidBy: karan._id,
      splitType: 'equal',
      category: 'Utilities',
      date: new Date(Date.now() - 10 * 86400000),
      createdBy: karan._id,
      participants: [
        { user: aman._id, shareAmount: 500, sharePercentage: 33.33 },
        { user: karan._id, shareAmount: 500, sharePercentage: 33.33 },
        { user: sneha._id, shareAmount: 500, sharePercentage: 33.33 },
      ],
    });

    // Weekly Supermarket Groceries
    await Expense.create({
      groupId: apartmentGroup._id,
      description: 'Weekly Organic Groceries',
      amount: 2400,
      paidBy: aman._id,
      splitType: 'equal',
      category: 'Groceries',
      date: new Date(Date.now() - 4 * 86400000),
      createdBy: aman._id,
      participants: [
        { user: aman._id, shareAmount: 800, sharePercentage: 33.33 },
        { user: karan._id, shareAmount: 800, sharePercentage: 33.33 },
        { user: sneha._id, shareAmount: 800, sharePercentage: 33.33 },
      ],
    });

    console.log('[Seed] Adding Activity Logs...');
    await Activity.create({
      groupId: goaTrip._id,
      userId: aman._id,
      action: 'group_created',
      description: 'Aman Sharma created the group "Goa Beach Vacation".',
      createdAt: new Date(Date.now() - 5 * 86400000),
    });

    await Activity.create({
      groupId: goaTrip._id,
      userId: aman._id,
      action: 'expense_created',
      description: 'Aman Sharma added expense "Dinner at Fisherman’s Wharf" (₹900) paid by Aman Sharma.',
      createdAt: new Date(Date.now() - 2 * 86400000),
    });

    await Activity.create({
      groupId: goaTrip._id,
      userId: riya._id,
      action: 'expense_created',
      description: 'Riya Patel added expense "Beach Snacks & Drinks" (₹300) paid by Riya Patel.',
      createdAt: new Date(Date.now() - 1 * 86400000),
    });

    console.log('[Seed] Adding Sample Notifications for Aman...');
    await Notification.create({
      userId: aman._id,
      groupId: goaTrip._id,
      type: 'new_expense',
      message: 'New expense "Beach Snacks & Drinks" (₹300) added in "Goa Beach Vacation".',
      isRead: false,
    });

    console.log('----------------------------------------------------');
    console.log('✅ Demo database seeded successfully!');
    console.log('Test Accounts available:');
    console.log('1. Aman  : aman@example.com  / password123 (Admin)');
    console.log('2. Riya  : riya@example.com  / password123');
    console.log('3. Karan : karan@example.com / password123');
    console.log('4. Sneha : sneha@example.com / password123');
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
