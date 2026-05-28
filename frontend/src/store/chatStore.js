import { create } from 'zustand'

const useChatStore = create((set) => ({
  messages: [],
  isTyping: false,
  courseCount: 80,
  pendingSchedule: null,

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setTyping: (isTyping) => set({ isTyping }),
  setCourseCount: (courseCount) => set({ courseCount }),
  setPendingSchedule: (pendingSchedule) => set({ pendingSchedule }),
}))

export default useChatStore
