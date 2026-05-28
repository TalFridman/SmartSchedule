import { describe, it, expect, beforeEach } from 'vitest'
import useScheduleStore from '../store/scheduleStore'

const initialState = {
  blocks: [],
  schedules: [],
  resultCount: 0,
  loading: false,
  error: null,
}

beforeEach(() => {
  useScheduleStore.setState(initialState)
})

describe('scheduleStore — initial state', () => {
  it('has correct initial values', () => {
    const state = useScheduleStore.getState()
    expect(state.blocks).toEqual([])
    expect(state.schedules).toEqual([])
    expect(state.resultCount).toBe(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })
})

describe('scheduleStore — setBlocks', () => {
  it('updates blocks and creates a new array reference', () => {
    const newBlocks = [{ id: '1', course_code: 'CS101' }]
    useScheduleStore.getState().setBlocks(newBlocks)
    const state = useScheduleStore.getState()
    expect(state.blocks).toEqual(newBlocks)
    expect(state.blocks).not.toBe(initialState.blocks)
  })
})

describe('scheduleStore — setSchedules', () => {
  it('updates schedules and creates a new array reference', () => {
    const newSchedules = [{ id: 's1', option_number: 1, is_recommended: true, session_count: 3, blocks: [] }]
    useScheduleStore.getState().setSchedules(newSchedules)
    const state = useScheduleStore.getState()
    expect(state.schedules).toEqual(newSchedules)
    expect(state.schedules).not.toBe(initialState.schedules)
  })
})

describe('scheduleStore — setResultCount', () => {
  it('updates resultCount to the given number', () => {
    useScheduleStore.getState().setResultCount(5)
    expect(useScheduleStore.getState().resultCount).toBe(5)
  })
})

describe('scheduleStore — setLoading and setError', () => {
  it('setLoading toggles loading', () => {
    useScheduleStore.getState().setLoading(true)
    expect(useScheduleStore.getState().loading).toBe(true)
    useScheduleStore.getState().setLoading(false)
    expect(useScheduleStore.getState().loading).toBe(false)
  })

  it('setError stores the error message', () => {
    useScheduleStore.getState().setError('שגיאה')
    expect(useScheduleStore.getState().error).toBe('שגיאה')
  })
})
