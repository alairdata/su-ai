# Mixpanel Events Reference

All 81 tracked events across the So Unfiltered AI web app.
Organized by category. Each entry shows: **event name**, **properties**, and **why it's tracked**.

---

## Session

### `session_started`
**Properties:** `returning` (bool)
**Why:** Fires on every page load for an authenticated user. `returning` tells us if they've been here before (repeat visit vs. brand new session). Used to calculate session count, DAU, and new-vs-returning ratios.

### `session_ended`
**Properties:** `session_duration_seconds`, `messages_sent_this_session`
**Why:** Fires on `beforeunload`. Lets us measure session length and whether users sent any messages at all. Core input for engagement and stickiness calculations.

### `bounce_detected`
**Properties:** `session_duration_seconds`
**Why:** Fires when session ends in under 30 seconds. A dedicated bounce signal (separate from session_ended) so we can filter and analyze short visits without polluting engagement data.

---

## Performance

### `page_load_time`
**Properties:** `dns_ms`, `tcp_ms`, `ttfb_ms`, `dom_load_ms`, `full_load_ms`
**Why:** Full breakdown of the Navigation Timing API. Tells us where slowness is happening — DNS, connection, server response, or DOM rendering. Helps prioritize perf fixes.

### `first_contentful_paint`
**Properties:** `fcp_ms`
**Why:** Perceived load speed — when the user first sees content. Key UX metric. High FCP = users may abandon before they even see the app.

### `page_refreshed`
**Properties:** _(none)_
**Why:** Detects when the user hard-refreshed. Spikes here can signal confusion, errors, or stale UI — a soft frustration signal.

### `client_error`
**Properties:** `message`, `filename`, `line`, `col`
**Why:** Captures uncaught JS errors (capped at 10/session). Gives us real-world error visibility without needing users to report anything. Capped to avoid noise.

### `unhandled_rejection`
**Properties:** `reason`
**Why:** Captures unhandled Promise rejections (capped at 10/session). Catches async failures that `window.onerror` misses — common source of silent bugs.

---

## Frustration Signals

### `rage_click_detected`
**Properties:** `x`, `y`, `click_count`
**Why:** Fires when 3+ clicks happen within 1s in a 50px area. Classic UX frustration signal — means something looks clickable but isn't, or an action isn't responding fast enough.

### `idle_timeout`
**Properties:** `idle_duration_seconds` (always 300)
**Why:** Fires after 5 minutes of no activity (no mouse, keyboard, scroll, or touch). Tells us users are leaving the tab open but disengaged — useful for understanding session quality vs. raw duration.

### `form_validation_error`
**Properties:** _(varies by form — field name, error message)_
**Why:** Fires when a form field fails validation. High rates here indicate confusing UX or unclear requirements on the signup/login flow.

---

## Auth & Account

### `user_signed_up`
**Properties:** `method` (credentials/google/github)
**Why:** Core acquisition event. Ties directly to growth. Lets us compare signup method conversion and attribute signups to specific flows.

### `user_logged_in`
**Properties:** `method` (credentials/google/github)
**Why:** Tracks successful logins. Together with `session_started`, confirms returning users. Lets us compare login method usage over time.

