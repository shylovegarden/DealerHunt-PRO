import { TopBar } from '@/components/layout/TopBar'
import { Sidebar } from '@/components/Sidebar'
import { BottomNav } from '@/components/BottomNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-[#07070A] text-[#FAFAFA]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 pb-16 md:pb-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
