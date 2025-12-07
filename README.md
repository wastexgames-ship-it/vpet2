# vPet2 — Minimal Virtual Pet

This is a tiny browser-based virtual pet demo using Canvas and a simple state machine.

Run locally (PowerShell):

```powershell
# use npx to run a static server on port 8080
npx http-server . -p 8080 -c-1

# or if you have live-server installed:
npx live-server --port=8080
```

Open http://localhost:8080 in your browser. Interact with the pet using the buttons.

Files of interest:

- `index.html` — the page and UI
- `styles.css` — basic styles
- `src/main.js` — bootstraps the canvas, loop and UI
- `src/pet.js` — Pet class with stats and tick
- `src/stateMachine.js` — small state machine
- `src/render.js` — canvas drawing helpers

Next steps you might ask me to do:

- Add persistent save/load (localStorage)
- Add images / sprites and animations
- Add audio and more detailed interactions
