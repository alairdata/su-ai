import mixpanel from 'mixpanel-browser';

export const EVENTS = {
  // Session
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',

  // Auth
  USER_SIGNED_UP: 'user_signed_up',
  USER_LOGGED_IN: 'user_logged_in',
  LOGIN_FAILED: 'login_failed',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  EMAIL_VERIFIED: 'email_verified',

  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_SCREEN_VIEWED: 'onboarding_screen_viewed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_SKIPPED: 'onboarding_skipped',

  // What's New
  WHATS_NEW_SHOWN: 'whats_new_shown',
  WHATS_NEW_SCREEN_VIEWED: 'whats_new_screen_viewed',
  WHATS_NEW_COMPLETED: 'whats_new_completed',
  WHATS_NEW_DISMISSED: 'whats_new_dismissed',

  // Theme
  THEME_CHANGED: 'theme_changed',

  // Chat
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  CHARACTER_MENTIONED: 'character_mentioned',
  CHAT_CREATED: 'chat_created',
  CHAT_DELETED: 'chat_deleted',
  DAILY_LIMIT_REACHED: 'daily_limit_reached',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_REGENERATED: 'message_regenerated',

  // Chat UI
  CHAT_SELECTED: 'chat_selected',
  PROMPT_CHIP_CLICKED: 'prompt_chip_clicked',
  CHARACTER_MODAL_OPENED: 'character_modal_opened',
  CHARACTER_MODAL_CLOSED: 'character_modal_closed',
  CHARACTER_CREATED: 'character_created',
  CHARACTER_REMOVED: 'character_removed',
  CHARACTER_LIMIT_REACHED: 'character_limit_reached',
  CHARACTER_RESPONSE_RECEIVED: 'character_response_received',
  MENTION_DROPDOWN_SHOWN: 'mention_dropdown_shown',
  MENTION_DROPDOWN_SELECTED: 'mention_dropdown_selected',

  // Files
  FILE_SELECTED: 'file_selected',
  FILE_UPLOADED: 'file_uploaded',
  FILE_UPLOAD_FAILED: 'file_upload_failed',
  FILE_UPLOAD_CANCELLED: 'file_upload_cancelled',

  // Monetization
  UPGRADE_MODAL_OPENED: 'upgrade_modal_opened',
  UPGRADE_INITIATED: 'upgrade_initiated',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',

  // Extras
  MESSAGE_COPIED: 'message_copied',
  MESSAGE_FEEDBACK: 'message_feedback',

  // Week 3: AI Response Quality
  AI_RESPONSE_ERROR: 'ai_response_error',
  AI_RESPONSE_TIMEOUT: 'ai_response_timeout',
  AI_RESPONSE_EMPTY: 'ai_response_empty',
  STREAMING_STARTED: 'streaming_started',
  STREAMING_COMPLETED: 'streaming_completed',
  STREAMING_INTERRUPTED: 'streaming_interrupted',

  // Week 3: Frustration Signals
  RAGE_CLICK_DETECTED: 'rage_click_detected',
  FORM_VALIDATION_ERROR: 'form_validation_error',
  PAGE_REFRESHED: 'page_refreshed',
  IDLE_TIMEOUT: 'idle_timeout',
  BOUNCE_DETECTED: 'bounce_detected',

  // Week 3: Retention & Activation
  FIRST_MESSAGE_SENT: 'first_message_sent',
  ACTIVATION_MILESTONE: 'activation_milestone',
  CONVERSATION_DEPTH_MILESTONE: 'conversation_depth_milestone',
  RETENTION_DAY: 'retention_day',
  STREAK_MILESTONE: 'streak_milestone',

  // Week 3: Session Depth
  TYPING_STARTED: 'typing_started',
  INPUT_FOCUSED: 'input_focused',
  INPUT_ABANDONED: 'input_abandoned',
  SCROLL_DEPTH: 'scroll_depth',

  // Week 3: Performance
  PAGE_LOAD_TIME: 'page_load_time',
  FIRST_CONTENTFUL_PAINT: 'first_contentful_paint',
  CLIENT_ERROR: 'client_error',
  UNHANDLED_REJECTION: 'unhandled_rejection',

  // Week 4: Growth
  APP_INSTALLED: 'app_installed',
  EXTERNAL_LINK_CLICKED: 'external_link_clicked',
  TOPIC_DETECTED: 'topic_detected',
  EMAIL_SENT: 'email_sent',

  // Week 4: Business-Critical
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  SUBSCRIPTION_PAYMENT_FAILED: 'subscription_payment_failed',
  SUBSCRIPTION_REACTIVATED: 'subscription_reactivated',

  // Week 4: A/B Testing
  EXPERIMENT_ASSIGNED: 'experiment_assigned',
  EXPERIMENT_CONVERTED: 'experiment_converted',
} as const;

export function track(event: string, properties?: Record<string, unknown>) {
  try {
    mixpanel.track(event, properties);
  } catch {
    // Silent failure — never break the app
  }
}

export function setUserProperties(properties: Record<string, unknown>) {
  try {
    mixpanel.people.set(properties);
  } catch {
    // Silent failure
  }
}

export function incrementUserProperty(property: string, value: number = 1) {
  try {
    mixpanel.people.increment(property, value);
  } catch {
    // Silent failure
  }
}

const MIXPANEL_TOKEN = 'f7f0420f484f10149af49240230f2c9d';

/** Server-side tracking via Mixpanel HTTP API (for API routes/webhooks) */
export function trackServerEvent(userId: string, event: string, properties?: Record<string, unknown>) {
  try {
    const payload = [{
      event,
      properties: {
        ...properties,
        distinct_id: userId,
        token: MIXPANEL_TOKEN,
        time: Math.floor(Date.now() / 1000),
      },
    }];
    fetch('https://api.mixpanel.com/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/plain' },
      body: JSON.stringify(payload),
    }).catch(() => { /* silent */ });
  } catch {
    // Silent failure
  }
}

/** A/B testing: assign user to an experiment variant (persisted in localStorage) */
export function assignExperiment(name: string, variants: string[]): string {
  try {
    const key = `exp_${name}`;
    const stored = localStorage.getItem(key);
    if (stored && variants.includes(stored)) return stored;

    const variant = variants[Math.floor(Math.random() * variants.length)];
    localStorage.setItem(key, variant);
    track(EVENTS.EXPERIMENT_ASSIGNED, { experiment: name, variant });
    return variant;
  } catch {
    return variants[0];
  }
}

/** A/B testing: track a conversion event for an experiment */
export function trackExperimentConversion(name: string, event: string) {
  try {
    const key = `exp_${name}`;
    const variant = localStorage.getItem(key);
    if (!variant) return;
    track(EVENTS.EXPERIMENT_CONVERTED, { experiment: name, variant, conversion_event: event });
  } catch {
    // Silent failure
  }
}
