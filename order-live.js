import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

(() => {
  const config = window.hansolCatalogConfig;
  const api = window.hansolCatalog;
  if (!config?.url || !config?.publishableKey || !api?.shopRpc) return;

  const labels = {
    received: "입금 대기",
    paid: "입금 확인",
    preparing: "배송 준비",
    shipped: "배송 중",
    delivered: "배송 완료",
    canceled: "주문 취소",
  };
  const dateFormat = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    accessToken: async () => {
      try {
        const session = JSON.parse(localStorage.getItem("hansol_auth_session_v1"));
        return session?.accessToken || null;
      } catch { return null; }
    },
  });

  let channel = null;
  let currentUserId = null;
  let currentToken = null;
  let refreshTimer = null;
  let refreshPending = false;
  const displayedHistory = new WeakSet();

  function isOrderDialogOpen() {
    const modal = document.getElementById("shopAdminModal");
    return modal && getComputedStyle(modal).display !== "none";
  }

  function refreshVisibleOrders() {
    if (!isOrderDialogOpen()) {
      refreshPending = true;
      return;
    }
    const button = [...document.querySelectorAll("#orderOverview button")]
      .find((candidate) => candidate.textContent.trim() === "새로고침");
    if (button && !button.disabled) button.click();
    refreshPending = false;
  }

  async function reconnect() {
    let session = null;
    try { session = JSON.parse(localStorage.getItem("hansol_auth_session_v1")); } catch {}
    if (!session?.userId || !session?.accessToken) {
      if (channel) await client.removeChannel(channel);
      channel = null;
      currentUserId = currentToken = null;
      return;
    }
    if (session.userId === currentUserId && session.accessToken === currentToken) return;
    if (channel) await client.removeChannel(channel);
    currentUserId = session.userId;
    currentToken = session.accessToken;
    await client.realtime.setAuth(session.accessToken);
    channel = client.channel("hansol-order-status")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "hansol_order_live_updates",
      }, () => refreshVisibleOrders())
      .subscribe();
  }

  function addHistory(card) {
    if (displayedHistory.has(card) || !card.dataset.orderId) return;
    displayedHistory.add(card);
    const details = document.createElement("details");
    details.className = "order-status-history";
    const summary = document.createElement("summary");
    summary.textContent = "상태 변경 이력";
    details.append(summary);
    card.append(details);

    void api.shopRpc("hansol_order_status_history", { p_order_id: card.dataset.orderId })
      .then((rows) => {
        const list = document.createElement("ol");
        list.className = "order-history-list";
        for (const row of rows || []) {
          const item = document.createElement("li");
          const time = document.createElement("time");
          time.dateTime = row.changed_at;
          time.textContent = dateFormat.format(new Date(row.changed_at));
          const text = document.createElement("span");
          text.textContent = labels[row.status] || row.status;
          item.append(time, text);
          if (row.carrier && row.tracking) {
            const tracking = document.createElement("span");
            tracking.textContent = row.carrier + " · " + row.tracking;
            item.append(tracking);
          }
          list.append(item);
        }
        if (!list.children.length) {
          const item = document.createElement("li");
          item.textContent = "저장된 변경 이력이 없습니다.";
          list.append(item);
        }
        details.append(list);
      })
      .catch(() => {
        const message = document.createElement("p");
        message.textContent = "상태 이력을 불러오지 못했습니다. 주문 목록을 새로고침해 주세요.";
        details.append(message);
      });
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(".order-card")) addHistory(node);
        node.querySelectorAll?.(".order-card").forEach(addHistory);
      }
    }
  });
  const list = document.getElementById("shopAdminList");
  if (list) observer.observe(list, { childList: true, subtree: true });

  const dialog = document.getElementById("shopAdminModal");
  if (dialog) {
    new MutationObserver(() => {
      if (refreshPending) refreshVisibleOrders();
    }).observe(dialog, { attributes: true, attributeFilter: ["style"] });
  }

  void reconnect();
  refreshTimer = window.setInterval(() => void reconnect(), 2500);
  window.addEventListener("storage", (event) => {
    if (event.key === "hansol_auth_session_v1") void reconnect();
  });
  window.addEventListener("pagehide", () => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (channel) void client.removeChannel(channel);
  });
})();
