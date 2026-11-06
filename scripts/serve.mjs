import * as http from "node:http"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const root = path.resolve(process.argv.includes("--dist") ? "dist" : ".")
const port_flag = process.argv.indexOf("--port")
const port = Number(
    port_flag >= 0 ? process.argv[port_flag + 1] : process.env.PORT || 5173,
)
const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".pdf": "application/pdf",
    ".ttf": "font/ttf",
    ".woff2": "font/woff2",
    ".json": "application/json; charset=utf-8",
}

const server = http.createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(
            new URL(request.url, "http://localhost").pathname,
        )
        const file_path = path.resolve(
            root,
            `.${pathname === "/" ? "/index.html" : pathname}`,
        )
        if (!file_path.startsWith(`${root}${path.sep}`)) {
            response.writeHead(403).end("Forbidden")
            return
        }
        if (!(await fs.stat(file_path)).isFile()) throw new Error("Not a file")
        const data = await fs.readFile(file_path)
        response.writeHead(200, {
            "Content-Type":
                types[path.extname(file_path)] || "application/octet-stream",
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
        })
        response.end(data)
    } catch {
        response.writeHead(404, { "Content-Type": "text/plain" }).end("Not found")
    }
})

server.on("error", (error) => {
    console.error(`Preview failed: ${error.message}`)
    process.exitCode = 1
})
server.listen(port, "127.0.0.1", () => console.log(`Local: http://127.0.0.1:${port}`))
