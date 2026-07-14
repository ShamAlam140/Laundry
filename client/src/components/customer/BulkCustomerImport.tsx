import { useState } from 'react';
import { HiOutlineUpload, HiOutlineX, HiOutlineDocumentText, HiOutlineDownload } from 'react-icons/hi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import * as XLSX from 'xlsx';

interface BulkCustomerImportProps {
    onClose: () => void;
    onSuccess: () => void;
}

const BulkCustomerImport = ({ onClose, onSuccess }: BulkCustomerImportProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [showFormat, setShowFormat] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const name = selectedFile.name.toLowerCase();
            if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
                setFile(selectedFile);
            } else {
                toast.error('Please select a CSV or Excel file');
            }
        }
    };

    const downloadSampleCSV = () => {
        const headers = 'Name,Phone,Email,Address,Type,Premium,Credit Days,Notification Frequency';
        const row1 = 'John Smith,0412345678,john.smith@gmail.com,123 Main St Brisbane QLD,walk-in,false,0,none';
        const row2 = 'Acme Corp,0412345679,billing@acme.com,456 Industrial Rd Gold Coast,corporate,true,30,1_week';
        const sampleData = `${headers}\n${row1}\n${row2}`;

        const blob = new Blob([sampleData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bulk_customer_sample.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Sample CSV downloaded!');
    };

    const handleImport = async () => {
        if (!file) {
            toast.error('Please select a CSV or Excel file');
            return;
        }

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawData = XLSX.utils.sheet_to_json(ws);

                if (rawData.length === 0) {
                    toast.error('The file is empty.');
                    setLoading(false);
                    return;
                }

                const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/\s+/g, '');

                const customers = rawData.map((row: any) => {
                    const mapped: any = {};
                    for (const key of Object.keys(row)) {
                        mapped[normalizeKey(key)] = row[key];
                    }
                    return {
                        name: mapped['name']?.toString()?.trim() || '',
                        phone: mapped['phone']?.toString()?.trim() || '',
                        email: mapped['email']?.toString()?.trim() || '',
                        address: mapped['address']?.toString()?.trim() || '',
                        customerType: mapped['type']?.toString()?.trim()?.toLowerCase() || 'walk-in',
                        isPremium: String(mapped['premium'] || '').trim().toLowerCase() === 'true',
                        creditDays: parseInt(mapped['creditdays']) || 0,
                        notificationFrequency: mapped['notificationfrequency']?.toString()?.trim()?.toLowerCase() || 'none',
                    };
                });

                // Batch upload in chunks of 500
                const BATCH_SIZE = 500;
                let successTotal = 0;
                let errorTotal = 0;
                const allErrors: any[] = [];

                for (let i = 0; i < customers.length; i += BATCH_SIZE) {
                    const batch = customers.slice(i, i + BATCH_SIZE);
                    const res = await api.post('/customers/bulk-import', { customers: batch });
                    successTotal += res.data.data.successCount || 0;
                    errorTotal += res.data.data.errorCount || 0;
                    if (res.data.data.errors && res.data.data.errors.length > 0) {
                        allErrors.push(...res.data.data.errors);
                    }
                }

                toast.success(`${successTotal} customers registered successfully!`);
                if (errorTotal > 0) {
                    toast.error(`${errorTotal} customer records failed. See console log.`);
                    console.error('Customer Import errors:', allErrors);
                }

                onSuccess();
                onClose();
            } catch (err: any) {
                toast.error(err.response?.data?.message || err.message || 'Import failed');
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
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
                            <h2 className="text-lg font-bold text-slate-900">Bulk Customer Import</h2>
                            <p className="text-xs text-slate-500">Import multiple customers from a CSV file</p>
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
                                <h3 className="text-sm font-semibold text-blue-900 mb-2">How to Import Customers</h3>
                                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                                    <li>Download the sample CSV file template</li>
                                    <li>Fill in customer details following the exact headers</li>
                                    <li>Upload the CSV and click Import</li>
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
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                            <span className="text-cyan-600 font-semibold">Name</span>
                                            <p className="text-slate-600 mt-1">Full name of the customer</p>
                                        </div>
                                        <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                            <span className="text-cyan-600 font-semibold">Phone</span>
                                            <p className="text-slate-600 mt-1">Unique contact phone number</p>
                                        </div>
                                        <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                            <span className="text-cyan-600 font-semibold">Email</span>
                                            <p className="text-slate-600 mt-1">Unique email address (Mandatory)</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Optional Columns:</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                            <span className="text-slate-700 font-semibold">Address</span>
                                            <p className="text-slate-600 mt-1">Physical address for delivery pickups</p>
                                        </div>
                                        <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                            <span className="text-slate-700 font-semibold">Type</span>
                                            <p className="text-slate-600 mt-1">"walk-in" (default) or "corporate"</p>
                                        </div>
                                        <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                            <span className="text-slate-700 font-semibold">Premium</span>
                                            <p className="text-slate-600 mt-1">"true" or "false" (default)</p>
                                        </div>
                                        <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                            <span className="text-slate-700 font-semibold">Credit Days</span>
                                            <p className="text-slate-600 mt-1">Number of credit terms days (default 0)</p>
                                        </div>
                                        <div className="font-mono text-xs bg-white px-3 py-2 rounded border border-slate-200 sm:col-span-2">
                                            <span className="text-slate-700 font-semibold">Notification Frequency</span>
                                            <p className="text-slate-600 mt-1">none (default), 1_day, 3_days, 5_days, 1_week, 15_days, 1_month</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Upload CSV or Excel File</label>
                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-cyan-400 transition-colors">
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                                id="customer-csv-upload"
                            />
                            <label htmlFor="customer-csv-upload" className="cursor-pointer">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                    <HiOutlineUpload className="w-8 h-8 text-slate-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-700 mb-1">
                                    {file ? file.name : 'Click to upload CSV or Excel file'}
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
                        {loading ? 'Importing...' : 'Import Customers'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkCustomerImport;
