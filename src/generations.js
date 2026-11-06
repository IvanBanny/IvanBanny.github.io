import generation_catalog from "../assets/generations/index.json" with { type: "json" }

/** @typedef {{size: number, sheet: string, poster: string}} GenerationVariant */
/** @typedef {{id: string, label: string, frame_count: number,
 * variants: GenerationVariant[]}} GenerationBuild */
/** @typedef {{frame_ms: number, hold_ms: number, columns: number,
 * builds: GenerationBuild[]}} GenerationCatalog */
/** @typedef {{build: GenerationBuild, variant: GenerationVariant,
 * bitmap: ImageBitmap}} LoadedBuild */
/** @typedef {{set_presence: (value: number) => void,
 * reduce_motion: (value: boolean) => void, dispose: () => void}} GenerationGrid */

/**
 * Sample nine builds, weighted by the number of batches since their last display.
 * @param {GenerationBuild[]} builds
 * @param {GenerationBuild[]} previous
 * @param {ReadonlyMap<string, number>} ages
 * @param {() => number} random
 * @returns {GenerationBuild[]}
 */
export function pick_builds(
    builds,
    previous = [],
    ages = new Map(),
    random = Math.random,
) {
    const previous_ids = new Set(previous.map((build) => build.id))
    const fresh = builds.filter((build) => !previous_ids.has(build.id))
    const eligible = fresh.length >= Math.min(9, builds.length) ? fresh : builds
    const pool = eligible.map((build) => ({
        build,
        weight: 1 + (ages.get(build.id) || 0),
    }))
    const selected = []
    let total = pool.reduce((sum, entry) => sum + entry.weight, 0)
    while (pool.length && selected.length < 9) {
        let draw = random() * total
        let index = 0
        while (index < pool.length - 1 && draw >= pool[index].weight) {
            draw -= pool[index++].weight
        }
        const [entry] = pool.splice(index, 1)
        selected.push(entry.build)
        total -= entry.weight
    }
    return selected
}

/**
 * @param {HTMLElement} stage
 * @param {GenerationCatalog} catalog
 * @param {boolean} reduced_motion
 * @returns {GenerationGrid}
 */
