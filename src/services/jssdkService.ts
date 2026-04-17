import * as ww from "@wecom/jssdk"
import { requestJSON } from "./http"

const CHECK_JS_API_LIST = [
  "getContext",
  "getCurExternalContact",
  "getCurExternalChat",
  "sendChatMessage",
  "navigateToKfChat",
] as const
const MAIN_WEBVIEW_CHECK_API_LIST = ["getContext", "checkJsApi"] as const

const REGISTER_JS_API_LIST = ["checkJsApi", ...CHECK_JS_API_LIST]

const SINGLE_ENTRIES = new Set(["single_chat_tools", "contact_profile", "single_kf_tools"])
const GROUP_ENTRIES = new Set(["group_chat_tools"])
const SEND_ALLOWED_ENTRIES = new Set(["single_chat_tools", "group_chat_tools", "chat_attachment", "single_kf_tools"])

const REGISTER_RETRY_LIMIT = 3
const REGISTER_RETRY_DELAY_MS = 220

type SignatureValue = {
  timestamp: number
  nonce_str: string
  signature: string
}

type SignatureBundle = {
  corp_id: string
  suite_id: string
  agent_id: number
  config_signature: SignatureValue
  agent_config_signature: SignatureValue
}

type SignatureReply = {
  code?: number
  message?: string
  data?: SignatureBundle
}

type RuntimeState = "external_browser" | "wecom_bridge_pending" | "wecom_bridge_ready"

type RuntimeDiagnostics = {
  userAgent: string
  isWxworkWebView: boolean
  runtimeState: RuntimeState
  hasWindowWW: boolean
  windowWWRegisterType: string
  jssdkRegisterType: string
  jssdkCheckJsApiType: string
  jssdkGetContextType: string
}

type ErrorCode =
  | "unsupported"
  | "bridge_pending"
  | "permission_denied"
  | "api_unsupported"
  | "context_unavailable"
  | "register_failed"
  | "unknown"

export type SidebarRuntimeMode = "single" | "group" | "unknown"

export type SidebarRuntimeContext = {
  entry: string
  mode: SidebarRuntimeMode
  open_kfid: string
  external_userid: string
  chat_id: string
  api_support: Record<string, boolean>
}

export type MainWebviewJSSDKCheckResult = {
  is_wecom_webview: boolean
  runtime_state: RuntimeState
  register_ok: boolean
  check_ok: boolean
  check_result: Record<string, boolean>
  error_code?: string
  error_message?: string
}

export class JSSDKRuntimeError extends Error {
  code: ErrorCode
  detail?: unknown

  constructor(code: ErrorCode, message: string, detail?: unknown) {
    super(message)
    this.name = "JSSDKRuntimeError"
    this.code = code
    this.detail = detail
  }
}

const signatureCache = new Map<string, SignatureBundle>()
let registerPromise: Promise<void> | null = null
let checkedApiCache: Record<string, boolean> | null = null

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.trunc(parsed)
  }
  return 0
}

function currentPageURL(): string {
  if (typeof window === "undefined") return ""
  return (window.location.href || "").trim()
}

