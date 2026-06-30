import { useState } from 'react';
import { HiOutlineUpload, HiOutlineX, HiOutlineDocumentText, HiOutlineDownload } from 'react-icons/hi';
import toast from 'react-hot-toast';
import api from '../../services/api';

interface BulkOrderImportProps {
    onClose: () => void;
    onSuccess: () => void;
}

const BulkOrderImport = ({ onClose, onSuccess }: BulkOrderImportProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [showFormat, setShowFormat] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
                setFile(selectedFile);
            } else {
                toast.error('Please select a CSV file');
            }
        }
    };

    const downloadSampleCSV = () => {
        const sampleData = `Customer Phone,Customer Name,Service Name,Service Quantity,Item Type,Item Name,Item Quantity,Item Price,Delivery Date,Discount %,Special Instructions
0412000000,John Doe,Hotel,2,Linen,Bedsheet,5,20,2026-05-25,0,Handle with care
0412000000,John Doe,1 Florre,1,Clothing,Towel,10,2,2026-05-25,0,
0413000000,Jane Smith,Hotel,3,,,,,2026-05-26,5,Express service needed`;

        const blob = new Blob([sampleData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bulk_order_sample.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Sample CSV downloaded!');
    };

    const handleImport = async () => {
        if (!file) {
            toast.error('Please select a CSV file');
            return;
        }

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/orders/bulk-import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success(`${res.data.data.successCount} orders created successfully!`);
            if (res.data.data.errors.length > 0) {
                toast.error(`${res.data.data.errors.length} orders failed. Check console for details.`);
                console.error('Import errors:', res.data.data.errors);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Import failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-fadeIn">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                            <HiOutlineUpload className="w-5 h-5 text-cyan-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Bulk Order Import</h2>
                            <p className="text-xs text-slate-500">Import multiple orders from CSV file</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Instructions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <HiOutlineDocumentText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-blue-900 mb-2">How to Import Orders</h3>
                                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                                    <li>Download the sample CSV file to see the correct format</li>
                                    <li>Fill in your order data following the same format</li>
                                    <li>Upload the CSV file and click Import</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    {/* Download Sample */}
                    <div>
                        <button
                            onClick={downloadSampleCSV}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors text-sm font-medium"
                        >
                            <HiOutlineDownload className="w-4 h-4" />
                            Download Sample CSV
                        </button>
                    </div>

                    {/* CSV Format Documentation */}
                    <div>
                        <button
                            onClick={() => setShowFormat(!showFormat)}
                            className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-cyan-600 transition-colors mb-3"
                        >
                            <span>{showFormat ? '▼' : '▶'}</span>
                            CSV Format Documentation
                        </button>

                        {showFormat && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Required Columns:</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                                <span className="text-cyan-600 font-semibold">Customer Phone</span>
                                                <p className="text-slate-600 mt-1">Customer's phone number (must exist in system)</p>
                                            </div>
                                            <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                                <span className="text-cyan-600 font-semibold">Customer Name</span>
                                                <p className="text-slate-600 mt-1">Customer's full name (for reference)</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Service Columns (Optional):</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                                <span className="text-emerald-600 font-semibold">Service Name</span>
                                                <p className="text-slate-600 mt-1">Name of service (e.g., "Hotel", "1 Florre")</p>
                                            </div>
                                            <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                                <span className="text-emerald-600 font-semibold">Service Quantity</span>
                                                <p className="text-slate-600 mt-1">Number of service items (e.g., 2, 5)</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Manual Item Columns (Optional):</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                                <span className="text-amber-600 font-semibold">Item Type</span>
                                                <p className="text-slate-600 mt-1">Clothing, Linen, Accessories, Special_Items</p>
                                            </div>
                                            <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                                <span className="text-amber-600 font-semibold">Item Name</span>
                                                <p className="text-slate-600 mt-1">Name of item (e.g., "Bedsheet", "Towel")</p>
                                            </div>
                                            <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                                <span className="text-amber-600 font-semibold">Item Quantity</span>
                                                <p className="text-slate-600 mt-1">Number of items (e.g., 10, 20)</p>
                                            </div>
                                            <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                                <span className="text-amber-600 font-semibold">Item Price</span>
                                                <p className="text-slate-600 mt-1">Price per item (e.g., 2.50, 20)</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Other Columns (Optional):</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                                <span className="text-purple-600 font-semibold">Delivery Date</span>
                                                <p className="text-slate-600 mt-1">Format: YYYY-MM-DD (e.g., 2026-05-25)</p>
                                            </div>
                                            <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                                <span className="text-purple-600 font-semibold">Discount %</span>
                                                <p className="text-slate-600 mt-1">Discount percentage (e.g., 5, 10)</p>
                                            </div>
                                            <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200 col-span-2">
                                                <span className="text-purple-600 font-semibold">Special Instructions</span>
                                                <p className="text-slate-600 mt-1">Any special handling notes</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <p className="text-xs text-amber-800">
                                        <strong>Note:</strong> Each row can have either services OR manual items OR both. 
                                        Multiple rows with same customer phone will be grouped into one order.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Upload CSV File</label>
                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-cyan-400 transition-colors">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                                id="csv-upload"
                            />
                            <label htmlFor="csv-upload" className="cursor-pointer">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                    <HiOutlineUpload className="w-8 h-8 text-slate-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-700 mb-1">
                                    {file ? file.name : 'Click to upload CSV file'}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {file ? `${(file.size / 1024).toFixed(2)} KB` : 'or drag and drop'}
                                </p>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!file || loading}
                        className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Importing...' : 'Import Orders'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkOrderImport;
