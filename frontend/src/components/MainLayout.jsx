import AppHeader from './AppHeader'
import SchedulePanel from './SchedulePanel'
import ChatSidebar from './ChatSidebar'

export default function MainLayout() {
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <ChatSidebar />
        <SchedulePanel />
      </div>
    </div>
  )
}
