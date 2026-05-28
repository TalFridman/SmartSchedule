import ChatWarningCard from './ChatWarningCard'

export default function ChatMessage({ message }) {
  if (message.role === 'user') {
    return (
      <div className="bg-[#1e3569] text-white rounded-2xl rounded-ss-sm px-4 py-3 text-sm self-end max-w-[85%] text-right">
        {message.content}
      </div>
    )
  }

  if (message.type === 'warning') {
    return (
      <div className="self-start max-w-[90%]">
        <ChatWarningCard text={message.content} />
      </div>
    )
  }

  return (
    <div className="bg-gray-50 rounded-2xl rounded-se-sm px-4 py-3 text-sm text-gray-800 self-start max-w-[90%] text-right whitespace-pre-wrap">
      {message.content}
    </div>
  )
}
