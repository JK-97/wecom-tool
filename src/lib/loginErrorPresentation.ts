import { normalizeErrorMessage } from "@/services/http"

export type LoginErrorPresentation = {
  title: string
  description?: string
}

function normalizeRawMessage(error: unknown): string {
  return normalizeErrorMessage(error).trim()
}

function includesAny(raw: string, patterns: string[]): boolean {
  const lower = raw.toLowerCase()
  return patterns.some((pattern) => lower.includes(pattern.toLowerCase()))
}

export function presentLoginError(error: unknown): LoginErrorPresentation {
  const raw = normalizeRawMessage(error)

  if (!raw) {
    return {
      title: "暂时无法完成登录",
      description: "请稍后重试；如果问题持续存在，请联系管理员检查企业微信登录配置。",
    }
  }

  if (
    includesAny(raw, [
      "invalid suite ticket",
      "suite_access_token",
      "suite ticket",
      "get_suite_token",
      "authorized app visibility failed",
      "read authorized app visibility failed",
    ])
  ) {
    return {
      title: "企业微信登录服务暂时不可用",
      description: "请稍后重试；如果持续失败，请联系管理员检查服务商授权与企业微信应用配置。",
    }
  }

  if (includesAny(raw, ["登录面板初始化失败", "登录面板参数不完整", "企业微信登录组件不可用"])) {
    return {
      title: "登录面板暂时不可用",
      description: "请刷新页面后重试；如果仍无法打开，请联系管理员检查登录配置。",
    }
  }

  if (includesAny(raw, ["缺少 code", "login fail", "企业微信登录失败"])) {
    return {
      title: "企业微信登录未完成",
      description: "请重新发起登录；如果多次失败，请改用新的浏览器页签重试。",
    }
  }

  if (includesAny(raw, ["failed to load https://open.work.weixin.qq.com", "networkerror", "failed to fetch"])) {
    return {
      title: "登录资源加载失败",
      description: "请检查当前网络后重试，或稍后再次打开登录页。",
    }
  }

  if (includesAny(raw, ["timeout", "timed out", "aborterror"])) {
    return {
      title: "登录请求超时",
      description: "网络可能暂时较慢，请稍后重试。",
    }
  }

  return {
    title: "暂时无法完成登录",
    description: "请稍后重试；如果问题持续存在，请联系管理员协助排查。",
  }
}