function readQueryParam(name: string): string {
  if (typeof window === "undefined") return ""
  const params = new URLSearchParams(window.location.search)
  return (params.get(name) || "").trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function logJSSDKDiagnostic(stage: string, detail?: unknown): void {
  if (typeof console === "undefined" || typeof console.info !== "function") return
  if (detail === undefined) {
    console.info(`[wecom-jssdk] ${stage}`)
    return
  }
  console.info(`[wecom-jssdk] ${stage}`, detail)
}

function inferRuntimeState(isWxworkWebView: boolean, hasWindowWW: boolean, windowWWRegisterType: string): RuntimeState {
  if (hasWindowWW && windowWWRegisterType === "function") {
    return "wecom_bridge_ready"
  }
  if (isWxworkWebView || hasWindowWW) {
    return "wecom_bridge_pending"
  }
  return "external_browser"
}

function readRuntimeDiagnostics(): RuntimeDiagnostics {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent || ""
  const isWxworkWebView = /wxwork/i.test(userAgent)
  const windowWW = typeof window === "undefined" ? undefined : (window as Window & { ww?: Record<string, unknown> }).ww
  const hasWindowWW = Boolean(windowWW)
  const windowWWRegisterType = typeof windowWW?.register
  const runtimeState = inferRuntimeState(isWxworkWebView, hasWindowWW, windowWWRegisterType)

  return {
    userAgent,
    isWxworkWebView,
    runtimeState,
    hasWindowWW,
    windowWWRegisterType,
    jssdkRegisterType: typeof ww.register,
    jssdkCheckJsApiType: typeof ww.checkJsApi,
    jssdkGetContextType: typeof ww.getContext,
  }
}

function normalizeMessage(error: unknown): string {
  if (error instanceof Error) return error.message || ""
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return ""
  }
}

function mapRuntimeError(
  error: unknown,
  options?: { stage?: string; diagnostics?: RuntimeDiagnostics },
): JSSDKRuntimeError {
  if (error instanceof JSSDKRuntimeError) return error

  const stage = options?.stage || "unknown"
  const diagnostics = options?.diagnostics
  const message = normalizeMessage(error)
  const normalized = message.toLowerCase()

  const looksLikeBridgeIssue =
    normalized.includes("window.ww") ||
    normalized.includes("cannot read properties") ||
    normalized.includes("bridge") ||
    normalized.includes("not initialized") ||
    normalized.includes("js-sdk not ready")

  if (normalized.includes("permission denied")) {
    return new JSSDKRuntimeError("permission_denied", "当前账号无权限调用企业微信会话能力。", {
      stage,
      diagnostics,
      message,
      raw: error,
    })
  }

  if (looksLikeBridgeIssue) {
    const inWeComLikeRuntime = diagnostics?.runtimeState !== "external_browser"
    if (inWeComLikeRuntime) {
      return new JSSDKRuntimeError("bridge_pending", "企业微信 JS Bridge 尚未就绪，请稍后重试。", {
        stage,
        diagnostics,
        message,
        raw: error,
      })
    }
    return new JSSDKRuntimeError("unsupported", "当前不在企业微信客户端环境，无法调用会话能力。", {
      stage,
      diagnostics,
      message,
      raw: error,
    })
  }

  if (normalized.includes("not support") || normalized.includes("unsupported") || normalized.includes("checkjsapi")) {
    return new JSSDKRuntimeError("api_unsupported", "当前企业微信客户端不支持所需 JS-SDK 能力。", {
      stage,
      diagnostics,
      message,
      raw: error,
    })
  }

  if (stage === "get_context" || normalized.includes("getcontext") || normalized.includes("context")) {
    return new JSSDKRuntimeError("context_unavailable", "当前环境无法读取企业微信会话上下文。", {
      stage,
      diagnostics,
      message,
      raw: error,
    })
  }

  if (
    stage === "register" ||
    normalized.includes("config") ||
    normalized.includes("signature") ||
    normalized.includes("agentconfig")
  ) {
    return new JSSDKRuntimeError("register_failed", "企业微信 JS-SDK 初始化失败，请稍后重试。", {
      stage,
      diagnostics,
      message,
      raw: error,
    })
  }

  return new JSSDKRuntimeError("unknown", "企业微信客户端能力调用失败。", {
    stage,
    diagnostics,
    message,
    raw: error,
  })
}

