/**
 * Sample-data visitors get their real demo account as soon as the server answers.
 *
 * The demo account is the default way into Strades. When the API did not answer at the moment the visitor
 * pressed "Continue in demo mode" (e.g. it was restarting), pages/auth.vue fell back to sample data
 * (cookie strades_demo=1): no account, so no profile mirror, wallets or bots. On the next app start we
 * try once per browser tab to resume the demo remembered on this device, else create one, then reload so
 * every store reads the account instead of the sample files.
 */
export default defineNuxtPlugin(() => {
  const demo = useCookie<string | number | null>('strades_demo')
  const auth = useAuth()
  if (String(demo.value ?? '') !== '1' || auth.isAuthenticated.value) return
  const KEY = 'strades_demo_upgrade_tried'
  try {
    if (sessionStorage.getItem(KEY)) return
    sessionStorage.setItem(KEY, '1')
  } catch { return }
  // after hydration: never delay the first paint for it
  setTimeout(async () => {
    try {
      await auth.activateDemo(2)
      reloadNuxtApp({ force: true })
    } catch {
      // still unreachable or rate-limited: stay on sample data; the profile mirror offers a button
    }
  }, 300)
})
