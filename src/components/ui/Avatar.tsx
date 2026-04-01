import * as React from "react"
import { cn } from "@/lib/utils"

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback?: string
  size?: "xs" | "sm" | "default" | "lg" | "xl"
}

export function Avatar({ className, src, alt, fallback, size = "default", ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full bg-gray-100",
        {
          "h-6 w-6": size === "xs",
          "h-8 w-8": size === "sm",
          "h-10 w-10": size === "default",
          "h-12 w-12": size === "lg",
          "h-16 w-16": size === "xl",
        },
        className
      )}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="aspect-square h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-medium text-gray-500">
          {fallback}
        </span>
      )}
    </div>
  )
}
