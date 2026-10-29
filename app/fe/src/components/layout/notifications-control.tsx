"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { ROLES } from "@mis/shared-types";
import { NotificationsModal, type NotificationItem } from "@mis/ui/notifications-modal";
import { useAuth } from "@/providers/keycloak-provider";
import { useApi } from "@/hooks/use-api";

export function NotificationsControl() {
  const { activeRole } = useAuth();
  const api = useApi();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (activeRole !== ROLES.ADMIN) return;
    try {
      const result = await api<{ items: NotificationItem[]; unreadCount: number }>("/api/v1/internal/notifications");
      setItems(result.items);
      setUnreadCount(result.unreadCount);
      setError(null);
    } catch (loadError) {
      console.error("Could not load in-app notifications", loadError);
      setError(loadError instanceof Error ? loadError.message : "Notifications are temporarily unavailable. Please try again.");
    }
  }, [activeRole, api]);

  useEffect(() => {
    if (activeRole !== ROLES.ADMIN) {
      setItems([]);
      setUnreadCount(0);
      setError(null);
      return;
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [activeRole, load]);

  async function selectNotification(notification: NotificationItem) {
    try {
      await api(`/api/v1/internal/notifications/${notification.id}/read`, { method: "PATCH" });
      setItems((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: item.read_at ?? new Date().toISOString(), tone: "info" } : item));
      if (!notification.read_at) setUnreadCount((count) => Math.max(0, count - 1));
    } catch (readError) {
      console.error("Could not mark notification as read", readError);
    }
    setOpen(false);
    if (notification.target_path) router.push(notification.target_path);
  }

  if (activeRole !== ROLES.ADMIN) return null;
  return <>
    <button type="button" aria-label={`Notifications, ${unreadCount} unread`} onClick={() => { setOpen(true); void load(); }} className="relative inline-flex size-10 items-center justify-center rounded-full text-gray-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
      <Bell size={20} />
      {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-600 px-1 text-[10px] leading-4 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    <NotificationsModal open={open} onClose={() => setOpen(false)} notifications={items} error={error} onSelect={(notification) => void selectNotification(notification)} />
  </>;
}
