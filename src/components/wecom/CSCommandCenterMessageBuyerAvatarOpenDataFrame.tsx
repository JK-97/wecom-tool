/**
 * 客服中心主会话窗口买家头像列 open-data frame。
 *
 * 边界说明：
 * 1. 这里只承接“主会话窗口消息列表左侧的买家头像列”。
 * 2. 这里只渲染头像列，不承接消息气泡、文案、系统 notice。
 * 3. 这里使用单个 OpenDataFrame 批量渲染整列买家头像，避免一条消息一个 iframe。
 * 4. 客服头像不走这里，客服头像继续由 React 主列表使用渠道主真相头像渲染。
 */
import * as ww from "@wecom/jssdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import {
  ensureOpenDataReady,
  type OpenDataRuntime,
} from "@/services/openDataService";

const BUYER_AVATAR_SIZE_PX = 32;
const MIN_MESSAGE_ROW_HEIGHT_PX = 32;

export type CSCommandCenterMessageBuyerAvatarRow = {
  key: string;
  externalUserID: string;
  fallback: string;
  top: number;
  height: number;
  visible: boolean;
};

type MessageBuyerAvatarFrameData = {
  rows: CSCommandCenterMessageBuyerAvatarRow[];
};

function normalizeRows(
  rows: CSCommandCenterMessageBuyerAvatarRow[],
): CSCommandCenterMessageBuyerAvatarRow[] {
  return (rows || []).map((item) => ({
    key: (item.key || "").trim(),
    externalUserID: (item.externalUserID || "").trim(),
    fallback: (item.fallback || "").trim().slice(0, 1).toUpperCase() || "?",
    top: Math.max(0, Math.round(Number(item.top) || 0)),
    height: Math.max(
      MIN_MESSAGE_ROW_HEIGHT_PX,
      Math.round(Number(item.height) || 0),
    ),
    visible: item.visible === true,
  }));
}

function buildRowsSignature(
  rows: CSCommandCenterMessageBuyerAvatarRow[],
): string {
  return rows
    .map(
      (item) =>
        `${item.key}\u0001${item.externalUserID}\u0001${item.fallback}\u0001${item.top}\u0001${item.height}\u0001${item.visible ? "1" : "0"}`,
    )
    .join("\u0002");
}

function resolveTotalHeight(rows: CSCommandCenterMessageBuyerAvatarRow[]): number {
  return rows.reduce((max, item) => {
    return Math.max(max, item.top + item.height);
  }, 0);
}

function buildTemplate(): string {
  return `
<view class="cs-message-buyer-avatar-column">
  <block wx:for="{{data.rows}}" wx:key="key">
    <view class="cs-message-buyer-avatar-row" style="top: {{item.top}}px; height: {{item.height}}px;">
      <block wx:if="{{item.visible}}">
        <block wx:if="{{item.externalUserID}}">
          <ww-open-data class="cs-message-buyer-avatar-node" type="externalUserAvatar" openid="{{item.externalUserID}}"></ww-open-data>
        </block>
        <block wx:else>
          <view class="cs-message-buyer-avatar-fallback">{{item.fallback}}</view>
        </block>
      </block>
      <block wx:else>
        <view class="cs-message-buyer-avatar-spacer"></view>
      </block>
    </view>
  </block>
</view>
`;
}

function buildStyle(): string {
  return `
.cs-message-buyer-avatar-column {
  position: relative;
  width: ${BUYER_AVATAR_SIZE_PX}px;
  min-height: 100%;
}

.cs-message-buyer-avatar-row {
  position: absolute;
  left: 0;
  width: ${BUYER_AVATAR_SIZE_PX}px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  box-sizing: border-box;
}

.cs-message-buyer-avatar-node,
.cs-message-buyer-avatar-fallback,
.cs-message-buyer-avatar-spacer {
  display: block;
  width: ${BUYER_AVATAR_SIZE_PX}px;
  height: ${BUYER_AVATAR_SIZE_PX}px;
  overflow: hidden;
  border-radius: 9999px;
}

.cs-message-buyer-avatar-node,
.cs-message-buyer-avatar-fallback {
  background: #f3f4f6;
}

.cs-message-buyer-avatar-fallback {
  color: #6b7280;
  font-size: 14px;
  font-weight: 600;
  line-height: ${BUYER_AVATAR_SIZE_PX}px;
  text-align: center;
}

.cs-message-buyer-avatar-spacer {
  background: transparent;
}
`;
}

