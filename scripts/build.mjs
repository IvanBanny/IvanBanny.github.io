import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as esbuild from "esbuild"

const destination = "dist"
await fs.rm(destination, { recursive: true, force: true })
await fs.mkdir(destination)
await fs.cp("assets", path.join(destination, "assets"), { recursive: true })
await fs.rm(path.join(destination, "assets/generations/index.json"))

const result = await esbuild.build({
    entryPoints: ["app.js", "styles.css"],
    entryNames: "[name]-[hash]",
    outdir: destination,
    bundle: true,
    external: ["*.woff2"],
    minify: true,
    format: "iife",
    target: "es2022",
    metafile: true,
    logLevel: "info",
})
const outputs = Object.entries(result.metafile.outputs)
const script = outputs.find(([, info]) => info.entryPoint === "app.js")[0]
const stylesheet = outputs.find(([, info]) => info.entryPoint === "styles.css")[0]
const html = (await fs.readFile("index.html", "utf8"))
    .replace(
        '<script type="module" src="app.js"></script>',
        `<script defer src="${path.basename(script)}"></script>`,
    )
    .replace('href="styles.css"', `href="${path.basename(stylesheet)}"`)
await fs.writeFile(path.join(destination, "index.html"), html)
await fs.writeFile(path.join(destination, ".nojekyll"), "")
