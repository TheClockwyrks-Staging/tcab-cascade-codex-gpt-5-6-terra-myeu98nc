# Cascade

Cascade is a browser-only Draw One Klondike solitaire. Build each foundation from Ace through King, then watch the completed deck burst into the game's signature card cascade.

## Run it

Install dependencies with `npm ci`, then start the development server with `npm run dev`. Build the self-contained static site with `npm run build`; its files are written to `dist/` and can be served by any static web server.

## Controls

Use a mouse or touch to drag face-up cards. Click the stock to turn one card; click it again once empty to recycle the waste. Double-click a playable waste or tableau card to send it to its foundation. The bottom bar provides New Game, Menu, and Sound controls.

Menus work with Arrow keys or W/S, Enter or Space to confirm, and Escape to go back from the instructions. Press the backtick key to show the read-only debug overlay.
