import { useRef, useEffect } from 'react'
import useChatStore from '../store/chatStore'
import ChatMessage from './ChatMessage'

export default function ChatMessages() {
  const { messages, isTyping } = useChatStore()
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {isTyping && (
        <div className="bg-gray-50 rounded-2xl rounded-se-sm px-4 py-3 text-sm text-gray-400 self-start">
          <span className="animate-pulse">מקליד...</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
