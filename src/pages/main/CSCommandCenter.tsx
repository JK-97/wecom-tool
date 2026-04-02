import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { Dialog } from "@/components/ui/Dialog"
import { Textarea } from "@/components/ui/Textarea"
import { Search, AlertCircle, Clock, CheckCircle2, UserX, ShieldAlert, AlertTriangle, GitBranch, UserPlus, ExternalLink, Info, ChevronRight, Star } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  executeCSCommandCenterCommand,
  getCSCommandCenterSessionDetail,
  getCSCommandCenterView,
  type CommandCenterSession,
  type CommandCenterSessionDetail,
  type CommandCenterViewModel,
} from "@/services/commandCenterService"
import { executeContactSidebarCommand } from "@/services/sidebarService"
import { normalizeErrorMessage } from "@/services/http"

type SessionTab = "queue" | "active" | "closed"

function resolveSessionBucket(session: CommandCenterSession): SessionTab {
  const bucket = (session.state_bucket || "").trim().toLowerCase()
  if (bucket === "active") return "active"
  if (bucket === "closed") return "closed"
  if (bucket === "queue") return "queue"
  const state = Number(session.session_state || 0)
  if (state === 3) return "active"
  if (state === 4) return "closed"
  return "queue"
}

export default function CSCommandCenter() {
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isEndModalOpen, setIsEndModalOpen] = useState(false)
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [isUpgradeSuccess, setIsUpgradeSuccess] = useState(false)

  const [view, setView] = useState<CommandCenterViewModel | null>(null)
  const [detail, setDetail] = useState<CommandCenterSessionDetail | null>(null)
  const [selectedExternalUserID, setSelectedExternalUserID] = useState("")
  const [activeTab, setActiveTab] = useState<SessionTab>("queue")
  const [keyword, setKeyword] = useState("")
  const [notice, setNotice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [upgradeOwner, setUpgradeOwner] = useState("销售部-王经理")
  const [upgradeReason, setUpgradeReason] = useState("高意向潜客")
  const [upgradeTask, setUpgradeTask] = useState("")
  const [upgradeStars, setUpgradeStars] = useState(4)

  const [transferTarget, setTransferTarget] = useState("")
  const [transferReason, setTransferReason] = useState("")

  const queryOpenKFID = useMemo(() => {
    if (typeof window === "undefined") return ""
    const params = new URLSearchParams(window.location.search)
    return (params.get("open_kfid") || "").trim()
  }, [])

  const loadView = async () => {
    const data = await getCSCommandCenterView({ open_kfid: queryOpenKFID, limit: 200 })
    setView(data)
    const selectedID = (data?.selected?.external_userid || data?.sessions?.[0]?.external_userid || "").trim()
    setSelectedExternalUserID((prev) => prev || selectedID)
  }

  const loadDetail = async (externalUserID: string) => {
    const selected = (externalUserID || "").trim()
    if (!selected) {
      setDetail(null)
      return
    }
    const data = await getCSCommandCenterSessionDetail({
      open_kfid: queryOpenKFID,
      external_userid: selected,
      limit: 200,
    })
    setDetail(data)
  }

  useEffect(() => {
    let alive = true
    void getCSCommandCenterView({ open_kfid: queryOpenKFID, limit: 200 })
      .then((data) => {
        if (!alive) return
        setView(data)
        const selectedID = (data?.selected?.external_userid || data?.sessions?.[0]?.external_userid || "").trim()
        setSelectedExternalUserID(selectedID)
      })
      .catch(() => {
        if (!alive) return
        setView(null)
      })
    return () => {
      alive = false
    }
  }, [queryOpenKFID])

  useEffect(() => {
    let alive = true
    if (!selectedExternalUserID) {
      setDetail(null)
      return
    }
    void getCSCommandCenterSessionDetail({
      open_kfid: queryOpenKFID,
      external_userid: selectedExternalUserID,
      limit: 200,
    })
      .then((data) => {
        if (!alive) return
        setDetail(data)
      })
      .catch(() => {
        if (!alive) return
        setDetail(null)
      })
    return () => {
      alive = false
    }
  }, [queryOpenKFID, selectedExternalUserID])

  const sessions = useMemo(() => view?.sessions || [], [view?.sessions])
  const selectedSession = useMemo(() => {
    if (sessions.length === 0) return null
    const found = sessions.find((item) => (item.external_userid || "").trim() === selectedExternalUserID.trim())
    return found || sessions[0]
  }, [selectedExternalUserID, sessions])

  const filteredSessions = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return sessions.filter((item) => {
      const bucket = resolveSessionBucket(item)
      if (activeTab !== bucket) return false
      if (!q) return true
      const joined = `${item.name || ""} ${item.last_message || ""} ${item.source || ""}`.toLowerCase()
      return joined.includes(q)
    })
  }, [activeTab, keyword, sessions])

  const queueCount = useMemo(() => sessions.filter((item) => resolveSessionBucket(item) === "queue").length, [sessions])
  const activeCount = useMemo(() => sessions.filter((item) => resolveSessionBucket(item) === "active").length, [sessions])
  const closedCount = useMemo(() => sessions.filter((item) => resolveSessionBucket(item) === "closed").length, [sessions])

  const runCSCommand = async (command: string, payload?: Record<string, unknown>) => {
    try {
      setIsSubmitting(true)
      const result = await executeCSCommandCenterCommand({
        command,
        open_kfid: selectedSession?.open_kfid,
        external_userid: selectedSession?.external_userid,
        payload,
      })
      setNotice((result?.message || "命令已提交").trim())
      await loadView()
      await loadDetail(selectedSession?.external_userid || "")
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpgrade = async () => {
    if (!selectedSession?.external_userid) {
      setNotice("未选择会话")
      return
    }
    try {
      setIsSubmitting(true)
      const result = await executeContactSidebarCommand({
        command: "cs_upgrade_to_contact",
        external_userid: selectedSession.external_userid,
        payload: {
          assigned_userid: upgradeOwner,
          reason: upgradeReason,
          task_title: "客服中心升级跟进",
          note: upgradeTask,
          stars: upgradeStars,
          open_kfid: selectedSession.open_kfid,
          contact_name: selectedSession.name,
        },
      })
      setNotice((result?.message || "升级命令已提交").trim())
      setIsUpgradeModalOpen(false)
      if (result?.success) {
        setIsUpgradeSuccess(true)
        setTimeout(() => setIsUpgradeSuccess(false), 2500)
      }
      await loadView()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const monitorMood = (view?.monitor?.mood || "neutral").trim()
  const monitorEmoji = monitorMood === "stable" ? "🙂" : monitorMood === "neutral" ? "😐" : "😠"

  return (
    <div className="flex h-full gap-6">
      <div className="w-[380px] shrink-0 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">微信客服中心</h2>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SessionTab)}>
            <TabsList className="w-full grid grid-cols-3 bg-white border border-gray-200">
              <TabsTrigger value="queue" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
                排队中 ({queueCount})
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                接待中 ({activeCount})
              </TabsTrigger>
              <TabsTrigger value="closed">已结束 ({closedCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="p-3 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索客户昵称或消息内容..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {notice ? <div className="text-[11px] text-blue-600">{notice}</div> : null}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {filteredSessions.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">当前筛选下暂无会话</div>
          ) : (
            filteredSessions.map((session) => {
              const selected = (session.external_userid || "").trim() === (selectedSession?.external_userid || "").trim()
              const bucket = resolveSessionBucket(session)
              const queueWaitText = (session.queue_wait_text || "").trim()
              const replyOverdue = session.reply_overdue === true || session.overdue === true
              const slaStatus = (session.reply_sla_status || "").trim().toLowerCase()
              return (
                <div
                  key={(session.external_userid || session.name || "session").trim()}
                  className={`p-4 cursor-pointer transition-colors ${selected ? "bg-blue-50/50 border-l-4 border-blue-600" : "hover:bg-gray-50"}`}
                  onClick={() => setSelectedExternalUserID((session.external_userid || "").trim())}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Avatar src="" size="sm" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{(session.name || "未命名客户").trim()}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-600 border-none">{(session.source || "未知渠道").trim()}</Badge>
                          <Badge className="text-[9px] px-1 py-0 bg-gray-100 text-gray-500 border-none">{(session.session_label || "会话中").trim()}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {replyOverdue ? (
                        <div className="flex items-center text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                          <AlertCircle className="w-3 h-3 mr-1" /> 超时告警
                        </div>
                      ) : bucket === "queue" ? (
                        <div className={`flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${slaStatus === "warning" ? "text-amber-700 bg-amber-100" : "text-orange-600 bg-orange-100"}`}>
                          <Clock className="w-3 h-3 mr-1" /> 排队 {queueWaitText || "-"}
                        </div>
                      ) : (
                        <div className="flex items-center text-[10px] font-medium text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                          <Clock className="w-3 h-3 mr-1" /> {session.unread_count || 0} 未读
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-1 mb-2">{(session.last_message || "暂无消息").trim()}</p>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3" /> {(session.assigned_userid || "待分配").trim()}
                    </span>
                    <span>{(session.last_active || "").replace("T", " ").slice(0, 16)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-white shrink-0">
          <div className="h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold text-gray-900">{(selectedSession?.name || "未选择会话").trim()}</h3>
              <Badge variant="success" className="bg-green-50 text-green-700 border-green-200">
                {(selectedSession?.session_label || "-").trim()}
              </Badge>
              <span className="text-sm text-gray-500 border-l border-gray-200 pl-4">接待人：{(selectedSession?.assigned_userid || "待分配").trim()}</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => setIsUpgradeModalOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" /> 升级为客户联系
              </Button>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => setIsTransferModalOpen(true)}>
                <UserX className="w-4 h-4 mr-2" /> 强制转交
              </Button>
              <Button variant="outline" size="sm" className="text-gray-600 hover:bg-gray-100" onClick={() => setIsEndModalOpen(true)}>
                强制结束
              </Button>
            </div>
          </div>

          <div className="px-6 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-6 text-[11px]">
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="font-medium">来源渠道:</span>
              <span className="text-gray-900">{(selectedSession?.source || "-").trim()}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="font-medium">路由规则:</span>
              <span className="text-blue-600 flex items-center gap-0.5 cursor-pointer hover:underline">
                {(detail?.route_rule_name || "-").trim()} <ExternalLink className="w-3 h-3" />
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="font-medium">接待池:</span>
              <span className="text-gray-900">{(detail?.route_pool_name || "-").trim()}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500 ml-auto">
              <span className="font-medium">告警状态:</span>
              {(selectedSession?.reply_overdue === true || selectedSession?.overdue === true) ? (
                <Badge className="bg-red-100 text-red-700 border-none text-[10px] px-1.5 py-0">超时</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-700 border-none text-[10px] px-1.5 py-0">
                  {((selectedSession?.reply_sla_status || "normal").trim() || "normal") === "warning" ? "预警" : "正常"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="font-medium">排队时间:</span>
              <span className="text-gray-900">{(selectedSession?.queue_wait_text || "-").trim() || "-"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="font-medium">升级状态:</span>
              <Badge className="bg-green-100 text-green-700 border-none text-[10px] px-1.5 py-0">{isUpgradeSuccess ? "已升级" : "未升级"}</Badge>
            </div>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 bg-[#F5F7FA] p-6 overflow-y-auto flex flex-col gap-6">
            {(detail?.messages || []).length === 0 ? (
              <div className="text-sm text-gray-500">暂无会话消息</div>
            ) : (
              (detail?.messages || []).map((message) => {
                const outgoing = (message.sender || "").trim() !== "customer"
                return (
                  <div key={message.id || `${message.timestamp}-${message.content}`} className={`flex items-start gap-3 ${outgoing ? "flex-row-reverse" : ""}`}>
                    {outgoing ? (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-600">AI</span>
                      </div>
                    ) : (
                      <Avatar src="" size="sm" />
                    )}
                    <div
                      className={`px-4 py-2.5 max-w-[70%] shadow-sm rounded-2xl ${
                        outgoing ? "bg-blue-600 text-white rounded-tr-none" : "bg-white border border-gray-200 text-gray-800 rounded-tl-none"
                      }`}
                    >
                      <p className="text-sm">{(message.content || "").trim()}</p>
                      <p className={`mt-1 text-[10px] ${outgoing ? "text-blue-100" : "text-gray-400"}`}>{(message.timestamp || "").replace("T", " ").slice(0, 16)}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="w-[300px] border-l border-gray-200 bg-white p-5 overflow-y-auto space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-blue-600" /> 路由信息
              </h4>
              <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">命中渠道</span>
                  <span className="text-xs font-medium">{(selectedSession?.source || "-").trim()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">匹配规则</span>
                  <span className="text-xs font-medium text-blue-600">{(detail?.route_rule_name || "-").trim()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">接待池</span>
                  <span className="text-xs font-medium">{(detail?.route_pool_name || "-").trim()}</span>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <Link to="/main/routing-rules" className="text-[11px] text-blue-600 flex items-center justify-center gap-1 hover:underline">
                    前往调整路由规则 <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" /> 客户升级
              </h4>
              <div className="bg-blue-50 rounded-lg border border-blue-100 p-4 text-center">
                <p className="text-xs text-blue-700 mb-3 leading-relaxed">可将当前会话升级为客户联系并自动创建跟进任务。</p>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-xs h-8" onClick={() => setIsUpgradeModalOpen(true)}>
                  立即升级
                </Button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-600" /> AI 实时监控
              </h4>

              <div className="space-y-6">
                <div>
                  <div className="text-xs text-gray-500 mb-2">客户情绪</div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{monitorEmoji}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${monitorMood === "stable" ? "bg-green-500 w-[35%]" : monitorMood === "neutral" ? "bg-yellow-500 w-[55%]" : "bg-orange-500 w-[70%]"}`} />
                    </div>
                    <span className="text-xs font-medium text-orange-600">{monitorMood === "stable" ? "稳定" : monitorMood === "neutral" ? "中性" : "焦急"}</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-2">会话摘要</div>
                  <div className="bg-gray-50 p-3 rounded-md border border-gray-100 text-sm text-gray-700 leading-relaxed">
                    {(view?.monitor?.summary || "暂无会话摘要").trim()}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-2">合规质检</div>
                  {view?.monitor?.compliance_pass === false ? (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded-md border border-red-100">
                      <AlertTriangle className="w-4 h-4" /> 检测到潜在风险话术
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-md border border-green-100">
                      <CheckCircle2 className="w-4 h-4" /> 未发现违规话术
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            升级为客户联系
          </div>
        }
        className="max-w-[520px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsUpgradeModalOpen(false)}>
              取消
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting} onClick={() => void handleUpgrade()}>
              确认升级并创建任务
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed">升级后将自动生成客户档案和跟进任务，当前为内部命令链路执行。</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">负责人</label>
              <input
                value={upgradeOwner}
                onChange={(event) => setUpgradeOwner(event.target.value)}
                className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">意向等级</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={`w-5 h-5 cursor-pointer ${i <= upgradeStars ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} onClick={() => setUpgradeStars(i)} />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">升级原因</label>
            <input
              value={upgradeReason}
              onChange={(event) => setUpgradeReason(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">下一步任务</label>
            <Textarea className="text-sm min-h-[80px]" value={upgradeTask} onChange={(event) => setUpgradeTask(event.target.value)} placeholder="请输入需要负责人执行的具体任务" />
          </div>
        </div>
      </Dialog>

      {isUpgradeSuccess ? (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">升级成功！已同步至客户中心并创建跟进任务。</span>
        </div>
      ) : null}

      <Dialog
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="强制转交会话"
        className="max-w-[480px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsTransferModalOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-blue-600"
              disabled={isSubmitting}
              onClick={async () => {
                await runCSCommand("cs_transfer_session", { assigned_userid: transferTarget, reason: transferReason })
                setIsTransferModalOpen(false)
                setTransferTarget("")
                setTransferReason("")
              }}
            >
              确认转交
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">转交给</label>
            <input
              type="text"
              value={transferTarget}
              onChange={(event) => setTransferTarget(event.target.value)}
              placeholder="输入客服人员或技能组"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">转交原因</label>
            <Textarea className="text-sm min-h-[80px]" value={transferReason} onChange={(event) => setTransferReason(event.target.value)} placeholder="请输入转交原因" />
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isEndModalOpen}
        onClose={() => setIsEndModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            强制结束会话
          </div>
        }
        className="max-w-[400px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEndModalOpen(false)}>
              暂不结束
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isSubmitting}
              onClick={async () => {
                await runCSCommand("cs_end_session", {})
                setIsEndModalOpen(false)
              }}
            >
              强制结束
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">强制结束会话将中断当前客服接待。请确认是否继续？</p>
      </Dialog>
    </div>
  )
}
