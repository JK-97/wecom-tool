import * as ww from "@wecom/jssdk"
import { useEffect, useMemo, useRef, useState } from "react"
import { ensureOpenDataReady } from "@/services/openDataService"

const ROOT_REF = "group-ops-list-root"
const GROUP_LIST_MIN_WIDTH = 1200
const GROUP_ROW_HEIGHT = 96

type GroupOperationsListPreviewMember = {
  key: string
  openID: string
  avatarType: "userAvatar" | "externalUserAvatar"
  displayName: string
  displayInitial: string
}

export type GroupOperationsListOpenDataRow = {
  chatID: string
  name: string
  nameInitial: string
  ownerOpenID: string
  ownerName: string
  ownerInitial: string
  memberCount: number
  statusLabel: string
  statusTone: "warning" | "success" | "neutral"
  tags: string[]
  lastSyncedAt: string
  noticePreview: string
  previewMembers: GroupOperationsListPreviewMember[]
  showMemberOverflow: boolean
}

type FrameData = {
  rows: GroupOperationsListOpenDataRow[]
}

type FrameFailureReason =
  | "unsupported"
  | "factory_unavailable"
  | "mount_missing"
  | "runtime_error"

function estimatedFrameHeight(rows: GroupOperationsListOpenDataRow[]): number {
  return Math.max(160, rows.length * GROUP_ROW_HEIGHT)
}

function resolveFallbackReason(reason: FrameFailureReason): string {
  switch (reason) {
    case "unsupported":
      return "当前环境暂不支持会话展示组件，已切换为标准列表展示。"
    case "factory_unavailable":
      return "会话展示组件当前不可用，已切换为标准列表展示。"
    case "mount_missing":
      return "会话展示组件未完成挂载，已切换为标准列表展示。"
    default:
      return "会话展示组件渲染失败，已切换为标准列表展示。"
  }
}

function buildTemplate(): string {
  return `
<view class="group-ops-list" ref="${ROOT_REF}">
  <block wx:for="{{data.rows}}" wx:key="chatID">
    <view class="group-ops-row" data-chatid="{{item.chatID}}" bindclick="handleOpenDetail">
      <view class="group-ops-col group-ops-col--meta">
        <view class="group-ops-check"></view>
      </view>
      <view class="group-ops-col group-ops-col--info">
        <view class="group-ops-info-stack">
          <view class="group-ops-avatars">
            <block wx:if="{{item.previewMembers.length}}">
              <block wx:for="{{item.previewMembers}}" wx:for-item="member" wx:key="key">
                <block wx:if="{{member.openID}}">
                  <ww-open-data class="group-ops-member-avatar" type="{{member.avatarType}}" openid="{{member.openID}}"></ww-open-data>
                </block>
                <block wx:else>
                  <view class="group-ops-member-avatar group-ops-member-avatar--fallback">{{member.displayInitial}}</view>
                </block>
              </block>
            </block>
            <block wx:else>
              <view class="group-ops-member-avatar group-ops-member-avatar--fallback">{{item.nameInitial}}</view>
            </block>
            <block wx:if="{{item.showMemberOverflow}}">
              <view class="group-ops-avatar-more">...</view>
            </block>
          </view>
          <view class="group-ops-texts">
            <view class="group-ops-name">{{item.name}}</view>
            <view class="group-ops-id">{{item.chatID}}</view>
          </view>
        </view>
      </view>
      <view class="group-ops-col group-ops-col--count">
        <view class="group-ops-plain">{{item.memberCount}}</view>
      </view>
      <view class="group-ops-col group-ops-col--status">
        <view class="group-ops-badge group-ops-badge--{{item.statusTone}}">{{item.statusLabel}}</view>
      </view>
      <view class="group-ops-col group-ops-col--tags">
        <view class="group-ops-tags">
          <block wx:for="{{item.tags}}" wx:key="*this">
            <view class="group-ops-tag">{{item}}</view>
          </block>
        </view>
      </view>
      <view class="group-ops-col group-ops-col--updated">
        <view class="group-ops-time">{{item.lastSyncedAt}}</view>
        <view class="group-ops-preview">{{item.noticePreview}}</view>
      </view>
      <view class="group-ops-col group-ops-col--owner">
        <view class="group-ops-owner">
          <block wx:if="{{item.ownerOpenID}}">
            <ww-open-data class="group-ops-owner-avatar group-ops-owner-avatar--inline" type="userAvatar" openid="{{item.ownerOpenID}}"></ww-open-data>
            <ww-open-data class="group-ops-owner-name" type="userName" openid="{{item.ownerOpenID}}"></ww-open-data>
          </block>
          <block wx:else>
            <view class="group-ops-owner-avatar group-ops-owner-avatar--fallback group-ops-owner-avatar--inline">{{item.ownerInitial}}</view>
            <view class="group-ops-owner-name">{{item.ownerName}}</view>
          </block>
        </view>
      </view>
      <view class="group-ops-col group-ops-col--action">
        <view class="group-ops-link">详情</view>
      </view>
    </view>
  </block>
</view>
`
}

