import { X } from "lucide-react"
import { Button } from "./Button"

export function Drawer({ isOpen, onClose, title, children, footer, position = "right", className = "w-[400px]" }: any) {
  if (!isOpen) return null;
  
  const positionClasses = {
    right: "inset-y-0 right-0 animate-in slide-in-from-right",
    bottom: "inset-x-0 bottom-0 animate-in slide-in-from-bottom rounded-t-xl max-h-[90vh]",
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm">
      <div className={`absolute bg-white shadow-2xl flex flex-col duration-300 ${positionClasses[position as keyof typeof positionClasses]} ${className}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-gray-50/50">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-400 hover:text-gray-600 -mr-2">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
