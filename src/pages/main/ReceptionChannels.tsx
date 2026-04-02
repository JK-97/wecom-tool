import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { Search, RefreshCw, ExternalLink, QrCode, Link as LinkIcon, MoreHorizontal, Info, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  createReceptionChannel,
  getReceptionOverview,
  getReceptionChannelDetail,
  listReceptionChannels,
  retryReceptionChannelSync,
  triggerReceptionChannelSync,
  type ReceptionChannel,
  type ReceptionChannelDetail,
  type ReceptionOverview,
} from "@/services/receptionService"
import { normalizeErrorMessage } from "@/services/http"

export default function ReceptionChannels() {
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<ReceptionChannel | null>(null)
  const [selectedChannelDetail, setSelectedChannelDetail] = useState<ReceptionChannelDetail | null>(null)
  const [overview, setOverview] = useState<ReceptionOverview | null>(null)
  const [channels, setChannels] = useState<ReceptionChannel[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [notice, setNotice] = useState("")
  const [keyword, setKeyword] = useState("")
  const [createOpenKFID, setCreateOpenKFID] = useState("")
  const [createName, setCreateName] = useState("")
  const [createSource, setCreateSource] = useState("")
  const [createSceneValue, setCreateSceneValue] = useState("")

  const loadChannels = async (query?: string) => {
    try {
      const [loadedOverview, loadedChannels] = await Promise.all([
        getReceptionOverview(),
        listReceptionChannels({ query: query || "", limit: 200 }),
      ])
      setOverview(loadedOverview)
      setChannels(loadedChannels)
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    }
  }

  useEffect(() => {
    void loadChannels()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadChannels(keyword)
    }, 260)
    return () => window.clearTimeout(timer)
  }, [keyword])

  const handleSync = async () => {
    setIsSyncing(true)
    const target = selectedChannel?.open_kfid || channels[0]?.open_kfid
    if (!target) {
      setNotice("当前没有可同步的渠道")
      setIsSyncing(false)
      return
    }
    try {
      const accepted = await triggerReceptionChannelSync(target)
      setNotice(accepted ? "已提交同步任务" : "同步任务未被接受")
      await loadChannels(keyword)
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSyncing(false)
    }
  }

  const loadDetail = async (channel: ReceptionChannel) => {
    setSelectedChannel(channel)
    setSelectedChannelDetail(null)
    setIsDetailLoading(true)
    setIsDetailOpen(true)
    if (!channel.open_kfid) {
      setIsDetailLoading(false)
      return
    }
    try {
      const detail = await getReceptionChannelDetail(channel.open_kfid)
      setSelectedChannelDetail(detail)
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
      setSelectedChannelDetail(null)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const retrySync = async (openKFID: string) => {
    if (!openKFID) return
    try {
      const retried = await retryReceptionChannelSync(openKFID)
      setNotice(retried > 0 ? `已重试 ${retried} 个失败任务` : "没有需要重试的失败任务")
      await loadChannels(keyword)
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    }
  }

  const formatDateTime = (value?: string): string => {
    const text = (value || "").trim()
    if (!text) return "-"
    const parsed = Date.parse(text)
    if (Number.isNaN(parsed)) {
      return text
    }
    return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
  }

  const handleCreateChannel = async () => {
    const openKFID = createOpenKFID.trim()
    if (!openKFID) {
      setNotice("请输入 Open KFID")
      return
    }
    try {
      setIsCreating(true)
      const created = await createReceptionChannel({
        open_kfid: openKFID,
        name: createName.trim(),
        source: createSource.trim(),
        scene_value: createSceneValue.trim(),
      })
      setNotice(created?.open_kfid ? "接待渠道已创建" : "接待渠道创建完成")
      setIsCreateOpen(false)
      setCreateOpenKFID("")
      setCreateName("")
      setCreateSource("")
      setCreateSceneValue("")
      await loadChannels(keyword)
      if (created?.open_kfid) {
        await loadDetail(created)
      }
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  const primaryScene = useMemo(() => {
    const scenes = selectedChannelDetail?.scenes || []
    return scenes.length > 0 ? scenes[0] : null
  }, [selectedChannelDetail?.scenes])

  const promotionURL = (primaryScene?.url || "").trim()

  const handleCopyLink = async () => {
    if (!promotionURL) {
      setNotice("当前渠道暂无可复制的推广链接")
      return
    }
    try {
      await navigator.clipboard.writeText(promotionURL)
      setNotice("推广链接已复制")
    } catch {
      setNotice("复制失败，请手动复制")
    }
  }

  const handleDownloadQRCode = async () => {
    if (!promotionURL) {
      setNotice("当前渠道暂无可下载二维码的链接")
      return
    }
    try {
      const query = new URLSearchParams({ text: promotionURL, size: "512" })
      const response = await fetch(`/api/v1/routing/qrcode?${query.toString()}`, {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error(`二维码下载失败(${response.status})`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${(selectedChannel?.open_kfid || "reception_channel").trim()}-${(primaryScene?.scene_value || "scene").trim()}.png`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setNotice("二维码下载已开始")
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-50 text-green-700 border-green-200">正常</Badge>
      case "error":
        return <Badge className="bg-red-50 text-red-700 border-red-200">异常</Badge>
      case "syncing":
      case "pending":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">同步中</Badge>
      case "failed":
        return <Badge className="bg-red-50 text-red-700 border-red-200">同步失败</Badge>
      case "muted":
        return <Badge className="bg-gray-50 text-gray-700 border-gray-200">停用</Badge>
      default:
        return null
    }
  }

  const getDisplayName = (channel?: ReceptionChannel | null): string => {
    return (
      (channel?.display_name || "").trim() ||
      (channel?.name || "").trim() ||
      (channel?.open_kfid || "").trim() ||
      "未命名渠道"
    )
  }

  const getAvatarURL = (channel?: ReceptionChannel | null): string => {
    return (channel?.avatar_url || "").trim()
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 flex items-center gap-4 border-none shadow-sm">
          <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
            <LinkIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">渠道总数</p>
            <p className="text-2xl font-bold text-gray-900">{overview?.total_channels ?? 0}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-none shadow-sm">
          <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">启用中</p>
            <p className="text-2xl font-bold text-gray-900">{overview?.active_channels ?? 0}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-none shadow-sm">
          <div className="h-12 w-12 rounded-lg bg-red-50 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">异常渠道</p>
            <p className="text-2xl font-bold text-gray-900">{overview?.abnormal_channels ?? 0}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-none shadow-sm">
          <div className="h-12 w-12 rounded-lg bg-orange-50 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">待同步</p>
            <p className="text-2xl font-bold text-gray-900">{overview?.pending_sync ?? 0}</p>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索渠道名称或 ID..."
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              同步企微后台
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/main/guide">
              <Button variant="outline" size="sm" className="text-gray-600">
                <Info className="h-4 w-4 mr-2" />
                查看渠道文档
              </Button>
            </Link>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsCreateOpen(true)}>
              + 新建接待渠道
            </Button>
          </div>
        </div>
        {notice ? <div className="px-4 py-2 text-xs text-blue-600 border-b border-gray-100 bg-blue-50">{notice}</div> : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 font-semibold">渠道信息</th>
                <th className="px-6 py-3 font-semibold">Open KFID</th>
                <th className="px-6 py-3 font-semibold">来源说明</th>
                <th className="px-6 py-3 font-semibold">状态</th>
                <th className="px-6 py-3 font-semibold">接待人员</th>
                <th className="px-6 py-3 font-semibold">默认路由规则</th>
                <th className="px-6 py-3 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {channels.map((channel) => (
                <tr key={channel.open_kfid || channel.name} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {getAvatarURL(channel) ? (
                        <img
                          src={getAvatarURL(channel)}
                          alt={getDisplayName(channel)}
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                          {getDisplayName(channel).charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-gray-900">{getDisplayName(channel)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">
                    {channel.open_kfid}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-transparent">
                      {channel.source}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(channel.status || "")}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">{channel.staff_count}</span>
                    <span className="text-gray-400 ml-1">人</span>
                  </td>
                  <td className="px-6 py-4 text-blue-600">
                    {(channel.open_kfid || "").trim() ? (
                      <Link className="hover:underline" to={`/main/routing-rules?channel=${encodeURIComponent((channel.open_kfid || "").trim())}`}>
                        {channel.default_rule}
                      </Link>
                    ) : (
                      <span>{channel.default_rule}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 hover:bg-blue-50 h-8"
                        onClick={() => {
                          void loadDetail(channel)
                        }}
                      >
                        详情
                      </Button>
                      <Link to={`/main/routing-rules?channel=${channel.open_kfid}`}>
                        <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100 h-8">
                          配置路由
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400"
                        onClick={() => {
                          const openKFID = (channel.open_kfid || "").trim()
                          if (!openKFID) return
                          void retrySync(openKFID)
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {channels.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={7}>
                    暂无接待渠道
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Drawer (Dialog) */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="渠道详情与推广"
        className="max-w-[480px]"
        footer={
          <Button className="w-full bg-blue-600" onClick={() => setIsDetailOpen(false)}>
            关闭
          </Button>
        }
      >
        {(selectedChannel || selectedChannelDetail?.channel) && (
          <div className="space-y-6">
            {isDetailLoading ? (
              <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">加载渠道详情中...</div>
            ) : null}
            {(() => {
              const detailChannel = selectedChannelDetail?.channel || selectedChannel
              if (!detailChannel) return null
              return (
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
              {getAvatarURL(detailChannel) ? (
                <img src={getAvatarURL(detailChannel)} alt={getDisplayName(detailChannel)} className="h-12 w-12 rounded object-cover" />
              ) : (
                <div className="h-12 w-12 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
                  {getDisplayName(detailChannel).charAt(0)}
                </div>
              )}
              <div>
                <h3 className="font-bold text-gray-900">{getDisplayName(detailChannel)}</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">{detailChannel.open_kfid}</p>
              </div>
              <div className="ml-auto">
                {getStatusBadge(detailChannel.status || "")}
              </div>
            </div>
              )
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg flex flex-col items-center gap-3 hover:border-blue-300 transition-colors cursor-pointer group">
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100">
                  <QrCode className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">推广二维码</span>
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 h-7" onClick={() => void handleDownloadQRCode()}>
                  下载图片
                </Button>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg flex flex-col items-center gap-3 hover:border-blue-300 transition-colors cursor-pointer group">
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100">
                  <ExternalLink className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">推广链接</span>
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 h-7" onClick={() => void handleCopyLink()}>
                  复制链接
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">场景预设 (Scene)</h4>
              <div className="p-3 bg-gray-50 rounded border border-gray-100 text-xs font-mono text-gray-600 break-all">
                {promotionURL || "-"}
              </div>
              <p className="text-[11px] text-gray-400">
                提示：通过在链接后增加 scene 参数，可以触发特定的路由规则，实现精准分流。
              </p>
              {(selectedChannelDetail?.scenes || []).length > 0 ? (
                <div className="space-y-2">
                  {(selectedChannelDetail?.scenes || []).map((scene) => (
                    <div key={`${scene.scene_value || ""}-${scene.url || ""}`} className="rounded border border-gray-100 bg-white px-3 py-2">
                      <div className="text-xs font-medium text-gray-700">{(scene.name || "未命名场景").trim()}</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">{(scene.scene_value || "").trim() || "DEFAULT"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">暂无场景预设</div>
              )}
            </div>

            {selectedChannelDetail?.warnings && selectedChannelDetail.warnings.length > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700">
                {selectedChannelDetail.warnings.join("；")}
              </div>
            )}

            <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-500">最近同步时间：{formatDateTime((selectedChannelDetail?.channel?.last_interaction || selectedChannel?.last_interaction || "").trim())}</span>
              <Button
                variant="link"
                size="sm"
                className="text-blue-600 p-0 h-auto text-xs"
                onClick={() => {
                  const openKFID = (selectedChannelDetail?.channel?.open_kfid || selectedChannel?.open_kfid || "").trim()
                  if (!openKFID) return
                  void retrySync(openKFID)
                }}
              >
                重新同步
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="新建接待渠道"
        className="max-w-[520px]"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              取消
            </Button>
            <Button className="bg-blue-600" disabled={isCreating} onClick={() => void handleCreateChannel()}>
              {isCreating ? "创建中..." : "创建渠道"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Open KFID</label>
            <input
              value={createOpenKFID}
              onChange={(event) => setCreateOpenKFID(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="wkxxxxxx"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">渠道名称</label>
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="如：官网在线咨询"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">来源说明</label>
            <input
              value={createSource}
              onChange={(event) => setCreateSource(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="如：官网 H5"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">默认 Scene</label>
            <input
              value={createSceneValue}
              onChange={(event) => setCreateSceneValue(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="如：OFFICIAL_WEBSITE"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
