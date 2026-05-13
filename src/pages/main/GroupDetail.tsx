import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { usePageFeedback } from "@/components/ui/PageFeedback"
import { ChatDataPanel } from "@/components/chatdata/ChatDataPanel"
import { useChatDataPanel } from "@/hooks/useChatDataPanel"
import {
  GroupDetailMembersOpenDataFrame,
  type GroupDetailMemberOpenDataRow,
} from "@/components/wecom/GroupDetailMembersOpenDataFrame"
import {
  GroupAvatarStackOpenDataFrame,
  type GroupAvatarStackMember,
} from "@/components/wecom/GroupAvatarStackOpenDataFrame"
import { normalizeErrorMessage } from "@/services/http"
import { WecomProfileAvatarOpenDataFrame } from "@/components/wecom/WecomProfileAvatarOpenDataFrame"
import { WecomDirectoryOpenDataName } from "@/components/wecom/WecomDirectoryOpenDataName"
import {
  getGroupOperationDetail,
  type CustomerGroupChatAdmin,
  type CustomerGroupChatMember,
  type GroupOperationDetail,
} from "@/services/groupChatService"
import {
  getCRMSyncOverview,
  openCRMSyncOverviewStream,
  type CRMSyncOverview,
  type CRMSyncScopeCard,
} from "@/services/crmSyncService"

type DetailTab = "overview" | "members" | "risk" | "chat-history"

function formatDateTime(value?: string): string {
  const text = (value || "").trim()
  if (!text) return "-"
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return text
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
}

function formatUnixSeconds(value?: number): string {
  const seconds = Number(value || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return "-"
  return new Date(seconds * 1000).toLocaleString("zh-CN", { hour12: false })
}

function memberName(member: CustomerGroupChatMember): string {
  return (member.group_nickname || "").trim() || (member.name || "").trim() || (member.userid || "").trim() || "未命名成员"
}

function memberTypeLabel(memberType?: number): string {
  switch (Number(memberType || 0)) {
    case 1:
      return "企业成员"
    case 2:
      return "外部联系人"
    default:
      return "成员"
  }
}

function statusToneClass(tone?: string): string {
  switch ((tone || "").trim()) {
    case "warning":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "success":
      return "bg-green-50 text-green-700 border-green-200"
    default:
      return "bg-gray-100 text-gray-700 border-gray-200"
  }
}

function syncTone(status?: string): string {
  switch ((status || "").trim()) {
    case "running":
    case "cancelling":
      return "warning"
    case "completed":
      return "success"
    case "partial_failed":
    case "failed":
      return "warning"
    default:
      return "neutral"
  }
}

function riskTone(level?: string): string {
  switch ((level || "").trim()) {
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800"
    case "success":
      return "border-green-200 bg-green-50 text-green-800"
    default:
      return "border-gray-200 bg-gray-50 text-gray-700"
  }
}

function renderAdminChip(admin: CustomerGroupChatAdmin) {
  const userid = (admin.userid || "").trim()
  const openUserID = (admin.open_userid || "").trim()
  if (!userid) {
    return <div className="inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500">未同步管理员</div>
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
      <WecomProfileAvatarOpenDataFrame
        openID={openUserID}
        fallback={userid}
        size="xs"
        className="border border-gray-100"
      />
      <WecomDirectoryOpenDataName
        openID={openUserID}
        fallback={userid}
        className="max-w-[140px] truncate"
      />
    </div>
  )
}

function shouldRefreshGroupDetail(prev?: CRMSyncScopeCard | null, next?: CRMSyncScopeCard | null): boolean {
  if (!prev || !next) return false
  if ((prev.last_synced_at || "").trim() !== (next.last_synced_at || "").trim()) return true
  const prevBusy = ["running", "cancelling"].includes((prev.status || "").trim())
  const nextBusy = ["running", "cancelling"].includes((next.status || "").trim())
  return prevBusy && !nextBusy
}

function summaryText(detail?: GroupOperationDetail | null): string {
  if (!detail?.group_chat) return ""
  const riskCount = (detail.risk_signals || []).length
  const noticeCount = (detail.notices || []).length
  const memberTotal = Number(detail.member_stat?.total || 0)
  if (riskCount > 0) {
    return `当前共有 ${riskCount} 条需要留意的群资料提示，建议先处理风险项，再继续核对成员和群主状态。`
  }
  if ((detail.group_chat.notice || "").trim()) {
    return `群公告已同步，当前群内共有 ${memberTotal} 名成员。你可以继续核对管理员和成员结构。`
  }
  if (noticeCount > 0) {
    return `当前没有明显风险，补充说明共 ${noticeCount} 条，可继续查看群资料与成员列表。`
  }
  return `当前没有额外运营提示，最近一次同步时间为 ${formatDateTime(detail.sync_status?.last_synced_at || detail.group_chat.last_synced_at)}。`
}

function SidebarField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <p className="mt-1 text-sm leading-relaxed text-gray-700">{value ?? "-"}</p>
    </div>
  )
}

