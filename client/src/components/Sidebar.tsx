import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    HiOutlineHome,
    HiOutlineUsers,
    HiOutlineUserGroup,
    HiOutlineClipboardList,
    HiOutlinePlusCircle,
    HiOutlineDocumentText,
    HiOutlineCreditCard,
    HiOutlineChartBar,
    HiOutlineCog,
    HiOutlineLogout,
    HiOutlineX,
    HiOutlineReceiptRefund,
    HiOutlineUpload,
    HiOutlineClipboardCheck,
} from 'react-icons/hi';

import { HiOutlineCube, HiOutlineTruck } from 'react-icons/hi2';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Menu items filtered by role
    const menuItems = [
        {
            label: 'Dashboard',
            icon: HiOutlineHome,
            path: '/dashboard',
            roles: ['admin', 'manager', 'cashier', 'staff'],
        },
        {
            label: 'New Order',
            icon: HiOutlinePlusCircle,
            path: '/orders/new',
            roles: ['admin', 'manager', 'cashier'],
        },
        {
            label: 'Orders',
            icon: HiOutlineClipboardList,
            path: '/orders',
            roles: ['admin', 'manager', 'cashier', 'staff'],
        },
        {
            label: 'Customers',
            icon: HiOutlineUserGroup,
            path: '/customers',
            roles: ['admin', 'manager', 'cashier'],
        },
        {
            label: 'Invoices',
            icon: HiOutlineDocumentText,
            path: '/invoices',
            roles: ['admin', 'manager', 'cashier'],
        },
        {
            label: 'Invoice Approval',
            icon: HiOutlineClipboardCheck,
            path: '/invoices/approval',
            roles: ['admin', 'manager', 'cashier'],
        },
        {
            label: 'Migrate Invoices',
            icon: HiOutlineUpload,
            path: '/invoices?tab=migrated',
            roles: ['admin', 'manager', 'cashier'],
        },
        {
            label: 'Payments',
            icon: HiOutlineCreditCard,
            path: '/payments',
            roles: ['admin', 'manager', 'cashier'],
        },
        {
            label: 'Reports',
            icon: HiOutlineChartBar,
            path: '/reports',
            roles: ['admin', 'manager'],
        },
        {
            label: 'Refund Analytics',
            icon: HiOutlineReceiptRefund,
            path: '/refunds/analytics',
            roles: ['admin', 'manager'],
        },
        {
            label: 'Inventory',
            icon: HiOutlineCube,
            path: '/inventory',
            roles: ['admin', 'manager'],
        },
        {
            label: 'Deliveries',
            icon: HiOutlineTruck,
            path: '/deliveries',
            roles: ['admin', 'manager', 'staff'],
        },
        {
            label: 'Shipped',
            icon: HiOutlineTruck,
            path: '/shipped',
            roles: ['admin', 'manager', 'cashier', 'staff'],
        },
        {
            label: 'User Management',
            icon: HiOutlineUsers,
            path: '/users',
            roles: ['admin'],
        },
        {
            label: 'Settings',
            icon: HiOutlineCog,
            path: '/settings',
            roles: ['admin'],
        },
    ];

    const filteredMenu = menuItems.filter(
        (item) => user && item.roles.includes(user.role)
    );

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                ></div>
            )}

            <aside
                className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-32 h-9 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                            <img src="/logo.jpeg" alt="Peninsula Laundries Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-900 leading-none">Peninsula Laundries</h1>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Laundry POS</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="lg:hidden text-slate-500 hover:text-slate-900">
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                {/* User info */}
                <div className="px-5 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto h-[calc(100%-200px)]">
                    {filteredMenu.map((item) => {
                        const isActive = item.path.includes('?')
                            ? location.pathname + location.search === item.path
                            : location.pathname === item.path && !location.search.includes('tab=migrated');
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                className={
                                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive
                                        ? 'bg-cyan-50 text-cyan-600 border border-cyan-200'
                                        : 'text-slate-500 hover:text-slate-900 hover:bg-white'
                                    }`
                                }
                            >
                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                <span>{item.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-all duration-200"
                    >
                        <HiOutlineLogout className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
