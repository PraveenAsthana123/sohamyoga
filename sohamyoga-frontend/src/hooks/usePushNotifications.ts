"use client";
// Real Web Push subscribe/unsubscribe flow: requests Notification
// permission, subscribes via the already-registered service worker's
// PushManager (see src/components/PWARegister.tsx for the sw.js
// registration) using NEXT_PUBLIC_VAPID_PUBLIC_KEY, and persists the
// subscription server-side via /api/customer/push-subscriptions.
import { useEffect, useState, useCallback } from "react";

export type PushSupportState = "unsupported" | "unsubscribed" | "subscribed" | "denied";

interface UsePushNotificationsResult {
  state: PushSupportState;
  loading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

function isSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [state, setState] = useState<PushSupportState>("unsubscribed");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupported()) { setState("unsupported"); setLoading(false); return; }
    if (Notification.permission === "denied") { setState("denied"); setLoading(false); return; }
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setState(existing ? "subscribed" : "unsubscribed");
    } catch {
      setState("unsubscribed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const subscribe = useCallback(async () => {
    setError(null);
    if (!isSupported()) { setError("Push notifications are not supported in this browser."); return; }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) { setError("Push notifications are not configured on this server."); return; }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "denied" : "unsubscribed"); return; }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        // The PushManager spec accepts applicationServerKey as a raw
        // base64url string directly (no manual Uint8Array conversion
        // needed) -- see https://www.w3.org/TR/push-api/#dom-pushsubscriptionoptionsinit-applicationserverkey
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        });
      }

      const json = subscription.toJSON();
      const res = await fetch("/api/customer/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save subscription.");
      }
      setState("subscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable push notifications.");
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch(`/api/customer/push-subscriptions?endpoint=${encodeURIComponent(endpoint)}`, { method: "DELETE" }).catch(() => undefined);
      }
      setState("unsubscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable push notifications.");
    }
  }, []);

  return { state, loading, error, subscribe, unsubscribe };
}
