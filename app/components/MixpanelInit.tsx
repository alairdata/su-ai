"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import mixpanel from "mixpanel-browser";
import { track, setUserProperties, incrementUserProperty, EVENTS } from "@/lib/analytics";

let initialized = false;

export default function MixpanelInit() {
  const { data: session } = useSession();
  const sessionStartRef = useRef<number>(0);
  const messagesSentRef = useRef<number>(0);

  useEffect(() => {
    if (!initialized) {
      mixpanel.init("f7f0420f484f10149af49240230f2c9d", {
        autocapture: true,
        record_sessions_percent: 100,
      });
      initialized = true;
    }
  }, []);

  useEffect(() => {
    if (initialized && session?.user) {
      mixpanel.identify(session.user.id);

      const lastVisit = localStorage.getItem('mp_last_visit');
      const now = Date.now();
      const returning = !!lastVisit;
      localStorage.setItem('mp_last_visit', String(now));

      sessionStartRef.current = now;

      mixpanel.people.set({
        $name: session.user.name,
        $email: session.user.email,
        plan: session.user.plan,
      });

      if (session.user.createdAt) {
        setUserProperties({ $created: session.user.createdAt });
      }

      // Enhanced user properties
      setUserProperties({
        last_active_date: new Date().toISOString(),
        onboarding_completed: session.user.onboardingComplete ?? false,
        whats_new_seen: session.user.whatsNewSeen ?? false,
      });
      incrementUserProperty('total_sessions');

      track(EVENTS.SESSION_STARTED, { returning });
    }
  }, [session]);

  // Track session_ended + bounce_detected on page unload
  useEffect(() => {
    if (!initialized || !session?.user) return;

    const handleUnload = () => {
      const duration = sessionStartRef.current
        ? Math.round((Date.now() - sessionStartRef.current) / 1000)
        : 0;

      // Bounce detection: session < 30 seconds
      if (duration < 30) {
        track(EVENTS.BOUNCE_DETECTED, { session_duration_seconds: duration });
      }

      track(EVENTS.SESSION_ENDED, {
        session_duration_seconds: duration,
        messages_sent_this_session: messagesSentRef.current,
      });
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [session]);

  // Listen for messages sent to count them for session_ended
  useEffect(() => {
    const handler = () => { messagesSentRef.current += 1; };
    window.addEventListener('mp_message_sent', handler);
    return () => window.removeEventListener('mp_message_sent', handler);
  }, []);

  // Page refresh detection
  useEffect(() => {
    try {
      const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (entries[0]?.type === 'reload') {
        track(EVENTS.PAGE_REFRESHED);
      }
    } catch { /* silent */ }
  }, []);

  // Page load time (Performance Navigation Timing API)
  useEffect(() => {
    try {
      const measure = () => {
        const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        const nav = entries[0];
        if (!nav) return;
        track(EVENTS.PAGE_LOAD_TIME, {
          dns_ms: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
          tcp_ms: Math.round(nav.connectEnd - nav.connectStart),
          ttfb_ms: Math.round(nav.responseStart - nav.requestStart),
          dom_load_ms: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
          full_load_ms: Math.round(nav.loadEventEnd - nav.startTime),
        });
      };
      // Wait for load event to complete
      if (document.readyState === 'complete') {
        setTimeout(measure, 0);
      } else {
        window.addEventListener('load', () => setTimeout(measure, 0), { once: true });
      }
    } catch { /* silent */ }
  }, []);

  // First Contentful Paint
  useEffect(() => {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            track(EVENTS.FIRST_CONTENTFUL_PAINT, { fcp_ms: Math.round(entry.startTime) });
            observer.disconnect();
          }
        }
      });
      observer.observe({ type: 'paint', buffered: true });
      return () => observer.disconnect();
    } catch { /* silent */ }
  }, []);

  // Client errors (capped at 10 per session)
  useEffect(() => {
    let errorCount = 0;
    const handler = (event: ErrorEvent) => {
      if (errorCount >= 10) return;
      errorCount++;
      track(EVENTS.CLIENT_ERROR, {
        message: (event.message || '').slice(0, 200),
        filename: (event.filename || '').slice(0, 200),
        line: event.lineno,
        col: event.colno,
      });
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  // Unhandled promise rejections (capped at 10 per session)
  useEffect(() => {
    let rejectionCount = 0;
    const handler = (event: PromiseRejectionEvent) => {
      if (rejectionCount >= 10) return;
      rejectionCount++;
      const reason = event.reason instanceof Error
        ? event.reason.message
        : String(event.reason || '');
      track(EVENTS.UNHANDLED_REJECTION, {
        reason: reason.slice(0, 200),
      });
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  // Rage click detection: 3+ clicks within 1s in 50px proximity
  useEffect(() => {
    const clicks: { x: number; y: number; t: number }[] = [];

    const handler = (e: MouseEvent) => {
      const now = Date.now();
      clicks.push({ x: e.clientX, y: e.clientY, t: now });

      // Remove clicks older than 1 second
      while (clicks.length > 0 && now - clicks[0].t > 1000) {
        clicks.shift();
      }

      if (clicks.length >= 3) {
        // Check proximity: all clicks within 50px of each other
        const first = clicks[0];
        const allClose = clicks.every(
          c => Math.abs(c.x - first.x) < 50 && Math.abs(c.y - first.y) < 50
        );
        if (allClose) {
          track(EVENTS.RAGE_CLICK_DETECTED, {
            x: e.clientX,
            y: e.clientY,
            click_count: clicks.length,
          });
          clicks.length = 0; // Reset after firing
        }
      }
    };

    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Idle timeout: 5 minutes of inactivity
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let idleFired = false;

    const resetIdle = () => {
      clearTimeout(timeoutId);
      idleFired = false;
      timeoutId = setTimeout(() => {
        if (!idleFired) {
          idleFired = true;
          track(EVENTS.IDLE_TIMEOUT, { idle_duration_seconds: 300 });
        }
      }, 5 * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    const opts: AddEventListenerOptions = { passive: true };
    events.forEach(e => window.addEventListener(e, resetIdle, opts));
    resetIdle();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => window.removeEventListener(e, resetIdle));
    };
  }, []);

  // Retention day milestones (1, 3, 7, 14, 30 days since signup)
  useEffect(() => {
    if (!session?.user?.createdAt) return;
    try {
      const createdAt = new Date(session.user.createdAt).getTime();
      const daysSinceSignup = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
      const milestones = [1, 3, 7, 14, 30];

      for (const milestone of milestones) {
        if (daysSinceSignup >= milestone) {
          const key = `mp_retention_${milestone}`;
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, '1');
            track(EVENTS.RETENTION_DAY, { day: milestone });
          }
        }
      }
    } catch { /* silent */ }
  }, [session]);

  // Streak milestone tracking (consecutive daily usage)
  useEffect(() => {
    if (!session?.user) return;
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const lastDate = localStorage.getItem('mp_streak_date');
      let streak = parseInt(localStorage.getItem('mp_streak_count') || '0', 10);

      if (lastDate === today) {
        // Already counted today
      } else {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (lastDate === yesterday) {
          streak += 1;
        } else {
          streak = 1; // Reset streak
        }
        localStorage.setItem('mp_streak_date', today);
        localStorage.setItem('mp_streak_count', String(streak));

        const milestones = [3, 7, 14, 30];
        if (milestones.includes(streak)) {
          track(EVENTS.STREAK_MILESTONE, { streak_days: streak });
        }
      }
    } catch { /* silent */ }
  }, [session]);

  // PWA app installed event
  useEffect(() => {
    const handler = () => {
      track(EVENTS.APP_INSTALLED);
    };
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  return null;
}
