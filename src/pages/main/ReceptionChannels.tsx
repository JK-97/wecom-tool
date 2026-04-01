import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { Search, RefreshCw, ExternalLink, QrCode, Link as LinkIcon, MoreHorizontal, Info, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"

const channels = [
  {
    id: "1",
    name: "官方视频号接待",
    open_kfid: "wk666688880001",
    source: "视频号",
    staffCount: 12,
    defaultRule: "视频号专席路由",
    lastInteraction: "2024-03-20 14:30",
    status: "active",
    syncStatus: "success"
  },
  {
    id: "2",
    name: "官网在线咨询",
    open_kfid: "wk666688880002",
    source: "官网 H5",
    staffCount: 8,
    defaultRule: "官网通用路由",
    lastInteraction: "2024-03-20 15:12",
    status: "active",
    syncStatus: "success"
  },
  {
    id: "3",
    name: "App 内嵌客服",
    open_kfid: "wk666688880003",
    source: "移动 App",
    staffCount: 5,
    defaultRule: "App 灰度路由",
    lastInteraction: "2024-03-19 18:00",
    status: "error",
    syncStatus: "failed"
  },
  {
    id: "4",
    name: "线下门店扫码",
    open_kfid: "wk666688880004",
    source: "二维码",
    staffCount: 20,
    defaultRule: "门店地理位置路由",
    lastInteraction: "2024-03-20 10:05",
    status: "muted",
    syncStatus: "success"
  }
]

export default function ReceptionChannels() {
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<any>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = () => {
    setIsSyncing(true)
    setTimeout(() => setIsSyncing(false), 2000)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-50 text-green-700 border-green-200">正常</Badge>
      case "error":
        return <Badge className="bg-red-50 text-red-700 border-red-200">异常</Badge>
      case "syncing":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">同步中</Badge>
      case "muted":
        return <Badge className="bg-gray-50 text-gray-700 border-gray-200">停用</Badge>
      default:
        return null
    }
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
            <p className="text-2xl font-bold text-gray-900">12</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-none shadow-sm">
          <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">启用中</p>
            <p className="text-2xl font-bold text-gray-900">10</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-none shadow-sm">
          <div className="h-12 w-12 rounded-lg bg-red-50 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">异常渠道</p>
            <p className="text-2xl font-bold text-gray-900">1</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-none shadow-sm">
          <div className="h-12 w-12 rounded-lg bg-orange-50 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">待同步</p>
            <p className="text-2xl font-bold text-gray-900">1</p>
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
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              同步企微后台
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-gray-600">
              <Info className="h-4 w-4 mr-2" />
              查看渠道文档
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              + 新建接待渠道
            </Button>
          </div>
        </div>

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
                <tr key={channel.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                        {channel.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{channel.name}</span>
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
                    {getStatusBadge(channel.status)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">{channel.staffCount}</span>
                    <span className="text-gray-400 ml-1">人</span>
                  </td>
                  <td className="px-6 py-4 text-blue-600 hover:underline cursor-pointer">
                    {channel.defaultRule}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 hover:bg-blue-50 h-8"
                        onClick={() => {
                          setSelectedChannel(channel)
                          setIsDetailOpen(true)
                        }}
                      >
                        详情
                      </Button>
                      <Link to={`/main/routing-rules?channel=${channel.open_kfid}`}>
                        <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100 h-8">
                          配置路由
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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
        {selectedChannel && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="h-12 w-12 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
                {selectedChannel.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{selectedChannel.name}</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">{selectedChannel.open_kfid}</p>
              </div>
              <div className="ml-auto">
                {getStatusBadge(selectedChannel.status)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg flex flex-col items-center gap-3 hover:border-blue-300 transition-colors cursor-pointer group">
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100">
                  <QrCode className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">推广二维码</span>
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 h-7">下载图片</Button>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg flex flex-col items-center gap-3 hover:border-blue-300 transition-colors cursor-pointer group">
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100">
                  <ExternalLink className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">推广链接</span>
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 h-7">复制链接</Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">场景预设 (Scene)</h4>
              <div className="p-3 bg-gray-50 rounded border border-gray-100 text-xs font-mono text-gray-600 break-all">
                https://work.weixin.qq.com/kfid/{selectedChannel.open_kfid}?scene=OFFICIAL_WEBSITE
              </div>
              <p className="text-[11px] text-gray-400">
                提示：通过在链接后增加 scene 参数，可以触发特定的路由规则，实现精准分流。
              </p>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-500">最近同步时间：2024-03-20 10:00</span>
              <Button variant="link" size="sm" className="text-blue-600 p-0 h-auto text-xs">重新同步</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
