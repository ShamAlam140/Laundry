# Laundry Management System - Detailed User Guide

Welcome to your new **Laundry Management System**! This document provides a clear, step-by-step breakdown of how your staff and customers will use the platform on a daily basis.

The system is split into two main areas:
1. **Web Admin Portal** (Used on computers/tablets at the shop or back office)
2. **Mobile App** (Used by delivery staff on the go, and by your customers)

---

## 1. Web Admin Portal Roles (Shop & Operations)

### 🥇 Admin (The Owner / General Manager)
The Admin has 100% control over the entire system. This role is for the business owner to see the big picture and configure the system.
*   **What they do:**
    *   **Manage Employees:** Create accounts for new Managers, Cashiers, and Staff (`Users` menu).
    *   **System Settings:** Set store details, manage email/SMS connections, configure tax rules, and set up receipt formats (`Settings` menu).
    *   **Financial Reports:** View detailed profit, order volume, and performance analytics across all stores (`Reports` menu).
    *   **Total Oversight:** Can view, edit, or delete any order, customer, invoice, or delivery in the system.

### 🥈 Manager (The Store Manager)
The Manager oversees daily store operations but cannot change core system settings or employee salaries.
*   **What they do:**
    *   **Monitor Daily Flow:** Track how many orders are coming in and check pending deliveries on the Dashboard.
    *   **Handle Issues:** Can update orders, fix customer disputes, or adjust invoices (`Orders` & `Invoices` menus).
    *   **Inventory Tracking:** Check if you need to buy more detergent or supplies (`Inventory` menu).
    *   **Basic Reporting:** Look at daily/weekly sales reports to ensure targets are hit.

### 🥉 Cashier (The Front Desk)
The Cashier handles the direct face-to-face interaction with walk-in customers and takes payments.
*   **What they do:**
    *   **Create New Orders:** When a customer walks in, the cashier quickly adds their items (e.g., 2 shirts, 1 suit) and generates an order (`Create Order`).
    *   **Add Customers:** Register a new walk-in customer into the system (`Customers` menu).
    *   **Process Payments:** Accept cash, card, or digital payments and mark the invoice as "Paid" (`Payments` menu).
    *   **Print Receipts:** Generate and print paper or digital receipts for the customer.
    *   *Note: Cashiers cannot see overall business reports or change settings.*

### 🛠️ Staff (The Washers, Ironers & Packing Team)
The Staff members do the physical work and use the system to know what needs to be cleaned and when.
*   **What they do:**
    *   **Update Laundry Stages:** They look at the `Orders` screen to see what needs washing. As they finish, they update the status:
        *   -> `Washing`
        *   -> `Ironing`
        *   -> `Ready for Delivery`
    *   **Update Stock:** Mark when a supply (like soap) has been taken out of the inventory room.
    *   *Note: Staff members cannot see any financial data, invoices, or business reports.*

---

## 2. Mobile App Roles (On The Go)

The Mobile App is designed for two specific types of users. It uses different screens based on who logs in.

### 🛵 Delivery Staff (Your Drivers)
Delivery staff use the app on their phones to manage pickups and drop-offs without needing a computer.
*   **What they do on the app:**
    *   **View Route:** See exactly which addresses they need to visit today.
    *   **Update Deliveries:** When dropping clean clothes off at a house, they tap "Mark as Delivered."
    *   **On-Site Orders:** (Optional) If they pick up dirty clothes from a customer's house, they can quickly input the items to create an initial order.

### 👥 Customers (Your Clients)
Customers download the app to their phone so they never have to call the store asking "Are my clothes ready?"
*   **What they do on the app:**
    *   **Track Orders Live:** They open the app and see a timeline (e.g., "Picked Up" -> "Washing" -> "Out for Delivery").
    *   **View Receipts:** Look at past invoices and see if they have any outstanding balance to pay.
    *   **Schedule Pickups:** Request that a driver comes to their house to pick up dirty laundry.
    *   **Manage Profile:** Update their phone number or home address easily.

---

## 🔄 Daily Workflow Example (How it all connects)

Here is exactly how a typical order flows through your system:

1.  **Drop-off (Cashier):** John walks in with 5 shirts. The Cashier uses the **Web Portal** to create an order, take payment, and hand John a digital receipt.
2.  **Tracking (Customer):** John goes home, opens his **Customer App**, and sees his 5 shirts are in the "Pending" status.
3.  **Cleaning (Staff):** In the back room, the Staff sees John's order on the **Web Portal**. They wash it, iron it, and click "Ready for Delivery."
4.  **Notification (System):** The system automatically sends John an email/SMS saying "Your clothes are ready!"
5.  **Delivery (Delivery Staff):** Your driver takes the clothes, opens their **Staff App**, drives to John's house, hands him the clothes, and clicks "Delivered."
6.  **Review (Manager/Admin):** At the end of the day, the Manager checks the **Web Portal Dashboard** to ensure all deliveries were completed, and the Admin looks at the **Reports** to see total sales.
