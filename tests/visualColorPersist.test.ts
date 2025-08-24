import { describe, it, expect } from 'vitest'
import { Color, BufferGeometry, LineBasicMaterial, Line, BufferAttribute } from 'three'
import { captureVisualData, applyVisualData } from '../src/visual/persist.js'

function makeDummyTrajectory(len: number, color: Color): Line {
    const geom = new BufferGeometry()
    const arr = new Float32Array(len * 3)
    for (let i = 0; i < len; i++) {
        const k = 3 * i
        arr[k] = i; arr[k + 1] = i + 1; arr[k + 2] = i + 2
    }
    geom.setAttribute('position', new BufferAttribute(arr, 3))
    const mat = new LineBasicMaterial({ color })
    return new Line(geom, mat)
}

describe('visual color persistence', () => {
    it('captures and reapplies colors (v2 snapshot)', () => {
        const colors = [new Color(0xff0000), new Color(0x00ff00), new Color(0x0000ff)]
        const trajectories = [makeDummyTrajectory(4, colors[0]), null, makeDummyTrajectory(4, colors[2])]
        const snap = captureVisualData(trajectories, colors)
        expect(snap).toBeTruthy()
        expect(snap!.version).toBe(2)
        expect(snap!.colors).toEqual([0xff0000, 0x00ff00, 0x0000ff])
        // Mutate colors away from originals
        colors[0].setHex(0xffffff)
        colors[1].setHex(0xffffff)
        colors[2].setHex(0xffffff)
        applyVisualData(snap!, trajectories, colors)
        expect(colors[0].getHex()).toBe(0xff0000)
        expect(colors[1].getHex()).toBe(0x00ff00)
        expect(colors[2].getHex()).toBe(0x0000ff)
        // Trajectory line materials updated (only indices 0 & 2 exist)
        expect(((trajectories[0] as Line).material as LineBasicMaterial).color.getHex()).toBe(0xff0000)
        expect(((trajectories[2] as Line).material as LineBasicMaterial).color.getHex()).toBe(0x0000ff)
    })
})
