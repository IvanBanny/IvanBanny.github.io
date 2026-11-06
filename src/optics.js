/** @typedef {{lens: Float32Array, ripple: Float32Array, lattice: Float32Array,
 * pose: Float32Array, stretch: Float32Array}} OpticalState */

export const PUPIL_GRID = 384

const SCENES = [
    {
        lens: [1.04, 0.14, 0.07, 0.5],
        ripple: [0.0022, 21, 0.3, 1.0],
        lattice: [0.00015, 16],
        pose: [-0.35, 1.45, 0.13, 0.02],
        stretch: [1.13, 1.16],
    },
    {
        lens: [0.93, 0.08, 0.13, 0.4],
        ripple: [0.0021, 25, 1.2, 0.7],
        lattice: [0.0006, 13],
        pose: [0.12, 1.65, 0.32, 0.0],
        stretch: [1.2, 1.02],
    },
    {
        lens: [1.15, 0.34, -0.1, 0.5],
        ripple: [0.0013, 22, 2.2, 1.8],
        lattice: [0.0001, 18],
        pose: [-0.7, 1.55, 0.36, 0.04],
        stretch: [1.04, 1.3],
    },
    {
        lens: [0.82, -0.2, 0.18, 0.4],
        ripple: [0.0019, 24, 2.9, 1.0],
        lattice: [0.0003, 14],
        pose: [0.6, 1.7, 0.36, -0.06],
        stretch: [1.15, 1.12],
    },
    {
        lens: [1.05, 0.04, 0.18, 0.48],
        ripple: [0.0016, 18, 4.0, 0.7],
        lattice: [0.0, 16],
        pose: [1.5, 1.55, 0.4, 0.05],
        stretch: [1.3, 1.02],
    },
]

export const SCENE_COUNT = SCENES.length
const SCENE_KEYS = /** @type {(keyof OpticalState)[]} */ (Object.keys(SCENES[0]))

/**
 * @returns {OpticalState}
 */
export function create_state() {
    return {
        lens: new Float32Array(4),
        ripple: new Float32Array(4),
        lattice: new Float32Array(2),
        pose: new Float32Array(4),
        stretch: new Float32Array(2),
    }
}

/**
 * @param {OpticalState} state
 * @param {number} progress Section position, clamped to the scene range.
 * @param {number} time Seconds of ambient animation.
 * @returns {void}
 */
export function sample_scene(state, progress, time) {
    const position = Math.min(SCENE_COUNT - 1, Math.max(0, progress))
    const index = Math.min(Math.floor(position), SCENE_COUNT - 2)
    const fraction = position - index
    const t = fraction * fraction * (3 - 2 * fraction)
    for (const key of SCENE_KEYS) {
        const start = SCENES[index][key]
        const end = SCENES[index + 1][key]
        for (let i = 0; i < start.length; i++) {
            state[key][i] = start[i] + (end[i] - start[i]) * t
        }
    }
    state.ripple[2] += time * 0.2
    state.lens[0] += Math.sin(time * 0.13) * 0.006
}

/**
 * @returns {Uint32Array}
 */
export function create_indices() {
    const indices = new Uint32Array(PUPIL_GRID * PUPIL_GRID * 6)
    let offset = 0
    for (let y = 0; y < PUPIL_GRID; y++) {
        for (let x = 0; x < PUPIL_GRID; x++) {
            const a = y * (PUPIL_GRID + 1) + x
            const b = a + 1
            const c = a + PUPIL_GRID + 1
            indices[offset++] = a
            indices[offset++] = b
            indices[offset++] = c
            indices[offset++] = c
            indices[offset++] = b
            indices[offset++] = c + 1
        }
    }
    return indices
}

/**
 * @param {number} progress
 * @returns {number}
 */
export function generation_focus(progress) {
    const entering = Math.max(0, Math.min(1, (progress - 0.55) / 0.4))
    const leaving = Math.max(0, Math.min(1, (progress - 1.6) / 0.35))
    return (
        entering *
        entering *
        (3 - 2 * entering) *
        (1 - leaving * leaving * (3 - 2 * leaving))
    )
}
