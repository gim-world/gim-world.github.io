# GIM-World — Project Page

Static project page for **GIM-World: Geometry-Aware Implicit Memory for Video World Models**.

Pure HTML/CSS/JS — no build step.

## Structure

```
index.html              # the page
.nojekyll               # tell GitHub Pages to serve files as-is
static/
  css/style.css
  js/main.js            # per-strip synchronized video playback
  images/teaser.webp
  videos/
    hero.mp4            # title background
    long/               # long-horizon rollouts (action HUD baked in)
    compare/<case>/     # framepack / cam / ssm / ours / gt, per case
```

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy with GitHub Pages

1. Push this folder to a GitHub repo.
2. Settings → Pages → Build from branch → `main` / root.
3. The page is served from `index.html`.
