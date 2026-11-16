# SplitEasy – Full-Stack Expense Sharing Platform

SplitEasy is a modern, full-stack shared expense management platform built with the MERN stack (MongoDB, Express.js, React with Vite, Node.js, and Tailwind CSS). It enables friends, roommates, families, and travel groups to create groups, log shared expenses, split bills with customizable rules, track individual balances with exact currency-safe precision, and settle debts with optimized payment suggestions.

---

## 🌟 Key Features

- **Robust Authentication & Security**:
  - Secure registration and login with bcryptjs password hashing (10 salt rounds).
  - JWT tokens stored in secure, HTTP-only cookies (plus Bearer header fallback for external API testing).
  - Rate limiting on authentication routes to prevent brute-force attacks.
  - Granular authorization middleware preventing unauthorized cross-group data access.

- **Group Management**:
  - Create groups with categories (*Trip*, *Hostel*, *Flat / Roommates*, *Family*, *Party*, *Other*).
  - Add existing registered users by email with real-time autocomplete suggestions.
  - Group creator automatically assigned the `admin` role with edit and management permissions.
  - Member removal with financial safety protection (cannot remove a member with an unsettled balance).

- **Flexible Expense Splitting Engine**:
  - **Equal Split**: Automatically divides bills equally with integer-paise precision.
  - **Custom Split**: Set exact rupee amounts for participants with real-time balance validation.
  - **Percentage Split**: Split by custom percentages with live validation ensuring exactly 100%.
  - Search, filter by category and payer, sort by date and amount, and edit/delete capabilities.

- **Section 7 & 8 Calculation & Settlement Engine**:
  - Performs closed-form balance calculations:
    $$\text{Net Balance} = (\text{Total Paid for Expenses} - \text{Total Expense Share}) + (\text{Settlements Paid} - \text{Settlements Received})$$
  - Uses internal integer paise math (`Math.round(rupees * 100)`) to eliminate floating-point rounding errors.
  - **Greedy Debt Simplification**: Computes optimal suggested payments to minimize total transactions across group members.
  - 1-Click **"Settle Now"** modal pre-filling payer, recipient, and amount from suggestions.

- **Activity History & In-App Notifications**:
  - Database-backed notifications for group invitations, new expenses, updates, and payments.
  - Unread notification count badge and mark-as-read controls.
  - Comprehensive activity audit trail per group and globally.

- **Modern SaaS Dashboard & UI**:
  - Styled with an Emerald Green financial palette, glassmorphism, clean cards, and responsive layouts.
  - 1-Click demo account switchers for instant local testing.

---

## 🧪 Mandatory Test Case Walkthrough (Section 7 & 8)

| Member | Expense Description | Amount Paid | Individual Share | Net Balance | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Aman** | Dinner at Fisherman's Wharf | ₹900.00 | ₹400.00 | **+₹500.00** | Gets back ₹500 |
| **Riya** | Beach Snacks & Drinks | ₹300.00 | ₹400.00 | **-₹100.00** | Owes ₹100 |
| **Karan** | *(None)* | ₹0.00 | ₹400.00 | **-₹400.00** | Owes ₹400 |
| **Total** | | **₹1,200.00** | **₹1,200.00** | **₹0.00** | **Balanced** |

### Optimized Settlement Suggestions
1. **Riya pays Aman ₹100**
2. **Karan pays Aman ₹400**

*After these two payments are recorded, all three members have a net balance of exactly ₹0.00.*

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, React Router DOM v6, Axios, Tailwind CSS, Lucide React, Context API |
| **Backend** | Node.js, Express.js, Mongoose ODM, JSON Web Token (JWT), bcryptjs, cookie-parser, morgan |
| **Database** | MongoDB (Local or MongoDB Atlas) |
| **Testing** | Jest, Supertest |
| **Deployment** | Vercel (Client), Render (Server), MongoDB Atlas (Database) |

---

## 📁 Project Structure

```
splitEasy/
├── client/                     # React + Vite Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # Navbar, StatCard, Modal, LoadingSpinner, EmptyState
│   │   │   └── modals/         # AddExpenseModal, SettleDebtModal, CreateGroupModal, AddMemberModal, EditGroupModal
│   │   ├── context/            # AuthContext, NotificationContext
│   │   ├── layouts/            # AppLayout
│   │   ├── pages/              # LandingPage, LoginPage, RegisterPage, DashboardPage, GroupsPage, GroupDetailPage, ProfilePage, ActivityPage
│   │   ├── routes/             # ProtectedRoute
│   │   ├── services/           # Axios API Client
│   │   ├── App.jsx             # Main Router Configuration
│   │   ├── index.css           # Tailwind Directives & Custom Styles
│   │   └── main.jsx            # Entry point
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── vercel.json
│   └── .env.example
├── server/                     # Express.js REST API Backend
│   ├── config/                 # db.js MongoDB connection
│   ├── controllers/            # auth, user, group, expense, balance, settlement, notification, dashboard
│   ├── middleware/             # auth, groupAuth, errorHandler, rateLimiter
│   ├── models/                 # User, Group, Expense, Settlement, Notification, Activity
│   ├── routes/                 # REST API Express routers
│   ├── services/               # calculationService, notificationService, activityService
│   ├── tests/                  # spliteasy.test.js (Jest & Supertest test suite)
│   ├── utils/                  # seed.js (Database seeder)
│   ├── server.js               # Express application entrypoint
│   ├── render.yaml             # Render deployment configuration
│   ├── package.json
│   ├── .env.example
│   └── .env
├── package.json                # Root workspace convenience scripts
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **MongoDB** running locally on port 27017 or a **MongoDB Atlas URI**

### 1. Clone & Install Dependencies

```bash
cd splitEasy

