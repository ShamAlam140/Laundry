# Laundry Management System

A comprehensive Laundry Management System built with a Node.js/Express backend, a React web admin portal, and a React Native mobile application for customers and staff.

## Project Structure

This repository is a monorepo containing three main components:

1.  **`server/` (Backend System)**
    *   Node.js, Express, and MongoDB.
    *   RESTful APIs for managing users, customers, orders, inventory, billing, notifications, and settings.
    *   Authentication & Authorization (JWT based).
    *   Automated status updates and seed scripts.

2.  **`client/` (Web Admin Portal)**
    *   React.js with Vite and TypeScript.
    *   Tailwind CSS for UI styling.
    *   Comprehensive dashboard for business operations (Orders, Customers, Inventory, Analytics, etc.).
    *   Role-based access control protecting different routes.

3.  **`apk/` (Mobile Application)**
    *   React Native (Expo) app.
    *   Designed for both staff handling deliveries/orders on the go and customers tracking their laundry.
    *   Authentication, Profile, Orders, and Invoices screens.

---

## User Roles & Access Levels

The system implements a robust Role-Based Access Control (RBAC) mechanism. Here is a breakdown of what each user role can access:

### 1. Admin (`admin`)
*   **Highest level of access.** Has full control over the entire system.
*   **Web Portal Access:**
    *   Dashboard & Analytics
    *   Orders Management (Create, Update, View, Delete)
    *   Customer Management
    *   Invoices & Payments
    *   **Reports (Financial & Operational)**
    *   Inventory & Deliveries
    *   **User Management (Create/Edit other Admins, Managers, Cashiers, Staff)**
    *   **System Settings (Store configuration, email/SMS gateways, taxation rules, etc.)**

### 2. Manager (`manager`)
*   **Operational overview.** Manages day-to-day business operations but cannot change core system settings or manage other admins.
*   **Web Portal Access:**
    *   Dashboard & Analytics
    *   Orders Management
    *   Customer Management
    *   Invoices & Payments
    *   **Reports (Financial & Operational)**
    *   Inventory & Deliveries
    *   *Cannot access User Management or System Settings.*

### 3. Cashier (`cashier`)
*   **Point of Sale (POS) focused.** Handles billing, payments, and order intake.
*   **Web Portal Access:**
    *   Dashboard (Limited view)
    *   Orders Management (Create, Update status to processing/ready)
    *   Customer Management (Create, View)
    *   Invoices & Payments (Process payments, generate receipts)
    *   *Cannot access Reports, User Management, Settings, or Inventory.*

### 4. Staff (`staff`)
*   **Floor operations focused.** Handles the actual washing, ironing, and delivery processes.
*   **Web Portal / Mobile App Access:**
    *   View assigned Orders & update statuses (e.g., from 'Processing' to 'Ready for Delivery').
    *   View Deliveries (Marking items as delivered/picked up).
    *   Inventory Management (Update stock levels for detergents, etc.).
    *   *Cannot access Financials, Reports, User Management, or Settings.*

### 5. Customer (`customer` - Separate Auth System)
*   **End-user access.** Tracks individual laundry progress.
*   **Mobile App / Web Portal Access:**
    *   Login/Register via Customer Portal.
    *   View personal Order History and Current Order Status.
    *   View Invoices and outstanding balances.
    *   Update personal profile and address.

---

## Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (v16+)
*   [MongoDB](https://www.mongodb.com/) (Local or Atlas URI)
*   [Yarn](https://yarnpkg.com/) or npm (for web/server)
*   Expo CLI (for mobile app)

### 1. Server Setup
```bash
cd server
npm install
```
*   Create a `.env` file in the `server` directory (reference the codebase for required variables like `MONGO_URI`, `JWT_SECRET`).
*   Run `npm run seed` to populate initial test data to the database.
*   Run `npm run dev` to start the backend server on `https://jspcorporationptyltd.ts.r.appspot.com`.

### 2. Client (Web Portal) Setup
```bash
cd client
npm install
```
*   Modify the API base URL in `client/src/services/api.ts` if your server runs on a different port.
*   Run `npm run dev` to start the React development server.

### 3. APK (Mobile App) Setup
```bash
cd apk
npm install
```
*   Ensure your Expo go app or Android/iOS simulators are ready.
*   Run `npx expo start` to bundle the app and launch the development QR code.

---

## Default Login Credentials (if seeded)
*If you ran the seed script in the server, use the following credentials:*
*   **Admin:** `admin@laundry.com` / `password123`
*   **Manager:** `manager@laundry.com` / `password123`
*   **Cashier:** `cashier@laundry.com` / `password123`
*   **Staff:** `staff@laundry.com` / `password123`

## Technologies Used
*   **Backend:** Node.js, Express.js, MongoDB, Mongoose, JWT, Bcrypt
*   **Frontend (Web):** React.js, Vite, TailwindCSS, React Router, Axios
*   **Frontend (Mobile):** React Native, Expo, NativeWind
