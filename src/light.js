import * as optics from "./optics.js"
import * as shaders from "./shaders.js"

const FRAME_INTERVAL = 1000 / 30
const MAX_CANVAS_SIDE = 1800
const MAX_PIXEL_RATIO = 1.3
const LIGHT_SCALE = 0.75
const GLYPHS = ".,:;-+*/=|#@"

/** @typedef {{paused?: boolean, reduced_motion?: boolean}} LightOptions */
/** @typedef {{seek: (value: number) => void, pause: (value: boolean) => void,
 * reduce_motion: (value: boolean) => void, dispose: () => void}} Light */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} type
 * @param {string} source
 * @returns {WebGLShader}
 */
function compile_shader(gl, type, source) {
    const shader = gl.createShader(type)
    if (!shader) throw new Error("Could not allocate a shader")
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader)
        gl.deleteShader(shader)
        throw new Error(message || "Could not compile a shader")
    }
    return shader
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} vertex_source
 * @param {string} fragment_source
 * @returns {WebGLProgram}
 */
function create_program(gl, vertex_source, fragment_source) {
    const program = gl.createProgram()
    if (!program) throw new Error("Could not allocate a program")
    /** @type {WebGLShader[]} */
    const compiled = []
    try {
        const sources = [vertex_source, fragment_source]
        const types = [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER]
        for (let i = 0; i < sources.length; i++) {
            const shader = compile_shader(gl, types[i], sources[i])
            compiled.push(shader)
            gl.attachShader(program, shader)
        }
        gl.linkProgram(program)
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program) || "Could not link a program")
        }
        return program
    } catch (error) {
        gl.deleteProgram(program)
        throw error
    } finally {
        for (const shader of compiled) gl.deleteShader(shader)
    }
}

/** @param {WebGL2RenderingContext} gl @returns {WebGLTexture} */
function create_texture(gl) {
    const texture = gl.createTexture()
    if (!texture) throw new Error("Could not allocate a texture")
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
}

/** @param {WebGL2RenderingContext} gl @returns {void} */
function upload_glyph_atlas(gl) {
    const atlas = document.createElement("canvas")
    atlas.width = 24 * GLYPHS.length
    atlas.height = 36
    const context = atlas.getContext("2d")
    if (!context) throw new Error("Could not create the glyph atlas")
    context.fillStyle = "white"
    context.font = '24px "IBM Plex Sans"'
    context.textAlign = "center"
    context.textBaseline = "middle"
    Array.from(GLYPHS).forEach((character, index) => {
        context.fillText(character, index * 24 + 12, 19)
    })
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
}

/**
 * @param {WebGL2RenderingContext} gl
 */
function create_resources(gl) {
    /** @type {(() => void)[]} */
    const cleanup = []
    const dispose = () => {
        for (const release of cleanup.splice(0).reverse()) release()
    }
    try {
        if (!gl.getExtension("EXT_color_buffer_float")) {
            throw new Error("Floating-point WebGL rendering is unavailable")
        }
        const rays = create_program(gl, shaders.PHOTONS, shaders.FLUX)
        cleanup.push(() => gl.deleteProgram(rays))
        const screen = create_program(gl, shaders.QUAD, shaders.PROJECT)
        cleanup.push(() => gl.deleteProgram(screen))
        const mesh = gl.createVertexArray()
        const buffer = gl.createBuffer()
        cleanup.push(
            () => gl.deleteVertexArray(mesh),
            () => gl.deleteBuffer(buffer),
        )
        if (!mesh || !buffer) throw new Error("Could not allocate the pupil mesh")
        gl.bindVertexArray(mesh)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer)
        const indices = optics.create_indices()
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)
        gl.bindVertexArray(null)
        gl.activeTexture(gl.TEXTURE1)
        const glyphs = create_texture(gl)
        cleanup.push(() => gl.deleteTexture(glyphs))
        upload_glyph_atlas(gl)
        gl.activeTexture(gl.TEXTURE0)
        const texture = create_texture(gl)
        cleanup.push(() => gl.deleteTexture(texture))
        const framebuffer = gl.createFramebuffer()
        cleanup.push(() => gl.deleteFramebuffer(framebuffer))
        if (!framebuffer) throw new Error("Could not allocate the light buffer")

        /** @param {WebGLProgram} program @param {string[]} names */
        const uniforms = (program, names) =>
            Object.fromEntries(
                names.map((name) => [name, gl.getUniformLocation(program, name)]),
            )
        const ray_uniforms = uniforms(rays, [
            "resolution",
            "lens",
            "ripple",
            "lattice",
            "pose",
            "stretch",
        ])
        const screen_uniforms = uniforms(screen, [
            "resolution",
            "light",
            "glyphs",
            "journey",
            "time",
            "render_scale",
            "generation_focus",
        ])
        gl.useProgram(screen)
        gl.uniform1i(screen_uniforms.light, 0)
        gl.uniform1i(screen_uniforms.glyphs, 1)
        return {
            rays,
            screen,
            mesh,
            texture,
            framebuffer,
            ray_uniforms,
            screen_uniforms,
            index_count: indices.length,
            dispose,
        }
    } catch (error) {
        dispose()
        throw error
    }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {LightOptions} options
 * @returns {Light}
 */
