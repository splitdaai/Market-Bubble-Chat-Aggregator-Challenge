/** True when the app runs inside an iframe — e.g. the Return to Memes venue
 *  wall screen. Used to strip interactive chrome (header controls, clip/hide/
 *  transport buttons, chat search + filters, the composer) so an embedded
 *  screen is a clean, read-only stream + chat display. Module constant: the
 *  frame relationship never changes for a given page load. */
export const IS_EMBEDDED = typeof window !== "undefined" && window.self !== window.top;
