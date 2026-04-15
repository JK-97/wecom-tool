export type CommandCenterVersion = number;

// lastVersion is the latest command-center page version that has already been
// committed into the frontend store. The client must only apply
// incoming.version > lastVersion. Any version gap requires a full bootstrap.
export type CommandCenterLastVersion = number;

export interface CommandCenterDisplayMetaContract {
  sourceDisplayName: string;
  sourceHint: string;
  assignedUserid: string;
  assignedDisplayName: string;
  matchedRouteName: string;
  queueWaitText: string;
  queueLabel: string;
  sessionStatusLabel: string;
  entrySourceLabel: string;
}

export interface CommandCenterCustomerSummaryContract {
  externalUserid: string;
  displayName: string;
  avatarUrl: string;
  crmOwnerUserid: string;
  crmOwnerDisplayName: string;
  tags: string[];
}

export interface CommandCenterSessionSummaryContract {
  corpId: string;
  openKfid: string;
  externalUserid: string;
  customerName: string;
  customerAvatar: string;
  latestMessagePreview: string;
  latestMessageTime: string;
  lastActiveAt: string;
  unreadCount: number;
  sessionState: number;
  sessionStateCode: string;
  queueStateCode: string;
  isPinned: boolean;
  customer: CommandCenterCustomerSummaryContract | null;
  displayMeta: CommandCenterDisplayMetaContract | null;
}

export interface CommandCenterEntryContextContract {
  scene: string;
  sceneParam: string;
  sourceServicerUserid: string;
  sourceServicerDisplayName: string;
  welcomeCode: string;
}

export interface CommandCenterStatusBarContract {
  sessionState: number;
  sessionStateCode: string;
  sessionStatusLabel: string;
  queueStateCode: string;
  queueWaitText: string;
  assignedUserid: string;
  assignedDisplayName: string;
  matchedRouteName: string;
}

export interface CommandCenterMessageContract {
  id: string;
  msgId: string;
  direction: string;
  senderRole: string;
  senderDisplayName: string;
  msgType: string;
  contentText: string;
  deliveryStatus: string;
  failureReason: string;
  createdAt: string;
  occurredAt: string;
}

export interface CommandCenterRoutingRecordDetailsContract {
  executionResultLabel: string;
  currentTargetLabel: string;
  reason: string;
  dispatchStrategyLabel: string;
  queueLabel: string;
  traceId: string;
}

export interface CommandCenterRoutingRecordContract {
  id: string;
  occurredAt: string;
  actionText: string;
  actorLabel: string;
  targetLabel: string;
  routingRuleName: string;
  sourceLabel: string;
  details: CommandCenterRoutingRecordDetailsContract | null;
}

export interface CommandCenterMonitorContract {
  summary: string;
  emotion: {
    sentiment: string;
    trend: string;
    keywords: string[];
  } | null;
  summaryDetail: {
    summary: string;
    unresolvedItems: string[];
  } | null;
  compliance: {
    alerts: string[];
    risks: string[];
  } | null;
  meta: {
    updatedAt: string;
    model: string;
    confidence: string;
  } | null;
}

export interface CommandCenterSessionDetailContract {
  session: CommandCenterSessionSummaryContract;
  statusBar: CommandCenterStatusBarContract;
  entryContext: CommandCenterEntryContextContract | null;
}

export interface CommandCenterBootstrapContract {
  version: CommandCenterVersion;
  selectedExternalUserid: string;
  sessions: CommandCenterSessionSummaryContract[];
  selectedDetail: CommandCenterSessionDetailContract | null;
  messages: CommandCenterMessageContract[];
  routingRecords: CommandCenterRoutingRecordContract[];
  monitor: CommandCenterMonitorContract | null;
}

export type CommandCenterPatchType =
  | "delta"
  | "rebootstrap_required";

export type CommandCenterPatchScope =
  | "sessions"
  | "selected_detail"
  | "messages"
  | "routing_records"
  | "monitor"
  | "status";

export interface CommandCenterPatchEnvelopeContract {
  version: CommandCenterVersion;
  patchType: CommandCenterPatchType;
  scopes: CommandCenterPatchScope[];
  rebootstrapRequired: boolean;
  sessionsChanged?: {
    upserts: CommandCenterSessionSummaryContract[];
    removedExternalUserids: string[];
  };
  selectedDetailChanged?: {
    selectedExternalUserid: string;
    detail: CommandCenterSessionDetailContract | null;
  };
  messagesAppended?: {
    externalUserid: string;
    messages: CommandCenterMessageContract[];
  };
  routingRecordsAppended?: {
    externalUserid: string;
    records: CommandCenterRoutingRecordContract[];
  };
  monitorChanged?: {
    externalUserid: string;
    monitor: CommandCenterMonitorContract | null;
  };
  statusChanged?: {
    externalUserid: string;
    statusBar: CommandCenterStatusBarContract | null;
  };
}

export interface CommandCenterSSECursorContract {
  sinceVersion: CommandCenterVersion;
  lastVersion: CommandCenterLastVersion;
  lastEventId?: string;
}

