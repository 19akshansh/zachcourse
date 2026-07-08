import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const { t } = useTranslation("common");

  if (totalPages <= 1) return null;

  const pages = [];
  const showPages = 5;

  let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
  let endPage = Math.min(totalPages, startPage + showPages - 1);

  if (endPage - startPage + 1 < showPages) {
    startPage = Math.max(1, endPage - showPages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between sm:justify-center gap-2 mt-6 font-sans">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label={t("previousPage", { defaultValue: "Previous Page" })}
        className="p-2 rounded-xl border border-[#2A2443] bg-[#121021] text-[#CECADF] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1A172E] transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="hidden sm:flex items-center gap-1">
        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="w-10 h-10 rounded-xl border border-[#2A2443] bg-[#121021] text-[#CECADF] hover:bg-[#1A172E] transition-colors flex items-center justify-center font-medium"
            >
              1
            </button>
            {startPage > 2 && <span className="text-[#8E88AB] px-2">...</span>}
          </>
        )}

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center font-medium transition-colors ${
              currentPage === page
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "border-[#2A2443] bg-[#121021] text-[#CECADF] hover:bg-[#1A172E]"
            }`}
          >
            {page}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-[#8E88AB] px-2">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="w-10 h-10 rounded-xl border border-[#2A2443] bg-[#121021] text-[#CECADF] hover:bg-[#1A172E] transition-colors flex items-center justify-center font-medium"
            >
              {totalPages}
            </button>
          </>
        )}
      </div>

      <div className="sm:hidden text-sm text-[#8E88AB] font-medium">
        {t("pageOf", { defaultValue: "Page {{current}} of {{total}}", current: currentPage, total: totalPages })}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label={t("nextPage", { defaultValue: "Next Page" })}
        className="p-2 rounded-xl border border-[#2A2443] bg-[#121021] text-[#CECADF] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1A172E] transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};
