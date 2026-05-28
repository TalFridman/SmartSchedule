import { create } from 'zustand'

const useScheduleStore = create((set) => ({
  blocks: [],
  schedules: [],
  resultCount: 0,
  loading: false,
  error: null,

  setBlocks: (blocks) => set({ blocks }),
  setSchedules: (schedules) => set({ schedules }),
  setResultCount: (resultCount) => set({ resultCount }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))

export default useScheduleStore