async function fetchSignatureBundle(targetURL: string): Promise<SignatureBundle> {
  const normalizedURL = targetURL.trim()
  if (!normalizedURL) {
    throw new JSSDKRuntimeError("register_failed", "签名 URL 为空，无法初始化 JS-SDK。")
  }
  const cacheKey = normalizedURL
  const cached = signatureCache.get(cacheKey)
  if (cached) return cached

  const payload = await requestJSON<SignatureReply>("/api/v1/wecom/js-sdk/signature", {
    method: "POST",
    body: JSON.stringify({
      url: normalizedURL,
    }),
  })

  const data = payload?.data
  if (!data) {
    throw new JSSDKRuntimeError("register_failed", "签名接口返回为空。")
  }

  const bundle: SignatureBundle = {
    corp_id: readString(data.corp_id),
    suite_id: readString(data.suite_id),
    agent_id: readInt(data.agent_id),
    config_signature: {
      timestamp: readInt(data.config_signature?.timestamp),
      nonce_str: readString(data.config_signature?.nonce_str),
      signature: readString(data.config_signature?.signature),
    },
    agent_config_signature: {
      timestamp: readInt(data.agent_config_signature?.timestamp),
      nonce_str: readString(data.agent_config_signature?.nonce_str),
      signature: readString(data.agent_config_signature?.signature),
    },
  }

  if (
    !bundle.corp_id ||
    bundle.agent_id <= 0 ||
    bundle.config_signature.timestamp <= 0 ||
    !bundle.config_signature.nonce_str ||
    !bundle.config_signature.signature ||
    bundle.agent_config_signature.timestamp <= 0 ||
    !bundle.agent_config_signature.nonce_str ||
    !bundle.agent_config_signature.signature
  ) {
    throw new JSSDKRuntimeError("register_failed", "签名接口返回字段不完整。", data)
  }

  logJSSDKDiagnostic("signature_bundle_loaded", {
    url: normalizedURL,
    corp_id: bundle.corp_id,
    suite_id: bundle.suite_id,
    agent_id: bundle.agent_id,
  })
  signatureCache.set(cacheKey, bundle)
  return bundle
}

async function registerWithJSSDK(pageURL: string): Promise<void> {
  const seedBundle = await fetchSignatureBundle(pageURL)
  const fixedAgentID = seedBundle.agent_id
  const getBundle = async (rawURL: string): Promise<SignatureBundle> => {
    const source = rawURL && rawURL.trim() ? rawURL.trim() : pageURL
    return fetchSignatureBundle(source)
  }

  const registerOptions: Parameters<typeof ww.register>[0] = {
    corpId: seedBundle.corp_id,
    suiteId: seedBundle.suite_id || undefined,
    agentId: fixedAgentID,
    jsApiList: [...REGISTER_JS_API_LIST],
    async getConfigSignature(url: string) {
      const bundle = await getBundle(url)
      return {
        timestamp: bundle.config_signature.timestamp,
        nonceStr: bundle.config_signature.nonce_str,
        signature: bundle.config_signature.signature,
      }
    },
    async getAgentConfigSignature(url: string) {
      const bundle = await getBundle(url)
      return {
        timestamp: bundle.agent_config_signature.timestamp,
        nonceStr: bundle.agent_config_signature.nonce_str,
        signature: bundle.agent_config_signature.signature,
      }
    },
    onConfigFail(detail) {
      logJSSDKDiagnostic("register_config_fail", { detail })
    },
    onAgentConfigFail(detail) {
      logJSSDKDiagnostic("register_agent_config_fail", { detail })
    },
  }

  logJSSDKDiagnostic("register_options_ready", {
    corp_id: seedBundle.corp_id,
    suite_id: seedBundle.suite_id,
    agent_id: fixedAgentID,
    js_api_list: [...REGISTER_JS_API_LIST],
  })
  ww.register(registerOptions)
  if (typeof ww.ensureConfigReady === "function") {
    await ww.ensureConfigReady()
  }
}

