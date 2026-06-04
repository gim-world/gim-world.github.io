/* GIM-World project page – minimal interactivity.
 *
 * Per-strip synchronized playback for the comparison grid. Each <video>
 * with the same data-strip="..." is treated as one strip; the first video
 * in the strip is the leader, the rest re-anchor to its currentTime
 * whenever they drift more than 180ms. No controls, no switcher.
 *
 * No frameworks, no build step.
 */
(function () {
  "use strict";

  const grid = document.querySelector("[data-cmp-grid]");
  if (!grid) return;

  /** @type {Record<string, HTMLVideoElement[]>} */
  const strips = {};
  for (const v of grid.querySelectorAll("video[data-strip]")) {
    const k = v.getAttribute("data-strip");
    if (!k) continue;
    (strips[k] ||= []).push(v);
  }

  // A strip is "ready" only when every member has enough buffered data to
  // play smoothly (HAVE_FUTURE_DATA). We gate all time-alignment on this so
  // we never seek videos while they are still buffering — that mid-load
  // re-anchoring is what made the first frames jump back and forth.
  const STRIP_READY = 3; // HTMLMediaElement.HAVE_FUTURE_DATA
  function stripReady(arr) {
    return arr.every((v) => v.readyState >= STRIP_READY);
  }

  // Re-anchor every follower in a strip to the leader's currentTime when
  // drift exceeds the threshold. Only runs once the whole strip is buffered.
  const DRIFT_S = 0.18;
  setInterval(function () {
    for (const k in strips) {
      const arr = strips[k];
      if (arr.length < 2) continue;
      const leader = arr[0];
      if (leader.paused || !stripReady(arr)) continue;
      const t = leader.currentTime;
      for (let i = 1; i < arr.length; i++) {
        const v = arr[i];
        const dt = v.currentTime - t;
        if (Math.abs(dt) > DRIFT_S) {
          try { v.currentTime = t; } catch (e) { /* noop */ }
        }
      }
    }
  }, 1500);

  // When the leader (re)starts, snap the rest of the strip to it — but only
  // if the strip is fully buffered, so we don't fight the loaders.
  for (const k in strips) {
    const arr = strips[k];
    arr.forEach((v) => {
      v.addEventListener("playing", () => {
        if (v !== arr[0] || !stripReady(arr)) return;
        const t = v.currentTime;
        for (let i = 1; i < arr.length; i++) {
          const o = arr[i];
          try { o.currentTime = t; } catch (e) { /* noop */ }
          o.play().catch(() => {});
        }
      });
    });
  }

  // Lazy-load + viewport gating. Grid/long videos ship with preload="none"
  // and no autoplay, so nothing downloads until a tile nears the viewport.
  // On intersect we call play(), which kicks off the fetch and decode; on
  // exit we pause (the buffered data is kept, so scrolling back is instant).
  // rootMargin starts loading ~300px before a tile actually enters view.
  const all = document.querySelectorAll("video:not(.title-bg)");

  // Give every lazy video a lightweight poster (the matching first-frame jpg
  // sitting next to the .mp4). Posters are ~20KB each, so they paint instantly
  // and the heavy video stream swaps in behind them once it buffers.
  all.forEach((v) => {
    if (v.poster) return;
    const s = v.getAttribute("src");
    if (s) v.poster = s.replace(/\?.*$/, "").replace(/\.mp4$/, ".jpg");
  });

  // Loading spinner: toggle .is-loading on the enclosing <figure> while the
  // clip is fetching/buffering, clear it once it can play.
  function setLoading(v, on) {
    const fig = v.closest("figure");
    if (fig) fig.classList.toggle("is-loading", on);
  }
  all.forEach((v) => {
    v.addEventListener("waiting", () => setLoading(v, true));
    v.addEventListener("stalled", () => setLoading(v, true));
    v.addEventListener("canplay", () => setLoading(v, false));
    v.addEventListener("playing", () => setLoading(v, false));
    v.addEventListener("error", () => setLoading(v, false));
  });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const ent of entries) {
        const v = ent.target;
        if (ent.isIntersecting) {
          if (v.readyState < STRIP_READY) setLoading(v, true);
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      }
    }, { rootMargin: "300px 0px", threshold: 0.15 });
    all.forEach((v) => io.observe(v));
  } else {
    // No IntersectionObserver: fall back to playing everything (the browser
    // will still stream lazily via the media element's own buffering).
    all.forEach((v) => v.play().catch(() => {}));
  }
})();
