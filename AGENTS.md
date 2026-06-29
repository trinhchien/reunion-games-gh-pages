# Repository Guidelines

## Project Structure & Module Organization
This repository is a single-page static site for reunion event games and a lucky wheel. Keep the app split by concern:

- `index.html`: page structure, sections, and UI hooks.
- `style.css`: all visual styling, layout, and responsive rules.
- `script.js`: app state, `localStorage` persistence, admin interactions, and wheel logic.
- `README.md`: end-user setup and deployment notes.

There is no `src/` or build output directory. Add new assets beside these files only when necessary, and keep paths relative for GitHub Pages compatibility.

## Build, Test, and Development Commands
No build step is required.

- `start index.html` or open `index.html` in a browser: run the site locally.
- `python -m http.server 8000`: optional local server if browser security blocks direct file access.

This project is intended to deploy as static files to GitHub Pages.

## Coding Style & Naming Conventions
Use 2-space indentation in HTML and 2 spaces in CSS and JavaScript to match the existing files. Prefer descriptive camelCase for JavaScript variables and functions such as `renderPublicGames` and `toggleAttendeeExcluded`. Use kebab-case for CSS classes like `.hero-card` and `.tab-panel`.

Keep JavaScript framework-free and DOM-driven. Reuse the existing `state` model and `STORAGE_KEY` pattern instead of adding parallel storage flows. Preserve relative imports like `./style.css` and `./script.js`.

## Testing Guidelines
There is no automated test suite yet. Before opening a PR, verify manually in a browser:

- overview, admin, and wheel tabs switch correctly
- attendee add/import/remove flows persist after refresh
- lucky wheel spin, exclude, and reset behavior work
- layout remains usable on desktop and mobile widths

If you add logic with meaningful branching, consider adding lightweight browser-based tests or documenting manual test steps in the PR.

## Commit & Pull Request Guidelines
Git history is not available in this workspace, so no established commit pattern can be inferred. Use short, imperative commit messages such as `Add attendee import validation` or `Refine wheel mobile layout`.

Pull requests should include:

- a brief summary of user-visible changes
- manual test notes
- screenshots or short recordings for UI changes
- linked issue or task reference when applicable

## Configuration Notes
Application data is stored in browser `localStorage`. Avoid storing secrets or assuming shared state across devices or browsers.


## Language & Copy Guidelines
Write all Vietnamese copy with proper diacritics. Do not introduce Vietnamese text without accents in UI labels, descriptions, documentation, or seeded content. When editing existing Vietnamese copy, normalize it to accented Vietnamese where practical.