export function create_light(canvas, { paused = false, reduced_motion = false } = {}) {
    const context = canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        powerPreference: "low-power",
    })
    if (!context) throw new Error("WebGL 2 is unavailable")
    const gl = context
    let resources = create_resources(gl)
    const state = optics.create_state()
    const events = new AbortController()
    let target = 0
    let progress = 0
    let generation_focus = 0
    let elapsed = 0
    let frame = 0
    let last_frame = 0
    let lost = false
    let disposed = false
    let css_width = 0
    let css_height = 0
    let light_width = 0
    let light_height = 0

    function resize() {
        const ratio = Math.min(
            window.devicePixelRatio || 1,
            MAX_PIXEL_RATIO,
            MAX_CANVAS_SIDE / Math.max(css_width, css_height),
        )
        const width = Math.max(1, Math.round(css_width * ratio))
        const height = Math.max(1, Math.round(css_height * ratio))
        if (canvas.width === width && canvas.height === height && light_width) return
        canvas.width = width
        canvas.height = height
        // the HDR pass can be smaller without reducing text or glyph resolution
        light_width = Math.max(1, Math.round(width * LIGHT_SCALE))
        light_height = Math.max(1, Math.round(height * LIGHT_SCALE))
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, resources.texture)
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA16F,
            light_width,
            light_height,
            0,
            gl.RGBA,
            gl.HALF_FLOAT,
            null,
        )
        gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer)
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            resources.texture,
            0,
        )
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error("Could not allocate the floating-point light buffer")
        }
    }

    function draw() {
        resize()
        optics.sample_scene(state, progress, elapsed)
        const { ray_uniforms, screen_uniforms } = resources
        gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer)
        gl.viewport(0, 0, light_width, light_height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.useProgram(resources.rays)
        gl.uniform2f(ray_uniforms.resolution, light_width, light_height)
        gl.uniform4fv(ray_uniforms.lens, state.lens)
        gl.uniform4fv(ray_uniforms.ripple, state.ripple)
        gl.uniform4fv(ray_uniforms.pose, state.pose)
        gl.uniform2fv(ray_uniforms.lattice, state.lattice)
        gl.uniform2fv(ray_uniforms.stretch, state.stretch)
        gl.bindVertexArray(resources.mesh)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE)
        gl.drawElementsInstanced(
            gl.TRIANGLES,
            resources.index_count,
            gl.UNSIGNED_INT,
            0,
            3,
        )
        gl.disable(gl.BLEND)
        gl.bindVertexArray(null)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.useProgram(resources.screen)
        gl.uniform2f(screen_uniforms.resolution, canvas.width, canvas.height)
        gl.uniform1f(screen_uniforms.journey, progress)
        gl.uniform1f(screen_uniforms.generation_focus, generation_focus)
        gl.uniform1f(screen_uniforms.time, elapsed)
        gl.uniform1f(screen_uniforms.render_scale, canvas.width / css_width)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    function render(now = 0) {
        frame = 0
        if (lost || disposed || document.hidden || !css_width || !css_height) return
        // tolerate fractional refresh intervals rather than slipping to 20 fps
        if (last_frame && now - last_frame < FRAME_INTERVAL - 0.5) {
            request_draw()
            return
        }
        const delta = last_frame ? Math.min((now - last_frame) / 1000, 0.1) : 0
        last_frame = now
        if (!paused) elapsed += delta
        progress += (target - progress) * (1 - Math.exp(-delta * 11))
        if (Math.abs(target - progress) < 0.0001) progress = target
        try {
            draw()
        } catch (error) {
            lost = true
            resources.dispose()
            document.body.classList.add("light-unavailable")
            console.warn("Background rendering failed:", error)
            return
        }
        if (!paused || progress !== target) request_draw()
    }

    function request_draw() {
        if (!frame && !lost && !disposed && !document.hidden) {
            frame = requestAnimationFrame(render)
        }
    }

    function stop() {
        cancelAnimationFrame(frame)
        frame = 0
        last_frame = 0
    }

    const observer = new ResizeObserver(([entry]) => {
        css_width = entry.contentRect.width
        css_height = entry.contentRect.height
        request_draw()
    })
    observer.observe(canvas)
    document.addEventListener(
        "visibilitychange",
        () => {
            stop()
            if (!document.hidden) request_draw()
        },
        { signal: events.signal },
    )
    canvas.addEventListener(
        "webglcontextlost",
        (event) => {
            event.preventDefault()
            lost = true
            stop()
            // discard handles before restoration creates a new resource generation
            resources.dispose()
            document.body.classList.add("light-unavailable")
        },
        { signal: events.signal },
    )
    canvas.addEventListener(
        "webglcontextrestored",
        () => {
            try {
                resources.dispose()
                resources = create_resources(gl)
                light_width = 0
                lost = false
                document.body.classList.remove("light-unavailable")
                request_draw()
            } catch (error) {
                console.warn("Background restoration failed:", error)
            }
        },
        { signal: events.signal },
    )

    return {
        seek(value) {
            generation_focus = optics.generation_focus(value)
            target = Math.min(optics.SCENE_COUNT - 1, Math.max(0, value))
            if (reduced_motion) progress = target = Math.round(target)
            request_draw()
        },
        pause(value) {
            if (paused === value) return
            paused = value
            last_frame = 0
            request_draw()
        },
        reduce_motion(value) {
            reduced_motion = value
            if (value) progress = target = Math.round(target)
            request_draw()
        },
        dispose() {
            if (disposed) return
            disposed = true
            stop()
            observer.disconnect()
            events.abort()
            resources.dispose()
        },
    }
}
