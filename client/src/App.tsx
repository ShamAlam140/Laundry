import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';

// Lazy loaded pages
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const Orders = lazy(() => import('./pages/Orders'));
const CreateOrder = lazy(() => import('./pages/CreateOrder'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'));
const InvoiceApproval = lazy(() => import('./pages/InvoiceApproval'));
const Payments = lazy(() => import('./pages/Payments'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Reports = lazy(() => import('./pages/Reports'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Deliveries = lazy(() => import('./pages/Deliveries'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Shipped = lazy(() => import('./pages/Shipped'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const ProcessRefund = lazy(() => import('./pages/ProcessRefund'));
const RefundAnalytics = lazy(() => import('./pages/RefundAnalytics'));
const PublicInvoiceDetail = lazy(() => import('./pages/PublicInvoiceDetail'));

// Loading Fallback Component
const PageLoader = () => (
    <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

function App() {
    return (
        <AuthProvider>
            <SettingsProvider>
                <Router>
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            duration: 3000,
                            style: {
                                background: '#ffffff',
                                color: '#0f172a',
                                border: '1px solid rgba(0,0,0,0.1)',
                                borderRadius: '12px',
                                fontSize: '14px',
                            },
                            success: { iconTheme: { primary: '#06b6d4', secondary: '#fff' } },
                            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                        }}
                    />
                    <Suspense fallback={<PageLoader />}>
                        <Routes>
                            {/* Public */}
                            <Route path="/login" element={<Login />} />
                            <Route path="/reset-password/:token" element={<ResetPassword />} />
                            <Route path="/public/invoice/:invoiceId" element={<PublicInvoiceDetail />} />

                            {/* Protected — App Layout */}
                            <Route
                                element={
                                    <ProtectedRoute>
                                        <AppLayout />
                                    </ProtectedRoute>
                                }
                            >
                                <Route path="/dashboard" element={<Dashboard />} />
                                <Route path="/orders" element={<Orders />} />
                                <Route path="/orders/new" element={<CreateOrder />} />
                                <Route path="/orders/:id" element={<OrderDetail />} />
                                <Route path="/orders/:orderId/refund" element={
                                    <ProtectedRoute allowedRoles={['admin', 'manager']}>
                                        <ProcessRefund />
                                    </ProtectedRoute>
                                } />
                                <Route path="/customers" element={<Customers />} />
                                <Route path="/invoices" element={<Invoices />} />
                                <Route path="/invoices/:invoiceId" element={<InvoiceDetail />} />
                                <Route path="/invoices/approval" element={
                                    <ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']}>
                                        <InvoiceApproval />
                                    </ProtectedRoute>
                                } />
                                <Route path="/payments" element={<Payments />} />
                                <Route path="/reports" element={
                                    <ProtectedRoute allowedRoles={['admin', 'manager']}>
                                        <Reports />
                                    </ProtectedRoute>
                                } />
                                <Route path="/refunds/analytics" element={
                                    <ProtectedRoute allowedRoles={['admin', 'manager']}>
                                        <RefundAnalytics />
                                    </ProtectedRoute>
                                } />
                                <Route
                                    path="/users"
                                    element={
                                        <ProtectedRoute allowedRoles={['admin']}>
                                            <UserManagement />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route path="/inventory" element={<Inventory />} />
                                <Route path="/deliveries" element={<Deliveries />} />
                                <Route path="/shipped" element={<Shipped />} />
                                <Route path="/settings" element={
                                    <ProtectedRoute allowedRoles={['admin']}>
                                        <SettingsPage />
                                    </ProtectedRoute>
                                } />
                            </Route>

                            {/* Default redirect */}
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                    </Suspense>
                </Router>
            </SettingsProvider>
        </AuthProvider>
    );
}

export default App;
