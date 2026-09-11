import { Loader2 } from 'lucide-react'

export default function SysControlLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
        <span className="text-zinc-400 text-sm">Loading system control...</span>
      </div>
    </div>
  )
}