async function ensureRegistered(): Promise<void> {
  if (registerPromise) return registerPromise

  registerPromise = (async () => {
    const diagnostics = readRuntimeDiagnostics()
    logJSSDKDiagnostic("environment_detect", diagnostics)

    if (diagnostics.runtimeState === "external_browser") {
      throw new JSSDKRuntimeError("unsupported", "当前不在企业微信客户端环境，无法调用会话能力。", {
        stage: "environment_detect",
        diagnostics,
      })
    }

    const pageURL = currentPageURL()
    if (!pageURL) {
      throw new JSSDKRuntimeError("register_failed", "无法读取当前页面地址，JS-SDK 初始化失败。", {
        stage: "register",
      })
    }

    for (let attempt = 1; attempt <= REGISTER_RETRY_LIMIT; attempt += 1) {
      try {
        logJSSDKDiagnostic("register_start", {
          attempt,
          retry_limit: REGISTER_RETRY_LIMIT,
          runtime_state: diagnostics.runtimeState,
        })
        await registerWithJSSDK(pageURL)
        logJSSDKDiagnostic("register_success", {
          attempt,
          runtime_state: diagnostics.runtimeState,
        })
        return
      } catch (error) {
        const mapped = mapRuntimeError(error, { stage: "register", diagnostics })
        logJSSDKDiagnostic("register_failed", {
          attempt,
          code: mapped.code,
          message: mapped.message,
          detail: mapped.detail,
        })

        if (mapped.code === "bridge_pending" && attempt < REGISTER_RETRY_LIMIT) {
          await sleep(REGISTER_RETRY_DELAY_MS)
          continue
        }
        throw mapped
      }
    }
  })()

  try {
    await registerPromise
  } catch (error) {
    registerPromise = null
    throw mapRuntimeError(error, { stage: "register" })
  }
}

function parseJsApiResult(raw: Record<string, unknown> | undefined): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const name of CHECK_JS_API_LIST) {
    const value = raw?.[name]
    result[name] = value === true || value === "true" || value === 1
  }
  return result
}

function toUnknownRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>
  }
  return {}
}

async function ensureSupportedAPIs(): Promise<Record<string, boolean>> {
  if (checkedApiCache) return checkedApiCache
  if (typeof ww.checkJsApi !== "function") {
    throw new JSSDKRuntimeError("api_unsupported", "当前企业微信客户端不支持 checkJsApi。", { stage: "check_js_api" })
  }

  logJSSDKDiagnostic("check_js_api_start", { api_list: [...CHECK_JS_API_LIST] })
  try {
    const raw = await ww.checkJsApi({ jsApiList: [...CHECK_JS_API_LIST] })
    const checkResult = toUnknownRecord((raw as { checkResult?: unknown }).checkResult)
    checkedApiCache = parseJsApiResult(checkResult)
    logJSSDKDiagnostic("check_js_api_done", { result: checkedApiCache })
    return checkedApiCache
  } catch (error) {
    throw mapRuntimeError(error, { stage: "check_js_api", diagnostics: readRuntimeDiagnostics() })
  }
}

function normalizeEntry(entry: unknown): string {
  return typeof entry === "string" ? entry.trim().toLowerCase() : ""
}

function inferMode(entry: string, externalUserID: string, chatID: string): SidebarRuntimeMode {
  if (GROUP_ENTRIES.has(entry) || chatID) return "group"
  if (SINGLE_ENTRIES.has(entry) || externalUserID) return "single"
  return "unknown"
}

function readExternalUserID(payload: Record<string, unknown>): string {
  return (
    readString(payload.externalUserId) ||
    readString(payload.external_userid) ||
    readString(payload.externalUserid) ||
    readString(payload.userId) ||
    readString(payload.userid)
  )
}

function readChatID(payload: Record<string, unknown>): string {
  return readString(payload.chatId) || readString(payload.chat_id)
}

function readOpenKFID(payload: Record<string, unknown>): string {
  return (
    readString(payload.openKfId) ||
    readString(payload.open_kfid) ||
    readString(payload.openKFID) ||
    readString(payload.kfOpenId) ||
    readString(payload.kf_open_id)
  )
}