function buildStyle(): string {
  return `
.group-ops-list {
  display: block;
  width: 100%;
  background: #ffffff;
}

.group-ops-row {
  display: flex;
  align-items: center;
  gap: 0;
  min-height: 96px;
  border-bottom: 1px solid #f3f4f6;
  background: #ffffff;
}

.group-ops-col {
  box-sizing: border-box;
  padding: 16px 12px;
}

.group-ops-col--meta {
  width: 56px;
  padding-left: 24px;
}

.group-ops-col--info {
  flex: 1 1 0;
  min-width: 0;
}

.group-ops-col--count {
  width: 92px;
}

.group-ops-col--status {
  width: 110px;
}

.group-ops-col--tags {
  width: 180px;
}

.group-ops-col--updated {
  width: 176px;
}

.group-ops-col--owner {
  width: 180px;
}

.group-ops-col--action {
  width: 84px;
  padding-right: 24px;
}

.group-ops-check {
  width: 14px;
  height: 14px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #ffffff;
}

.group-ops-info-stack {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.group-ops-avatars {
  display: flex;
  align-items: center;
  margin-right: 2px;
}

.group-ops-member-avatar,
.group-ops-owner-avatar,
.group-ops-avatar-more {
  width: 30px;
  height: 30px;
  border-radius: 9999px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #ffffff;
  box-sizing: border-box;
}

.group-ops-member-avatar {
  margin-left: -8px;
  background: #f3f4f6;
}

.group-ops-member-avatar:first-child {
  margin-left: 0;
}

.group-ops-member-avatar--fallback {
  background: #eef2ff;
  color: #5b6476;
  font-size: 13px;
  font-weight: 600;
}

.group-ops-owner-avatar {
  background: #f3f4f6;
}

.group-ops-avatar-more {
  margin-left: -8px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.group-ops-owner-avatar--fallback {
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.group-ops-owner-avatar--inline {
  margin-left: 0;
  width: 24px;
  height: 24px;
  border-width: 1px;
  border-color: #f3f4f6;
}

.group-ops-texts {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.group-ops-name {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-ops-id {
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-ops-plain,
.group-ops-time,
.group-ops-owner-name {
  color: #111827;
  font-size: 14px;
  line-height: 1.5;
}

.group-ops-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  border: 1px solid transparent;
  box-sizing: border-box;
}

.group-ops-badge--warning {
  background: #fff7ed;
  border-color: #fdba74;
  color: #c2410c;
}

.group-ops-badge--success {
  background: #f0fdf4;
  border-color: #86efac;
  color: #15803d;
}

.group-ops-badge--neutral {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.group-ops-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.group-ops-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 9999px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
}

.group-ops-preview {
  margin-top: 4px;
  color: #9ca3af;
  font-size: 11px;
  line-height: 1.4;
}

.group-ops-owner {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.group-ops-owner-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-ops-link {
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
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
  const fallbackHeight = Number(host.dataset.estimatedHeight || 0)
  iframe.style.width = `${Math.max(GROUP_LIST_MIN_WIDTH, Math.ceil(hostRect.width))}px`
  iframe.style.height = `${Math.max(120, fallbackHeight, Math.ceil(bestHeight) + 2)}px`
  iframe.style.maxWidth = "none"
  iframe.style.visibility = "visible"
}

function primeFrameElement(instance: ww.OpenDataFrameInstance<FrameData>, host: HTMLDivElement, rows: GroupOperationsListOpenDataRow[]): void {
  const iframe = instance.el as HTMLIFrameElement
  iframe.setAttribute("scrolling", "no")
  iframe.style.display = "block"
  iframe.style.width = `${Math.max(GROUP_LIST_MIN_WIDTH, Math.ceil(host.getBoundingClientRect().width))}px`
  iframe.style.height = `${estimatedFrameHeight(rows)}px`
  iframe.style.maxWidth = "none"
  iframe.style.border = "none"
  iframe.style.overflow = "hidden"
  iframe.style.background = "transparent"
  iframe.style.visibility = "hidden"
}

export function GroupOperationsListOpenDataFrame(props: {
  rows: GroupOperationsListOpenDataRow[]
  loading?: boolean
  onOpenDetail?: (chatID: string) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<ww.OpenDataFrameInstance<FrameData> | null>(null)
  const openDetailRef = useRef(props.onOpenDetail)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [fallbackMode, setFallbackMode] = useState(false)
  const frameData = useMemo<FrameData>(() => ({ rows: props.rows }), [props.rows])

  useEffect(() => {
    openDetailRef.current = props.onOpenDetail
  }, [props.onOpenDetail])

  // BUGFIX: the loading branch does not render the frame host. If the first
  // mount runs while hostRef is null, the OpenDataFrame will stay blank unless
  // it is recreated when real rows arrive.
  useEffect(() => {
    let cancelled = false
    let mountWatchTimer = 0

    const dispose = () => {
      instanceRef.current?.dispose()
      instanceRef.current = null
      hostRef.current?.replaceChildren()
      if (mountWatchTimer) {
        window.clearTimeout(mountWatchTimer)
        mountWatchTimer = 0
      }
    }

    const failToFallback = (reason: FrameFailureReason, detail?: unknown) => {
      if (cancelled) return
      console.warn("[group-ops/open-data] fallback", {
        reason,
        detail,
        rowCount: frameData.rows.length,
      })
      setFallbackMode(true)
      setError(resolveFallbackReason(reason))
      setReady(false)
    }

    const mount = async () => {
      const host = hostRef.current
      if (!host) return
      console.info("[group-ops/open-data] mount begin", {
        rowCount: frameData.rows.length,
        hostWidth: Math.ceil(host.getBoundingClientRect().width),
        hostHeight: Math.ceil(host.getBoundingClientRect().height),
      })
      const runtime = await ensureOpenDataReady()
      console.info("[group-ops/open-data] runtime ready", {
        canUseOpenData: runtime.canUseOpenData,
        availability: runtime.availability,
        reason: runtime.reason || "",
      })
      if (cancelled) return
      if (!runtime.canUseOpenData) {
        failToFallback("unsupported", runtime.reason)
        return
      }
      if (typeof ww.createOpenDataFrameFactory !== "function") {
        failToFallback("factory_unavailable")
        return
      }

      try {
        const factory = ww.createOpenDataFrameFactory({
          handleError(nextError) {
            failToFallback("runtime_error", nextError instanceof Error ? nextError.message : nextError)
          },
        })
        console.info("[group-ops/open-data] factory created")

        instanceRef.current = factory.createOpenDataFrame({
          el: host,
          data: frameData,
          template: buildTemplate(),
          style: buildStyle(),
          methods: {
            handleOpenDetail(event: { currentTarget?: { dataset?: Record<string, unknown> } }) {
              const chatID = `${event?.currentTarget?.dataset?.chatid || ""}`.trim()
              if (!chatID || !openDetailRef.current) return
              openDetailRef.current(chatID)
            },
          },
          async handleMounted() {
            if (cancelled || !instanceRef.current || !hostRef.current) return
            await syncFrameSize(instanceRef.current, hostRef.current)
            setReady(true)
            setFallbackMode(false)
            setError("")
          },
          async handleUpdated() {
            if (cancelled || !instanceRef.current || !hostRef.current) return
            await syncFrameSize(instanceRef.current, hostRef.current)
            setReady(true)
            setFallbackMode(false)
            setError("")
          },
          handleError(nextError) {
            failToFallback("runtime_error", nextError instanceof Error ? nextError.message : nextError)
          },
        })
        console.info("[group-ops/open-data] instance created", {
          hasIframe: instanceRef.current?.el instanceof HTMLIFrameElement,
          hostChildCount: host.childElementCount,
        })
        if (instanceRef.current) {
          primeFrameElement(instanceRef.current, host, frameData.rows)
        }
      } catch (error) {
        failToFallback("runtime_error", error instanceof Error ? error.message : error)
        return
      }

      if (instanceRef.current?.el && instanceRef.current.el.parentElement !== host) {
        primeFrameElement(instanceRef.current, host, frameData.rows)
        host.replaceChildren(instanceRef.current.el)
        console.info("[group-ops/open-data] iframe appended", {
          hostChildCount: host.childElementCount,
        })
      }

      mountWatchTimer = window.setTimeout(() => {
        if (cancelled || ready || fallbackMode) return
        const currentHost = hostRef.current
        const hasMountedFrame = Boolean(currentHost?.querySelector("iframe"))
        console.info("[group-ops/open-data] mount watch", {
          hasMountedFrame,
          hostChildCount: currentHost?.childElementCount || 0,
          ready,
          fallbackMode,
        })
        if (!hasMountedFrame) {
          failToFallback("mount_missing")
        }
      }, 1500)
    }

    setReady(false)
    setError("")
    setFallbackMode(false)
    dispose()
    void mount()

    return () => {
      cancelled = true
      dispose()
    }
  }, [props.rows.length])

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
      <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
        正在读取群聊数据...
      </div>
    )
  }

  if (fallbackMode) {
    return (
      <div className="w-full">
        {error ? (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : null}
        {props.rows.map((row) => (
          <button
            key={row.chatID}
            type="button"
            className="flex min-h-[96px] w-full items-center border-b border-gray-100 bg-white text-left transition hover:bg-gray-50"
            onClick={() => props.onOpenDetail?.(row.chatID)}
          >
            <div className="w-14 px-6 py-4">
              <div className="h-[14px] w-[14px] rounded border border-gray-300 bg-white" />
            </div>
            <div className="flex flex-1 items-center gap-3 px-6 py-4">
              <div className="flex items-center">
                {(row.previewMembers.length > 0 ? row.previewMembers : [{ key: `${row.chatID}-fallback`, displayInitial: row.nameInitial }]).map((member, index) => (
                  <div
                    key={member.key}
                    className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white bg-indigo-50 text-[13px] font-semibold text-slate-600 ${index > 0 ? "-ml-2" : ""}`}
                  >
                    {member.displayInitial}
                  </div>
                ))}
                {row.showMemberOverflow ? (
                  <div className="-ml-2 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white bg-slate-50 text-xs font-bold text-slate-500">
                    ...
                  </div>
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-900">{row.name}</div>
                <div className="truncate text-xs text-slate-400">{row.chatID}</div>
              </div>
            </div>
            <div className="w-[92px] px-3 py-4 text-sm text-gray-900">{row.memberCount}</div>
            <div className="w-[110px] px-3 py-4">
              <span
                className={[
                  "inline-flex min-h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold",
                  row.statusTone === "warning"
                    ? "border-orange-300 bg-orange-50 text-orange-700"
                    : row.statusTone === "success"
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-blue-200 bg-blue-50 text-blue-700",
                ].join(" ")}
              >
                {row.statusLabel}
              </span>
            </div>
            <div className="flex w-[180px] flex-wrap gap-1.5 px-3 py-4">
              {row.tags.map((tag) => (
                <span
                  key={`${row.chatID}-${tag}`}
                  className="inline-flex min-h-5 items-center rounded-full bg-gray-100 px-2 text-[10px] font-semibold text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="w-[176px] px-3 py-4">
              <div className="text-sm text-gray-900">{row.lastSyncedAt}</div>
              <div className="mt-1 truncate text-[11px] text-gray-400">{row.noticePreview}</div>
            </div>
            <div className="w-[180px] px-3 py-4 text-sm text-gray-900">{row.ownerName}</div>
            <div className="w-[84px] px-6 py-4 text-right text-sm font-semibold text-blue-600">详情</div>
          </button>
        ))}
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

  return (
    <div
      ref={hostRef}
      data-estimated-height={estimatedFrameHeight(props.rows)}
      className="w-full"
      style={{
        minHeight: estimatedFrameHeight(props.rows),
        minWidth: GROUP_LIST_MIN_WIDTH,
      }}
    />
  )
}
