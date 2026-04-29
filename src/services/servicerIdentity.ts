export type ServicerIdentitySource = {
  userid?: string;
  userID?: string;
  raw_servicer_userid?: string;
  rawServicerUserID?: string;
  resolved_userid?: string;
  resolvedUserID?: string;
  resolved_open_userid?: string;
  resolvedOpenUserID?: string;
  assigned_userid?: string;
  assigned_raw_servicer_userid?: string;
  assigned_resolved_userid?: string;
  assigned_resolved_open_userid?: string;
  display_identity?: string;
  displayIdentity?: string;
  display_userid?: string;
  assigned_display_userid?: string;
  display_fallback?: string;
  displayFallback?: string;
  assigned_display_fallback?: string;
  resolution_status?: string;
  resolutionStatus?: string;
  assigned_resolution_status?: string;
};

export type ServicerTargetLike = {
  userIds?: string[];
  user_ids?: string[];
  departmentIds?: number[];
  department_ids?: number[];
};

export type ServicerSelectionItem = {
  type: "user" | "department";
  id: string;
};

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = (value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export type ServicerIdentityView = {
  rawServicerUserID: string;
  resolvedUserID: string;
  resolvedOpenUserID: string;
  stableIdentity: string;
  displayIdentity: string;
  displayFallback: string;
  resolutionStatus: string;
};

export function resolveServicerIdentityView(
  source?: ServicerIdentitySource | null,
): ServicerIdentityView {
  const rawServicerUserID = firstNonEmpty(
    source?.raw_servicer_userid,
    source?.rawServicerUserID,
    source?.assigned_raw_servicer_userid,
    source?.userid,
    source?.userID,
    source?.assigned_userid,
  );
  const resolvedUserID = firstNonEmpty(
    source?.resolved_userid,
    source?.resolvedUserID,
    source?.assigned_resolved_userid,
  );
  const resolvedOpenUserID = firstNonEmpty(
    source?.resolved_open_userid,
    source?.resolvedOpenUserID,
    source?.assigned_resolved_open_userid,
  );
  const stableIdentity = firstNonEmpty(
    resolvedUserID,
    resolvedOpenUserID,
    rawServicerUserID,
  );
  const displayIdentity = firstNonEmpty(
    source?.display_identity,
    source?.displayIdentity,
    source?.assigned_display_userid,
    source?.display_userid,
  );
  const displayFallback = firstNonEmpty(
    source?.display_fallback,
    source?.displayFallback,
    source?.assigned_display_fallback,
    resolvedUserID,
    rawServicerUserID,
    "未设置",
  );
  const resolutionStatus = firstNonEmpty(
    source?.resolution_status,
    source?.resolutionStatus,
    source?.assigned_resolution_status,
    stableIdentity ? "unresolved" : "",
  );
  return {
    rawServicerUserID,
    resolvedUserID,
    resolvedOpenUserID,
    stableIdentity,
    displayIdentity,
    displayFallback,
    resolutionStatus,
  };
}

export function buildServicerIdentityLookup(
  sources: Array<ServicerIdentitySource | null | undefined>,
): Map<string, ServicerIdentityView> {
  const lookup = new Map<string, ServicerIdentityView>();
  sources.forEach((source) => {
    const identity = resolveServicerIdentityView(source);
    const keys = [
      identity.rawServicerUserID,
      identity.resolvedUserID,
      identity.resolvedOpenUserID,
      identity.stableIdentity,
      identity.displayIdentity,
      identity.displayFallback,
    ];
    keys.forEach((key) => {
      const normalized = (key || "").trim();
      if (!normalized || lookup.has(normalized)) return;
      lookup.set(normalized, identity);
    });
  });
  return lookup;
}

export function resolveServicerIdentityToken(
  token: string,
  lookup: Map<string, ServicerIdentityView>,
): ServicerIdentityView | null {
  const normalized = (token || "").trim();
  if (!normalized) return null;
  return lookup.get(normalized) || null;
}

export function splitIdentityTokens(value: string): string[] {
  return (value || "")
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildRawServicerIDsByStableIdentity(
  sources: Array<ServicerIdentitySource | null | undefined>,
): Map<string, string[]> {
  const next = new Map<string, string[]>();
  sources.forEach((source) => {
    const identity = resolveServicerIdentityView(source);
    const rawID = identity.rawServicerUserID.trim();
    if (!rawID) return;
    const stableID = (identity.stableIdentity || rawID).trim();
    [
      stableID,
      identity.rawServicerUserID,
      identity.resolvedUserID,
      identity.resolvedOpenUserID,
      identity.displayIdentity,
      identity.displayFallback,
    ].forEach((key) => {
      const normalized = (key || "").trim();
      if (!normalized) return;
      const bucket = next.get(normalized) || [];
      if (!bucket.includes(rawID)) {
        bucket.push(rawID);
      }
      next.set(normalized, bucket);
    });
  });
  return next;
}

export function mapSelectedUserIDsToPoolRaw(
  userIDs: string[],
  rawUsersByStableIdentity: Map<string, string[]>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  userIDs.forEach((userID) => {
    const normalizedID = (userID || "").trim();
    if (!normalizedID) return;
    const resolvedRawIDs = rawUsersByStableIdentity.get(normalizedID) || [normalizedID];
    resolvedRawIDs.forEach((rawID) => {
      const value = (rawID || "").trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      out.push(value);
    });
  });
  return out;
}

function normalizeSelectionItems(
  items: ServicerSelectionItem[],
): ServicerSelectionItem[] {
  const seen = new Set<string>();
  const out: ServicerSelectionItem[] = [];
  items.forEach((item) => {
    const type = item.type === "department" ? "department" : "user";
    const id = (item.id || "").trim();
    if (!id) return;
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ type, id });
  });
  return out;
}

function normalizeTargetUserIDs(target?: ServicerTargetLike | null): string[] {
  const values = target?.userIds || target?.user_ids || [];
  return values.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeTargetDepartmentIDs(target?: ServicerTargetLike | null): number[] {
  const values = target?.departmentIds || target?.department_ids || [];
  return values
    .map((item) => Number(item || 0))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function hydrateServicerTargetSelection(
  target: ServicerTargetLike | null | undefined,
  sources: Array<ServicerIdentitySource | null | undefined>,
): ServicerSelectionItem[] {
  const lookup = buildServicerIdentityLookup(sources);
  return normalizeSelectionItems([
    ...normalizeTargetUserIDs(target).map((userID) => {
      const identity = resolveServicerIdentityToken(userID, lookup);
      return {
        type: "user" as const,
        id: (identity?.stableIdentity || userID).trim(),
      };
    }),
    ...normalizeTargetDepartmentIDs(target).map((departmentID) => ({
      type: "department" as const,
      id: String(departmentID),
    })),
  ]);
}