export async function resolveSidebarRuntimeContext(): Promise<SidebarRuntimeContext> {
  try {
    await ensureRegistered()
    const apiSupport = await ensureSupportedAPIs()
    if (!apiSupport.getContext || typeof ww.getContext !== "function") {
      throw new JSSDKRuntimeError("api_unsupported", "当前环境无法读取企业微信会话上下文。", {
        stage: "get_context",
      })
    }

    logJSSDKDiagnostic("get_context_start")
    const context = await ww.getContext()
    const contextRecord = toUnknownRecord(context)
    const entry = normalizeEntry(context?.entry)
    logJSSDKDiagnostic("get_context_done", { entry, raw_entry: context?.entry, raw_context: contextRecord })

    const modeByEntry = inferMode(entry, "", "")
    let openKFID = readOpenKFID(contextRecord)
    let externalUserID = readExternalUserID(contextRecord)
    let chatID = ""

    if (modeByEntry !== "group" && apiSupport.getCurExternalContact && typeof ww.getCurExternalContact === "function") {
      try {
        const contactRecord = toUnknownRecord(await ww.getCurExternalContact())
        externalUserID = readExternalUserID(contactRecord) || externalUserID
        openKFID = readOpenKFID(contactRecord) || openKFID
      } catch {
        externalUserID = externalUserID || ""
      }
    }

    if (modeByEntry !== "single" && apiSupport.getCurExternalChat && typeof ww.getCurExternalChat === "function") {
      try {
        chatID = readChatID(toUnknownRecord(await ww.getCurExternalChat()))
      } catch {
        chatID = ""
      }
    }

    if (!chatID && modeByEntry === "group") {
      chatID = readQueryParam("chat_id")
      if (chatID) {
        logJSSDKDiagnostic("chat_id_fallback_from_query", { chat_id: chatID })
      }
    }
    if (!openKFID) {
      openKFID = readQueryParam("open_kfid")
      if (openKFID) {
        logJSSDKDiagnostic("open_kfid_fallback_from_query", { open_kfid: openKFID })
      }
    }
    if (!externalUserID) {
      externalUserID = readQueryParam("external_userid")
      if (externalUserID) {
        logJSSDKDiagnostic("external_userid_fallback_from_query", { external_userid: externalUserID })
      }
    }

    return {
      entry,
      mode: inferMode(entry, externalUserID, chatID),
      open_kfid: openKFID,
      external_userid: externalUserID,
      chat_id: chatID,
      api_support: apiSupport,
    }
  } catch (error) {
    const mapped = mapRuntimeError(error, { stage: "resolve_runtime", diagnostics: readRuntimeDiagnostics() })
    logJSSDKDiagnostic("resolve_runtime_failed", {
      code: mapped.code,
      message: mapped.message,
      detail: mapped.detail,
    })
    throw mapped
  }
}

export async function sendTextToCurrentSession(
  content: string,
  target?: { external_userid?: string; chat_id?: string },
): Promise<{ mode: SidebarRuntimeMode; external_userid: string; chat_id: string }> {
  const text = content.trim()
  if (!text) {
    throw new JSSDKRuntimeError("context_unavailable", "发送内容为空，无法填入。")
  }

  await ensureRegistered()
  const runtime = await resolveSidebarRuntimeContext()
  if (!runtime.api_support.sendChatMessage || typeof ww.sendChatMessage !== "function") {
    throw new JSSDKRuntimeError("api_unsupported", "当前客户端不支持 sendChatMessage。")
  }

  const externalUserID = readString(target?.external_userid) || runtime.external_userid
  const chatID = readString(target?.chat_id) || runtime.chat_id
  if (runtime.entry && !SEND_ALLOWED_ENTRIES.has(runtime.entry)) {
    throw new JSSDKRuntimeError("context_unavailable", "当前入口不支持会话填入，请在聊天工具栏内使用。")
  }

  try {
    await ww.sendChatMessage({
      msgtype: "text",
      text: { content: text },
      enterChat: false,
    })

    return {
      mode: inferMode(runtime.entry, externalUserID, chatID),
      external_userid: externalUserID,
      chat_id: chatID,
    }
  } catch (error) {
    throw mapRuntimeError(error, { stage: "send_chat_message", diagnostics: readRuntimeDiagnostics() })
  }
}

