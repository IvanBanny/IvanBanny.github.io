import * as generations from "../src/generations.js"
import * as renderer from "../src/light.js"

const canvas = document.querySelector("canvas")
const results = document.querySelector("#results")
const lines = []
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function check(condition, message) {
    if (!condition) throw new Error(message)
    lines.push(`PASS: ${message}`)
    results.textContent = lines.join("\n")
}

async function wait_for(condition) {
    const deadline = performance.now() + 2500
    while (!condition()) {
        if (performance.now() > deadline) throw new Error("Renderer check timed out")
        await delay(20)
    }
}

try {
    const gl = canvas.getContext("webgl2")
    if (!gl) throw new Error("WebGL 2 is required for these checks")
    const original_draw = gl.drawArrays
    let draws = 0
    gl.drawArrays = function (...args) {
        draws++
        return original_draw.apply(this, args)
    }
    const light = renderer.create_light(canvas, { paused: true, reduced_motion: true })
    try {
        light.seek(1.6)
        await wait_for(() => draws > 0)
        const program = () => gl.getParameter(gl.CURRENT_PROGRAM)
        const journey = () =>
            gl.getUniform(program(), gl.getUniformLocation(program(), "journey"))
        check(journey() === 2, "Reduced motion snaps directly to a section")
        check(
            gl.getUniform(
                program(),
                gl.getUniformLocation(program(), "generation_focus"),
            ) === 1,
            "Dirtflow focus survives reduced-motion snapping",
        )
        check(
            gl.getError() === gl.NO_ERROR,
            "Both shader passes render without GL errors",
        )
        let previous = draws
        await delay(120)
        check(draws === previous, "A settled paused renderer schedules no extra draws")

        light.reduce_motion(false)
        light.pause(false)
        await wait_for(() => draws > previous + 2)
        check(true, "Ambient motion resumes")
        light.pause(true)
        await delay(100)
        previous = draws
        await delay(120)
        check(draws === previous, "Pausing stops ambient redraws")
        light.seek(1.25)
        await wait_for(() => journey() === 1.25)
        check(true, "Scrolling still interpolates to its target while paused")

        const loss = gl.getExtension("WEBGL_lose_context")
        if (!loss) throw new Error("Context-loss testing is unavailable")
        const restored = new Promise((resolve) => {
            canvas.addEventListener("webglcontextrestored", resolve, { once: true })
        })
        loss.loseContext()
        await wait_for(() => gl.isContextLost())
        // consume the expected context-lost error before checking the new context
        gl.getError()
        await delay(100)
        loss.restoreContext()
        await restored
        await wait_for(() => !gl.isContextLost() && journey() === 1.25)
        check(
            !document.body.classList.contains("light-unavailable"),
            "Context recovery preserves the scroll state without reloading",
        )
        check(
            gl.getError() === gl.NO_ERROR,
            "Restored resources render without GL errors",
        )

        light.dispose()
        previous = draws
        canvas.style.width = "600px"
        light.seek(0)
        await delay(120)
        check(draws === previous, "Disposal cancels drawing and disconnects resizing")
        const stage = document.createElement("div")
        stage.id = "test-generations"
        stage.style.cssText = "position:fixed;top:0;right:0;width:100px;height:100px"
        document.body.append(stage)
        const sheet = new URL("fixtures/frames.webp", document.baseURI).href
        const poster = new URL("fixtures/final.webp", document.baseURI).href
        const builds = Array.from({ length: 27 }, (_, id) => ({
            id: String(id),
            label: `Build ${id}`,
            frame_count: 21,
            variants: [{ size: 16, sheet, poster }],
        }))
        const grid = generations.mount_generations(
            stage,
            { frame_ms: 40, hold_ms: 250, columns: 7, builds },
            false,
        )
        const value = () =>
            stage.querySelector("canvas")?.getContext("2d").getImageData(4, 4, 1, 1)
                .data[0]
        const labels = () =>
            Array.from(stage.children, (tile) => tile.getAttribute("aria-label"))
        try {
            await wait_for(() => stage.childElementCount === 9)
            check(value() === 21, "Final stills appear before playback")
            grid.set_presence(1)
            await wait_for(() => value() === 1)
            const first = labels()
            check(new Set(first).size === 9, "The grid has nine distinct builds")
            await wait_for(() => value() === 21)
            check(
                Array.from(stage.children).every(
                    (tile) =>
                        tile.getContext("2d").getImageData(4, 4, 1, 1).data[0] === 21,
                ),
                "Every tile reaches its separate final frame together",
            )
            await delay(100)
            check(
                labels().join() === first.join(),
                "Finished builds hold before replacement",
            )
            await wait_for(() => labels().join() !== first.join())
            check(
                labels().every((label) => !first.includes(label)),
                "The next batch uses new builds",
            )
            grid.set_presence(0)
            const stopped = value()
            await delay(150)
            check(value() === stopped, "Leaving Dirtflow pauses frame playback")
            grid.set_presence(1)
            const control = stage.nextElementSibling
            control.click()
            const paused = value()
            await delay(150)
            check(
                value() === paused && control.textContent === "Resume builds",
                "Pause keeps the current frame",
            )
            control.click()
            await wait_for(() => value() !== paused)
            grid.reduce_motion(true)
            check(
                value() === 21 && control.hidden,
                "Reduced motion shows final builds and hides playback controls",
            )
            const reduced_labels = labels().join()
            await delay(350)
            check(
                value() === 21 && labels().join() === reduced_labels,
                "Reduced motion does not cycle batches",
            )
        } finally {
            grid.dispose()
            check(
                stage.hidden && stage.childElementCount === 0,
                "Disposal releases the grid",
            )
            stage.remove()
        }
        const original_fetch = window.fetch
        const requests = []
        let reject_sheets = false
        window.fetch = (url, options) => {
            const path = String(url)
            requests.push(path)
            if (reject_sheets && path === sheet) {
                return Promise.resolve(new Response(null, { status: 503 }))
            }
            return original_fetch(url, options)
        }
        document.body.append(stage)
        try {
            const catalog = { frame_ms: 40, hold_ms: 250, columns: 7, builds }
            const stills = generations.mount_generations(stage, catalog, true)
            try {
                stills.set_presence(1)
                await wait_for(() => stage.childElementCount === 9)
                await delay(150)
                check(
                    !requests.includes(sheet),
                    "Initial reduced motion loads no frame sheets",
                )
                check(value() === 21, "Initial reduced motion shows final stills")
            } finally {
                stills.dispose()
            }
            reject_sheets = true
            requests.length = 0
            const fallback = generations.mount_generations(stage, catalog, false)
            try {
                fallback.set_presence(1)
                await wait_for(() => requests.includes(sheet))
                await delay(150)
                check(value() === 21, "Failed frame requests preserve the final stills")
            } finally {
                fallback.dispose()
            }
            const removed = generations.mount_generations(stage, catalog, true)
            removed.dispose()
            await delay(150)
            check(
                stage.hidden && !stage.childElementCount,
                "A pending load cannot redraw a disposed grid",
            )
        } finally {
            window.fetch = original_fetch
            stage.remove()
        }
        results.textContent += "\nAll browser checks passed."
    } finally {
        light.dispose()
        gl.drawArrays = original_draw
    }
} catch (error) {
    results.textContent = `${lines.join("\n")}\nFAIL: ${error.message}`
    console.error(error)
}
