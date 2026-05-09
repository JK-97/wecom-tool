import * as ww from "@wecom/jssdk"
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ensureOpenDataReady } from "@/services/openDataService"

const ROOT_REF = "group-avatar-stack-root"
const AVATAR_SIZE = 40
const AVATAR_OVERLAP = 8

export type GroupAvatarStackMember = {
  key: string
  openID: string
  avatarType: "userAvatar" | "externalUserAvatar"
  displayInitial: string
}

type FrameData = {
  members: GroupAvatarStackMember[]
  fallbackInitial: string
  overflow: boolean
}

function stackWidth(memberCount: number, overflow: boolean): number {
  const visibleCount = Math.max(1, memberCount) + (overflow ? 1 : 0)
  return AVATAR_SIZE + Math.max(0, visibleCount - 1) * (AVATAR_SIZE - AVATAR_OVERLAP)
}

function buildTemplate(): string {
  return `
<view class="group-avatar-stack" ref="${ROOT_REF}">
  <block wx:if="{{data.members.length}}">
    <block wx:for="{{data.members}}" wx:for-item="member" wx:key="key">
      <block wx:if="{{member.openID}}">
        <ww-open-data class="group-avatar-stack-item" type="{{member.avatarType}}" openid="{{member.openID}}"></ww-open-data>
      </block>
      <block wx:else>
        <view class="group-avatar-stack-item group-avatar-stack-item--fallback">{{member.displayInitial}}</view>
      </block>
    </block>
  </block>
  <block wx:else>
    <view class="group-avatar-stack-item group-avatar-stack-item--fallback">{{data.fallbackInitial}}</view>
  </block>
  <block wx:if="{{data.overflow}}">
    <view class="group-avatar-stack-more">...</view>
  </block>
</view>
`
}

function buildStyle(): string {
  return `
.group-avatar-stack {
  display: flex;
  align-items: center;
  height: ${AVATAR_SIZE}px;
}

.group-avatar-stack-item,
.group-avatar-stack-more {
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${AVATAR_SIZE}px;
  height: ${AVATAR_SIZE}px;
  border: 2px solid #ffffff;
  border-radius: 9999px;
  box-sizing: border-box;
  overflow: hidden;
  background: #f3f4f6;
}

.group-avatar-stack-item + .group-avatar-stack-item,
.group-avatar-stack-more {
  margin-left: -${AVATAR_OVERLAP}px;
}

.group-avatar-stack-item--fallback {
  color: #5b6476;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.group-avatar-stack-more {
  color: #64748b;
  background: #f8fafc;
  font-size: 13px;
  font-weight: 700;
}
`
}

function syncFrameSize(instance: ww.OpenDataFrameInstance<FrameData>, width: number): void {
  const iframe = instance.el as HTMLIFrameElement
  iframe.setAttribute("scrolling", "no")
  iframe.style.display = "block"
  iframe.style.width = `${width}px`
  iframe.style.height = `${AVATAR_SIZE}px`
  iframe.style.maxWidth = "none"
  iframe.style.border = "none"
  iframe.style.overflow = "hidden"
  iframe.style.background = "transparent"
}

function fallbackStack(data: FrameData, width: number) {
  const members = data.members.length > 0
    ? data.members
    : [{ key: "fallback", openID: "", avatarType: "userAvatar" as const, displayInitial: data.fallbackInitial }]
  return (
    <span className="flex h-10 items-center" style={{ width }}>
      {members.map((member) => (
        <span
          key={member.key}
        className="-ml-2 first:ml-0 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gray-100 text-sm font-bold text-gray-500"
      >
          {member.displayInitial || "?"}
        </span>
      ))}
      {data.overflow ? (
        <span className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-50 text-sm font-bold text-slate-500">
          ...
        </span>
      ) : null}
    </span>
  )
}

export function GroupAvatarStackOpenDataFrame({
  members,
  overflow,
  fallbackInitial,
  className,
}: {
  members: GroupAvatarStackMember[]
  overflow?: boolean
  fallbackInitial?: string
  className?: string
}) {
  const hostRef = useRef<HTMLSpanElement | null>(null)
  const instanceRef = useRef<ww.OpenDataFrameInstance<FrameData> | null>(null)
  const [ready, setReady] = useState(false)
  const data = useMemo<FrameData>(
    () => ({
      members: members.slice(0, 3),
      fallbackInitial: (fallbackInitial || "群").trim().slice(0, 1) || "群",
      overflow: overflow === true,
    }),
    [fallbackInitial, members, overflow],
  )
  const width = stackWidth(data.members.length, data.overflow)

  // Keep the title avatar stack in one official OpenDataFrame. This matches
  // the list rendering model and avoids creating one verification session per
  // avatar when users enter group detail pages.
  useEffect(() => {
    let cancelled = false

    const dispose = () => {
      instanceRef.current?.dispose()
      instanceRef.current = null
      hostRef.current?.replaceChildren()
    }

    const mount = async () => {
      const host = hostRef.current
      if (!host) return
      setReady(false)
      dispose()
      const runtime = await ensureOpenDataReady()
      if (cancelled || !runtime.canUseOpenData || typeof ww.createOpenDataFrameFactory !== "function") {
        return
      }
      const factory = ww.createOpenDataFrameFactory({
        handleError() {
          if (cancelled) return
          setReady(false)
        },
      })
      instanceRef.current = factory.createOpenDataFrame({
        el: host,
        data,
        template: buildTemplate(),
        style: buildStyle(),
        handleMounted() {
          if (cancelled || !instanceRef.current) return
          syncFrameSize(instanceRef.current, width)
          setReady(true)
        },
        handleUpdated() {
          if (cancelled || !instanceRef.current) return
          syncFrameSize(instanceRef.current, width)
          setReady(true)
        },
        handleError() {
          if (cancelled) return
          setReady(false)
        },
      })
      if (instanceRef.current) {
        syncFrameSize(instanceRef.current, width)
      }
    }

    void mount()

    return () => {
      cancelled = true
      dispose()
    }
  }, [data, width])

  return (
    <span className={cn("relative inline-flex h-10 shrink-0", className)} style={{ width }}>
      {!ready ? fallbackStack(data, width) : null}
      <span
        ref={hostRef}
        className={cn("absolute inset-0 block overflow-hidden", ready ? "opacity-100" : "pointer-events-none opacity-0")}
        style={{ width, height: AVATAR_SIZE }}
      />
    </span>
  )
}
