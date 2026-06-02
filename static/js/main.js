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

  // Re-anchor every follower in a strip to the leader's currentTime when
  // drift exceeds the threshold. Browsers can desync the videos slowly,
  // especially with autoplay-loop and tab visibility changes.
  const DRIFT_S = 0.18;
  setInterval(function () {
    for (const k in strips) {
      const arr = strips[k];
      if (arr.length < 2) continue;
      const leader = arr[0];
      if (leader.paused || leader.readyState < 2) continue;
      const t = leader.currentTime;
      for (let i = 1; i < arr.length; i++) {
        const v = arr[i];
        if (v.readyState < 2) continue;
        const dt = v.currentTime - t;
        if (Math.abs(dt) > DRIFT_S) {
          try { v.currentTime = t; } catch (e) { /* noop */ }
        }
      }
    }
  }, 1500);

  // When any video stalls and resumes (network blip, tab switched out and
  // back in), kick the rest of the strip to follow it.
  for (const k in strips) {
    const arr = strips[k];
    arr.forEach((v) => {
      v.addEventListener("playing", () => {
        if (v !== arr[0]) return;
        const t = v.currentTime;
        for (let i = 1; i < arr.length; i++) {
          const o = arr[i];
          if (o.readyState >= 2) {
            try { o.currentTime = t; } catch (e) { /* noop */ }
            o.play().catch(() => {});
          }
        }
      });
    });
  }

  // Pause videos that are not in the viewport so background tabs and
  // off-screen strips don't fight over decode threads. Resume when scrolled
  // back in. Same logic for the 4 long-horizon tiles.
  const all = document.querySelectorAll("video");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const ent of entries) {
        const v = ent.target;
        if (ent.isIntersecting) {
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      }
    }, { threshold: 0.15 });
    all.forEach((v) => io.observe(v));
  }
})();
