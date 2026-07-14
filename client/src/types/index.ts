// ================================
// CLSPBS TypeScript Interfaces
// ================================

// --- USER ---
export interface IUser {
    _id: string;
    name: string;
    username: string;
    email: string;
    phone?: string;
    role: 'admin' | 'manager' | 'cashier' | 'staff';
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// --- CUSTOMER ---
export interface ICustomer {
    _id: string;
    customerId: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    customerType: 'walk-in' | 'corporate';
    isPremium?: boolean;
    outstandingBalance: number;
    creditBalance?: number; // NEW FIELD
    notificationFrequency?: string;
    lastNotificationSentAt?: string;
    creditDays?: number;
    createdAt: string;
    updatedAt: string;
}

// --- SERVICE ---
export interface IService {
    _id: string;
    number?: string;
    linenGroup?: string;
    category?: string;
    name: string;
    serviceType: 'wash-fold' | 'dry-cleaning' | 'ironing' | 'express' | 'bulk-commercial';
    description?: string;
    colors?: string;
    sizes?: string;
    weight?: string;
    pricePerUnit: number;
    unit: 'piece' | 'kg' | 'bundle';
    isExpress: boolean;
    expressSurchargePercent: number;
    isActive: boolean;
    isCustomerSpecific?: boolean;
    customer?: string;
    customerId?: string;
    customerPhone?: string;
}

// --- ORDER ITEM ---
export interface IOrderItem {
    _id?: string;
    service?: string;
    serviceName: string;
    serviceType: string;
    itemName?: string;
    quantity: number;
    unit: 'piece' | 'kg' | 'bundle';
    pricePerUnit: number;
    subtotal: number;
    // NEW FIELDS for item details and refund tracking
    itemType?: 'Clothing' | 'Linen' | 'Accessories' | 'Special_Items';
    isRefunded?: boolean;
    refundAmount?: number;
    refundReason?: 'Damaged' | 'Lost' | 'Delayed_Service' | 'Quality_Issue' | 'Customer_Complaint' | 'Other';
    refundReasonDescription?: string;
    // NEW FIELDS for damage tracking
    damageDetails?: string;
    damagedQuantity?: number;
    damageReason?: 'Damaged' | 'Lost' | 'Delayed_Service' | 'Quality_Issue' | 'Customer_Complaint' | 'Other';
    damageReasonDescription?: string;
    damageRecordedBy?: string;
    damageRecordedAt?: string;
    potentialRefundAmount?: number;
    shippedQuantity?: number;
}

// --- ORDER STATUS ---
export type OrderStatus =
    | 'received'
    | 'washing'
    | 'packed'
    | 'cancelled';

export interface IStatusHistory {
    status: OrderStatus;
    timestamp: string;
    updatedBy?: string;
    note?: string;
}

// --- ORDER ---
export interface IOrder {
    _id: string;
    orderId: string;
    customer: ICustomer;
    items: IOrderItem[];
    status: OrderStatus;
    statusHistory: IStatusHistory[];
    specialInstructions?: string;
    deliveryDate?: string;
    subtotal: number;
    taxPercent: number;
    taxAmount: number;
    discountPercent: number;
    discountAmount: number;
    serviceCharge: number;
    totalAmount: number;
    assignedStaff?: IUser;
    createdBy?: IUser;
    createdAt: string;
    updatedAt: string;
    // NEW FIELDS for service time tracking
    serviceStartTime?: string;
    serviceEndTime?: string;
    serviceDuration?: number;
    isDelayed?: boolean;
    // NEW FIELDS for refund tracking
    totalRefundAmount?: number;
    hasRefund?: boolean;
    isShipped?: boolean;
    groupedItems?: Record<string, IOrderItem[]>;
}

// --- INVOICE ---
export interface IRefundLineItem {
    refund: string;
    description: string;
    amount: number;
    refundDate: string;
}

export interface IInvoice {
    _id: string;
    invoiceId: string;
    order: IOrder;
    customer: ICustomer;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    serviceCharge: number;
    totalAmount: number;
    paidAmount: number;
    balanceDue: number;
    paymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded';
    isFinalized: boolean;
    createdAt: string;
    // NEW FIELDS for refund tracking
    refundLineItems?: IRefundLineItem[];
    totalRefundAmount?: number;
    creditBalance?: number;
    payments?: IPayment[];
    dueDate?: string;
    terms?: string;
}

// --- PAYMENT ---
export interface IPayment {
    _id: string;
    invoice: IInvoice;
    paymentMethod: 'cash' | 'card' | 'mobile' | 'bank-transfer' | 'credit-account';
    amount: number;
    transactionRef?: string;
    note?: string;
    processedBy?: IUser;
    createdAt: string;
}

// --- API RESPONSE ---
export interface ApiResponse<T> {
    success: boolean;
    message?: string;
    data?: T;
    count?: number;
}

// --- DASHBOARD STATS ---
export interface IDashboardStats {
    totalOrders: number;
    todayOrders: number;
    todayRevenue: number;
    pendingOrders: number;
    completedOrders: number;
    totalCustomers: number;
    totalRevenue: number;
}

// --- REFUND ---
export interface IRefundItem {
    orderItemId: string;
    itemName: string;
    itemType?: string;
    refundAmount: number;
    refundReason: 'Damaged' | 'Lost' | 'Delayed_Service' | 'Quality_Issue' | 'Customer_Complaint' | 'Other';
    refundReasonDescription?: string;
}

export interface IRefund {
    _id: string;
    refundId: string;
    order: string | IOrder;
    invoice: string;
    customer: string | ICustomer;
    refundType: 'full' | 'partial';
    totalRefundAmount: number;
    refundedItems?: IRefundItem[];
    fullOrderReason?: 'Damaged' | 'Lost' | 'Delayed_Service' | 'Quality_Issue' | 'Customer_Complaint' | 'Other';
    fullOrderReasonDescription?: string;
    processedBy: string | IUser;
    processedByName?: string;
    ipAddress?: string;
    status: 'pending' | 'completed' | 'failed';
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface IRefundRecommendation {
    orderId: string;
    orderNumber: string;
    customerName: string;
    serviceDuration: number;
    expectedDuration: number;
    delayPercentage: number;
    recommendedAmount: number;
    refundPercentage: number;
    reason: string;
}
