"use client";

import { useEffect } from "react";

const MarkReadOnView = () => {
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/user/notifications/mark-read", {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
    }).catch(() => {
      // Ignore transient network errors.
    });

    return () => {
      controller.abort();
    };
  }, []);

  return null;
};

export default MarkReadOnView;