### `login_failed`
**Properties:** `reason`
**Why:** Fires on failed login attempts. Helps identify whether failures are password-related (convert to password reset nudge) or other issues (account doesn't exist, rate limited).

### `email_verified`
**Properties:** _(none)_
**Why:** Marks completion of the email verification step. Drop-off between `user_signed_up` and `email_verified` tells us how much friction the verification flow creates.

### `password_reset_requested`
**Properties:** _(none)_
**Why:** Tracks how often users can't remember their password. High volume is a signal to push OAuth harder, or to add magic link login.

### `password_reset_completed`
**Properties:** _(none)_
**Why:** Confirms the user successfully reset and came back. The gap between requested and completed is recovery rate — users who don't complete are likely churned.

---

## Onboarding

### `onboarding_started`
**Properties:** _(none)_
**Why:** Fires when a new user hits the onboarding flow. Baseline for onboarding funnel — everything after this is a drop-off point.

### `onboarding_screen_viewed`
**Properties:** `screen` (2 or 3)
**Why:** Tracks which screens users reach. Screen-by-screen drop-off tells us exactly where people check out of onboarding.

### `onboarding_completed`
**Properties:** _(none)_
**Why:** Fires when the user finishes all onboarding screens. The most important onboarding event — completing onboarding is highly correlated with D7 retention.

### `onboarding_skipped`
**Properties:** _(none)_
**Why:** Fires when the user skips out early. High skip rate means the onboarding is too long, too slow, or not valuable-feeling. Compare skip-vs-complete cohorts for retention difference.

---

## What's New

### `whats_new_shown`
**Properties:** _(none)_
**Why:** Fires when the What's New modal appears. Baseline for the feature announcement funnel.

### `whats_new_screen_viewed`
**Properties:** `screen` (2, 3, 4)
**Why:** Tracks how far users read through release notes. Drop-off by screen tells us which content they care about (or don't).

### `whats_new_completed`
**Properties:** _(none)_
**Why:** User read through all screens. Strong signal of engagement with product updates — these users are more likely to try new features.

### `whats_new_dismissed`
**Properties:** _(none)_
**Why:** User closed the modal without finishing. Paired with `whats_new_shown` gives us a dismissal rate — high dismissal = announcements aren't landing.

---

## Chat Core

### `chat_created`
**Properties:** `source` (new_chat | character_flow)
**Why:** A new conversation was started. `source` tells us whether it was user-initiated or triggered by the character creation flow. Feeds conversation volume metrics.

### `message_sent`
**Properties:** `message_length`, `has_attachment` (bool), `is_first_message` (bool)
**Why:** Every outbound user message. The most important engagement event. `is_first_message` identifies activation. `has_attachment` tracks file/image feature usage.

### `message_received`
**Properties:** `response_time_ms`, `response_length`, `is_character` (bool), `character_name`
**Why:** Every AI response completed. Tracks response quality (length) and speed. `is_character` tells us how much of usage is character-mode vs. plain chat.

### `message_edited`
**Properties:** _(none)_
**Why:** User edited a previous message. Tells us how often users need to correct their input — could indicate the AI misunderstood, or just normal iteration.

### `message_regenerated`
**Properties:** _(none)_
**Why:** User asked for a new response to the same message. High regeneration rate signals AI response quality problems or misaligned expectations.

### `message_copied`
**Properties:** _(none)_
**Why:** User copied an AI response. Strong positive signal — they found the output useful enough to use somewhere. Proxy for response quality when we can't measure it directly.

### `message_feedback`
**Properties:** `type` (thumbs_up | thumbs_down), `message_id`
**Why:** Explicit user rating on an AI response. Direct quality signal. Segmented by character vs. plain chat, it tells us where the AI is and isn't meeting expectations.

### `chat_deleted`
**Properties:** _(none)_
**Why:** User deleted a conversation. A soft churn signal within the session. High delete rates on short chats suggest users aren't getting value quickly enough.

### `chat_selected`
**Properties:** `chat_id`
**Why:** User navigated to a previous chat. Measures re-engagement with old conversations — a proxy for how often users return to ongoing threads vs. starting fresh.

### `daily_limit_reached`
**Properties:** `plan`
**Why:** User hit their daily message cap. The most direct monetization signal — these are exactly the users to target for upgrade. Tracked by plan to separate Free (5/day) from Pro (100/day).

---

## Streaming

### `streaming_started`
**Properties:** _(none)_
**Why:** First data chunk received from the AI stream. Start of the perceived response. Together with `streaming_completed` gives us real streaming duration.

### `streaming_completed`
**Properties:** `total_chunks`, `duration_ms`
**Why:** Full response delivered. `duration_ms` is the real user-perceived latency from send to finish. `total_chunks` can hint at response length before it's processed.

### `streaming_interrupted`
**Properties:** `streamed_length`, `duration_ms`
**Why:** User hit "Stop" mid-generation. Tells us how often users abandon in-progress responses — high interruption rate suggests slow responses or irrelevant content.

### `ai_response_error`
**Properties:** `error_type`
**Why:** Something broke during message delivery. Fires on any non-abort error. Tracked separately from `client_error` because these are API/server failures, not JS bugs.

### `ai_response_timeout`
**Properties:** `wait_ms`
**Why:** Response took over 30 seconds to start. Fires before the full timeout, so we know the user was still waiting. High rates signal backend overload or Anthropic API issues.

### `ai_response_empty`
**Properties:** _(none)_
**Why:** Stream completed but returned blank content. A quality failure — the AI responded but with nothing. Helps distinguish true failures from errors.

---

## Characters

### `character_modal_opened`
**Properties:** _(none)_
**Why:** User opened the character creator. Top of the character creation funnel.

### `character_modal_closed`
**Properties:** `action` (added | clicked_outside | cancelled)
**Why:** Tracks HOW the modal was closed. `added` = success. `clicked_outside` or `cancelled` = abandon. Lets us measure character creation completion rate and where people drop off.

### `character_created`
**Properties:** `character_id`, `character_name`
**Why:** A new character was saved. Core feature adoption event. Compare users with characters vs. without for retention difference.

### `character_removed`
**Properties:** `character_id`
**Why:** User deleted a character. If high, suggests characters aren't delivering value or the feature needs iteration.

### `character_mentioned`
**Properties:** `character_id`
**Why:** User @mentioned a character in a message. Measures active character usage per message, not just creation. The real engagement signal for the characters feature.

### `character_response_received`
**Properties:** `character_name`, `response_time_ms`, `response_length`
**Why:** AI responded in character mode. Lets us benchmark character response quality vs. plain mode. High response times in character mode could indicate prompt overhead issues.

### `character_limit_reached`
**Properties:** _(none)_
**Why:** User tried to create more characters than their plan allows. Monetization signal similar to `daily_limit_reached` — these users are engaged enough to hit the ceiling.

### `mention_dropdown_shown`
**Properties:** _(none)_
**Why:** The @mention autocomplete dropdown appeared. Tracks discoverability of the character mention feature — if low, users may not know characters can be @mentioned.

---

## Files & Uploads

### `file_selected`
**Properties:** `file_type`, `file_size`
**Why:** User picked a file to attach. Top of the file upload funnel. Drop-off between `file_selected` and `file_uploaded` = upload friction or failures.

### `file_uploaded`
**Properties:** `file_type`, `file_size`, `upload_duration_ms`
**Why:** File successfully uploaded to storage. Confirms the feature worked. `upload_duration_ms` tracks upload speed — slow uploads hurt perceived performance.

### `file_upload_failed`
**Properties:** `error` (upload_error | network_error), `file_type`
**Why:** Upload failed. `error` type separates server-side failures from network issues. High rates = reliability problem that directly blocks a paid feature.

### `file_upload_cancelled`
**Properties:** _(none)_
**Why:** User cancelled before upload finished. Possible sign the file picker UX is confusing or uploads are too slow.

---

## Input Behaviour

### `typing_started`
**Properties:** _(none)_
**Why:** User started typing in the message input. Fires once per input session (debounced). Measures intent-to-send before the message is actually sent — gap between typing_started and message_sent is composition time.

### `input_focused`
**Properties:** _(none)_
**Why:** User clicked/tapped the input field. A softer engagement signal than typing — tells us users are actively engaging with the compose area even if they don't type.

### `input_abandoned`
**Properties:** _(none)_
**Why:** User started typing but left the input without sending. Fires on blur after typing was detected. High abandonment suggests friction before sending — could be hesitation, confusion, or the daily limit.

### `scroll_depth`
**Properties:** `depth_percent` (25 | 50 | 75 | 100)
**Why:** How far users scroll through the conversation. Tracks whether users are reading full responses or just the top portion. Low depth on long responses = consider more concise output.

### `prompt_chip_clicked`
**Properties:** `prompt_text`
**Why:** User clicked one of the suggested prompt chips. Measures how useful the starter prompts are. High click rate = users don't know what to say on their own (could be good or bad).

---

## Monetization

### `upgrade_modal_opened`
**Properties:** `trigger` (where it was opened from)
**Why:** User saw the upgrade prompt. Top of the paid conversion funnel. `trigger` tells us which surface (limit hit, manual click, etc.) drives the most modal views.

### `upgrade_initiated`
**Properties:** `plan` (Pro | Plus), `price`
**Why:** User clicked to proceed with payment. Intent signal — they've seen the price and chosen to continue. Gap between this and `subscription_started` is payment drop-off.

### `subscription_started`
**Properties:** `plan`, `price`, `method` (paystack | stripe)
**Why:** Payment confirmed and subscription is active. The actual revenue event. Tied to Paystack/Stripe webhook confirmation, not just the button click.

### `subscription_cancelled`
**Properties:** `plan`, `reason` (if provided)
**Why:** User cancelled their subscription. The churn event. Tracked with plan so we can compare Pro vs. Plus churn rates. Feeds MRR calculations.

### `subscription_renewed`
**Properties:** `plan`, `amount`
**Why:** Recurring billing succeeded. Fires from the billing cron/webhook. Distinguishes one-time subscribers from retained ones.

### `subscription_payment_failed`
**Properties:** `plan`, `attempt_count`
**Why:** A renewal charge failed. Fires from Paystack webhook. Users here are at high churn risk — used to trigger dunning emails.

### `subscription_reactivated`
**Properties:** `plan`
**Why:** A cancelled or lapsed subscriber paid again. Win-back event. These users have higher LTV than first-time subscribers on average.

---

## Retention & Activation

### `first_message_sent`
**Properties:** _(none)_
**Why:** The single most important activation event. A user who sends their first message is activated — everything before this is pre-activation. Fired only once per user, ever.

### `activation_milestone`
**Properties:** `total_messages` (3 | 10 | 50)
**Why:** Depth checkpoints after activation. 3 msgs = tried it, 10 msgs = getting value, 50 msgs = power user. Correlates strongly with paid conversion probability.

### `conversation_depth_milestone`
**Properties:** `depth` (5 | 10 | 20)
**Why:** Tracks how deep a single conversation goes. Deep conversations signal genuine engagement vs. quick-exit usage. Users reaching 10+ messages in one chat have very high retention.

### `retention_day`
**Properties:** `day` (1 | 3 | 7 | 14 | 30)
**Why:** Fires the first time a user returns on or after each milestone day since signup. Tracked via localStorage so it fires exactly once per milestone. Standard retention cohort inputs (D1, D7, D30).

### `streak_milestone`
**Properties:** `streak_days` (3 | 7 | 14 | 30)
**Why:** Consecutive daily usage streak. High streak users are your most habitual users. Can be used to trigger reward messaging or to identify power users for research interviews.

---

## Theme

### `theme_changed`
**Properties:** `theme` (light | dark | system)
**Why:** User switched the app theme. Tells us preferred theme distribution. Also useful for verifying that dark mode is working correctly if error rates spike after a change.

---

## Growth & Discovery

### `app_installed`
**Properties:** _(none)_
**Why:** Fires on the browser's `appinstalled` event (PWA install). Tracks how many users are adding the app to their home screen — a strong retention signal.

### `external_link_clicked`
**Properties:** `url`, `label`
**Why:** User clicked an outbound link (social media, docs, etc.). Tracks which external content users are engaging with and how often they leave the app via link clicks.

### `topic_detected`
**Properties:** `topic`
**Why:** The app detected a conversation topic from the message text (e.g. "coding", "writing", "relationships"). Tells us what users actually talk about — informs content strategy, prompt suggestions, and character ideas.

### `email_sent`
**Properties:** `email_type` (verification | password_reset | subscription_welcome | subscription_cancelled | payment_failed | abandoned_payment | follow_up), `user_id`
**Why:** Server-side event tracking all transactional emails. Lets us verify emails are being sent, measure delivery rates, and correlate email sends with downstream actions (e.g. did the abandoned payment email convert?).

---

## A/B Testing

### `experiment_assigned`
**Properties:** `experiment` (name), `variant`
**Why:** Fires when a user is randomly assigned to an experiment variant (persisted in localStorage). Baseline for any A/B test — without this, you can't build a cohort to measure against.

### `experiment_converted`
**Properties:** `experiment` (name), `variant`, `conversion_event`
**Why:** Fires when a user in an experiment completes the target action. Paired with `experiment_assigned`, this is the full A/B result — conversion rate per variant.

---

## Summary

| Category | Events |
|---|---|
| Session | 3 |
| Performance | 5 |
| Frustration | 3 |
| Auth & Account | 6 |
| Onboarding | 4 |
| What's New | 4 |
| Chat Core | 10 |
| Streaming | 6 |
| Characters | 8 |
| Files & Uploads | 4 |
| Input Behaviour | 5 |
| Monetization | 7 |
| Retention & Activation | 5 |
| Theme | 1 |
| Growth & Discovery | 4 |
| A/B Testing | 2 |
| **Total** | **81** |
