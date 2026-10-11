/**
 * One locale for every number/date the app formats.
 *
 * Calling toLocaleString() with no locale formats with the RUNTIME default:
 * en-US on the Nuxt server, the visitor's language in the browser. The two
 * renders then differ ("$142,475" vs "$142 475") and Vue reports a hydration
 * mismatch. The UI is English, so format in en-US on both sides. If the app
 * is ever localized, derive this from the user's setting and pass it through
 * useState, so the server and the client agree.
 */
export const APP_LOCALE = 'en-US'