export async function openWecomKfConversation(target: {
  open_kfid?: string
  external_userid?: string
}): Promise<void> {
  const openKfId = readString(target?.open_kfid)
  const externalUserId = readString(target?.external_userid)
  if (!openKfId) {
    throw new JSSDKRuntimeError("context_unavailable", "缺少客服账号，无法在企业微信中打开会话。")
  }

  await ensureRegistered()
  const apiSupport = await ensureSupportedAPIs()
  if (!apiSupport.navigateToKfChat || typeof ww.navigateToKfChat !== "function") {
    throw new JSSDKRuntimeError("api_unsupported", "当前客户端不支持打开微信客服会话。")
  }

  try {
    await ww.navigateToKfChat({
      openKfId,
      externalUserId: externalUserId || undefined,
    })
  } catch (error) {
    throw mapRuntimeError(error, { stage: "navigate_to_kf_chat", diagnostics: readRuntimeDiagnostics() })
  }
}

export function normalizeJSSDKRuntimeError(error: unknown): JSSDKRuntimeError {
  return mapRuntimeError(error, { diagnostics: readRuntimeDiagnostics() })
}

export function toJSSDKErrorMessage(error: unknown): string {
  const mapped = normalizeJSSDKRuntimeError(error)
  switch (mapped.code) {
    case "unsupported":
      return "当前不在企业微信客户端，无法直接填入"
    case "bridge_pending":
      return "企业微信 JS Bridge 正在初始化，请稍后再试"
    case "permission_denied":
      return "当前账号暂无企业微信会话操作权限"
    case "api_unsupported":
      return "当前企业微信客户端版本不支持该能力"
    case "context_unavailable":
      return mapped.message
    case "register_failed":
      return "企业微信 JS-SDK 初始化失败"
    default:
      return "企业微信客户端调用失败"
  }
}

export async function checkMainWebviewJSSDKRuntime(): Promise<MainWebviewJSSDKCheckResult> {
  const diagnostics = readRuntimeDiagnostics()
  const emptyCheck: Record<string, boolean> = {}
  for (const name of MAIN_WEBVIEW_CHECK_API_LIST) {
    emptyCheck[name] = false
  }

  try {
    await ensureRegistered()
    if (typeof ww.checkJsApi !== "function") {
      return {
        is_wecom_webview: diagnostics.isWxworkWebView,
        runtime_state: diagnostics.runtimeState,
        register_ok: true,
        check_ok: false,
        check_result: emptyCheck,
        error_code: "api_unsupported",
        error_message: "当前环境不支持 checkJsApi",
      }
    }
    const raw = await ww.checkJsApi({ jsApiList: [...MAIN_WEBVIEW_CHECK_API_LIST] })
    const checkResult = toUnknownRecord((raw as { checkResult?: unknown }).checkResult)
    const parsed: Record<string, boolean> = {}
    for (const name of MAIN_WEBVIEW_CHECK_API_LIST) {
      const value = checkResult[name]
      parsed[name] = value === true || value === "true" || value === 1
    }
    return {
      is_wecom_webview: diagnostics.isWxworkWebView,
      runtime_state: diagnostics.runtimeState,
      register_ok: true,
      check_ok: true,
      check_result: parsed,
    }
  } catch (error) {
    const mapped = normalizeJSSDKRuntimeError(error)
    return {
      is_wecom_webview: diagnostics.isWxworkWebView,
      runtime_state: diagnostics.runtimeState,
      register_ok: mapped.code !== "register_failed",
      check_ok: false,
      check_result: emptyCheck,
      error_code: mapped.code,
      error_message: mapped.message,
    }
  }
}
