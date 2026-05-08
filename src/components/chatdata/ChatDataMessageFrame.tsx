import * as ww from "@wecom/jssdk"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ensureOpenDataReady } from "@/services/openDataService"
import { getChatDataDisplayBootstrap, type ChatDataMessageSummary } from "@/services/chatdataService"
import { normalizeErrorMessage } from "@/services/http"

const OPEN_DATA_STYLE = `
.chatdata-message-shell {
  display: block;
}

.chatdata-message-node {
  display: block;
  color: #111827;
  font-size: 14px;
  line-height: 1.7;
}
`

function readOpenDataError(error: unknown): string {
  if (error && typeof error === "object") {
    const row = error as Record<string, unknown>
    const message = typeof row.message === "string" ? row.message.trim() : ""
    if (message) return message
    const errMsg = typeof row.errMsg === "string" ? row.errMsg.trim() : ""
    if (errMsg) return errMsg
    try {
      return JSON.stringify(row)
    } catch {
      return normalizeErrorMessage(error)
    }
  }
  return normalizeErrorMessage(error)
}

function toDebugObject(input: unknown): unknown {
  const seen = new WeakSet<object>()

  const walk = (value: unknown, depth: number): unknown => {
    if (depth > 4) return "[depth-exceeded]"
    if (value == null) return value
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value
    }
    if (Array.isArray(value)) {
      return value.map((item) => walk(item, depth + 1))
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>
      if (seen.has(obj)) return "[circular]"
      seen.add(obj)
      const out: Record<string, unknown> = {}
      for (const key of Reflect.ownKeys(obj)) {
        if (typeof key !== "string") continue
        try {
          out[key] = walk(obj[key], depth + 1)
        } catch (err) {
          out[key] = `[unreadable:${normalizeErrorMessage(err)}]`
        }
      }
      return out
    }
    return String(value)
  }

  return walk(input, 0)
}

function toDebugJSONString(input: unknown): string {
  try {
    return JSON.stringify(toDebugObject(input))
  } catch (error) {
    return `"[stringify-failed:${normalizeErrorMessage(error)}]"`
  }
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function buildOpenDataTemplate(msgID: string, secretKey: string): string {
  return `
<view class="chatdata-message-shell">
  <ww-open-message
    class="chatdata-message-node"
    message-id="${escapeAttr(msgID)}"
    secret-key="${escapeAttr(secretKey)}"
    display-type="text"
    open-type="viewMessage"
    binderror="handleMessageError"
  ></ww-open-message>
</view>
`
}

export function ChatDataMessageFrame(props: {
  message: ChatDataMessageSummary
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<ww.OpenDataFrameInstance<{ messageId: string; secretKey: string }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const msgID = (props.message.msg_id || "").trim()

  useEffect(() => {
    let cancelled = false

    const dispose = () => {
      instanceRef.current?.dispose()
      instanceRef.current = null
      hostRef.current?.replaceChildren()
    }

    const mount = async () => {
      if (!msgID) {
        setLoading(false)
        setError("消息 ID 缺失，无法渲染会话组件。")
        return
      }
      setLoading(true)
      setError("")
      dispose()
      try {
        console.info("[chatdata/open-data] message mount begin", {
          msgID,
          chatID: (props.message.chat_id || "").trim(),
          publicKeyVer: props.message.public_key_ver || 0,
          sendTime: props.message.send_time || 0,
        })
        const [runtime, bootstrap] = await Promise.all([
          ensureOpenDataReady(),
          getChatDataDisplayBootstrap(msgID),
        ])
        if (cancelled) return
        console.info("[chatdata/open-data] message bootstrap result", {
          msgID,
          hasBootstrap: Boolean(bootstrap),
          bootstrapMsgID: bootstrap?.msg_id || "",
          bootstrapChatID: bootstrap?.chat_id || "",
          hasSecretKey: Boolean((bootstrap?.secret_key || "").trim()),
          secretKeyLength: (bootstrap?.secret_key || "").trim().length,
          hasSecretKeyBase64: Boolean((bootstrap?.secret_key_base64 || "").trim()),
          secretKeyBase64Length: (bootstrap?.secret_key_base64 || "").trim().length,
        })
        if (!runtime.canUseOpenData) {
          throw new Error(runtime.reason || "当前环境暂不支持会话展示组件。")
        }
        const secretKey = (bootstrap?.secret_key || "").trim()
        if (!secretKey) {
          throw new Error("会话展示组件缺少 secret_key。")
        }
        const host = hostRef.current
        if (!host) return
        console.info("[chatdata/open-data] create frame", {
          msgID,
          hasBind: Boolean(window.WWOpenData?.bind),
          hasWWApp: typeof window.wwapp !== "undefined",
          hasInvokeJsApiByCallInfo: typeof window.wwapp?.invokeJsApiByCallInfo === "function",
          frameUrl: "https://open.work.weixin.qq.com/wwopen/ww-open-data-frame",
        })
        const factory = ww.createOpenDataFrameFactory({
          handleError(nextError) {
            if (cancelled) return
            console.warn("[chatdata/open-data] factory handleError", {
              msgID,
              error: toDebugObject(nextError),
              errorJSON: toDebugJSONString(nextError),
            })
            setError(readOpenDataError(nextError))
            setLoading(false)
          },
        })
        instanceRef.current = factory.createOpenDataFrame({
          el: host,
          data: {
            messageId: msgID,
            secretKey,
          },
          template: buildOpenDataTemplate(msgID, secretKey),
          style: OPEN_DATA_STYLE,
          handleMounted() {
            if (cancelled) return
            console.info("[chatdata/open-data] frame mounted", { msgID })
            setLoading(false)
          },
          handleUpdated() {
            if (cancelled) return
            console.info("[chatdata/open-data] frame updated", { msgID })
            setLoading(false)
          },
          handleError(nextError) {
            if (cancelled) return
            console.warn("[chatdata/open-data] frame handleError", {
              msgID,
              error: toDebugObject(nextError),
              errorJSON: toDebugJSONString(nextError),
            })
            setError(readOpenDataError(nextError))
            setLoading(false)
          },
          methods: {
            handleMessageError(nextError: unknown) {
              if (cancelled) return
              console.warn("[chatdata/open-data] message binderror", {
                msgID,
                error: toDebugObject(nextError),
                errorJSON: toDebugJSONString(nextError),
              })
              setError(readOpenDataError(nextError))
              setLoading(false)
            },
          },
        })
      } catch (nextError) {
        if (cancelled) return
        console.warn("[chatdata/open-data] message mount failed", {
          msgID,
          error: toDebugObject(nextError),
          errorJSON: toDebugJSONString(nextError),
        })
        setError(readOpenDataError(nextError))
        setLoading(false)
      }
    }

    void mount()
    return () => {
      cancelled = true
      dispose()
    }
  }, [msgID])

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载会话内容...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {error}
        </div>
      ) : null}
      <div ref={hostRef} className={loading || error ? "min-h-0" : "min-h-[24px]"} />
    </div>
  )
}
