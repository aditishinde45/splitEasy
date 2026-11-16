const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const User = require('../models/User');
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const { calculateGroupBalances } = require('../services/calculationService');

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spliteasy_test';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URI);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Group.deleteMany({});
  await Expense.deleteMany({});
  await Settlement.deleteMany({});
  await Activity.deleteMany({});
  await Notification.deleteMany({});
});

describe('SplitEasy Authentication & Security Tests', () => {
  it('should register a new user successfully with hashed password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Aman Sharma',
      email: 'aman@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.name).toBe('Aman Sharma');
    expect(res.body.user.email).toBe('aman@example.com');
    expect(res.body.token).toBeDefined();

    // Verify password is not plaintext in DB
    const dbUser = await User.findOne({ email: 'aman@example.com' }).select('+password');
    expect(dbUser.password).not.toBe('password123');
  });

  it('should reject registration if email is duplicate', async () => {
    await User.create({
      name: 'Existing User',
      email: 'existing@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Another User',
      email: 'existing@example.com',
      password: 'password456',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already exists');
  });

  it('should log in an existing user with correct credentials and set token', async () => {
    await User.create({
      name: 'Test Login',
      email: 'login@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('should reject login with wrong password', async () => {
    await User.create({
      name: 'Test Login',
      email: 'login@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('SplitEasy Section 7 & 8: Mandatory Calculation Engine Test Case', () => {
  it('should accurately calculate balances and suggested settlements for Aman, Riya, and Karan', async () => {
    // 1. Create 3 users
    const aman = await User.create({ name: 'Aman', email: 'aman@test.com', password: 'password123' });
    const riya = await User.create({ name: 'Riya', email: 'riya@test.com', password: 'password123' });
    const karan = await User.create({ name: 'Karan', email: 'karan@test.com', password: 'password123' });

    // 2. Create group with all 3 members
    const group = await Group.create({
      name: 'Goa Trip',
      category: 'Trip',
      createdBy: aman._id,
      members: [
        { user: aman._id, role: 'admin' },
        { user: riya._id, role: 'member' },
        { user: karan._id, role: 'member' },
      ],
    });

    // 3. Add Expense 1: Aman paid ₹900 for Dinner (split equally among Aman, Riya, Karan: ₹300 each)
    await Expense.create({
      groupId: group._id,
      description: 'Dinner',
      amount: 900,
      paidBy: aman._id,
      splitType: 'equal',
      category: 'Food',
      createdBy: aman._id,
      participants: [
        { user: aman._id, shareAmount: 300, sharePercentage: 33.33 },
        { user: riya._id, shareAmount: 300, sharePercentage: 33.33 },
        { user: karan._id, shareAmount: 300, sharePercentage: 33.33 },
      ],
    });

    // 4. Add Expense 2: Riya paid ₹300 for Snacks (split equally among Aman, Riya, Karan: ₹100 each)
    await Expense.create({
      groupId: group._id,
      description: 'Snacks',
      amount: 300,
      paidBy: riya._id,
      splitType: 'equal',
      category: 'Food',
      createdBy: riya._id,
      participants: [
        { user: aman._id, shareAmount: 100, sharePercentage: 33.33 },
        { user: riya._id, shareAmount: 100, sharePercentage: 33.33 },
        { user: karan._id, shareAmount: 100, sharePercentage: 33.33 },
      ],
    });

    // 5. Execute calculation engine
    const result = await calculateGroupBalances(group._id);

    // Verify Total Expenses = ₹1200
    expect(result.totalExpenses).toBe(1200);

    // Verify Equal Share = ₹400
    expect(result.equalShare).toBe(400);

    // Verify Individual Balances
    const amanBalance = result.balances.find((b) => b.user._id.toString() === aman._id.toString());
    const riyaBalance = result.balances.find((b) => b.user._id.toString() === riya._id.toString());
    const karanBalance = result.balances.find((b) => b.user._id.toString() === karan._id.toString());

    // Aman: ₹900 paid - ₹400 share = +₹500 (gets back ₹500)
    expect(amanBalance.totalPaid).toBe(900);
    expect(amanBalance.totalShare).toBe(400);
    expect(amanBalance.netBalance).toBe(500);
    expect(amanBalance.status).toBe('receives');

    // Riya: ₹300 paid - ₹400 share = -₹100 (owes ₹100)
    expect(riyaBalance.totalPaid).toBe(300);
    expect(riyaBalance.totalShare).toBe(400);
    expect(riyaBalance.netBalance).toBe(-100);
    expect(riyaBalance.status).toBe('owes');

    // Karan: ₹0 paid - ₹400 share = -₹400 (owes ₹400)
    expect(karanBalance.totalPaid).toBe(0);
    expect(karanBalance.totalShare).toBe(400);
    expect(karanBalance.netBalance).toBe(-400);
    expect(karanBalance.status).toBe('owes');

    // Verify Suggested Payments:
    // Riya pays Aman ₹100
    // Karan pays Aman ₹400
    expect(result.settlementSuggestions.length).toBe(2);

    const riyaToAman = result.settlementSuggestions.find(
      (s) => s.fromUser._id.toString() === riya._id.toString() && s.toUser._id.toString() === aman._id.toString()
    );
    const karanToAman = result.settlementSuggestions.find(
      (s) => s.fromUser._id.toString() === karan._id.toString() && s.toUser._id.toString() === aman._id.toString()
    );

    expect(riyaToAman).toBeDefined();
    expect(riyaToAman.amount).toBe(100);

    expect(karanToAman).toBeDefined();
    expect(karanToAman.amount).toBe(400);

    // 6. Test Settlement System: Riya settles ₹100 to Aman
    await Settlement.create({
      groupId: group._id,
      paidBy: riya._id,
      paidTo: aman._id,
      amount: 100,
      status: 'completed',
    });

    const resultAfterSettlement1 = await calculateGroupBalances(group._id);
    const riyaAfter = resultAfterSettlement1.balances.find((b) => b.user._id.toString() === riya._id.toString());
    const amanAfter = resultAfterSettlement1.balances.find((b) => b.user._id.toString() === aman._id.toString());
    const karanAfter = resultAfterSettlement1.balances.find((b) => b.user._id.toString() === karan._id.toString());

    // Riya is now settled (₹0)
    expect(riyaAfter.netBalance).toBe(0);
    expect(riyaAfter.status).toBe('settled');

    // Aman is owed ₹400 remaining
    expect(amanAfter.netBalance).toBe(400);
    expect(amanAfter.status).toBe('receives');

    // Karan still owes ₹400
    expect(karanAfter.netBalance).toBe(-400);
    expect(karanAfter.status).toBe('owes');

    // Remaining suggestion: Karan pays Aman ₹400
    expect(resultAfterSettlement1.settlementSuggestions.length).toBe(1);
    expect(resultAfterSettlement1.settlementSuggestions[0].fromUser._id.toString()).toBe(karan._id.toString());
    expect(resultAfterSettlement1.settlementSuggestions[0].toUser._id.toString()).toBe(aman._id.toString());
    expect(resultAfterSettlement1.settlementSuggestions[0].amount).toBe(400);

    // 7. Karan settles ₹400 to Aman
    await Settlement.create({
      groupId: group._id,
      paidBy: karan._id,
      paidTo: aman._id,
      amount: 400,
      status: 'completed',
    });

    const resultFinal = await calculateGroupBalances(group._id);
    const amanFinal = resultFinal.balances.find((b) => b.user._id.toString() === aman._id.toString());
    const riyaFinal = resultFinal.balances.find((b) => b.user._id.toString() === riya._id.toString());
    const karanFinal = resultFinal.balances.find((b) => b.user._id.toString() === karan._id.toString());

    // All members are completely settled (₹0)
    expect(amanFinal.netBalance).toBe(0);
    expect(riyaFinal.netBalance).toBe(0);
    expect(karanFinal.netBalance).toBe(0);
    expect(resultFinal.settlementSuggestions.length).toBe(0);
  });
});

describe('Split Splits & Authorization Tests', () => {
  it('should enforce group membership to access group resources', async () => {
    const user1 = await User.create({ name: 'User 1', email: 'user1@test.com', password: 'password123' });
    const outsider = await User.create({ name: 'Outsider', email: 'outsider@test.com', password: 'password123' });

    const group = await Group.create({
      name: 'Private Group',
      category: 'Flat / Roommates',
      createdBy: user1._id,
      members: [{ user: user1._id, role: 'admin' }],
    });

    // Login as outsider
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'outsider@test.com',
      password: 'password123',
    });
    const token = loginRes.body.token;

    // Outsider attempts to get group details
    const res = await request(app)
      .get(`/api/groups/${group._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
