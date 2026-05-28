export default function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center min-h-96">
      <div className="border-2 border-dashed border-gray-300 rounded-2xl p-16 flex flex-col items-center justify-center bg-white max-w-lg w-full">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
            <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
            <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
            <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-3 text-right">
          מערכות השעות שלך יופיעו כאן
        </h2>
        <p className="text-sm text-gray-500 text-right max-w-sm mb-6">
          שוחח עם Smart Schedule בצ׳אט כדי לקבל עד 3 מערכות שעות אופטימליות שמתאמות לצרכים שלך
        </p>
        <span className="text-[#d9472b] text-sm font-medium cursor-pointer hover:underline flex items-center gap-1">
          ← התחל בצ׳אט
        </span>
      </div>
    </div>
  )
}
