import { X } from "lucide-react"
import { Button } from "./Button"

export function Dialog({ isOpen, onClose, title, children, footer, className = "max-w-md" }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${className} overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-full`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-400 hover:text-gray-600 -mr-2">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-5 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
