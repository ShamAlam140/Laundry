import { HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    itemsPerPage?: number;
}

const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }: PaginationProps) => {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                pages.push(currentPage - 1);
                pages.push(currentPage);
                pages.push(currentPage + 1);
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return pages;
    };

    const startItem = (currentPage - 1) * (itemsPerPage || 20) + 1;
    const endItem = Math.min(currentPage * (itemsPerPage || 20), totalItems || 0);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 bg-white">
            {totalItems !== undefined && (
                <div className="text-sm text-slate-600">
                    Showing <span className="font-medium text-slate-900">{startItem}</span> to{' '}
                    <span className="font-medium text-slate-900">{endItem}</span> of{' '}
                    <span className="font-medium text-slate-900">{totalItems}</span> results
                </div>
            )}

            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <HiOutlineChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Previous</span>
                </button>

                <div className="flex items-center gap-1">
                    {getPageNumbers().map((page, index) => (
                        typeof page === 'number' ? (
                            <button
                                key={index}
                                onClick={() => onPageChange(page)}
                                className={`min-w-[40px] h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                                    currentPage === page
                                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                {page}
                            </button>
                        ) : (
                            <span key={index} className="px-2 text-slate-400">
                                {page}
                            </span>
                        )
                    ))}
                </div>

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <span className="hidden sm:inline">Next</span>
                    <HiOutlineChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
