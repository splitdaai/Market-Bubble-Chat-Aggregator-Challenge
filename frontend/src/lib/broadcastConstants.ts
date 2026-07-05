/** Most recent full episode - the default replay shown when nothing is live.
 *  "Market Bubble: The Ansem Edition" (x.com/i/broadcasts/1kKzDDrlpOXJv, ~243min).
 *  To update after each show: grab the broadcast link from the episode tweet
 *  (x.com/i/broadcasts/<id>) and replace the id below. Previous: EP5 1dxYllbQZELJX. */
export const LATEST_EPISODE_BID = "1kKzDDrlpOXJv";

/** Seconds to skip at the start of a full-episode replay so the wall opens
 *  directly on the SHOW (hosts on screen), past X's "recorded live" slate AND
 *  Market Bubble's ~2-min pre-show countdown. Skipping the countdown also avoids
 *  its baked-in MB logo doubling with our footer wordmark. Per-episode: if a new
 *  show's intro runs longer/shorter, nudge this. */
export const EPISODE_SLATE_SKIP = 180;
