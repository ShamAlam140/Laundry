import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import type { IUser } from '../types';
import {
    HiOutlineSearch,
    HiOutlinePlusCircle,
    HiOutlinePencil,
    HiOutlineX,
    HiOutlineKey,
} from 'react-icons/hi';

const roleColors: Record<string, string> = {
    admin: 'bg-red-50 text-red-600 border-red-200',
    manager: 'bg-blue-50 text-blue-600 border-blue-200',
    cashier: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    staff: 'bg-white0/15 text-slate-500 border-slate-500/20',
};

const UserManagement = () => {
    const [users, setUsers] = useState<IUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<IUser | null>(null);
    const [resetPasswordUser, setResetPasswordUser] = useState<IUser | null>(null);
    const [resetPassword, setResetPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [form, setForm] = useState({
        name: '', username: '', email: '', phone: '', password: '', role: 'staff',
    });

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const params: any = {};
            if (search) params.search = search;
            const res = await api.get('/users', { params });
            setUsers(res.data.data);
        } catch {
            toast.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);
    useEffect(() => {
        const t = setTimeout(() => fetchUsers(), 400);
        return () => clearTimeout(t);
    }, [search]);

    const openCreate = () => {
        setEditingUser(null);
        setForm({ name: '', username: '', email: '', phone: '', password: '', role: 'staff' });
        setShowModal(true);
    };

    const openEdit = (u: IUser) => {
        setEditingUser(u);
        setForm({ name: u.name, username: u.username, email: u.email, phone: u.phone || '', password: '', role: u.role });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUser) {
                const { password, username, ...updateData } = form;
                await api.put(`/users/${editingUser._id}`, updateData);
                toast.success('User updated');
            } else {
                await api.post('/users', form);
                toast.success('User created');
            }
            setShowModal(false);
            fetchUsers();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed');
        }
    };

    const toggleActive = async (u: IUser) => {
        try {
            await api.put(`/users/${u._id}`, { isActive: !u.isActive });
            toast.success(`User ${u.isActive ? 'deactivated' : 'activated'}`);
            fetchUsers();
        } catch {
            toast.error('Failed');
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetPassword || resetPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        setResetLoading(true);
        try {
            const res = await api.patch(`/users/${resetPasswordUser?._id}/reset-password`, { password: resetPassword });
            toast.success(res.data.message);
            setResetPasswordUser(null);
            setResetPassword('');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to reset password');
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
                    <p className="text-sm text-slate-500 mt-1">{users.length} users</p>
                </div>
                <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-md shadow-cyan-500/30">
                    <HiOutlinePlusCircle className="w-5 h-5" /> Add User
                </button>
            </div>

            <div className="relative max-w-md">
                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500" />
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : users.map((u) => (
                    <div key={u._id} className={`rounded-2xl border bg-white p-5 transition-all ${u.isActive ? 'border-slate-200' : 'border-red-500/20 opacity-60'}`}>
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
                                    {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-slate-900 font-medium">{u.name}</p>
                                    <p className="text-xs text-slate-500">@{u.username}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => { setResetPasswordUser(u); setResetPassword(''); }} className="p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50" title="Reset Password">
                                    <HiOutlineKey className="w-4 h-4" />
                                </button>
                                <button onClick={() => openEdit(u)} className="p-2 rounded-lg text-slate-500 hover:text-cyan-600 hover:bg-white">
                                    <HiOutlinePencil className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1 text-sm text-slate-500 mb-3">
                            <p>{u.email}</p>
                            {u.phone && <p>{u.phone}</p>}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${roleColors[u.role]}`}>{u.role}</span>
                            <button onClick={() => toggleActive(u)}
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${u.isActive
                                    ? 'bg-emerald-500/15 text-emerald-400 hover:bg-red-500/15 hover:text-red-400'
                                    : 'bg-red-500/15 text-red-400 hover:bg-emerald-500/15 hover:text-emerald-400'
                                    }`}>
                                {u.isActive ? 'Active' : 'Inactive'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md mx-4 bg-white border border-slate-200 rounded-2xl p-6 animate-fadeIn">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-slate-900">{editingUser ? 'Edit User' : 'Create User'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Name *</label>
                                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                            </div>
                            {!editingUser && (
                                <div>
                                    <label className="block text-sm text-slate-600 mb-1">Username *</label>
                                    <input type="text" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Email *</label>
                                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Phone</label>
                                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                            </div>
                            {!editingUser && (
                                <div>
                                    <label className="block text-sm text-slate-600 mb-1">Password *</label>
                                    <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Role</label>
                                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer">
                                    <option value="staff">Staff</option>
                                    <option value="cashier">Cashier</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-white">Cancel</button>
                                <button type="submit"
                                    className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all">
                                    {editingUser ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetPasswordUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm mx-4 bg-white border border-slate-200 rounded-2xl p-6 animate-fadeIn">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-slate-900">Reset Password</h3>
                            <button onClick={() => setResetPasswordUser(null)} className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                {resetPasswordUser.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-900">{resetPasswordUser.name}</p>
                                <p className="text-xs text-slate-500 capitalize">{resetPasswordUser.role}</p>
                            </div>
                        </div>
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">New Password *</label>
                                <input type="password" required minLength={6} value={resetPassword}
                                    onChange={(e) => setResetPassword(e.target.value)}
                                    placeholder="Enter new password (min 6 chars)"
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setResetPasswordUser(null)}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-white">Cancel</button>
                                <button type="submit" disabled={resetLoading}
                                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold rounded-xl hover:from-amber-400 hover:to-orange-500 transition-all disabled:opacity-50">
                                    {resetLoading ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