# Install root, backend, and frontend dependencies
npm --prefix server install
npm --prefix client install
```

### 2. Environment Variables

Create `.env` inside `server/`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/spliteasy
JWT_SECRET=spliteasy_jwt_local_dev_secret_2026_safe
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

### 3. Seed Demo Data

Run the database seed script to populate demo users, groups, and the Section 7 Goa Trip test case:

```bash
cd server
npm run seed
```

#### Demo User Credentials:
| Name | Email | Password | Role / Purpose |
| :--- | :--- | :--- | :--- |
| **Aman Sharma** | `aman@example.com` | `password123` | Trip Admin / Paid ₹900 Dinner |
| **Riya Patel** | `riya@example.com` | `password123` | Member / Paid ₹300 Snacks |
| **Karan Verma** | `karan@example.com` | `password123` | Member / Paid ₹0 |
| **Sneha Rao** | `sneha@example.com` | `password123` | Apartment 402 Flatmate |

*(All demo accounts are accessible via 1-click buttons on the Login page!)*

### 4. Run the Backend and Frontend

In two separate terminals:

**Terminal 1 (Backend):**
```bash
npm --prefix server run dev
# Server runs on http://localhost:5000
```

**Terminal 2 (Frontend):**
```bash
npm --prefix client run dev
# Frontend runs on http://localhost:5173
```

---

## 🧪 Running Automated Tests

Run the complete backend integration and calculation engine test suite:

```bash
npm --prefix server test
```

The test suite validates:
1. User registration, password hashing verification, and duplicate email prevention.
2. Login authentication and JWT cookie/token generation.
3. **The exact Section 7 & 8 mandatory calculation test case** (Aman +₹500, Riya -₹100, Karan -₹400, suggested payments, and balance updates after settlements).
4. Group authorization and unauthorized cross-group protection (403 Forbidden).

---

## 📡 REST API Reference

### Authentication
- `POST /api/auth/register` - Register a new user (`name`, `email`, `password`, `confirmPassword`)
- `POST /api/auth/login` - Authenticate user (`email`, `password`)
- `POST /api/auth/logout` - Clear authentication session cookie
- `GET /api/auth/me` - Get current authenticated user
- `PUT /api/auth/change-password` - Change password (`currentPassword`, `newPassword`)

### Groups
- `POST /api/groups` - Create a group (`name`, `description`, `category`, `memberEmails`)
- `GET /api/groups` - Get all groups for the authenticated user
- `GET /api/groups/:groupId` - Get single group details (membership required)
- `PUT /api/groups/:groupId` - Update group details (admin only)
- `DELETE /api/groups/:groupId` - Delete group (admin only)
- `POST /api/groups/:groupId/members` - Add member by email
- `DELETE /api/groups/:groupId/members/:userId` - Remove member (balance must be ₹0)

### Expenses
- `POST /api/expenses` - Create expense (`groupId`, `description`, `amount`, `paidBy`, `splitType`, `participants`, `category`, `date`)
- `GET /api/expenses/group/:groupId` - List expenses with search, category, payer filters & sorting
- `GET /api/expenses/:expenseId` - Get expense details
- `PUT /api/expenses/:expenseId` - Update an expense
- `DELETE /api/expenses/:expenseId` - Delete an expense

### Balances & Settlements
- `GET /api/groups/:groupId/balances` - Calculate group balances and individual shares
- `GET /api/groups/:groupId/settlement-suggestions` - Get optimized suggested payments
- `POST /api/settlements` - Record a debt settlement (`groupId`, `paidBy`, `paidTo`, `amount`, `paymentDate`, `notes`)
- `GET /api/settlements/group/:groupId` - Get settlement history for a group

### Dashboard & Notifications
- `GET /api/dashboard/summary` - Aggregate dashboard metrics (groups, expenses, owes, owed)
- `GET /api/dashboard/recent-activity` - Global recent activity feed
- `GET /api/notifications` - Get user notifications & unread count
- `PATCH /api/notifications/:notificationId/read` - Mark single notification as read
- `PATCH /api/notifications/read-all` - Mark all notifications as read

---

## 🌐 Production Deployment Guide

### Backend on Render
1. Push your repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), create a new **Web Service**.
3. Connect your repository and configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `<Your MongoDB Atlas connection string>`
   - `JWT_SECRET`: `<A strong random secret string>`
   - `CLIENT_URL`: `<Your deployed Vercel frontend URL>`

### Frontend on Vercel
1. In [Vercel Dashboard](https://vercel.com), import your repository.
2. Set **Root Directory** to `client`.
3. In `client/vercel.json`, verify that the `/api/(.*)` rewrite points to your Render backend URL.
4. Deploy!
