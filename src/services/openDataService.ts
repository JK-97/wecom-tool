import * as ww from "@wecom/jssdk"
import { requestJSON } from "./http"

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
  data?: Partial<SignatureBundle>
}

type SignatureCacheEntry = {
  bundle: SignatureBundle
  expiresAt: number
}

export type OpenDataAvailability =
  | "ready"
  | "initializing"
  | "unsupported"
  | "login_required"
  | "error"

export type OpenDataRuntime = {
  availability: OpenDataAvailability
  isWeComWebView: boolean
  canUseOpenData: boolean
  reason?: string
}

type WWOpenDataGlobal = {
  bind?: (el: Element) => void
  bindAll?: (nodeList: NodeList | Element[]) => void
  checkSession?: (params: { success?: () => void; fail?: () => void }) => void
}

type WWAppInvoker = {
  invokeJsApiByCallInfo?: (payload: Record<string, unknown>) => Promise<unknown> | unknown
}

const JWEIXIN_SDK_URL = "https://res.wx.qq.com/open/js/jweixin-1.2.0.js"
const JWXWORK_SDK_URL = "https://open.work.weixin.qq.com/wwopen/js/jwxwork-1.0.0.js"
const OPEN_DATA_REGISTER_API_LIST = ["checkJsApi", "wwapp.invokeJsApiByCallInfo"]
const SIGNATURE_CACHE_TTL_MS = 30 * 1000
const OPEN_DATA_DEBUG_PREFIX = "[chatdata/open-data]"

let openDataReadyPromise: Promise<OpenDataRuntime> | null = null
const signatureCache = new Map<string, SignatureCacheEntry>()
const signaturePromiseCache = new Map<string, Promise<SignatureBundle>>()

declare global {
  interface Window {
    WWOpenData?: WWOpenDataGlobal
    wx?: unknown
    wwapp?: WWAppInvoker
  }
}

function currentPageURL(): string {
  if (typeof window === "undefined") return ""
  return (window.location.href || "").trim()
}

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

function isWeComWebView(): boolean {
  if (typeof navigator === "undefined") return false
  return /wxwork/i.test(navigator.userAgent || "")
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "open-data 初始化失败"
  if (typeof error === "string") return error
  return "open-data 初始化失败"
}

function debugOpenData(label: string, payload?: unknown): void {
  try {
    if (payload === undefined) {
      console.info(OPEN_DATA_DEBUG_PREFIX, label)
      return
    }
    console.info(OPEN_DATA_DEBUG_PREFIX, label, payload)
  } catch {
    console.info(OPEN_DATA_DEBUG_PREFIX, label)
  }
}

function createRuntime(
  availability: OpenDataAvailability,
  reason?: string,
): OpenDataRuntime {
  return {
    availability,
    isWeComWebView: isWeComWebView(),
    canUseOpenData: availability === "ready",
    reason,
  }
}

function openDataLoginHint(): string {
  return "当前页面未建立有效的企业微信登录态，请重新通过企业微信登录面板登录后再查看，或在企业微信内打开。"
}

function ensureScript(src: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>(`script[data-open-data-sdk="${src}"]`)
  if (existing) {
    if (existing.dataset.loaded === "true") return Promise.resolve()
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error(`failed to load ${src}`)), { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.referrerPolicy = "origin"
    script.dataset.openDataSdk = src
    script.addEventListener("load", () => {
      script.dataset.loaded = "true"
      resolve()
    }, { once: true })
    script.addEventListener("error", () => reject(new Error(`failed to load ${src}`)), { once: true })
    document.head.appendChild(script)
  })
}

async function ensureOpenDataScripts(): Promise<void> {
  await ensureScript(JWEIXIN_SDK_URL)
  await ensureScript(JWXWORK_SDK_URL)
}

async function fetchSignatureBundle(targetURL: string): Promise<SignatureBundle> {
  const cacheKey = targetURL.trim()
  const cached = signatureCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    debugOpenData("signature cache hit", { url: cacheKey })
    return cached.bundle
  }

  const inflight = signaturePromiseCache.get(cacheKey)
  if (inflight) {
    return inflight
  }

  const request = requestJSON<SignatureReply>("/api/v1/wecom/js-sdk/signature", {
    method: "POST",
    body: JSON.stringify({ url: targetURL }),
    skipAuthRedirect: true,
  })
    .then((payload) => {
      debugOpenData("signature response", { url: cacheKey, hasData: Boolean(payload?.data) })
      const data = payload?.data
      if (!data) {
        throw new Error("签名接口返回为空")
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
        throw new Error("签名接口返回字段不完整")
      }

      signatureCache.set(cacheKey, {
        bundle,
        expiresAt: Date.now() + SIGNATURE_CACHE_TTL_MS,
      })
      debugOpenData("signature bundle ready", {
        url: cacheKey,
        corpId: bundle.corp_id,
        agentId: bundle.agent_id,
        hasConfigSignature: Boolean(bundle.config_signature.signature),
        hasAgentConfigSignature: Boolean(bundle.agent_config_signature.signature),
      })
      return bundle
    })
    .finally(() => {
      signaturePromiseCache.delete(cacheKey)
    })

  signaturePromiseCache.set(cacheKey, request)
  return request
}

