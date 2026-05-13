/**
 * 客服中心左侧会话列表头像 open-data frame。
 *
 * 边界说明：
 * 1. 这里只承接“微信客服中心左侧会话列表头像列”。
 * 2. 这里使用单个 OpenDataFrame 批量渲染 externalUserAvatar，避免一行一个 iframe。
 * 3. 这不是 Profile 头像组件，也不是通讯录展示组件，不复用其它 open-data family。
 * 4. 这里的重点是 frame 生命周期稳定：普通列表刷新只更新 data，不销毁 iframe。
 */
import * as ww from "@wecom/jssdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import {
  ensureOpenDataReady,
  type OpenDataRuntime,
} from "@/services/openDataService";

const SESSION_AVATAR_ROOT_REF = "cs-session-avatar-root";
const SESSION_ROW_HEIGHT_PX = 116;
const SESSION_AVATAR_SIZE_PX = 32;

export type CSCommandCenterSessionAvatarOpenDataRow = {
  sessionKey: string;
  externalUserID: string;
  fallback: string;
};

type SessionAvatarFrameData = {
  rows: CSCommandCenterSessionAvatarOpenDataRow[];
};

function normalizeRows(
  rows: CSCommandCenterSessionAvatarOpenDataRow[],
): CSCommandCenterSessionAvatarOpenDataRow[] {
  return (rows || []).map((item) => ({
    sessionKey: (item.sessionKey || "").trim(),
    externalUserID: (item.externalUserID || "").trim(),
    fallback: (item.fallback || "").trim().slice(0, 1).toUpperCase() || "?",
  }));
}

function buildRowsSignature(
  rows: CSCommandCenterSessionAvatarOpenDataRow[],
): string {
  return rows
    .map((item) => `${item.sessionKey}\u0001${item.externalUserID}\u0001${item.fallback}`)
    .join("\u0002");
}

function buildSessionAvatarTemplate(): string {
  return `
<view class="cs-session-avatar-list" ref="${SESSION_AVATAR_ROOT_REF}">
  <block wx:for="{{data.rows}}" wx:key="sessionKey">
    <view class="cs-session-avatar-row">
      <block wx:if="{{item.externalUserID}}">
        <ww-open-data class="cs-session-avatar-node" type="externalUserAvatar" openid="{{item.externalUserID}}"></ww-open-data>
      </block>
      <block wx:else>
        <view class="cs-session-avatar-fallback">{{item.fallback}}</view>
      </block>
    </view>
  </block>
</view>
`;
}

function buildSessionAvatarStyle(): string {
  return `
.cs-session-avatar-list {
  display: flex;
  width: ${SESSION_AVATAR_SIZE_PX}px;
  min-height: 100%;
  flex-direction: column;
}

.cs-session-avatar-row {
  display: flex;
  width: ${SESSION_AVATAR_SIZE_PX}px;
  height: ${SESSION_ROW_HEIGHT_PX}px;
  align-items: flex-start;
  justify-content: center;
  padding-top: 2px;
  box-sizing: border-box;
  flex: 0 0 ${SESSION_ROW_HEIGHT_PX}px;
}

.cs-session-avatar-node,
.cs-session-avatar-fallback {
  display: block;
  width: ${SESSION_AVATAR_SIZE_PX}px;
  height: ${SESSION_AVATAR_SIZE_PX}px;
  overflow: hidden;
  border-radius: 9999px;
  background: #f3f4f6;
}

.cs-session-avatar-fallback {
  color: #6b7280;
  font-size: 14px;
  font-weight: 600;
  line-height: ${SESSION_AVATAR_SIZE_PX}px;
  text-align: center;
}
`;
}

/**
 * 统一同步 iframe 盒模型，确保列表高度变化时不需要重建 frame。
 */
function syncSessionAvatarFrameBox(
  instance: ww.OpenDataFrameInstance<SessionAvatarFrameData>,
  rowCount: number,
): void {
  const iframe = instance.el as HTMLIFrameElement;
  iframe.setAttribute("scrolling", "no");
  iframe.style.display = "block";
  iframe.style.width = `${SESSION_AVATAR_SIZE_PX}px`;
  iframe.style.height = `${Math.max(rowCount, 0) * SESSION_ROW_HEIGHT_PX}px`;
  iframe.style.maxWidth = "100%";
  iframe.style.border = "none";
  iframe.style.overflow = "hidden";
  iframe.style.background = "transparent";
}

/**
 * 左侧会话列表头像 frame。
 *
 * 关键实现：
 * 1. shouldBind 从 false -> true 时才真正创建 frame。
 * 2. rows 内容变化只走 setData，不销毁现有 iframe。
 * 3. skeleton 只覆盖首次挂载 / runtime 未就绪，不覆盖普通 data update。
 */
