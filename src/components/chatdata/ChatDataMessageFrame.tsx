import * as ww from "@wecom/jssdk"
import { useEffect, useRef, useState } from "react"
import { ensureOpenDataReady } from "@/services/openDataService"
import { type ChatDataDisplayBootstrap, type ChatDataMessageSummary } from "@/services/chatdataService"
import { normalizeErrorMessage } from "@/services/http"

const MESSAGE_SHELL_REF = "message-shell"
const MIN_MESSAGE_WIDTH = 180
const MAX_MESSAGE_WIDTH = 420
const MESSAGE_SIDE_CHROME = 52
const MIN_RENDERED_MESSAGE_HEIGHT = 56

// 会话展示组件 template 内支持的 ww-open-data，
// 与浏览器通讯录展示组件不是同一套语义。
type ChatMessageOpenDataNameType = "userName" | "externalUserName" | "chatName"
type ChatMessageOpenDataAvatarType = "userAvatar" | "externalUserAvatar"

function buildOpenDataStyle(
  tone: "incoming" | "outgoing",
  messageMaxWidth: number,
): string {
  const textColor = tone === "outgoing" ? "#ffffff" : "#111827"
  return `
.chatdata-shell {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-width: 100%;
}

.chatdata-shell--incoming {
  justify-content: flex-start;
}

.chatdata-shell--outgoing {
  justify-content: flex-end;
}

.chatdata-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  width: auto;
  max-width: ${messageMaxWidth}px;
}

.chatdata-main--incoming {
  align-items: flex-start;
}

.chatdata-main--outgoing {
  align-items: flex-end;
}

.chatdata-avatar {
  display: block;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  overflow: hidden;
  flex: none;
}

.chatdata-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  color: #6b7280;
  font-size: 14px;
}

.chatdata-sender-name {
  display: inline-block;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.25;
  color: #6b7280;
}

.chatdata-sender-name--incoming {
  margin-left: 4px;
}

.chatdata-sender-name--outgoing {
  margin-right: 4px;
  text-align: right;
}

.chatdata-message-shell {
  display: block;
  width: 100%;
  max-width: 100%;
  vertical-align: top;
  overflow: visible;
}

.chatdata-bubble {
  display: inline-block;
  max-width: 100%;
  overflow: visible;
  padding: 10px 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.chatdata-bubble--incoming {
  border: 1px solid #f3f4f6;
  background: #ffffff;
  color: #111827;
  border-radius: 16px 16px 16px 6px;
}

.chatdata-bubble--outgoing {
  background: #3b82f6;
  color: #ffffff;
  border-radius: 16px 16px 6px 16px;
}

.chatdata-meta {
  display: block;
  font-size: 11px;
  line-height: 1.25;
  color: #9ca3af;
  margin-top: 2px;
}

.chatdata-meta--incoming {
  margin-left: 4px;
  text-align: left;
}

.chatdata-meta--outgoing {
  margin-right: 4px;
  text-align: right;
}

.chatdata-message-node {
  display: block;
  width: 100%;
  max-width: 100%;
  color: ${textColor};
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
  overflow: visible;
}
`
}

function measureMessageMaxWidth(host: HTMLDivElement): number {
  const rowWidth =
    host.parentElement?.getBoundingClientRect().width ||
    host.getBoundingClientRect().width ||
    window.innerWidth ||
    375

  const available = Math.floor(rowWidth * 0.72) - MESSAGE_SIDE_CHROME
  return Math.max(MIN_MESSAGE_WIDTH, Math.min(MAX_MESSAGE_WIDTH, available))
}

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

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function buildSenderNameNode(props: {
  senderOpenID: string
  senderNameType: ChatMessageOpenDataNameType
  senderFallbackName: string
  tone: "incoming" | "outgoing"
}): string {
  if (!props.senderOpenID) {
    return `<span class="chatdata-sender-name chatdata-sender-name--${props.tone}">${escapeText(props.senderFallbackName)}</span>`
  }
  return `<ww-open-data class="chatdata-sender-name chatdata-sender-name--${props.tone}" type="${escapeAttr(props.senderNameType)}" openid="${escapeAttr(props.senderOpenID)}"></ww-open-data>`
}

function buildSenderAvatarNode(props: {
  senderOpenID: string
  senderAvatarType: ChatMessageOpenDataAvatarType
  senderFallbackName: string
}): string {
  if (!props.senderOpenID) {
    return `<view class="chatdata-avatar chatdata-avatar-fallback">${escapeText(props.senderFallbackName.slice(0, 1) || "?")}</view>`
  }
  return `<ww-open-data class="chatdata-avatar" type="${escapeAttr(props.senderAvatarType)}" openid="${escapeAttr(props.senderOpenID)}"></ww-open-data>`
}

