import * as ww from "@wecom/jssdk"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Avatar, type AvatarProps } from "@/components/ui/Avatar"
import { cn } from "@/lib/utils"
import {
  ensureOpenDataReady,
  type OpenDataRuntime,
} from "@/services/openDataService"

const AVATAR_ROOT_REF = "wecom-open-data-avatar-root"

// 页面级企微身份头像展示组件。
//
// 边界说明：
// 1. 这是“身份 / Profile 展示”组件，不是“会话展示组件”。
// 2. 它使用的是通用 OpenDataFrame 容器能力，但模板内只承载
//    <ww-open-data type="userAvatar|externalUserAvatar">。
// 3. 会话展示组件的边界是 ww-open-message + message-id/secret-key；
//    本文件没有这些消息语义，因此不能归类为会话展示组件。
// 4. 这里的 Profile 指成员 / 外部联系人身份展示，不承载会话消息内容。
// 5. 保留 frame 外壳的原因仅是头像场景的渲染稳定性。
type WecomProfileAvatarOpenDataFrameProps = {
  openID?: string
  type?: "userAvatar" | "externalUserAvatar"
  corpId?: string
  fallback?: string
  fallbackSrc?: string
  className?: string
  hintClassName?: string
  showHint?: boolean
  alt?: string
  size?: AvatarProps["size"]
  enabled?: boolean
  lazy?: boolean
}

type AvatarFrameData = {
  openid: string
}

function readFallback(openID: string, fallback?: string): string {
  const text = (fallback || "").trim()
  if (text) return text
  return (openID || "").trim().slice(0, 1).toUpperCase() || "?"
}

function avatarPixelSize(size: AvatarProps["size"]): number {
  switch (size) {
    case "xs":
      return 24
    case "sm":
      return 32
    case "lg":
      return 48
    case "xl":
      return 64
    default:
      return 40
  }
}

