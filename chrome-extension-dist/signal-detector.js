/**
 * Signal Main-World Component Detector
 *
 * Runs in the page's MAIN world to access React fiber / Vue instance /
 * Svelte component properties that only exist on the page's JS heap.
 *
 * Communication:
 *   content script → fires `signal-detect-component` with { points: [{x,y}] }
 *   this script    → responds with `signal-component-result` carrying
 *                    { componentName, componentFramework, components: [...] }
 *
 * Loaded via <script src="..."> (web_accessible_resources) to bypass CSP
 * restrictions that block inline scripts on many production websites.
 */
(function () {
  /**
   * Try to extract a Vue component name from a Vue 3 internal vnode/instance.
   * Works in both dev and production builds.
   */
  function getVue3Name(instance) {
    if (!instance) return null;
    var type = instance.type || (instance.$ && instance.$.type);
    if (!type) return null;
    // Dev: __name, name, __file
    var name = type.__name || type.name;
    if (name) return name;
    // Production: __file may still exist
    if (type.__file) return type.__file.split("/").pop().replace(/\.vue$/i, "");
    // Try setup / render function name
    if (type.setup && type.setup.name && /^[A-Z]/.test(type.setup.name)) return type.setup.name;
    if (type.render && type.render.name && /^[A-Z]/.test(type.render.name)) return type.render.name;
    return null;
  }

  /**
   * Try to find a Vue 3 component instance from a DOM element.
   * Checks multiple internal properties used by different Vue 3 versions.
   */
  function getVue3Instance(node) {
    // Dev mode: __vueParentComponent
    if (node.__vueParentComponent) return node.__vueParentComponent;
    // Production: look for __vue_app__ on root, or vnode properties
    var keys = Object.keys(node);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      // Vue 3 internal vnode key (starts with __vnode)
      if (k.startsWith("__vnode")) {
        var vnode = node[k];
        if (vnode && vnode.component) return vnode.component;
      }
      // Vue 3 compiled with app context
      if (k === "__vue_app__") return node.__vue_app__._instance;
    }
    return null;
  }

  /**
   * Walk up from an element to find the nearest owning framework component.
   * Returns the first match (nearest to the DOM node).
   */
  function walk(el) {
    var node = el;
    while (node && node !== document.documentElement) {
      var keys = Object.keys(node);

      // ── React fiber ──
      var fk = null;
      for (var i = 0; i < keys.length; i++) {
        if (
          keys[i].startsWith("__reactFiber") ||
          keys[i].startsWith("__reactInternalInstance")
        ) {
          fk = keys[i];
          break;
        }
      }
      if (fk) {
        var fiber = node[fk];
        while (fiber) {
          var t = fiber.type;
          if (t && typeof t === "function") {
            var n = t.displayName || t.name;
            if (n && n.length > 1 && /^[A-Z]/.test(n))
              return { componentName: n, componentFramework: "react" };
          }
          if (t && typeof t === "object") {
            var n2 =
              t.displayName ||
              (t.render && (t.render.displayName || t.render.name)) ||
              (t.type && (t.type.displayName || t.type.name));
            if (n2 && /^[A-Z]/.test(n2))
              return { componentName: n2, componentFramework: "react" };
          }
          fiber = fiber.return;
        }
      }

      // ── Vue 3 (dev + production) ──
      var v3 = getVue3Instance(node);
      if (v3) {
        var vn = getVue3Name(v3);
        if (vn) return { componentName: vn, componentFramework: "vue" };
        // Walk up the Vue component parent chain
        var parent = v3.parent;
        while (parent) {
          var pn = getVue3Name(parent);
          if (pn) return { componentName: pn, componentFramework: "vue" };
          parent = parent.parent;
        }
      }

      // ── Vue 2 ──
      if (node.__vue__ && node.__vue__.$options) {
        var vn2 = node.__vue__.$options.name || node.__vue__.$options.__name;
        if (vn2)
          return { componentName: vn2, componentFramework: "vue" };
      }

      // ── Svelte 4 / Svelte 5 ──
      if (
        node.__svelte_meta &&
        node.__svelte_meta.loc &&
        node.__svelte_meta.loc.file
      ) {
        var sn = node.__svelte_meta.loc.file
          .split("/")
          .pop()
          .replace(/\.svelte$/i, "");
        if (sn)
          return { componentName: sn, componentFramework: "svelte" };
      }

      node = node.parentElement;
    }
    return null;
  }

  /**
   * Walk upward collecting ALL component boundaries (nearest → outermost).
   * Returns a deduplicated array of { componentName, componentFramework }.
   */
  function walkAll(el) {
    var results = [];
    var seen = {};
    var node = el;
    while (node && node !== document.documentElement) {
      var keys = Object.keys(node);

      // React — traverse fiber chain
      var fk = null;
      for (var i = 0; i < keys.length; i++) {
        if (
          keys[i].startsWith("__reactFiber") ||
          keys[i].startsWith("__reactInternalInstance")
        ) {
          fk = keys[i];
          break;
        }
      }
      if (fk) {
        var fiber = node[fk];
        while (fiber) {
          var t = fiber.type;
          var cn = null;
          if (t && typeof t === "function") cn = t.displayName || t.name;
          if (!cn && t && typeof t === "object")
            cn =
              t.displayName ||
              (t.render && (t.render.displayName || t.render.name)) ||
              (t.type && (t.type.displayName || t.type.name));
          if (cn && cn.length > 1 && /^[A-Z]/.test(cn)) {
            var key = "react:" + cn;
            if (!seen[key]) {
              seen[key] = true;
              results.push({ componentName: cn, componentFramework: "react" });
            }
          }
          fiber = fiber.return;
        }
      }

      // Vue 3 — walk component parent chain
      var v3 = getVue3Instance(node);
      if (v3) {
        var inst = v3;
        while (inst) {
          var vn = getVue3Name(inst);
          if (vn) {
            var key = "vue:" + vn;
            if (!seen[key]) {
              seen[key] = true;
              results.push({ componentName: vn, componentFramework: "vue" });
            }
          }
          inst = inst.parent;
        }
      }

      // Vue 2
      if (node.__vue__ && node.__vue__.$options) {
        var vn2 = node.__vue__.$options.name || node.__vue__.$options.__name;
        if (vn2) {
          var key = "vue:" + vn2;
          if (!seen[key]) {
            seen[key] = true;
            results.push({ componentName: vn2, componentFramework: "vue" });
          }
        }
      }

      // Svelte
      if (
        node.__svelte_meta &&
        node.__svelte_meta.loc &&
        node.__svelte_meta.loc.file
      ) {
        var sn = node.__svelte_meta.loc.file
          .split("/")
          .pop()
          .replace(/\.svelte$/i, "");
        if (sn) {
          var key = "svelte:" + sn;
          if (!seen[key]) {
            seen[key] = true;
            results.push({ componentName: sn, componentFramework: "svelte" });
          }
        }
      }

      node = node.parentElement;
    }
    return results;
  }

  // ── Event listener ──
  window.addEventListener("signal-detect-component", function (e) {
    var points = (e.detail && e.detail.points) || [];
    var primary = null;
    var allComponents = [];
    var seen = {};

    for (var i = 0; i < points.length; i++) {
      var els = document.elementsFromPoint(points[i].x, points[i].y);
      for (var j = 0; j < els.length; j++) {
        // Find the nearest component for this element (for primary)
        if (!primary) {
          primary = walk(els[j]);
        }

        // Collect ALL components in the tree from this element
        var comps = walkAll(els[j]);
        for (var k = 0; k < comps.length; k++) {
          var key =
            comps[k].componentFramework + ":" + comps[k].componentName;
          if (!seen[key]) {
            seen[key] = true;
            allComponents.push(comps[k]);
          }
        }
      }
    }

    var result = primary
      ? {
          componentName: primary.componentName,
          componentFramework: primary.componentFramework,
          components: allComponents,
        }
      : { components: allComponents };

    window.dispatchEvent(
      new CustomEvent("signal-component-result", { detail: result })
    );
  });
})();
