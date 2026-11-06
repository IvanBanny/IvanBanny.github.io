# Ivan Banny

My website at [ivanbanny.github.io](https://ivanbanny.github.io).
HTML, CSS, JavaScript, and WebGL 2.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Reload after editing.

```sh
npm run check
npm test
npm run build
npm run preview
```

The build writes `dist/`. GitHub Actions checks, builds, and publishes pushes to
`main`. `npm run format` formats the source. The renderer and playback checks run
at `/tests/browser.html` on the development server; keep that tab visible.

The background uses the lens parameters in `src/optics.js` and shaders in
`src/shaders.js`. `src/light.js` handles WebGL; `src/generations.js` plays the
Dirtflow frames. Reduced motion shows stills. Research and navigation also work
without JavaScript or WebGL.

The generation catalog is `assets/generations/index.json`. Each build has a
frame sheet and final still at 256 and 384 pixels. IBM Plex Sans is included under
the [SIL Open Font License](assets/fonts/OFL.txt).
