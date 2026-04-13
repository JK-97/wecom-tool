export type ServicerIdentitySource = {
  userid?: string;
  raw_servicer_userid?: string;
  resolved_userid?: string;
  resolved_open_userid?: string;
  assigned_userid?: string;
  assigned_raw_servicer_userid?: string;
  assigned_resolved_userid?: string;
  assigned_resolved_open_userid?: string;
  display_identity?: string;
  display_userid?: string;
  assigned_display_userid?: string;
  display_fallback?: string;
  assigned_display_fallback?: string;
  resolution_status?: string;
  assigned_resolution_status?: string;
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
    source?.assigned_raw_servicer_userid,
    source?.userid,
    source?.assigned_userid,
  );
  const resolvedUserID = firstNonEmpty(
    source?.resolved_userid,
    source?.assigned_resolved_userid,
  );
  const resolvedOpenUserID = firstNonEmpty(
    source?.resolved_open_userid,
    source?.assigned_resolved_open_userid,
  );
  const stableIdentity = firstNonEmpty(
    resolvedUserID,
    resolvedOpenUserID,
    rawServicerUserID,
  );
  const displayIdentity = firstNonEmpty(
    source?.display_identity,
    source?.assigned_display_userid,
    source?.display_userid,
  );
  const displayFallback = firstNonEmpty(
    source?.display_fallback,
    source?.assigned_display_fallback,
    resolvedUserID,
    rawServicerUserID,
    "未设置",
  );
  const resolutionStatus = firstNonEmpty(
    source?.resolution_status,
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

export function buildRawServicerIDsByStableIdentity(
  sources: Array<ServicerIdentitySource | null | undefined>,
): Map<string, string[]> {
  const next = new Map<string, string[]>();
  sources.forEach((source) => {
    const identity = resolveServicerIdentityView(source);
    const rawID = identity.rawServicerUserID.trim();
    if (!rawID) return;
    const stableID = (identity.stableIdentity || rawID).trim();
    const bucket = next.get(stableID) || [];
    if (!bucket.includes(rawID)) {
      bucket.push(rawID);
    }
    next.set(stableID, bucket);
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
