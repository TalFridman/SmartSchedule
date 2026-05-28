export default function ChatWarningCard({ text }) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800 leading-relaxed whitespace-pre-wrap">
      ⚠️ {text}
    </div>
  )
}
