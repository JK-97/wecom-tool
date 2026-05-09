import * as ww from "@wecom/jssdk"
import { useEffect, useMemo, useRef, useState } from "react"
import { ensureOpenDataReady } from "@/services/openDataService"

const ROOT_REF = "group-detail-members-root"

export type GroupDetailMemberOpenDataRow = {
  key: string
  openID: string
  userID: string
  displayName: string
  displayInitial: string
  typeLabel: string
  joinTime: string
  inviterUserID: string
  isExternal: boolean
}

type FrameData = {
  rows: GroupDetailMemberOpenDataRow[]
}

function buildTemplate(): string {
  return `
<view class="group-members" ref="${ROOT_REF}">
  <view class="group-members-header">
    <view class="group-members-col group-members-col--member">成员</view>
    <view class="group-members-col group-members-col--type">类型</view>
    <view class="group-members-col group-members-col--time">入群时间</view>
    <view class="group-members-col group-members-col--inviter">邀请人</view>
  </view>
  <block wx:for="{{data.rows}}" wx:key="key">
    <view class="group-members-row">
      <view class="group-members-col group-members-col--member">
        <view class="group-members-person">
          <block wx:if="{{item.openID}}">
            <block wx:if="{{item.isExternal}}">
              <ww-open-data class="group-members-avatar" type="externalUserAvatar" openid="{{item.openID}}"></ww-open-data>
            </block>
            <block wx:else>
              <ww-open-data class="group-members-avatar" type="userAvatar" openid="{{item.openID}}"></ww-open-data>
            </block>
          </block>
          <block wx:else>
            <view class="group-members-avatar group-members-avatar--fallback">{{item.displayInitial}}</view>
          </block>
          <view class="group-members-meta">
            <block wx:if="{{item.openID}}">
              <block wx:if="{{item.isExternal}}">
                <ww-open-data class="group-members-name" type="externalUserName" openid="{{item.openID}}"></ww-open-data>
              </block>
              <block wx:else>
                <ww-open-data class="group-members-name" type="userName" openid="{{item.openID}}"></ww-open-data>
              </block>
            </block>
            <block wx:else>
              <view class="group-members-name">{{item.displayName}}</view>
            </block>
            <view class="group-members-id">{{item.userID || '-'}}</view>
          </view>
        </view>
      </view>
      <view class="group-members-col group-members-col--type">
        <view class="group-members-plain">{{item.typeLabel}}</view>
      </view>
      <view class="group-members-col group-members-col--time">
        <view class="group-members-plain">{{item.joinTime}}</view>
      </view>
      <view class="group-members-col group-members-col--inviter">
        <view class="group-members-plain">{{item.inviterUserID || '-'}}</view>
      </view>
    </view>
  </block>
</view>
`
}

function buildStyle(): string {
  return `
.group-members {
  display: block;
  width: 100%;
  background: #ffffff;
}

.group-members-header,
.group-members-row {
  display: grid;
  grid-template-columns: minmax(320px, 1.8fr) 120px 168px 160px;
  align-items: center;
}

.group-members-header {
  min-height: 48px;
  background: rgba(249, 250, 251, 0.8);
  border-bottom: 1px solid #e5e7eb;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
}

.group-members-row {
  min-height: 72px;
  border-bottom: 1px solid #f3f4f6;
}

.group-members-col {
  min-width: 0;
  padding: 0 16px;
  box-sizing: border-box;
}

.group-members-person {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.group-members-avatar {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  overflow: hidden;
  display: block;
  flex-shrink: 0;
  background: #f3f4f6;
}

.group-members-avatar--fallback {
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  line-height: 32px;
  text-align: center;
}

.group-members-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.group-members-name,
.group-members-plain {
  color: #111827;
  font-size: 14px;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-members-name {
  font-weight: 600;
}

.group-members-id {
  margin-top: 2px;
  color: #9ca3af;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
`
}

async function syncFrameSize(
  instance: ww.OpenDataFrameInstance<FrameData>,
  host: HTMLDivElement,
): Promise<void> {
  const iframe = instance.el as HTMLIFrameElement
  iframe.setAttribute("scrolling", "no")
  iframe.style.overflow = "hidden"
  iframe.style.display = "block"
  iframe.style.border = "none"
  iframe.style.background = "transparent"

  let bestHeight = 0
  const delays = [0, 32, 96, 180, 320]
  for (const delay of delays) {
    if (delay > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, delay))
    }
    const rect = (await ww.getNodeInfo(instance, ROOT_REF, { rect: true }))?.rect
    if (!rect) continue
    if (rect.height > bestHeight) bestHeight = rect.height
  }

  const hostRect = host.getBoundingClientRect()
  iframe.style.width = `${Math.max(720, Math.ceil(hostRect.width))}px`
  iframe.style.height = `${Math.max(120, Math.ceil(bestHeight) + 2)}px`
  iframe.style.maxWidth = "100%"
}

export function GroupDetailMembersOpenDataFrame(props: {
  rows: GroupDetailMemberOpenDataRow[]
  loading?: boolean
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<ww.OpenDataFrameInstance<FrameData> | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const frameData = useMemo<FrameData>(() => ({ rows: props.rows }), [props.rows])

  // BUGFIX: the initial loading state has no frame host. Recreate the member
  // frame when loading completes or rows arrive, otherwise the official
  // OpenDataFrame can stay mounted against a missing element.
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
      const runtime = await ensureOpenDataReady()
      if (cancelled) return
      if (!runtime.canUseOpenData) {
        setError(runtime.reason || "当前环境暂不支持通讯录展示组件。")
        return
      }

      const factory = ww.createOpenDataFrameFactory({
        handleError(nextError) {
          if (cancelled) return
          setError(nextError instanceof Error ? nextError.message : "成员列表组件初始化失败")
          setReady(false)
        },
      })

      instanceRef.current = factory.createOpenDataFrame({
        el: host,
        data: frameData,
        template: buildTemplate(),
        style: buildStyle(),
        async handleMounted() {
          if (cancelled || !instanceRef.current || !hostRef.current) return
          await syncFrameSize(instanceRef.current, hostRef.current)
          setReady(true)
          setError("")
        },
        async handleUpdated() {
          if (cancelled || !instanceRef.current || !hostRef.current) return
          await syncFrameSize(instanceRef.current, hostRef.current)
          setReady(true)
          setError("")
        },
        handleError(nextError) {
          if (cancelled) return
          setError(nextError instanceof Error ? nextError.message : "成员列表组件渲染失败")
          setReady(false)
        },
      })
    }

    setReady(false)
    setError("")
    dispose()
    void mount()

    return () => {
      cancelled = true
      dispose()
    }
  }, [props.loading, props.rows.length])

  useEffect(() => {
    const instance = instanceRef.current
    const host = hostRef.current
    if (!instance || !host) return
    void instance.setData(frameData).then(() => syncFrameSize(instance, host)).catch(() => {})
  }, [frameData])

  useEffect(() => {
    if (!ready || !hostRef.current || !instanceRef.current) return
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      if (!instanceRef.current || !hostRef.current) return
      void syncFrameSize(instanceRef.current, hostRef.current)
    })
    observer.observe(hostRef.current)
    return () => observer.disconnect()
  }, [ready])

  if (props.loading && props.rows.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center text-sm text-gray-500">
        正在读取成员列表...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm text-amber-800">
        {error}
      </div>
    )
  }

  return <div ref={hostRef} className="w-full" />
}
