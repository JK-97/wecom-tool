import { requestJSON } from "@/services/http"

export type MuYuAIConnectorStatus = {
  key: string
  name: string
  status: "connected" | "not_connected" | "unavailable" | string
  connected: boolean
  corp_id: string
  checked_at?: string
  connection?: MuYuAIConnection
}

export type MuYuAIConnection = {
  CorpID?: string
  MuYuAITenantID?: string
  MuYuAIUserID?: string
  MuYuAIUserPhone?: string
  Scopes?: string
  Status?: string
  TokenExpiresAt?: string
  ConnectedAt?: string
  UpdatedAt?: string
  corp_id?: string
  muyuai_tenant_id?: string
  muyuai_user_id?: string
  muyuai_user_phone?: string
  scopes?: string
  status?: string
  token_expires_at?: string
  connected_at?: string
  updated_at?: string
}

export type MuYuAIOAuthStart = {
  CorpID?: string
  ReturnURL?: string
  AuthorizeURL?: string
  State?: string
  ExpiresAt?: string
  corp_id?: string
  return_url?: string
  authorize_url?: string
  authorization_url?: string
  state?: string
  expires_at?: string
}

export type MuYuAIConnectorTestResult = {
  CorpID?: string
  Status?: string
  Message?: string
  Connection?: MuYuAIConnection
  UserInfo?: Record<string, unknown>
  Refreshed?: boolean
  TestedAt?: string
  corp_id?: string
  status?: string
  message?: string
  connection?: MuYuAIConnection
  user_info?: Record<string, unknown>
  refreshed?: boolean
  tested_at?: string
}

type APIEnvelope<T> = {
  code?: number
  message?: string
  data?: T
}

export async function getMuYuAIConnectorStatus(): Promise<MuYuAIConnectorStatus> {
  const payload = await requestJSON<APIEnvelope<MuYuAIConnectorStatus>>("/api/v1/connectors/muyuai/status")
  return payload.data || {
    key: "muyuai",
    name: "MuYuAI",
    status: "unavailable",
    connected: false,
    corp_id: "",
  }
}

export async function startMuYuAIOAuth(returnURL: string): Promise<MuYuAIOAuthStart> {
  const payload = await requestJSON<APIEnvelope<MuYuAIOAuthStart>>("/api/v1/connectors/muyuai/oauth/start", {
    method: "POST",
    body: JSON.stringify({ return_url: returnURL }),
  })
  return payload.data || {}
}

export async function refreshMuYuAIConnection(): Promise<MuYuAIConnection> {
  const payload = await requestJSON<APIEnvelope<MuYuAIConnection>>("/api/v1/connectors/muyuai/refresh", {
    method: "POST",
    body: JSON.stringify({}),
  })
  return payload.data || {}
}

export async function testMuYuAIConnection(): Promise<MuYuAIConnectorTestResult> {
  const payload = await requestJSON<APIEnvelope<MuYuAIConnectorTestResult>>("/api/v1/connectors/muyuai/test", {
    method: "POST",
    body: JSON.stringify({}),
  })
  return payload.data || {}
}
