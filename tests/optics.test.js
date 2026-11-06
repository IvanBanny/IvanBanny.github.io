import * as assert from "node:assert/strict"
import * as test from "node:test"
import * as optics from "../src/optics.js"

test.test("scene interpolation preserves the original endpoint uniforms", () => {
    const state = optics.create_state()
    optics.sample_scene(state, 0, 0)
    const expected = {
        lens: [1.04, 0.14, 0.07, 0.5],
        ripple: [0.0022, 21, 0.3, 1],
        lattice: [0.00015, 16],
        pose: [-0.35, 1.45, 0.13, 0.02],
        stretch: [1.13, 1.16],
    }
    for (const [key, values] of Object.entries(expected)) {
        values.forEach((value, i) => {
            assert.ok(Math.abs(state[key][i] - value) < 1e-6)
        })
    }
    optics.sample_scene(state, optics.SCENE_COUNT - 1, 0)
    const final_lens = [1.05, 0.04, 0.18, 0.48]
    final_lens.forEach((value, i) => {
        assert.ok(Math.abs(state.lens[i] - value) < 1e-6)
    })
})

test.test("scroll states clamp and stay continuous at every section boundary", () => {
    const before = optics.create_state()
    const after = optics.create_state()
    for (let boundary = 1; boundary < optics.SCENE_COUNT - 1; boundary++) {
        optics.sample_scene(before, boundary - 1e-4, 5)
        optics.sample_scene(after, boundary + 1e-4, 5)
        for (const key of Object.keys(before)) {
            before[key].forEach((value, i) => {
                assert.ok(Math.abs(value - after[key][i]) < 1e-5)
            })
        }
    }
    for (const [input, endpoint] of [
        [-10, 0],
        [10, optics.SCENE_COUNT - 1],
    ]) {
        optics.sample_scene(before, input, 3)
        optics.sample_scene(after, endpoint, 3)
        assert.deepEqual(before, after)
    }
})

test.test(
    "ambient motion changes the lens without allocating new uniform arrays",
    () => {
        const state = optics.create_state()
        const arrays = Object.values(state)
        optics.sample_scene(state, 0.5, 0)
        const initial_phase = state.ripple[2]
        const initial_focus = state.lens[0]
        optics.sample_scene(state, 0.5, 2)
        assert.ok(Math.abs(state.ripple[2] - initial_phase - 0.4) < 1e-6)
        assert.notEqual(state.lens[0], initial_focus)
        assert.ok(Object.values(state).every((array, i) => array === arrays[i]))
    },
)

test.test(
    "generation focus leaves other sections clear and fills the Dirtflow plateau",
    () => {
        for (const progress of [-1, 0, 0.55, 1.95, 2, 4]) {
            assert.equal(optics.generation_focus(progress), 0)
        }
        for (const progress of [0.95, 1, 1.25, 1.6]) {
            assert.ok(Math.abs(optics.generation_focus(progress) - 1) < 1e-12)
        }
        for (let i = 0; i <= 400; i++) {
            const focus = optics.generation_focus(i / 100)
            assert.ok(focus >= 0 && focus <= 1)
        }
        assert.ok(Math.abs(optics.generation_focus(0.75) - 0.5) < 1e-12)
        assert.ok(Math.abs(optics.generation_focus(1.775) - 0.5) < 1e-12)
    },
)