async function registerOpenDataIdentity(pageURL: string): Promise<void> {
  const bundle = await fetchSignatureBundle(pageURL)
  debugOpenData("register start", {
    pageURL,
    corpId: bundle.corp_id,
    agentId: bundle.agent_id,
    jsApiList: [...OPEN_DATA_REGISTER_API_LIST],
  })
  ww.register({
    corpId: bundle.corp_id,
    suiteId: bundle.suite_id || undefined,
    agentId: bundle.agent_id,
    jsApiList: [...OPEN_DATA_REGISTER_API_LIST],
    async getConfigSignature(url: string) {
      const current = await fetchSignatureBundle(url && url.trim() ? url.trim() : pageURL)
      return {
        timestamp: current.config_signature.timestamp,
        nonceStr: current.config_signature.nonce_str,
        signature: current.config_signature.signature,
      }
    },
    async getAgentConfigSignature(url: string) {
      const current = await fetchSignatureBundle(url && url.trim() ? url.trim() : pageURL)
      return {
        timestamp: current.agent_config_signature.timestamp,
        nonceStr: current.agent_config_signature.nonce_str,
        signature: current.agent_config_signature.signature,
      }
    },
  })
  if (isWeComWebView() && typeof ww.ensureConfigReady === "function") {
    debugOpenData("ensureConfigReady start")
    await ww.ensureConfigReady()
    debugOpenData("ensureConfigReady done")
  }
}

function ensureOpenDataSession(): Promise<void> {
  const runtime = window.WWOpenData
  if (!runtime?.checkSession) return Promise.resolve()
  debugOpenData("checkSession start")
  return new Promise((resolve, reject) => {
    runtime.checkSession?.({
      success() {
        debugOpenData("checkSession success")
        resolve()
      },
      fail() {
        debugOpenData("checkSession fail")
        reject(new Error(openDataLoginHint()))
      },
    })
  })
}

export async function ensureOpenDataReady(): Promise<OpenDataRuntime> {
  if (typeof window === "undefined") {
    return createRuntime("unsupported", "当前环境不支持浏览器 open-data。")
  }
  if (openDataReadyPromise) return openDataReadyPromise

  openDataReadyPromise = (async () => {
    try {
      const pageURL = currentPageURL()
      if (!pageURL) {
        return createRuntime("unsupported", "当前页面地址不可用，无法初始化通讯录展示组件。")
      }
      debugOpenData("ensureOpenDataReady begin", {
        pageURL,
        isWeComWebView: isWeComWebView(),
      })
      await ensureOpenDataScripts()
      await registerOpenDataIdentity(pageURL)
      await ww.initOpenData()
      debugOpenData("initOpenData done", {
        hasWWOpenData: Boolean(window.WWOpenData),
        hasBind: Boolean(window.WWOpenData?.bind),
        hasCheckSession: Boolean(window.WWOpenData?.checkSession),
        hasWWApp: typeof window.wwapp !== "undefined",
        hasInvokeJsApiByCallInfo: typeof window.wwapp?.invokeJsApiByCallInfo === "function",
      })
      if (!window.WWOpenData?.bind) {
        return createRuntime("unsupported", "当前环境未注入企业微信通讯录展示组件。")
      }
      await ensureOpenDataSession()
      debugOpenData("ensureOpenDataReady success")
      return createRuntime("ready")
    } catch (error) {
      const message = normalizeErrorMessage(error)
      debugOpenData("ensureOpenDataReady failed", {
        message,
        error,
        hasWWOpenData: Boolean(window.WWOpenData),
        hasWWApp: typeof window.wwapp !== "undefined",
        hasInvokeJsApiByCallInfo: typeof window.wwapp?.invokeJsApiByCallInfo === "function",
      })
      if (message.includes("登录态") || message.includes("403") || message.includes("跳转进入") || message.includes("同域页面")) {
        return createRuntime("login_required", openDataLoginHint())
      }
      return createRuntime("error", message)
    }
  })()

  const result = await openDataReadyPromise
  if (result.availability !== "ready") {
    openDataReadyPromise = null
  }
  return result
}

export function bindOpenDataElement(element: Element | null): void {
  if (!element || !window.WWOpenData?.bind) return
  window.WWOpenData.bind(element)
}

export async function invokeOpenDataCallInfo(payload: Record<string, unknown>): Promise<unknown> {
  const runtime = await ensureOpenDataReady()
  if (!runtime.canUseOpenData) {
    throw new Error(runtime.reason || "当前环境暂不支持会话展示组件。")
  }
  const fn = window.wwapp?.invokeJsApiByCallInfo
  if (typeof fn !== "function") {
    throw new Error("当前环境未注入 wwapp.invokeJsApiByCallInfo。")
  }
  debugOpenData("invokeOpenDataCallInfo", {
    keys: Object.keys(payload || {}),
    hasWWApp: Boolean(window.wwapp),
  })
  return await fn(payload)
}
