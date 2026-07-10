"use client";

import { Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const LAST_PATH_KEY = "fareback:last-path";

const NotificationBellClient = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const isNotificationsOpen = pathname.startsWith("/notifications");

  useEffect(() => {
    if (!isNotificationsOpen) {
      sessionStorage.setItem(LAST_PATH_KEY, pathname);
    }
  }, [isNotificationsOpen, pathname]);

  useEffect(() => {
    if (isNotificationsOpen) return;

    const fetchUnreadCount = async () => {
      try {
        const res = await fetch("/api/user/notifications/unread-count", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount);
        }
      } catch (error) {
        console.error("Failed to fetch unread count:", error);
      }
    };

    fetchUnreadCount();
  }, [isNotificationsOpen, pathname]);

  const handleClick = () => {
    if (isNotificationsOpen) {
      const previousPath = sessionStorage.getItem(LAST_PATH_KEY);
      router.push(
        previousPath && !previousPath.startsWith("/notifications")
          ? previousPath
          : "/"
      );
      return;
    }

    router.push("/notifications");
  };

  const hasUnread = !isNotificationsOpen && unreadCount !== null && unreadCount > 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300 ${
        isNotificationsOpen
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/50 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:shadow-[0_0_15px_hsl(var(--primary)/0.15)]"
      }`}
      aria-label={isNotificationsOpen ? "Close notifications" : "Open notifications"}
    >
      <Bell
        className={`h-5 w-5 transition-all duration-300 ${
          !isNotificationsOpen && "group-hover:origin-top group-hover:animate-[wave_1s_ease-in-out_infinite]"
        }`}
      />

      {hasUnread ? (
        <span className="absolute -right-1 -top-1 flex h-5 w-5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-40" />
          <span className="relative inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-background bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        </span>
      ) : null}
    </button>
  );
};

export default NotificationBellClient;
