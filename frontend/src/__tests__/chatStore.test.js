import { describe, it, expect, beforeEach } from 'vitest'
import useChatStore from '../store/chatStore'

const initialState = {
  messages: [],
  isTyping: false,
  courseCount: 80,
}

beforeEach(() => {
  useChatStore.setState(initialState)
})

describe('chatStore — initial state', () => {
  it('has correct initial values', () => {
    const state = useChatStore.getState()
    expect(state.messages).toEqual([])
    expect(state.isTyping).toBe(false)
    expect(state.courseCount).toBe(80)
  })
})

describe('chatStore — addMessage', () => {
  it('appends a message without mutating the previous array', () => {
    const before = useChatStore.getState().messages
    const msg = { id: '1', role: 'user', content: 'שלום', type: 'text', timestamp: Date.now() }
    useChatStore.getState().addMessage(msg)
    const after = useChatStore.getState().messages
    expect(after).toHaveLength(1)
    expect(after[0]).toEqual(msg)
    expect(after).not.toBe(before)
  })

  it('maintains correct order after two addMessage calls', () => {
    const msg1 = { id: '1', role: 'user', content: 'ראשון', type: 'text', timestamp: 1 }
    const msg2 = { id: '2', role: 'assistant', content: 'שני', type: 'text', timestamp: 2 }
    useChatStore.getState().addMessage(msg1)
    useChatStore.getState().addMessage(msg2)
    const messages = useChatStore.getState().messages
    expect(messages).toHaveLength(2)
    expect(messages[0].id).toBe('1')
    expect(messages[1].id).toBe('2')
  })
})

describe('chatStore — setTyping', () => {
  it('toggles isTyping', () => {
    useChatStore.getState().setTyping(true)
    expect(useChatStore.getState().isTyping).toBe(true)
    useChatStore.getState().setTyping(false)
    expect(useChatStore.getState().isTyping).toBe(false)
  })
})