function buildOpenDataTemplate(props: {
  msgID: string
  secretKey: string
  tone: "incoming" | "outgoing"
  footerTimeLabel: string
  senderOpenID: string
  senderNameType: ChatMessageOpenDataNameType
  senderAvatarType: ChatMessageOpenDataAvatarType
  senderFallbackName: string
}): string {
  const avatarNode = buildSenderAvatarNode(props)
  const nameNode = buildSenderNameNode(props)
  return `
<view class="chatdata-shell chatdata-shell--${props.tone}" ref="${MESSAGE_SHELL_REF}">
  ${props.tone === "incoming" ? avatarNode : ""}
  <view class="chatdata-main chatdata-main--${props.tone}">
    ${nameNode}
    <view class="chatdata-bubble chatdata-bubble--${props.tone}">
      <view class="chatdata-message-shell">
        <ww-open-message
          class="chatdata-message-node"
          message-id="${escapeAttr(props.msgID)}"
          secret-key="${escapeAttr(props.secretKey)}"
          display-type="text"
          open-type="viewMessage"
          binderror="handleMessageError"
        ></ww-open-message>
      </view>
    </view>
    <view class="chatdata-meta chatdata-meta--${props.tone}">${escapeText(props.footerTimeLabel)}</view>
  </view>
  ${props.tone === "outgoing" ? avatarNode : ""}
</view>
`
}

async function syncFrameSize(instance: ww.OpenDataFrameInstance, msgID: string) {
  const iframe = instance.el as HTMLIFrameElement
  iframe.setAttribute("scrolling", "no")
  iframe.style.overflow = "hidden"

  let bestWidth = 0
  let bestHeight = 0
  const delays = [0, 32, 96, 180, 320, 520, 800]

  for (const delay of delays) {
    if (delay > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, delay))
    }
    const rect = (await ww.getNodeInfo(instance, MESSAGE_SHELL_REF, { rect: true }))?.rect
    if (!rect) continue
    if (rect.width > bestWidth) bestWidth = rect.width
    if (rect.height > bestHeight) bestHeight = rect.height
  }
  if (bestWidth <= 0 || bestHeight <= 0) return

  const width = Math.max(40, Math.ceil(bestWidth) + 2)
  const height = Math.max(MIN_RENDERED_MESSAGE_HEIGHT, Math.ceil(bestHeight) + 2)
  iframe.style.width = `${width}px`
  iframe.style.height = `${height}px`
  iframe.style.maxWidth = "100%"
  iframe.style.opacity = "1"
  iframe.style.visibility = "visible"
  console.info("[chatdata/open-data] frame resized", { msgID, width, height, bestWidth, bestHeight })
}

export type ChatDataMessageRenderState = "loading" | "ready" | "error"

