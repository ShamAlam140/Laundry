import { HiOutlineMenuAlt2, HiOutlineSearch } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

interface HeaderProps {
    onMenuClick: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
    const { user } = useAuth();

    return (
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-4 lg:px-6">
            {/* Left */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-colors"
                >
                    <HiOutlineMenuAlt2 className="w-5 h-5" />
                </button>

                {/* Search Bar */}
                <div className="hidden md:flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 w-72">
                    <HiOutlineSearch className="w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search orders, customers..."
                        className="bg-transparent text-sm text-slate-900 placeholder-slate-500 outline-none w-full"
                    />
                </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3">
                {/* Notifications */}
                <NotificationBell />

                {/* User */}
                <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden sm:block">
                        <p className="text-sm font-medium text-slate-900 leading-none">{user?.name}</p>
                        <p className="text-[11px] text-slate-500 capitalize">{user?.role}</p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
