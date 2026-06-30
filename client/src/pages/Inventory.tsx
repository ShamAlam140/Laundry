import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
    HiOutlineSearch,
    HiOutlinePlusCircle,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineExclamationCircle,
} from 'react-icons/hi';

interface InventoryItem {
    _id: string;
    itemName: string;
    category: string;
    quantity: number;
    unit: string;
    threshold: number;
    isLowStock: boolean;
    lastRestocked?: string;
}

const categories = ['detergent', 'softener', 'packaging', 'chemical', 'other'];

const categoryColors: Record<string, string> = {
    detergent: 'bg-blue-50 text-blue-600 border-blue-200',
    softener: 'bg-purple-50 text-purple-600 border-purple-200',
    packaging: 'bg-amber-50 text-amber-600 border-amber-200',
    chemical: 'bg-red-50 text-red-600 border-red-200',
    other: 'bg-white0/15 text-slate-500 border-slate-500/20',
};

const Inventory = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [showLowOnly, setShowLowOnly] = useState(false);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [showRestock, setShowRestock] = useState<InventoryItem | null>(null);
    const [restockQty, setRestockQty] = useState(0);
    const [editItem, setEditItem] = useState<InventoryItem | null>(null);
    const [form, setForm] = useState({ itemName: '', category: 'other', quantity: 0, unit: 'pieces', threshold: 10 });

    const fetchItems = async () => {
        try {
            setLoading(true);
            const params: any = {};
            if (search) params.search = search;
            if (categoryFilter) params.category = categoryFilter;
            if (showLowOnly) params.lowStock = 'true';
            const res = await api.get('/inventory', { params });
            setItems(res.data.data);
            setLowStockCount(res.data.lowStockCount);
        } catch {
            toast.error('Failed to load inventory');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, [search, categoryFilter, showLowOnly]);

    const openCreate = () => {
        setEditItem(null);
        setForm({ itemName: '', category: 'other', quantity: 0, unit: 'pieces', threshold: 10 });
        setShowModal(true);
    };

    const openEdit = (item: InventoryItem) => {
        setEditItem(item);
        setForm({ itemName: item.itemName, category: item.category, quantity: item.quantity, unit: item.unit, threshold: item.threshold });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editItem) {
                await api.put(`/inventory/${editItem._id}`, form);
                toast.success('Item updated');
            } else {
                await api.post('/inventory', form);
                toast.success('Item added');
            }
            setShowModal(false);
            fetchItems();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed');
        }
    };

    const handleRestock = async () => {
        if (!showRestock || restockQty <= 0) return;
        try {
            await api.patch(`/inventory/${showRestock._id}/restock`, { quantity: restockQty });
            toast.success(`Restocked ${restockQty} ${showRestock.unit}`);
            setShowRestock(null);
            setRestockQty(0);
            fetchItems();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this inventory item?')) return;
        try {
            await api.delete(`/inventory/${id}`);
            toast.success('Item deleted');
            fetchItems();
        } catch {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
                    {lowStockCount > 0 && (
                        <p className="text-sm text-red-400 mt-1 flex items-center gap-1">
                            <HiOutlineExclamationCircle className="w-4 h-4" /> {lowStockCount} item{lowStockCount > 1 ? 's' : ''} low on stock
                        </p>
                    )}
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-md shadow-cyan-500/30">
                    <HiOutlinePlusCircle className="w-4 h-4" /> Add Item
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="text" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500" />
                </div>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-cyan-500">
                    <option value="">All Categories</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => setShowLowOnly(!showLowOnly)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${showLowOnly ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}>
                    ⚠️ Low Stock
                </button>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-sm">No items found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                                    <th className="px-5 py-3 text-left">Item</th>
                                    <th className="px-5 py-3 text-left">Category</th>
                                    <th className="px-5 py-3 text-center">Stock</th>
                                    <th className="px-5 py-3 text-center">Threshold</th>
                                    <th className="px-5 py-3 text-center">Status</th>
                                    <th className="px-5 py-3 text-left">Last Restocked</th>
                                    <th className="px-5 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item._id} className="border-b border-slate-200 hover:bg-white transition-colors">
                                        <td className="px-5 py-3.5 text-sm text-slate-900 font-medium">{item.itemName}</td>
                                        <td className="px-5 py-3.5">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${categoryColors[item.category] || ''}`}>
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <span className={`text-sm font-semibold ${item.isLowStock ? 'text-red-400' : 'text-slate-900'}`}>
                                                {item.quantity}
                                            </span>
                                            <span className="text-xs text-slate-500 ml-1">{item.unit}</span>
                                        </td>
                                        <td className="px-5 py-3.5 text-center text-sm text-slate-500">{item.threshold}</td>
                                        <td className="px-5 py-3.5 text-center">
                                            {item.isLowStock ? (
                                                <span className="px-2.5 py-1 bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium">Low Stock</span>
                                            ) : (
                                                <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium">In Stock</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-500">
                                            {item.lastRestocked ? new Date(item.lastRestocked).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => { setShowRestock(item); setRestockQty(0); }}
                                                    className="px-2.5 py-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors">
                                                    Restock
                                                </button>
                                                <button onClick={() => openEdit(item)}
                                                    className="p-1.5 text-slate-500 hover:text-cyan-600 transition-colors">
                                                    <HiOutlinePencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(item._id)}
                                                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md mx-4 bg-white border border-slate-200 rounded-2xl p-6 animate-fadeIn">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">{editItem ? 'Edit Item' : 'Add Inventory Item'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input type="text" required placeholder="Item Name" value={form.itemName}
                                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
                            <div className="grid grid-cols-2 gap-3">
                                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-cyan-500">
                                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-cyan-500">
                                    {['liters', 'kg', 'pieces', 'packs'].map((u) => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Quantity</label>
                                    <input type="number" required min={0} step="any" value={form.quantity}
                                        onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Low Stock Threshold</label>
                                    <input type="number" required min={0} step="any" value={form.threshold}
                                        onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-white">Cancel</button>
                                <button type="submit"
                                    className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500">
                                    {editItem ? 'Update' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Restock Modal */}
            {showRestock && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm mx-4 bg-white border border-slate-200 rounded-2xl p-6 animate-fadeIn">
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Restock: {showRestock.itemName}</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Current: <span className="text-slate-900 font-medium">{showRestock.quantity} {showRestock.unit}</span>
                        </p>
                        <div className="mb-4">
                            <label className="block text-xs text-slate-500 mb-1">Add Quantity ({showRestock.unit})</label>
                            <input type="number" min={0.01} step="any" value={restockQty || ''}
                                onChange={(e) => setRestockQty(Number(e.target.value))}
                                placeholder="Enter quantity to add"
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
                        </div>
                        {restockQty > 0 && (
                            <p className="text-sm text-emerald-400 mb-4">
                                New total: <span className="font-bold">{showRestock.quantity + restockQty} {showRestock.unit}</span>
                            </p>
                        )}
                        <div className="flex gap-3">
                            <button onClick={() => setShowRestock(null)}
                                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-white">Cancel</button>
                            <button onClick={handleRestock} disabled={restockQty <= 0}
                                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-slate-900 text-sm font-semibold rounded-xl hover:from-emerald-400 hover:to-green-500 disabled:opacity-50">
                                Restock
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
