import * as ww from "@wecom/jssdk"
import { useEffect, useMemo, useRef, useState } from "react"
import { ensureOpenDataReady } from "@/services/openDataService"

const ROOT_REF = "customer-list-root"
const CUSTOMER_LIST_MIN_WIDTH = 1240
const CUSTOMER_HEADER_HEIGHT = 48
const CUSTOMER_ROW_HEIGHT = 84

export type CustomerListOpenDataRow = {
  externalUserID: string
  customerName: string
  customerInitial: string
  mobileMasked: string
  sourceChannel: string
  stage: string
  stageTone: "default" | "success" | "warning" | "neutral"
  tags: string[]
  hasChatdata: boolean
  lastInteractionAt: string
  lastInteractionLabel: string
  ownerOpenID: string
  ownerName: string
  ownerInitial: string
  selected: boolean
}

type FrameData = {
  rows: CustomerListOpenDataRow[]
  allSelected: boolean
}

type FrameFailureReason =
  | "unsupported"
  | "factory_unavailable"
  | "mount_missing"
  | "runtime_error"

function estimatedFrameHeight(rows: CustomerListOpenDataRow[]): number {
  return Math.max(160, CUSTOMER_HEADER_HEIGHT + rows.length * CUSTOMER_ROW_HEIGHT)
}

function resolveFallbackReason(reason: FrameFailureReason): string {
  switch (reason) {
    case "unsupported":
      return "当前环境暂不支持通讯录展示组件，已切换为标准列表展示。"
    case "factory_unavailable":
      return "通讯录展示组件当前不可用，已切换为标准列表展示。"
    case "mount_missing":
      return "通讯录展示组件未完成挂载，已切换为标准列表展示。"
    default:
      return "通讯录展示组件渲染失败，已切换为标准列表展示。"
  }
}

function readDatasetValue(event: unknown, key: string): string {
  if (!event || typeof event !== "object") return ""
  const target = (event as { currentTarget?: unknown }).currentTarget
  if (!target || typeof target !== "object") return ""
  const dataset = (target as { dataset?: unknown }).dataset
  if (!dataset || typeof dataset !== "object") return ""
  const value = (dataset as Record<string, unknown>)[key]
  return typeof value === "string" ? value.trim() : `${value || ""}`.trim()
}

