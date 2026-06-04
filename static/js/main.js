/* GIM-World project page – click-to-play playback.
 *
 * Nothing streams on load. Every clip shows its poster plus a play button.
 *   - Results tiles play individually.
 *   - Comparison videos sharing data-strip="..." play as one row: clicking
 *     any button in the row starts all five and keeps them time-aligned.
 *
 * No frameworks, no build step.
 */
(function () {
  "use strict";

  // The hero background video should always play on its own. Autoplay can be
  // throttled (poster shown, tab restored, power-saving), so kick it.
  const hero = document.querySelector("video.title-bg");
  if (hero) {
    const kickHero = () => { hero.play().catch(() => {}); };
    kickHero();
    hero.addEventListener("canplay", kickHero, { once: true });
    hero.addEventListener("loadeddata", kickHero, { once: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) kickHero();
    });
    // Last resort if the browser blocks muted autoplay until a gesture.
    window.addEventListener("pointerdown", kickHero, { once: true });
  }

  const grid = document.querySelector("[data-cmp-grid]");

  /** @type {Record<string, HTMLVideoElement[]>} */
  const strips = {};
  if (grid) {
    for (const v of grid.querySelectorAll("video[data-strip]")) {
      const k = v.getAttribute("data-strip");
      if (!k) continue;
      (strips[k] ||= []).push(v);
    }
  }

  // A strip is "ready" only when every member has buffered enough to play
  // smoothly. Time-alignment is gated on this so we never seek a clip while
  // it is still buffering (that mid-load re-anchoring caused the jitter).
  const STRIP_READY = 3; // HTMLMediaElement.HAVE_FUTURE_DATA
  function stripReady(arr) {
    return arr.every((v) => v.readyState >= STRIP_READY);
  }

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

  const all = document.querySelectorAll("video:not(.title-bg)");

  // Lightweight poster (matching first-frame jpg next to the .mp4) so the
  // tile shows real content before anything streams.
  all.forEach((v) => {
    if (v.poster) return;
    const s = v.getAttribute("src");
    if (s) v.poster = s.replace(/\?.*$/, "").replace(/\.mp4$/, ".jpg");
  });

  // Wrap each video so the play button and spinner anchor to the clip itself
  // (not the caption above it). Then attach a play button.
  const activated = new WeakSet();

  function setLoading(v, on) {
    const w = v.parentElement;
    if (w && w.classList.contains("vwrap")) w.classList.toggle("is-loading", on);
  }

  function groupOf(v) {
    const k = v.getAttribute("data-strip");
    return (k && strips[k]) ? strips[k] : [v];
  }

  function startGroup(arr) {
    arr.forEach((v) => {
      activated.add(v);
      const w = v.parentElement;
      if (w) w.classList.add("is-playing");
      if (v.readyState < STRIP_READY) setLoading(v, true);
      v.play().catch(() => {});
    });
  }

  all.forEach((v) => {
    const wrap = document.createElement("div");
    wrap.className = "vwrap";
    v.parentNode.insertBefore(wrap, v);
    wrap.appendChild(v);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "playbtn";
    btn.setAttribute("aria-label", "Play");
    btn.addEventListener("click", () => startGroup(groupOf(v)));
    wrap.appendChild(btn);

    v.addEventListener("waiting", () => setLoading(v, true));
    v.addEventListener("stalled", () => setLoading(v, true));
    v.addEventListener("canplay", () => setLoading(v, false));
    v.addEventListener("playing", () => setLoading(v, false));
    v.addEventListener("error", () => setLoading(v, false));
  });

  // Pause activated clips when scrolled off-screen; resume when scrolled back.
  // Clips the user never started stay paused on their poster.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const ent of entries) {
        const v = ent.target;
        if (!activated.has(v)) continue;
        if (ent.isIntersecting) {
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      }
    }, { rootMargin: "200px 0px", threshold: 0.1 });
    all.forEach((v) => io.observe(v));
  }
})();