export default function GroupDetail() {
  const { showFeedback } = usePageFeedback()
  const { chatId = "" } = useParams()
  const safeChatID = (chatId || "").trim()
  const [activeTab, setActiveTab] = useState<DetailTab>("overview")
  const [detail, setDetail] = useState<GroupOperationDetail | null>(null)
  const [syncOverview, setSyncOverview] = useState<CRMSyncOverview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const chatdata = useChatDataPanel({
    target_type: "chat_id",
    target_id: safeChatID,
    surface: "group_detail",
  })

  const loadDetail = useCallback(async () => {
    if (!safeChatID) {
      setDetail(null)
      setSyncOverview(null)
      return
    }
    try {
      setIsLoading(true)
      const [nextDetail, nextSync] = await Promise.all([getGroupOperationDetail(safeChatID), getCRMSyncOverview()])
      setDetail(nextDetail)
      setSyncOverview(nextSync)
    } catch (error) {
      setDetail(null)
      setSyncOverview(null)
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
    } finally {
      setIsLoading(false)
    }
  }, [safeChatID, showFeedback])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const loadDetailRef = useRef(loadDetail)
  useEffect(() => {
    loadDetailRef.current = loadDetail
  }, [loadDetail])

  useEffect(() => {
    const stream = openCRMSyncOverviewStream({
      onMessage: (payload) => {
        const next = payload.data || null
        if (!next) return
        setSyncOverview((previous) => {
          if (shouldRefreshGroupDetail(previous?.group_chats, next.group_chats)) {
            window.setTimeout(() => {
              void loadDetailRef.current()
            }, 0)
          }
          return next
        })
      },
    })
    return () => stream.close()
  }, [])

  const detailName = (detail?.group_chat?.name || "").trim() || "客户群详情"
  const syncToneValue = useMemo(() => syncTone(detail?.sync_status?.status), [detail?.sync_status?.status])
  const syncStatusLabel = (detail?.sync_status?.status_label || "").trim() || "暂无同步"
  const members = detail?.members || []
  const admins = detail?.admins || []
  const notices = detail?.notices || []
  const risks = detail?.risk_signals || []
  const ownerUserID = (detail?.group_chat?.owner_userid || "").trim()
  const ownerOpenUserID = (detail?.group_chat?.owner_open_userid || "").trim()
  const ownerName = ownerUserID || "未同步"
  const memberFrameRows = useMemo<GroupDetailMemberOpenDataRow[]>(
    () =>
      members.map((member) => {
        const userID = (member.userid || "").trim()
        const displayName = memberName(member)
        const isExternal = Number(member.type || 0) === 2
        const chatID = (detail?.group_chat?.chat_id || "").trim()
        const openID = isExternal
          ? chatID && userID
            ? `${chatID}/${userID}`
            : ""
          : (member.open_userid || "").trim()
        const inviterUserID = (member.invitor_userid || "").trim()
        const inviterIsExternal = Number(member.invitor_entity_type || 0) === 2
        const inviterOpenID = inviterIsExternal
          ? chatID && inviterUserID
            ? `${chatID}/${inviterUserID}`
            : ""
          : (member.invitor_open_userid || "").trim()
        const inviterName = inviterUserID || "-"
        return {
          key: `${userID}-${member.join_time}`,
          openID,
          avatarType: isExternal ? ("externalUserAvatar" as const) : ("userAvatar" as const),
          userID,
          displayName,
          displayInitial: displayName.slice(0, 1) || "人",
          typeLabel: memberTypeLabel(member.type),
          joinTime: formatUnixSeconds(member.join_time),
          inviterUserID,
          inviterOpenID,
          inviterAvatarType: inviterIsExternal ? ("externalUserAvatar" as const) : ("userAvatar" as const),
          inviterNameType: inviterIsExternal ? ("externalUserName" as const) : ("userName" as const),
          inviterName,
          inviterInitial: inviterName.slice(0, 1) || "人",
          isExternal,
        }
      }),
    [detail?.group_chat?.chat_id, members],
  )
  const headerAvatarMembers = useMemo<GroupAvatarStackMember[]>(
    () =>
      memberFrameRows.slice(0, 3).map((member) => ({
        key: member.key,
        openID: member.openID,
        avatarType: member.avatarType,
        displayInitial: member.displayInitial,
      })),
    [memberFrameRows],
  )
  const headerAvatarOverflow = Number(detail?.member_stat?.total || members.length || 0) > headerAvatarMembers.length

  if (!safeChatID) {
    return (
      <div className="flex h-full min-h-[720px] items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <EmptyState
          icon={ShieldAlert}
          title="缺少客户群编号"
          description="请先从群聊列表中选择一个客户群，再进入详情页查看成员和风险信息。"
        />
      </div>
    )
  }

  if (isLoading && !detail?.group_chat) {
    return (
      <div className="flex h-full min-h-[720px] items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          正在读取客户群详情...
        </div>
      </div>
    )
  }

  if (!detail?.group_chat) {
    return (
      <div className="flex h-full min-h-[720px] items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <EmptyState
          icon={AlertTriangle}
          title="暂时无法读取这个客户群"
          description="可以先返回列表重新选择，或稍后刷新再试。"
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[720px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-[#F5F7FA] shadow-sm">
      <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <Link to="/main/groups">
              <Button variant="ghost" size="icon" className="text-gray-500">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <GroupAvatarStackOpenDataFrame
              members={headerAvatarMembers}
              overflow={headerAvatarOverflow}
              fallbackInitial={detailName.slice(0, 1) || "群"}
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">{detailName}</h2>
                <Badge variant="outline" className={statusToneClass(syncToneValue)}>
                  {syncStatusLabel}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                群 ID: {(detail?.group_chat?.chat_id || "").trim() || "-"} · {Number(detail?.member_stat?.total || 0)} 名成员 · 创建于 {formatUnixSeconds(detail?.group_chat?.create_time)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" className="text-gray-600" onClick={() => void loadDetail()} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              刷新详情
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DetailTab)}>
          <TabsList className="h-auto gap-8 border-b-0 bg-transparent p-0">
            <TabsTrigger
              value="overview"
              className="rounded-none border-b-2 border-transparent px-0 py-2 font-medium data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600"
            >
              运营概览
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="rounded-none border-b-2 border-transparent px-0 py-2 font-medium data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600"
            >
              成员列表
            </TabsTrigger>
            <TabsTrigger
              value="risk"
              className="rounded-none border-b-2 border-transparent px-0 py-2 font-medium data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600"
            >
              风险监控
            </TabsTrigger>
            <TabsTrigger
              value="chat-history"
              className="rounded-none border-b-2 border-transparent px-0 py-2 font-medium data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600"
            >
              会话回显
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "chat-history" ? (
          <div className="mx-auto h-full max-w-4xl">
            <ChatDataPanel
              panel={chatdata.panel}
              loading={chatdata.loading}
              bootstrapping={chatdata.bootstrapping}
              error={chatdata.error}
              onReload={() => void chatdata.reload()}
              onBootstrap={() => void chatdata.bootstrap("manual_retry", true)}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="mb-1 text-xs font-medium text-gray-500">成员总数</div>
                  <span className="text-2xl font-bold text-gray-900">{Number(detail.member_stat?.total || 0)}</span>
                </CardContent>
              </Card>
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="mb-1 text-xs font-medium text-gray-500">企业成员</div>
                  <span className="text-2xl font-bold text-gray-900">{Number(detail.member_stat?.internal_count || 0)}</span>
                </CardContent>
              </Card>
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="mb-1 text-xs font-medium text-gray-500">外部联系人</div>
                  <span className="text-2xl font-bold text-gray-900">{Number(detail.member_stat?.external_count || 0)}</span>
                </CardContent>
              </Card>
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="mb-1 text-xs font-medium text-gray-500">待处理预警</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-red-600">{Number(detail.sync_status?.open_issue_count || risks.length || 0)}</span>
                    {Number(detail.sync_status?.open_issue_count || 0) > 0 || risks.length > 0 ? (
                      <Badge variant="destructive" className="py-0 text-[10px]">
                        需关注
                      </Badge>
                    ) : (
                      <Badge variant="success" className="py-0 text-[10px]">
                        稳定
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                {activeTab === "overview" ? (
                  <>
                    <Card className="border-gray-200 shadow-sm">
                      <CardHeader className="border-b border-gray-100 p-4">
                        <CardTitle className="text-sm font-semibold text-gray-800">群动态摘要</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                          <p className="text-sm leading-relaxed text-blue-900">{summaryText(detail)}</p>
                        </div>
                        <div className="space-y-4">
                          <div className="flex gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                              <RefreshCw className="h-4 w-4 text-gray-400" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">最近一次资料同步</div>
                              <div className="mt-0.5 text-xs text-gray-500">{formatDateTime(detail.sync_status?.last_synced_at || detail.group_chat.last_synced_at)}</div>
                            </div>
                          </div>
                          {risks.slice(0, 2).map((risk, index) => (
                            <div key={`${risk.title}-${index}`} className="flex gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                                <ShieldAlert className="h-4 w-4 text-red-600" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{(risk.title || "同步提示").trim()}</div>
                                <div className="mt-0.5 text-xs text-gray-500">{(risk.description || "暂无说明").trim()}</div>
                              </div>
                            </div>
                          ))}
                          {risks.length === 0 ? (
                            <div className="flex gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">当前没有异常项</div>
                                <div className="mt-0.5 text-xs text-gray-500">群主、管理员和成员资料没有发现需要立即处理的问题。</div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-gray-200 shadow-sm">
                      <CardHeader className="border-b border-gray-100 p-4">
                        <CardTitle className="text-sm font-semibold text-gray-800">群公告与补充说明</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 p-4">
                        <div className="rounded-lg border border-gray-200 bg-white p-4">
                          <div className="mb-1 text-sm font-medium text-gray-900">群公告</div>
                          <div className="text-sm leading-relaxed text-gray-600">
                            {(detail.group_chat.notice || "").trim() || "当前还没有可展示的群公告内容。"}
                          </div>
                        </div>
                        {notices.length > 0 ? (
                          notices.map((notice, index) => (
                            <div key={`${notice.title}-${index}`} className="rounded-lg border border-gray-200 bg-white p-4">
                              <div className="text-sm font-medium text-gray-900">{(notice.title || "补充说明").trim()}</div>
                              <div className="mt-1 text-sm leading-relaxed text-gray-600">{(notice.description || "暂无信息").trim()}</div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                            当前没有额外的补充说明。
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                ) : null}

                {activeTab === "members" ? (
                  <Card className="border-gray-200 shadow-sm">
                    <CardHeader className="border-b border-gray-100 p-4">
                      <CardTitle className="text-sm font-semibold text-gray-800">成员列表</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {members.length === 0 ? (
                        <div className="p-6">
                          <EmptyState
                            icon={Users}
                            title="当前还没有客户群数据"
                            description="完成首次同步后，这里会展示群主、成员和风险状态。"
                          />
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <GroupDetailMembersOpenDataFrame rows={memberFrameRows} loading={isLoading} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}

                {activeTab === "risk" ? (
                  <Card className="border-gray-200 shadow-sm">
                    <CardHeader className="border-b border-gray-100 p-4">
                      <CardTitle className="text-sm font-semibold text-gray-800">风险监控</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4">
                      {risks.length === 0 ? (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                          当前没有需要优先处理的群资料异常。
                        </div>
                      ) : (
                        risks.map((risk, index) => (
                          <div key={`${risk.title}-${index}`} className={`rounded-lg border px-4 py-3 ${riskTone(risk.level)}`}>
                            <div className="font-medium">{(risk.title || "提示").trim()}</div>
                            <div className="mt-1 text-sm leading-6">{(risk.description || "暂无说明").trim()}</div>
                          </div>
                        ))
                      )}
                      {notices.length > 0 ? (
                        <div className="pt-2">
                          <div className="mb-2 text-sm font-medium text-gray-900">补充说明</div>
                          <div className="space-y-2">
                            {notices.map((notice, index) => (
                              <div key={`${notice.title}-${index}`} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                                <div className="font-medium text-gray-900">{(notice.title || "说明").trim()}</div>
                                <div className="mt-1 text-sm leading-6 text-gray-600">{(notice.description || "暂无信息").trim()}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : null}
              </div>

              <div className="space-y-6">
                <Card className="border-gray-200 shadow-sm">
                  <CardHeader className="border-b border-gray-100 p-4">
                    <CardTitle className="text-sm font-semibold text-gray-800">同步状态</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">当前状态</span>
                      <Badge variant="outline" className={statusToneClass(syncToneValue)}>
                        {syncStatusLabel}
                      </Badge>
                    </div>
                    <SidebarField label="最近更新时间" value={formatDateTime(detail.sync_status?.last_synced_at || syncOverview?.group_chats?.last_synced_at)} />
                    <SidebarField label="状态说明" value={(detail.sync_status?.description || "这里会展示客户群最近一次同步结果和当前异常数量。").trim()} />
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-sm">
                  <CardHeader className="border-b border-gray-100 p-4">
                    <CardTitle className="text-sm font-semibold text-gray-800">群基本信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4">
                    <SidebarField
                      label="群主"
                      value={
                        <WecomDirectoryOpenDataName
                          openID={ownerOpenUserID}
                          fallback={ownerName}
                          className="text-sm text-gray-700"
                        />
                      }
                    />
                    <SidebarField label="群公告" value={(detail.group_chat.notice || "").trim() || "暂无群公告"} />
                    <SidebarField label="成员结构" value={`企业成员 ${Number(detail.member_stat?.internal_count || 0)} · 外部联系人 ${Number(detail.member_stat?.external_count || 0)}`} />
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-sm">
                  <CardHeader className="border-b border-gray-100 p-4">
                    <CardTitle className="text-sm font-semibold text-gray-800">管理员名单</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {admins.length === 0 ? (
                      <div className="text-sm text-gray-500">当前没有同步到管理员资料。</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {admins.map((admin, index) => (
                          <div key={`${admin.userid || "admin"}-${index}`}>{renderAdminChip(admin)}</div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