export function ChatDataMessageFrame(props: {
  message: ChatDataMessageSummary
  displayBootstrap?: ChatDataDisplayBootstrap | null
  tone?: "incoming" | "outgoing"
  footerTimeLabel?: string
  senderOpenID?: string
  senderNameType?: ChatMessageOpenDataNameType
  senderAvatarType?: ChatMessageOpenDataAvatarType
  senderFallbackName?: string
  onRenderStateChange?: (msgID: string, state: ChatDataMessageRenderState) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<ww.OpenDataFrameInstance<{ messageId: string; secretKey: string }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const msgID = (props.message.msg_id || "").trim()
  const tone = props.tone || "incoming"
  const senderOpenID = (props.senderOpenID || "").trim()
  const senderNameType = props.senderNameType || "userName"
  const senderAvatarType = props.senderAvatarType || "userAvatar"
  const senderFallbackName = (props.senderFallbackName || "").trim() || "成员"
  const footerTimeLabel = (props.footerTimeLabel || "").trim()
  const displayBootstrap = props.displayBootstrap || null
  const displayBootstrapError = (displayBootstrap?.error || "").trim()
  const displaySecretKey = (displayBootstrap?.secret_key || "").trim()

  useEffect(() => {
    if (!props.onRenderStateChange || !msgID) return
    if (error) {
      props.onRenderStateChange(msgID, "error")
      return
    }
    if (ready && !loading) {
      props.onRenderStateChange(msgID, "ready")
      return
    }
    props.onRenderStateChange(msgID, "loading")
  }, [error, loading, msgID, props.onRenderStateChange, ready])

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
        setReady(false)
        setError("消息 ID 缺失，无法渲染会话组件。")
        return
      }
      setLoading(true)
      setReady(false)
      setError("")
      dispose()
      try {
        if (displayBootstrapError) {
          throw new Error(displayBootstrapError)
        }
        console.info("[chatdata/open-data] message mount begin", {
          msgID,
          chatID: (props.message.chat_id || "").trim(),
          publicKeyVer: props.message.public_key_ver || 0,
          sendTime: props.message.send_time || 0,
        })
        const runtime = await ensureOpenDataReady()
        if (cancelled) return
        console.info("[chatdata/open-data] message bootstrap result", {
          msgID,
          hasBootstrap: Boolean(displayBootstrap),
          bootstrapMsgID: displayBootstrap?.msg_id || "",
          bootstrapChatID: displayBootstrap?.chat_id || "",
          hasSecretKey: Boolean(displaySecretKey),
          secretKeyLength: displaySecretKey.length,
          hasSecretKeyBase64: Boolean((displayBootstrap?.secret_key_base64 || "").trim()),
          secretKeyBase64Length: (displayBootstrap?.secret_key_base64 || "").trim().length,
        })
        if (!runtime.canUseOpenData) {
          throw new Error(runtime.reason || "当前环境暂不支持会话展示组件。")
        }
        if (!displaySecretKey) {
          throw new Error("会话展示数据缺失，无法渲染消息内容。")
        }
        const host = hostRef.current
        if (!host) return
        const messageMaxWidth = measureMessageMaxWidth(host)
        console.info("[chatdata/open-data] create frame", {
          msgID,
          senderOpenID,
          senderNameType,
          senderAvatarType,
          messageMaxWidth,
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
            setReady(false)
            setLoading(false)
          },
        })
        instanceRef.current = factory.createOpenDataFrame({
          el: host,
          data: {
            messageId: msgID,
            secretKey: displaySecretKey,
          },
          template: buildOpenDataTemplate({
            msgID,
            secretKey: displaySecretKey,
            tone,
            footerTimeLabel,
            senderOpenID,
            senderNameType,
            senderAvatarType,
            senderFallbackName,
          }),
          style: buildOpenDataStyle(tone, messageMaxWidth),
          async handleMounted() {
            if (cancelled) return
            if (instanceRef.current) {
              await syncFrameSize(instanceRef.current, msgID)
            }
            console.info("[chatdata/open-data] frame mounted", { msgID })
            setReady(true)
            setLoading(false)
          },
          async handleUpdated() {
            if (cancelled) return
            if (instanceRef.current) {
              await syncFrameSize(instanceRef.current, msgID)
            }
            console.info("[chatdata/open-data] frame updated", { msgID })
            setReady(true)
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
            setReady(false)
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
              setReady(false)
              setLoading(false)
            },
          },
        })
        const iframe = instanceRef.current.el as HTMLIFrameElement
        iframe.style.width = `${messageMaxWidth + MESSAGE_SIDE_CHROME}px`
        iframe.style.height = `${MIN_RENDERED_MESSAGE_HEIGHT}px`
        iframe.style.maxWidth = "100%"
        iframe.style.overflow = "hidden"
        iframe.style.opacity = "0"
        iframe.style.visibility = "hidden"
        iframe.setAttribute("scrolling", "no")
      } catch (nextError) {
        if (cancelled) return
        console.warn("[chatdata/open-data] message mount failed", {
          msgID,
          error: toDebugObject(nextError),
          errorJSON: toDebugJSONString(nextError),
        })
        setError(readOpenDataError(nextError))
        setReady(false)
        setLoading(false)
      }
    }

    void mount()
    return () => {
      cancelled = true
      dispose()
    }
  }, [
    displayBootstrap?.chat_id,
    displayBootstrap?.msg_id,
    displayBootstrap?.public_key_ver,
    displayBootstrapError,
    displaySecretKey,
    footerTimeLabel,
    msgID,
    senderAvatarType,
    senderFallbackName,
    senderNameType,
    senderOpenID,
    tone,
  ])

  return (
    <div className="inline-block max-w-full align-top">
      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {error}
        </div>
      ) : null}
      <div
        ref={hostRef}
        className={
          error
            ? "hidden"
            : ready && !loading
              ? "inline-block max-w-full align-top"
              : "pointer-events-none inline-block max-w-full align-top opacity-0"
        }
      />
    </div>
  )
}
