# DOOM PezzaliAPP Edition (PWA)

## Come usarla
1) Metti in `engine/` i file **engine.js** e **engine.wasm** (compilati con Emscripten).
2) (Opzionale ma consigliato) Metti `freedoom/freedoom1.wad` nel repo.
3) Pubblica con GitHub Pages e apri `index.html`.

### Note
- Il Service Worker non intercetta `.wad` e `.wasm` per evitare cache di 1 byte.
- `app.js` carica il WAD in RAM subito (locale o Freedoom) e lo salva per l'offline.