function avatarSizeClass(size: AvatarProps["size"]): string {
  switch (size) {
    case "xs":
      return "h-6 w-6"
    case "sm":
      return "h-8 w-8"
    case "lg":
      return "h-12 w-12"
    case "xl":
      return "h-16 w-16"
    default:
      return "h-10 w-10"
  }
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function buildProfileAvatarOpenDataTemplate(
  type: "userAvatar" | "externalUserAvatar",
  openid: string,
): string {
  return `
<view class="wecom-avatar-frame" ref="${AVATAR_ROOT_REF}">
  <ww-open-data class="wecom-avatar-node" type="${escapeAttr(type)}" openid="${escapeAttr(openid)}"></ww-open-data>
</view>
`
}

function buildProfileAvatarOpenDataStyle(width: number, height: number): string {
  return `
.wecom-avatar-frame {
  display: block;
  width: ${width}px;
  height: ${height}px;
  overflow: hidden;
  border-radius: 9999px;
  background: #f3f4f6;
}

.wecom-avatar-node {
  display: block;
  width: ${width}px;
  height: ${height}px;
  overflow: hidden;
  border-radius: 9999px;
}
`
}

function syncAvatarFrameSize(
  instance: ww.OpenDataFrameInstance<AvatarFrameData>,
  width: number,
  height: number,
): void {
  const iframe = instance.el as HTMLIFrameElement
  iframe.setAttribute("scrolling", "no")
  iframe.style.display = "block"
  iframe.style.width = `${width}px`
  iframe.style.height = `${height}px`
  iframe.style.maxWidth = "100%"
  iframe.style.border = "none"
  iframe.style.overflow = "hidden"
  iframe.style.background = "transparent"
}

function measureAvatarBox(
  shell: HTMLSpanElement,
  size: AvatarProps["size"],
): { width: number; height: number } {
  const fallbackSize = avatarPixelSize(size)
  const rect = shell.getBoundingClientRect()
  const width = Math.max(1, Math.ceil(rect.width || fallbackSize))
  const height = Math.max(1, Math.ceil(rect.height || fallbackSize))
  return { width, height }
}

export function WecomProfileAvatarOpenDataFrame({
  openID,
  type = "userAvatar",
  corpId,
  fallback,
  fallbackSrc,
  className,
  hintClassName,
  showHint = false,
  alt,
  size = "default",
  enabled = true,
  lazy = true,
}: WecomProfileAvatarOpenDataFrameProps) {
  const hostRef = useRef<HTMLSpanElement | null>(null)
  const shellRef = useRef<HTMLSpanElement | null>(null)
  const instanceRef = useRef<ww.OpenDataFrameInstance<AvatarFrameData> | null>(null)
  const [runtime, setRuntime] = useState<OpenDataRuntime | null>(null)
  const [inViewport, setInViewport] = useState(!lazy)
  const [frameReady, setFrameReady] = useState(false)
  const safeOpenID = (openID || "").trim()
  const safeCorpID = (corpId || "").trim()
  const fallbackText = useMemo(
    () => readFallback(safeOpenID, fallback),
    [fallback, safeOpenID],
  )
  const shouldBind = enabled && Boolean(safeOpenID) && (lazy ? inViewport : true)

  useLayoutEffect(() => {
    if (!lazy) {
      setInViewport(true)
      return
    }
    const shell = shellRef.current
    if (!shell || typeof IntersectionObserver === "undefined") {
      setInViewport(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        setInViewport(entry.isIntersecting || entry.intersectionRatio > 0)
      },
      {
        rootMargin: "160px 0px 160px 0px",
        threshold: 0.01,
      },
    )
    observer.observe(shell)
    return () => observer.disconnect()
  }, [lazy])

  useEffect(() => {
    let cancelled = false

    const dispose = () => {
      instanceRef.current?.dispose()
      instanceRef.current = null
      hostRef.current?.replaceChildren()
    }

    const mount = async () => {
      const host = hostRef.current
      const shell = shellRef.current
      if (!host || !shell || !shouldBind) {
        setFrameReady(false)
        if (!safeOpenID) setRuntime(null)
        return
      }

      setFrameReady(false)
      dispose()

      try {
        const nextRuntime = await ensureOpenDataReady()
        if (cancelled) return
        setRuntime(nextRuntime)
        if (!nextRuntime.canUseOpenData) return
        if (typeof ww.createOpenDataFrameFactory !== "function") return

        const { width, height } = measureAvatarBox(shell, size)
        const factory = ww.createOpenDataFrameFactory({
          handleError() {
            if (cancelled) return
            setFrameReady(false)
          },
        })
        instanceRef.current = factory.createOpenDataFrame({
          el: host,
          data: { openid: safeOpenID },
          template: buildProfileAvatarOpenDataTemplate(type, safeOpenID),
          style: buildProfileAvatarOpenDataStyle(width, height),
          handleMounted() {
            if (cancelled || !instanceRef.current) return
            syncAvatarFrameSize(instanceRef.current, width, height)
            setFrameReady(true)
          },
          handleUpdated() {
            if (cancelled || !instanceRef.current) return
            syncAvatarFrameSize(instanceRef.current, width, height)
            setFrameReady(true)
          },
          handleError() {
            if (cancelled) return
            setFrameReady(false)
          },
        })
        if (instanceRef.current) {
          syncAvatarFrameSize(instanceRef.current, width, height)
        }
      } catch {
        if (!cancelled) {
          setFrameReady(false)
        }
      }
    }

    void mount()
    return () => {
      cancelled = true
      dispose()
    }
  }, [safeOpenID, safeCorpID, size, type, shouldBind])

  return (
    <span className="inline-flex min-w-0 flex-col">
      <span
        ref={shellRef}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full bg-gray-100",
          avatarSizeClass(size),
          className,
        )}
        title={alt || runtime?.reason || fallbackText}
      >
        <Avatar
          src={(fallbackSrc || "").trim()}
          alt={alt}
          fallback={fallbackText}
          size={size}
          className={cn(
            "absolute inset-0 h-full w-full border-0",
            frameReady ? "opacity-0" : "opacity-100",
          )}
        />
        {safeOpenID && enabled ? (
          <span
            ref={hostRef}
            className={cn(
              "absolute inset-0 z-10 block overflow-hidden rounded-full bg-transparent",
              runtime?.canUseOpenData ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          />
        ) : null}
      </span>
      {showHint && runtime?.reason ? (
        <span className={hintClassName}>{runtime.reason}</span>
      ) : null}
    </span>
  )
}
