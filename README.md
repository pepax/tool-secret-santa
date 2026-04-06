# Browser Tool Template (Static + GitHub Pages)

A minimal, reusable starter repository for building small browser-based tools with **plain HTML, CSS, and vanilla JavaScript** (no build step).

This template is ideal for quick utilities such as:
- calculators
- converters
- generators
- formatters
- lightweight productivity tools

---

## What this template includes

```text
/
  index.html
  style.css
  app.js
  assets/
  .github/workflows/deploy.yml
  README.md
  LICENSE
```

- `index.html`: semantic structure for input → action → output flow
- `style.css`: mobile-first dark UI with clear panel separation
- `app.js`: reusable app skeleton (`state`, `init`, `compute`, `render`, `reset`, `copy`, localStorage)
- `deploy.yml`: official GitHub Pages deployment workflow (GitHub Actions source)

---

## How to create a new repo from this template

1. Click **Use this template** on GitHub.
2. Name your new repository.
3. Create the repository.
4. Clone it (or edit directly on GitHub/mobile).
5. Update:
   - page title and tool name in `index.html`
   - styles in `style.css` (optional)
   - core logic in `compute()` in `app.js`

---

## How to edit from a smartphone

This template is intentionally simple so you can maintain it from your phone:

1. Open your repository in the GitHub mobile app or mobile browser.
2. Edit `index.html`, `style.css`, and `app.js` directly.
3. Commit changes to `main`.
4. GitHub Actions automatically deploys the site.

Tip: Keep logic inside `compute()` and small helper functions so edits stay manageable on small screens.

---

## How deployment works

Deployment is handled by `.github/workflows/deploy.yml` using official GitHub Pages actions:

- `actions/configure-pages`
- `actions/upload-pages-artifact`
- `actions/deploy-pages`

Behavior:
- Triggered on push to `main` and manual run (`workflow_dispatch`)
- Deploys the repository root as a static site (no build step)
- Uses concurrency so only one Pages deploy runs at a time

To enable:
1. In your repository, go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Source: GitHub Actions**.

---

## Site URL (GitHub Pages)

After deployment, your site will be available at:

`https://<your-username>.github.io/<your-repo-name>/`

For organization repos, replace `<your-username>` with the org name.

---

## Extending `compute()` in `app.js`

`compute()` contains placeholder logic so this template can be reused for any tool.

Suggested pattern:
1. Read from `state.input`
2. Validate and normalize input
3. Run your transformation/calculation
4. Write result to `state.output`
5. Call `renderOutput()`
6. Save to localStorage (`saveState()`)

Example ideas:
- unit conversion (km → miles)
- tax/discount calculator
- password/passphrase generator
- JSON formatter
- text case converter

---

## License

This template is released under the MIT License. See `LICENSE`.