function syncFrameBox(
  instance: ww.OpenDataFrameInstance<MessageBuyerAvatarFrameData>,
  totalHeight: number,
): void {
  const iframe = instance.el as HTMLIFrameElement;
  iframe.setAttribute("scrolling", "no");
  iframe.style.display = "block";
  iframe.style.width = `${BUYER_AVATAR_SIZE_PX}px`;
  iframe.style.height = `${Math.max(0, totalHeight)}px`;
  iframe.style.maxWidth = "100%";
  iframe.style.border = "none";
  iframe.style.overflow = "hidden";
  iframe.style.background = "transparent";
}

export function CSCommandCenterMessageBuyerAvatarOpenDataFrame(props: {
  rows: CSCommandCenterMessageBuyerAvatarRow[];
  pending?: boolean;
  enabled?: boolean;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef =
    useRef<ww.OpenDataFrameInstance<MessageBuyerAvatarFrameData> | null>(null);
  const latestFrameDataRef = useRef<MessageBuyerAvatarFrameData>({ rows: [] });
  const latestHeightRef = useRef(0);
  const [runtime, setRuntime] = useState<OpenDataRuntime | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const rows = useMemo(() => normalizeRows(props.rows || []), [props.rows]);
  const rowsSignature = useMemo(() => buildRowsSignature(rows), [rows]);
  const stableRows = useMemo(() => rows, [rowsSignature]);
  const frameData = useMemo<MessageBuyerAvatarFrameData>(
    () => ({ rows: stableRows }),
    [stableRows],
  );
  const totalHeight = useMemo(() => resolveTotalHeight(rows), [rows]);
  const shouldBind =
    Boolean(props.enabled ?? true) &&
    rows.length > 0 &&
    rows.some((item) => item.visible);
  const runtimePending = shouldBind && runtime === null;
  const openDataReady = runtime?.canUseOpenData === true;
  const openDataUnsupported = Boolean(runtime) && !runtime.canUseOpenData;
  const showSkeleton =
    Boolean(props.pending) || runtimePending || (openDataReady && !frameReady);
  const showFallback = !showSkeleton && (openDataUnsupported || !shouldBind);

  latestFrameDataRef.current = frameData;
  latestHeightRef.current = totalHeight;

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
          template: buildTemplate(),
          style: buildStyle(),
          handleMounted() {
            if (cancelled || !instanceRef.current) return;
            syncFrameBox(instanceRef.current, latestHeightRef.current);
            setFrameReady(true);
          },
          handleUpdated() {
            if (cancelled || !instanceRef.current) return;
            syncFrameBox(instanceRef.current, latestHeightRef.current);
            setFrameReady(true);
          },
          handleError() {
            if (cancelled) return;
            setFrameReady(false);
          },
        });
        if (instanceRef.current) {
          syncFrameBox(instanceRef.current, latestHeightRef.current);
        }
      } catch {
        if (cancelled) return;
        setRuntime({
          availability: "error",
          isWeComWebView: false,
          canUseOpenData: false,
          reason: "command-center-message-buyer-avatar-init-failed",
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
    if (!instance || !shouldBind) return;
    void instance
      .setData(frameData)
      .then(() => {
        syncFrameBox(instance, totalHeight);
      })
      .catch(() => {
        setFrameReady(false);
      });
  }, [frameData, shouldBind, totalHeight]);

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-0 top-0 z-10 w-8 overflow-hidden",
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
        <div className="relative h-full w-full">
          {rows.map((item) =>
            item.visible ? (
              <div
                key={item.key}
                className="absolute left-0 w-8"
                style={{ top: `${item.top}px`, height: `${item.height}px` }}
              >
                <span className="block h-8 w-8 animate-pulse rounded-full bg-gray-200" />
              </div>
            ) : null,
          )}
        </div>
      ) : null}
      {showFallback ? (
        <div className="relative h-full w-full">
          {rows.map((item) =>
            item.visible ? (
              <div
                key={item.key}
                className="absolute left-0 w-8"
                style={{ top: `${item.top}px`, height: `${item.height}px` }}
              >
                <Avatar size="sm" fallback={item.fallback} />
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}
