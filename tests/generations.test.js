import * as assert from "node:assert/strict"
import * as test from "node:test"
import * as generations from "../src/generations.js"

const builds = Array.from({ length: 27 }, (_, id) => ({
    id: String(id),
    label: `Build ${id}`,
    frame_count: 21,
    variants: [],
}))

function seeded_random(seed) {
    return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed / 2 ** 32
    }
}

test.test(
    "Batches sample the full library without duplicates or immediate repeats",
    () => {
        let previous = []
        const seen = new Set()
        const random = seeded_random(42)
        for (let i = 0; i < 100; i++) {
            const batch = generations.pick_builds(builds, previous, new Map(), random)
            assert.equal(batch.length, 9)
            assert.equal(new Set(batch).size, 9)
            assert.ok(batch.every((build) => !previous.includes(build)))
            batch.forEach((build) => seen.add(build))
            previous = batch
        }
        assert.equal(seen.size, builds.length)
        assert.deepEqual(
            builds.map((build) => build.id),
            Array.from({ length: 27 }, (_, i) => String(i)),
        )
    },
)

test.test(
    "Older builds receive proportionally more chances without losing variety",
    () => {
        const pool = builds.slice(0, 18)
        const ages = new Map([[pool[0].id, 19]])
        const random = seeded_random(7)
        const counts = new Map(pool.map((build) => [build.id, 0]))
        const trials = 10000
        for (let i = 0; i < trials; i++) {
            const batch = generations.pick_builds(pool, [], ages, random)
            assert.equal(new Set(batch).size, 9)
            const id = batch[0].id
            counts.set(id, counts.get(id) + 1)
        }
        assert.ok(Math.abs(counts.get(pool[0].id) / trials - 20 / 37) < 0.02)
        assert.ok(pool.every((build) => counts.get(build.id) > 0))
        assert.deepEqual(ages, new Map([[pool[0].id, 19]]))
    },
)

test.test(
    "An old build still cannot repeat from the immediately previous batch",
    () => {
        const previous = builds.slice(0, 9)
        const ages = new Map(previous.map((build) => [build.id, 1000]))
        const batch = generations.pick_builds(builds, previous, ages, seeded_random(12))
        assert.ok(batch.every((build) => !previous.includes(build)))
    },
)

test.test(
    "Small and empty libraries remain valid and can reuse previous builds",
    () => {
        assert.deepEqual(generations.pick_builds([]), [])
        const small = builds.slice(0, 9)
        assert.deepEqual(new Set(generations.pick_builds(small, small)), new Set(small))
        assert.deepEqual(
            new Set(generations.pick_builds(builds.slice(0, 4))),
            new Set(builds.slice(0, 4)),
        )
    },
)