function buildTemplate(): string {
  return `
<view class="customer-list" ref="${ROOT_REF}">
  <view class="customer-list-header">
    <view class="customer-list-col customer-list-col--check">
      <view class="customer-list-check {{data.allSelected ? 'customer-list-check--selected' : ''}}" bindclick="handleToggleAll">
        <block wx:if="{{data.allSelected}}">
          <view class="customer-list-check-mark">✓</view>
        </block>
      </view>
    </view>
    <view class="customer-list-col customer-list-col--customer">客户信息</view>
    <view class="customer-list-col customer-list-col--source">来源渠道</view>
    <view class="customer-list-col customer-list-col--stage">当前阶段</view>
    <view class="customer-list-col customer-list-col--tags">核心标签</view>
    <view class="customer-list-col customer-list-col--latest">最新互动时间</view>
    <view class="customer-list-col customer-list-col--owner">负责人</view>
    <view class="customer-list-col customer-list-col--actions">操作</view>
  </view>
  <block wx:for="{{data.rows}}" wx:key="externalUserID">
    <view class="customer-list-row">
      <view class="customer-list-col customer-list-col--check">
        <view class="customer-list-check {{item.selected ? 'customer-list-check--selected' : ''}}" data-externaluserid="{{item.externalUserID}}" bindclick="handleToggleRow">
          <block wx:if="{{item.selected}}">
            <view class="customer-list-check-mark">✓</view>
          </block>
        </view>
      </view>
      <view class="customer-list-col customer-list-col--customer">
        <view class="customer-list-customer" data-externaluserid="{{item.externalUserID}}" bindclick="handleOpenDetail">
          <ww-open-data class="customer-list-customer-avatar" type="externalUserAvatar" openid="{{item.externalUserID}}"></ww-open-data>
          <view class="customer-list-customer-meta">
            <ww-open-data class="customer-list-customer-name" type="externalUserName" openid="{{item.externalUserID}}"></ww-open-data>
            <view class="customer-list-customer-mobile">{{item.mobileMasked}}</view>
          </view>
        </view>
      </view>
      <view class="customer-list-col customer-list-col--source">
        <view class="customer-list-source">{{item.sourceChannel}}</view>
      </view>
      <view class="customer-list-col customer-list-col--stage">
        <view class="customer-list-stage customer-list-stage--{{item.stageTone}}">{{item.stage}}</view>
      </view>
      <view class="customer-list-col customer-list-col--tags">
        <view class="customer-list-tags">
          <block wx:if="{{item.hasChatdata}}">
            <view class="customer-list-tag customer-list-tag--success">已同步聊天内容</view>
          </block>
          <block wx:for="{{item.tags}}" wx:key="*this">
            <view class="customer-list-tag">{{item}}</view>
          </block>
        </view>
      </view>
      <view class="customer-list-col customer-list-col--latest">
        <view class="customer-list-latest-time">{{item.lastInteractionAt}}</view>
        <view class="customer-list-latest-label">{{item.lastInteractionLabel}}</view>
      </view>
      <view class="customer-list-col customer-list-col--owner">
        <view class="customer-list-owner">
          <block wx:if="{{item.ownerOpenID}}">
            <ww-open-data class="customer-list-owner-avatar" type="userAvatar" openid="{{item.ownerOpenID}}"></ww-open-data>
            <ww-open-data class="customer-list-owner-name" type="userName" openid="{{item.ownerOpenID}}"></ww-open-data>
          </block>
          <block wx:else>
            <view class="customer-list-owner-avatar customer-list-owner-avatar--fallback">{{item.ownerInitial}}</view>
            <view class="customer-list-owner-name">{{item.ownerName}}</view>
          </block>
        </view>
      </view>
      <view class="customer-list-col customer-list-col--actions">
        <view class="customer-list-actions">
          <view class="customer-list-link customer-list-link--muted" data-externaluserid="{{item.externalUserID}}" bindclick="handleOpenEdit">编辑</view>
          <view class="customer-list-link" data-externaluserid="{{item.externalUserID}}" bindclick="handleOpenDetail">详情</view>
        </view>
      </view>
    </view>
  </block>
</view>
`
}

