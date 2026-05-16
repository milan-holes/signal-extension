/**
 * Signal Vue DevTools Hook
 *
 * Runs at document_start in the MAIN world (before any page scripts).
 * Intercepts Vue 3's app:init event so we can collect app references
 * before recording starts — even on production builds where the DevTools
 * hook is normally disabled.
 *
 * Stored in: window.__SIGNAL_VUE_HOOK__._apps
 * Read by:   detectAppContext() (framework-detector.ts) via scripting.executeScript
 */
;(function () {
  'use strict'

  var signalApps = []

  function trackApp(app) {
    if (app && signalApps.indexOf(app) === -1) {
      signalApps.push(app)
    }
  }

  var existing = window.__VUE_DEVTOOLS_GLOBAL_HOOK__
  if (existing) {
    // Real Vue DevTools is already installed — enable it and tap into its emit
    // so we also collect app references without duplicating anything.
    existing.enabled = true
    var _origEmit = typeof existing.emit === 'function' ? existing.emit.bind(existing) : null
    existing.emit = function (event) {
      if (event === 'app:init') {
        trackApp(arguments[1])
      }
      return _origEmit ? _origEmit.apply(this, arguments) : undefined
    }
  }
  else {
    // No DevTools installed — inject a minimal hook so Vue's production build
    // fires app:init and component events to us.
    window.__VUE_DEVTOOLS_GLOBAL_HOOK__ = {
      enabled: true,
      _buffer: [],
      _apps: signalApps,
      emit: function (event) {
        if (event === 'app:init') {
          trackApp(arguments[1])
        }
      },
      on: function () {},
      once: function () {},
      off: function () {},
    }
  }

  // Always expose the collected apps so detectAppContext() can read them.
  window.__SIGNAL_VUE_HOOK__ = { _apps: signalApps }
})()