export function CSCommandCenterSessionAvatarOpenDataFrame(props: {
  rows: CSCommandCenterSessionAvatarOpenDataRow[];
  pending?: boolean;
  enabled?: boolean;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef =
    useRef<ww.OpenDataFrameInstance<SessionAvatarFrameData> | null>(null);
  const latestFrameDataRef = useRef<SessionAvatarFrameData>({ rows: [] });
  const latestRowCountRef = useRef(0);
  const [runtime, setRuntime] = useState<OpenDataRuntime | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const rows = useMemo(() => normalizeRows(props.rows || []), [props.rows]);
  const rowsSignature = useMemo(() => buildRowsSignature(rows), [rows]);
  const stableRows = useMemo(() => rows, [rowsSignature]);
  const frameData = useMemo<SessionAvatarFrameData>(
    () => ({ rows: stableRows }),
    [stableRows],
  );
  const shouldBind = Boolean(props.enabled ?? true) && rows.length > 0;
  const runtimePending = shouldBind && runtime === null;
  const openDataReady = runtime?.canUseOpenData === true;
  const openDataUnsupported = Boolean(runtime) && !runtime.canUseOpenData;
  const totalHeight = rows.length * SESSION_ROW_HEIGHT_PX;
  const showSkeleton =
    Boolean(props.pending) || runtimePending || (openDataReady && !frameReady);
  const showFallback = !showSkeleton && (openDataUnsupported || !shouldBind);

  latestFrameDataRef.current = frameData;
  latestRowCountRef.current = rows.length;

  useEffect(() => {
    let cancelled = false;

    const dispose = () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
      hostRef.current?.replaceChildren();
    };

    const mount = async () => {
      const host = hostRef.current;
      if (!host) return;

      try {
        const nextRuntime = await ensureOpenDataReady();
        if (cancelled) return;
        setRuntime(nextRuntime);
        if (!nextRuntime.canUseOpenData) {
          setFrameReady(false);
          return;
        }
        if (typeof ww.createOpenDataFrameFactory !== "function") {
          setFrameReady(false);
          return;
        }

        const factory = ww.createOpenDataFrameFactory({
          handleError() {
            if (cancelled) return;
            setFrameReady(false);
          },
        });
        instanceRef.current = factory.createOpenDataFrame({
          el: host,
          data: latestFrameDataRef.current,
          template: buildSessionAvatarTemplate(),
          style: buildSessionAvatarStyle(),
          handleMounted() {
            if (cancelled || !instanceRef.current) return;
            syncSessionAvatarFrameBox(
              instanceRef.current,
              latestRowCountRef.current,
            );
            setFrameReady(true);
          },
          handleUpdated() {
            if (cancelled || !instanceRef.current) return;
            syncSessionAvatarFrameBox(
              instanceRef.current,
              latestRowCountRef.current,
            );
            setFrameReady(true);
          },
          handleError() {
            if (cancelled) return;
            setFrameReady(false);
          },
        });
        if (instanceRef.current) {
          syncSessionAvatarFrameBox(
            instanceRef.current,
            latestRowCountRef.current,
          );
        }
      } catch {
        if (cancelled) return;
        setRuntime({
          availability: "error",
          isWeComWebView: false,
          canUseOpenData: false,
          reason: "session-avatar-open-data-init-failed",
        });
        setFrameReady(false);
      }
    };

    if (!shouldBind) {
      dispose();
      setFrameReady(false);
      if (rows.length === 0) {
        setRuntime(null);
      }
      return () => {
        cancelled = true;
      };
    }

    if (!instanceRef.current) {
      setFrameReady(false);
      void mount();
    }

    return () => {
      cancelled = true;
      if (!shouldBind) {
        dispose();
      }
    };
  }, [rows.length, shouldBind]);

  useEffect(() => {
    const instance = instanceRef.current;
    const host = hostRef.current;
    if (!instance || !host || !shouldBind) return;
    void instance
      .setData(frameData)
      .then(() => {
        syncSessionAvatarFrameBox(instance, rows.length);
      })
      .catch(() => {
        setFrameReady(false);
      });
  }, [frameData, rows.length, shouldBind]);

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-4 top-4 z-10 w-8 overflow-hidden",
        props.className,
      )}
      style={{ height: totalHeight > 0 ? `${totalHeight}px` : undefined }}
      aria-hidden="true"
    >
      <div
        ref={hostRef}
        className={cn(
          "h-full w-full",
          openDataReady && frameReady ? "block" : "hidden",
        )}
      />
      {showSkeleton ? (
        <div className="flex h-full w-full flex-col">
          {rows.map((item) => (
            <div
              key={item.sessionKey}
              className="flex h-[116px] w-8 items-start justify-center pt-0.5"
            >
              <span className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
            </div>
          ))}
        </div>
      ) : null}
      {showFallback ? (
        <div className="flex h-full w-full flex-col">
          {rows.map((item) => (
            <div
              key={item.sessionKey}
              className="flex h-[116px] w-8 items-start justify-center pt-0.5"
            >
              <Avatar size="sm" fallback={item.fallback} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
