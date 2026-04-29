// Metro / @expo/cli configuration for the consumer-mobile dev server.
//
// ── Why this file exists ─────────────────────────────────────────────────
//
// On Node 25.x the @expo/cli web SSG pipeline pre-evaluates side-effect
// modules through its `metro-require` system. One of those modules is
// `expo-notifications/build/DevicePushTokenAutoRegistration.fx.js`, which
// transitively requires `ServerRegistrationModule.web.js`. That `.web.js`
// implementation calls `localStorage.getItem(...)` at module-load time.
//
// In a real browser `localStorage` is a built-in global. In Node it is not,
// so the require chain throws `TypeError: localStorage.getItem is not a
// function` and the Metro process crashes BEFORE it ever serves the
// Android bundle to the dev client. Result: the dev client lands on
// DevLauncherErrorActivity ("Failed to connect to localhost:8081 …
// ECONNREFUSED") and BLE / E2E cannot run.
//
// We install a tiny in-memory shim onto `globalThis.localStorage`. It is
// scoped to the Metro/Node process only — production web builds run in a
// real browser where the native `localStorage` shadows our shim, so this
// has zero impact on the deployed PWA. The polyfill is also a no-op when
// `localStorage` is already defined (e.g. on a Node version that ships a
// real shim, or when the runtime later upgrades).
//
// Remove this file once the Expo SDK ships Node 25 compatibility for the
// web SSG pre-evaluation phase, OR once the project pins Node 22 LTS.
//
// ── Polyfill ─────────────────────────────────────────────────────────────

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(String(key), String(value))
    },
    removeItem(key) {
      store.delete(String(key))
    },
    clear() {
      store.clear()
    },
    key(index) {
      const keys = [...store.keys()]
      return index >= 0 && index < keys.length ? keys[index] : null
    },
    get length() {
      return store.size
    },
  }
}

// ── Default Metro config ─────────────────────────────────────────────────
//
// We delegate to Expo's default config. No platform exclusions, no custom
// resolvers — keep it minimal so the dev server behaves identically to a
// stock Expo project, modulo the polyfill above.

const { getDefaultConfig } = require('expo/metro-config')

module.exports = getDefaultConfig(__dirname)
