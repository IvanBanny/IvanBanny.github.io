import * as renderer from "./src/light.js"
import * as generations from "./src/generations.js"
import * as optics from "./src/optics.js"

const chapters = Array.from(document.querySelectorAll(".chapter"))
const links = Array.from(document.querySelectorAll(".index a"))
const main = document.querySelector("main")
const canvas = document.querySelector("#light")
const stage = document.querySelector("#generation-stage")
const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
const events = new AbortController()
if (!(stage instanceof HTMLElement)) throw new Error("Missing generation stage")
const grid = generations.mount_generations(stage)

/** @type {import("./src/light.js").Light | undefined} */
let light
/** @type {number[]} */
let offsets = []
let frame = 0
let active = -1

function update() {
    frame = 0
    const y = window.scrollY
    const index = Math.max(
        0,
        offsets.findLastIndex((top) => top <= y + 1),
    )
    const distance = offsets[index + 1] - offsets[index]
    const fraction = distance > 0 ? (y - offsets[index]) / distance : 0
    const progress = index + Math.max(0, Math.min(1, fraction))
    light?.seek(progress)
    grid.set_presence(optics.generation_focus(progress))

    const current = Math.max(
        0,
        offsets.findLastIndex((top) => top <= y + window.innerHeight * 0.28),
    )
    if (current !== active) {
        active = current
        for (const link of links) {
            if (link.getAttribute("href") === `#${chapters[active].id}`) {
                link.setAttribute("aria-current", "location")
            } else {
                link.removeAttribute("aria-current")
            }
        }
    }
    document.documentElement.style.setProperty("--scroll-y", `${y}px`)
}

function request_update() {
    if (!events.signal.aborted && !frame) frame = requestAnimationFrame(update)
}

function measure() {
    offsets = chapters.map((chapter) => chapter.getBoundingClientRect().top + scrollY)
    request_update()
}

async function mount_light() {
    try {
        // the glyph atlas needs the same font as the page
        await document.fonts.load('400 24px "IBM Plex Sans"')
        if (events.signal.aborted) return
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing canvas")
        light = renderer.create_light(canvas, {
            paused: motion.matches,
            reduced_motion: motion.matches,
        })
        request_update()
    } catch (error) {
        document.body.classList.add("light-unavailable")
        console.warn("Background rendering failed:", error)
    }
}

motion.addEventListener(
    "change",
    () => {
        light?.reduce_motion(motion.matches)
        light?.pause(motion.matches)
        grid.reduce_motion(motion.matches)
    },
    { signal: events.signal },
)
window.addEventListener("scroll", request_update, {
    passive: true,
    signal: events.signal,
})
window.addEventListener("resize", measure, { signal: events.signal })
const observer = new ResizeObserver(measure)
if (main) observer.observe(main)
document.fonts.ready.then(measure)
measure()
void mount_light()
document.body.classList.add("scroll-ready")

window.addEventListener(
    "pagehide",
    (event) => {
        if (event.persisted) return
        events.abort()
        cancelAnimationFrame(frame)
        observer.disconnect()
        grid.dispose()
        light?.dispose()
    },
    { signal: events.signal },
)