export function mount_generations(
    stage,
    catalog = generation_catalog,
    reduced_motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches,
) {
    const asset_base = new URL("assets/generations/", document.baseURI)
    const events = new AbortController()
    const requests = new AbortController()
    // keep compressed files for revisits, with only two batches decoded at once
    /** @type {Map<string, Blob>} */
    const cache = new Map()
    /** @type {Map<string, number>} */
    const ages = new Map()
    const first = pick_builds(catalog.builds)
    /** @type {LoadedBuild[]} */
    let current = []
    /** @type {LoadedBuild[]} */
    let next = []
    /** @type {CanvasRenderingContext2D[]} */
    let contexts = []
    let loading = false
    let failed = false
    let active = false
    let near = false
    let visible = false
    let paused = false
    let disposed = false
    let frame = 0
    let showing_final = true
    let recorded = false
    let timer = 0
    let deadline = 0
    let remaining = catalog.frame_ms
    stage.hidden = !first.length

    const control = document.createElement("button")
    control.type = "button"
    control.className = "generation-control"
    control.textContent = "Pause builds"
    control.setAttribute("aria-controls", stage.id)
    control.setAttribute("aria-pressed", "false")
    control.hidden = reduced_motion || !first.length
    stage.after(control)

    /** @param {LoadedBuild[]} batch */
    function release(batch) {
        for (const entry of batch) entry.bitmap.close()
    }

    /**
     * @param {GenerationBuild[]} builds
     * @param {boolean} sheets
     * @returns {Promise<LoadedBuild[]>}
     */
    async function load_batch(builds, sheets) {
        /** @type {LoadedBuild[]} */
        const loaded = []
        const target = (stage.clientWidth / 3) * (window.devicePixelRatio || 1)
        let index = 0
        const workers = Array.from({ length: Math.min(3, builds.length) }, async () => {
            while (index < builds.length) {
                requests.signal.throwIfAborted()
                const slot = index++
                const build = builds[slot]
                const variant =
                    build.variants.find((item) => item.size >= target) ||
                    build.variants[build.variants.length - 1]
                const path = sheets ? variant.sheet : variant.poster
                let blob = cache.get(path)
                if (!blob) {
                    const response = await fetch(new URL(path, asset_base), {
                        signal: requests.signal,
                        priority: "low",
                    })
                    if (!response.ok)
                        throw new Error(`Generation image: ${response.status}`)
                    blob = await response.blob()
                    cache.set(path, blob)
                }
                const bitmap = await createImageBitmap(blob)
                loaded[slot] = { build, variant, bitmap }
            }
        })
        const results = await Promise.allSettled(workers)
        const error = results.find((result) => result.status === "rejected")
        if (error || disposed) {
            release(loaded.filter(Boolean))
            throw error?.reason || new DOMException("Disposed", "AbortError")
        }
        return loaded
    }

    /**
     * @param {LoadedBuild[]} batch
     * @param {number | null} step Null selects a separate final still.
     */
    function draw(batch, step) {
        for (let i = 0; i < batch.length; i++) {
            const { build, variant, bitmap } = batch[i]
            const context = contexts[i]
            const size = variant.size
            const final = build.frame_count - 1
            const index = step === null ? 0 : Math.min(step, final)
            context.clearRect(0, 0, size, size)
            context.drawImage(
                bitmap,
                (index % catalog.columns) * size,
                Math.floor(index / catalog.columns) * size,
                size,
                size,
                0,
                0,
                size,
                size,
            )
        }
    }

    /**
     * @param {LoadedBuild[]} batch
     * @param {number | null} step
     */
    function show(batch, step) {
        const tiles = batch.map(({ build, variant }) => {
            const tile = document.createElement("canvas")
            tile.className = "generation-tile"
            tile.width = tile.height = variant.size
            tile.setAttribute("role", "img")
            tile.setAttribute("aria-label", build.label)
            tile.textContent = build.label
            return tile
        })
        contexts = tiles.map((tile) => {
            const context = tile.getContext("2d")
            if (!context) throw new Error("Generation canvas unavailable")
            return context
        })
        stage.replaceChildren(...tiles)
        draw(batch, step)
    }

    function stop_timer() {
        if (!timer) return
        clearTimeout(timer)
        timer = 0
        remaining = Math.max(0, deadline - performance.now())
    }

    /** @param {GenerationBuild[]} builds @param {boolean} initial */
    async function prepare(builds, initial = false) {
        if (loading || failed) return
        loading = true
        try {
            const batch = await load_batch(builds, true)
            if (disposed) return release(batch)
            if (initial) {
                current = batch
                frame = 0
                remaining = catalog.frame_ms
                show(current, Number.MAX_SAFE_INTEGER)
                showing_final = true
            } else {
                next = batch
            }
        } catch (error) {
            if (!disposed) {
                failed = true
                console.warn("Generation frames could not be loaded:", error)
            }
        } finally {
            loading = false
            if (!disposed) sync()
        }
    }

    function advance() {
        timer = 0
        const final = Math.max(...current.map((entry) => entry.build.frame_count)) - 1
        if (frame < final) {
            frame++
            draw(current, frame)
            remaining = frame === final ? catalog.hold_ms : catalog.frame_ms
        } else if (next.length) {
            release(current)
            current = next
            next = []
            recorded = false
            frame = 0
            show(current, frame)
            showing_final = false
            remaining = catalog.frame_ms
        } else {
            remaining = 0
            return
        }
        sync()
    }

    function sync() {
        stop_timer()
        if (disposed) return
        control.hidden = reduced_motion || !first.length
        if (reduced_motion) {
            if (current.length) draw(current, Number.MAX_SAFE_INTEGER)
            showing_final = true
            return
        }
        if (document.hidden || paused) return
        if (near && !current.length) void prepare(first, true)
        if (!active || !visible || !current.length) return
        if (!recorded) {
            for (const build of catalog.builds) {
                ages.set(build.id, (ages.get(build.id) || 0) + 1)
            }
            for (const entry of current) ages.set(entry.build.id, 0)
            recorded = true
        }
        if (showing_final) {
            draw(current, frame)
            showing_final = false
        }
        if (!next.length && !loading && !failed) {
            const builds = pick_builds(
                catalog.builds,
                current.map((entry) => entry.build),
                ages,
            )
            void prepare(builds)
        }
        const final = Math.max(...current.map((entry) => entry.build.frame_count)) - 1
        if (frame === final && remaining === 0 && !next.length) return
        deadline = performance.now() + remaining
        timer = window.setTimeout(advance, remaining)
    }

    control.addEventListener(
        "click",
        () => {
            paused = !paused
            control.textContent = paused ? "Resume builds" : "Pause builds"
            control.setAttribute("aria-pressed", String(paused))
            sync()
        },
        { signal: events.signal },
    )
    const preload_observer = new IntersectionObserver(
        ([entry]) => {
            near = entry.isIntersecting
            sync()
        },
        { rootMargin: "600px" },
    )
    const visibility_observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting
        sync()
    })
    document.addEventListener("visibilitychange", sync, { signal: events.signal })
    if (first.length) {
        void load_batch(first, false)
            .then((batch) => {
                if (!disposed) show(batch, null)
                release(batch)
            })
            .catch((error) => {
                if (!disposed)
                    console.warn("Generation stills could not be loaded:", error)
            })
            .finally(() => {
                if (!disposed) {
                    preload_observer.observe(stage)
                    visibility_observer.observe(stage)
                }
            })
    }
    return {
        set_presence(value) {
            stage.style.setProperty(
                "--presence",
                String(Math.max(0, Math.min(1, value))),
            )
            active = value > 0.01 && first.length > 0
            stage.setAttribute("aria-hidden", String(!active))
            control.style.setProperty("--presence", String(active ? 1 : 0))
            control.disabled = !active
            sync()
        },
        reduce_motion(value) {
            if (value === reduced_motion || disposed) return
            reduced_motion = value
            if (!value && current.length) draw(current, frame)
            sync()
        },
        dispose() {
            if (disposed) return
            disposed = true
            stop_timer()
            events.abort()
            requests.abort()
            preload_observer.disconnect()
            visibility_observer.disconnect()
            release(current)
            release(next)
            current = next = []
            contexts = []
            cache.clear()
            stage.replaceChildren()
            stage.hidden = true
            control.remove()
        },
    }
}