function buildStyle(): string {
  return `
.customer-list {
  display: block;
  width: 100%;
  background: #ffffff;
}

.customer-list-header,
.customer-list-row {
  display: grid;
  grid-template-columns: 56px minmax(320px, 1.65fr) 120px 120px minmax(180px, 1.1fr) 168px 180px 96px;
  align-items: center;
}

.customer-list-header {
  min-height: 48px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
}

.customer-list-row {
  min-height: 84px;
  border-bottom: 1px solid #f3f4f6;
  background: #ffffff;
}

.customer-list-col {
  box-sizing: border-box;
  min-width: 0;
  padding: 0 16px;
}

.customer-list-col--check {
  display: flex;
  align-items: center;
  justify-content: center;
}

.customer-list-check {
  width: 16px;
  height: 16px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.customer-list-check--selected {
  border-color: #2563eb;
  background: #2563eb;
}

.customer-list-check-mark {
  color: #ffffff;
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
}

.customer-list-customer {
  display: flex;
  align-items: center;
  gap: 12px;
}

.customer-list-customer-avatar,
.customer-list-owner-avatar {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  overflow: hidden;
  flex-shrink: 0;
  display: block;
  background: #f3f4f6;
}

.customer-list-owner-avatar {
  width: 24px;
  height: 24px;
}

.customer-list-owner-avatar--fallback {
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
  line-height: 24px;
  text-align: center;
}

.customer-list-customer-meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.customer-list-customer-name,
.customer-list-owner-name {
  color: #111827;
  font-size: 14px;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.customer-list-customer-name {
  font-weight: 600;
}

.customer-list-customer-mobile,
.customer-list-latest-label {
  margin-top: 2px;
  color: #9ca3af;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.customer-list-source,
.customer-list-latest-time {
  color: #111827;
  font-size: 13px;
  line-height: 1.5;
}

.customer-list-stage {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 9999px;
  border: 1px solid transparent;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  box-sizing: border-box;
}

.customer-list-stage--default {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #2563eb;
}

.customer-list-stage--success {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

.customer-list-stage--warning {
  background: #fff7ed;
  border-color: #fdba74;
  color: #c2410c;
}

.customer-list-stage--neutral {
  background: #f3f4f6;
  border-color: #d1d5db;
  color: #4b5563;
}

.customer-list-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.customer-list-tag {
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

.customer-list-tag--success {
  background: #ecfdf5;
  color: #047857;
}

.customer-list-owner {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.customer-list-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.customer-list-link {
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.customer-list-link--muted {
  color: #6b7280;
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
  iframe.style.width = `${Math.max(CUSTOMER_LIST_MIN_WIDTH, Math.ceil(hostRect.width))}px`
  iframe.style.height = `${Math.max(160, fallbackHeight, Math.ceil(bestHeight) + 2)}px`
  iframe.style.maxWidth = "none"
  iframe.style.visibility = "visible"
}

function primeFrameElement(instance: ww.OpenDataFrameInstance<FrameData>, host: HTMLDivElement, rows: CustomerListOpenDataRow[]): void {
  const iframe = instance.el as HTMLIFrameElement
  iframe.setAttribute("scrolling", "no")
  iframe.style.display = "block"
  iframe.style.width = `${Math.max(CUSTOMER_LIST_MIN_WIDTH, Math.ceil(host.getBoundingClientRect().width))}px`
  iframe.style.height = `${estimatedFrameHeight(rows)}px`
  iframe.style.maxWidth = "none"
  iframe.style.border = "none"
  iframe.style.overflow = "hidden"
  iframe.style.background = "transparent"
  iframe.style.visibility = "hidden"
}

export function CustomerListOpenDataFrame(props: {
  rows: CustomerListOpenDataRow[]
  loading?: boolean
  allSelected?: boolean
  onToggleAll?: () => void
  onToggleRow?: (externalUserID: string) => void
  onOpenDetail?: (externalUserID: string) => void
  onOpenEdit?: (externalUserID: string) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<ww.OpenDataFrameInstance<FrameData> | null>(null)
  const toggleAllRef = useRef(props.onToggleAll)
  const toggleRowRef = useRef(props.onToggleRow)
  const openDetailRef = useRef(props.onOpenDetail)
  const openEditRef = useRef(props.onOpenEdit)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [fallbackMode, setFallbackMode] = useState(false)
  const frameData = useMemo<FrameData>(
    () => ({
      rows: props.rows,
      allSelected: props.allSelected === true && props.rows.length > 0,
    }),
    [props.allSelected, props.rows],
  )

  useEffect(() => {
    toggleAllRef.current = props.onToggleAll
    toggleRowRef.current = props.onToggleRow
    openDetailRef.current = props.onOpenDetail
    openEditRef.current = props.onOpenEdit
  }, [props.onOpenDetail, props.onOpenEdit, props.onToggleAll, props.onToggleRow])

  // BUGFIX: this component renders a loading placeholder before rows exist.
  // The placeholder has no hostRef node, so the list frame must be remounted
  // when the row count changes from 0 to the first real page.
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
      console.warn("[customer-list/open-data] fallback", {
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
      const runtime = await ensureOpenDataReady()
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

        instanceRef.current = factory.createOpenDataFrame({
          el: host,
          data: frameData,
          template: buildTemplate(),
          style: buildStyle(),
          methods: {
            handleToggleAll() {
              toggleAllRef.current?.()
            },
            handleToggleRow(event: unknown) {
              const externalUserID = readDatasetValue(event, "externaluserid")
              if (!externalUserID) return
              toggleRowRef.current?.(externalUserID)
            },
            handleOpenDetail(event: unknown) {
              const externalUserID = readDatasetValue(event, "externaluserid")
              if (!externalUserID) return
              openDetailRef.current?.(externalUserID)
            },
            handleOpenEdit(event: unknown) {
              const externalUserID = readDatasetValue(event, "externaluserid")
              if (!externalUserID) return
              openEditRef.current?.(externalUserID)
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
        if (instanceRef.current) {
          primeFrameElement(instanceRef.current, host, frameData.rows)
        }
      } catch (error) {
        failToFallback("runtime_error", error instanceof Error ? error.message : error)
        return
      }

      if (instanceRef.current?.el && instanceRef.current.el.parentElement !== host) {
        host.replaceChildren(instanceRef.current.el)
      }

      mountWatchTimer = window.setTimeout(() => {
        if (cancelled || ready || fallbackMode) return
        const currentHost = hostRef.current
        const hasMountedFrame = Boolean(currentHost?.querySelector("iframe"))
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
        正在读取客户数据...
      </div>
    )
  }

  const standardList = (
    <div className="w-full">
      {error ? (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}
      {props.rows.map((row) => (
        <div key={row.externalUserID} className="grid min-h-[84px] grid-cols-[56px_minmax(320px,1.65fr)_120px_120px_minmax(180px,1.1fr)_168px_180px_96px] items-center border-b border-gray-100 bg-white">
          <div className="flex justify-center px-4">
            <div className={`flex h-4 w-4 items-center justify-center rounded border ${row.selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}>
              {row.selected ? <span className="text-[11px] font-bold">✓</span> : null}
            </div>
          </div>
          <button
            type="button"
            className="flex min-w-0 items-center gap-3 px-4 text-left"
            onClick={() => props.onOpenDetail?.(row.externalUserID)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
              {row.customerInitial}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900">{row.customerName}</div>
              <div className="truncate text-[11px] text-gray-400">{row.mobileMasked}</div>
            </div>
          </button>
          <div className="px-4 text-sm text-gray-900">{row.sourceChannel}</div>
          <div className="px-4">
            <span className="inline-flex min-h-6 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-700">
              {row.stage}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 px-4">
            {row.hasChatdata ? (
              <span className="inline-flex min-h-5 items-center rounded-full bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700">
                已同步聊天内容
              </span>
            ) : null}
            {row.tags.map((tag) => (
              <span key={`${row.externalUserID}-${tag}`} className="inline-flex min-h-5 items-center rounded-full bg-gray-100 px-2 text-[10px] font-semibold text-gray-600">
                {tag}
              </span>
            ))}
          </div>
          <div className="px-4">
            <div className="text-sm text-gray-900">{row.lastInteractionAt}</div>
            <div className="mt-1 truncate text-[11px] text-gray-400">{row.lastInteractionLabel}</div>
          </div>
          <div className="px-4 text-sm text-gray-900">{row.ownerName}</div>
          <div className="flex justify-end gap-3 px-4 text-sm font-semibold">
            <button type="button" className="text-gray-500" onClick={() => props.onOpenEdit?.(row.externalUserID)}>
              编辑
            </button>
            <button type="button" className="text-blue-600" onClick={() => props.onOpenDetail?.(row.externalUserID)}>
              详情
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  if (fallbackMode) return standardList

  if (error) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm text-amber-800">
        {error}
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <div
        ref={hostRef}
        data-estimated-height={estimatedFrameHeight(props.rows)}
        className={ready ? "w-full" : "pointer-events-none absolute inset-x-0 top-0 -z-10 w-full opacity-0"}
        style={{
          minHeight: ready ? estimatedFrameHeight(props.rows) : 0,
          minWidth: CUSTOMER_LIST_MIN_WIDTH,
        }}
      />
      {ready ? null : standardList}
    </div>
  )
}
