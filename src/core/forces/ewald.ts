import { SimulationState, index3 } from '../simulation/state.js'
import { ForceContext, ForceField, forEachPair, getPeriodicBox } from './forceInterfaces.js'

/**
 * Minimal / crude Ewald summation for Coulomb & gravity (shared kernel with different sign / prefactors).
 * This is a simplified implementation intended for small systems; not optimized.
 *
 * We split 1/r as erfc(alpha r)/r  + erf(alpha r)/r where the first term is short‑range (real space) and the second
 * is handled in reciprocal space via discrete k vectors. We cap k shell by |k|^2 <= kMax2.
 */
export interface EwaldParams { alpha: number; kMax: number }

interface KernelParams { prefactor: number; chargesOrMasses: Float32Array; attractive: boolean }

function makeKVectors(box: { x: number; y: number; z: number }, kMax: number): { kx: number; ky: number; kz: number; k2: number }[] {
    const ks: { kx: number; ky: number; kz: number; k2: number }[] = []
    const Lx = 2 * box.x, Ly = 2 * box.y, Lz = 2 * box.z
    for (let nx = -kMax; nx <= kMax; nx++) {
        for (let ny = -kMax; ny <= kMax; ny++) {
            for (let nz = -kMax; nz <= kMax; nz++) {
                if (nx === 0 && ny === 0 && nz === 0) continue
                const kx = (2 * Math.PI * nx) / Lx
                const ky = (2 * Math.PI * ny) / Ly
                const kz = (2 * Math.PI * nz) / Lz
                const k2 = kx * kx + ky * ky + kz * kz
                ks.push({ kx, ky, kz, k2 })
            }
        }
    }
    return ks
}

export abstract class BaseEwaldForce implements ForceField {
    abstract readonly name: string
    constructor(protected readonly ewald: EwaldParams) { }
    /**
     * apply(): if PBC enabled performs full Ewald real + reciprocal space force accumulation.
     * Otherwise falls back to simple pairwise 1/r^2 style handled by subclass-specific fallbackApply().
     */
    apply(state: SimulationState, ctx: ForceContext): void {
        const box = getPeriodicBox()
        if (!box.enabled) return this.fallbackApply(state, ctx)
        const { positions, forces, N } = state
        const { alpha } = this.ewald
        const { prefactor, chargesOrMasses } = this.getKernelParams(state)
        // Real-space short-range contribution using erfc(alpha r)
        const cutoff2 = ctx.cutoff * ctx.cutoff
        const alpha2 = alpha * alpha
        forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
            if (r2 === 0 || r2 > cutoff2) return
            const r = Math.sqrt(r2)
            const erfcTerm = erfc(alpha * r)
            if (erfcTerm === 0) return
            const qiqj = (chargesOrMasses[i] || 0) * (chargesOrMasses[j] || 0)
            const coeff = prefactor * qiqj * (erfcTerm / (r2 * r) + (2 * alpha / Math.sqrt(Math.PI)) * Math.exp(-alpha2 * r2) / r2)
            // For gravity we want attraction: sign already encoded in prefactor
            const fx = coeff * dx
            const fy = coeff * dy
            const fz = coeff * dz
            const i3 = index3(i), j3 = index3(j)
            forces[i3] += fx; forces[i3 + 1] += fy; forces[i3 + 2] += fz
            forces[j3] -= fx; forces[j3 + 1] -= fy; forces[j3 + 2] -= fz
        })
        // Reciprocal space contribution
        const ks = makeKVectors(box, this.ewald.kMax)
        for (const { kx, ky, kz, k2 } of ks) {
            const expFactor = Math.exp(-k2 / (4 * alpha2)) / k2
            let Sk_re = 0, Sk_im = 0
            for (let i = 0; i < N; i++) {
                const i3 = index3(i)
                const phase = kx * positions[i3] + ky * positions[i3 + 1] + kz * positions[i3 + 2]
                const qi = chargesOrMasses[i] || 0
                Sk_re += qi * Math.cos(phase)
                Sk_im += qi * Math.sin(phase)
            }
            const common = 2 * prefactor * expFactor
            // Force contribution per particle: F_i += common * q_i * (Sk_re * sin(k.r_i) - Sk_im * cos(k.r_i)) * k_vector
            for (let i = 0; i < N; i++) {
                const i3 = index3(i)
                const qi = chargesOrMasses[i] || 0
                if (qi === 0) continue
                const phase = kx * positions[i3] + ky * positions[i3 + 1] + kz * positions[i3 + 2]
                const s = Math.sin(phase), c = Math.cos(phase)
                const factor = common * qi * (Sk_re * s - Sk_im * c)
                forces[i3] += factor * kx
                forces[i3 + 1] += factor * ky
                forces[i3 + 2] += factor * kz
            }
        }
        // Self-energy correction handled only in potential path.
    }
    potential(state: SimulationState, ctx: ForceContext): number {
        const box = getPeriodicBox(); if (!box.enabled) return this.fallbackPotential(state, ctx)
        const { positions, N } = state
        const { alpha } = this.ewald
        const { prefactor, chargesOrMasses } = this.getKernelParams(state)
        const cutoff2 = ctx.cutoff * ctx.cutoff
        let V = 0
        forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
            if (r2 === 0 || r2 > cutoff2) return
            const r = Math.sqrt(r2)
            const qiqj = (chargesOrMasses[i] || 0) * (chargesOrMasses[j] || 0)
            V += prefactor * qiqj * erfc(alpha * r) / r
        })
        const ks = makeKVectors(box, this.ewald.kMax)
        const Lx = 2 * box.x, Ly = 2 * box.y, Lz = 2 * box.z
        const volume = Lx * Ly * Lz
        let reciprocal = 0
        for (const { kx, ky, kz, k2 } of ks) {
            const expFactor = Math.exp(-k2 / (4 * alpha * alpha)) / k2
            let Sk_re = 0, Sk_im = 0
            for (let i = 0; i < N; i++) {
                const i3 = index3(i)
                const phase = kx * positions[i3] + ky * positions[i3 + 1] + kz * positions[i3 + 2]
                const qi = chargesOrMasses[i] || 0
                Sk_re += qi * Math.cos(phase)
                Sk_im += qi * Math.sin(phase)
            }
            reciprocal += (Sk_re * Sk_re + Sk_im * Sk_im) * expFactor
        }
        V += (prefactor * (2 * Math.PI) / volume) * reciprocal
        // Self interaction correction: subtract prefactor * alpha / sqrt(pi) * sum(q_i^2)
        let self = 0
        for (let i = 0; i < N; i++) {
            const qi = chargesOrMasses[i] || 0
            self += qi * qi
        }
        V -= prefactor * alpha / Math.sqrt(Math.PI) * self
        return V
    }
    // Subclasses provide non-periodic fallbacks
    protected abstract fallbackApply(state: SimulationState, ctx: ForceContext): void
    protected abstract fallbackPotential(state: SimulationState, ctx: ForceContext): number
    protected abstract getKernelParams(state: SimulationState): KernelParams
}

export class EwaldCoulomb extends BaseEwaldForce {
    readonly name = 'coulomb'
    constructor(private readonly K: number, ewald: EwaldParams) { super(ewald) }
    fallbackApply(state: SimulationState, ctx: ForceContext): void {
        const { charges, forces } = state
        forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
            if (r2 === 0) return
            const r = Math.sqrt(r2)
            const invR3 = 1 / (r2 * r)
            const coeff = this.K * (charges[i] || 0) * (charges[j] || 0) * invR3
            const fx = coeff * dx, fy = coeff * dy, fz = coeff * dz
            const i3 = index3(i), j3 = index3(j)
            forces[i3] += fx; forces[i3 + 1] += fy; forces[i3 + 2] += fz
            forces[j3] -= fx; forces[j3 + 1] -= fy; forces[j3 + 2] -= fz
        })
    }
    fallbackPotential(state: SimulationState, ctx: ForceContext): number {
        const { charges } = state
        let V = 0
        forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
            if (r2 === 0) return
            V += this.K * (charges[i] || 0) * (charges[j] || 0) / Math.sqrt(r2)
        })
        return V
    }
    protected getKernelParams(state: SimulationState): KernelParams { return { prefactor: this.K, chargesOrMasses: state.charges, attractive: false } }
}
export class EwaldGravity extends BaseEwaldForce {
    readonly name = 'gravity'
    constructor(private readonly G: number, ewald: EwaldParams) { super(ewald) }
    fallbackApply(state: SimulationState, ctx: ForceContext): void {
        const { masses, forces } = state
        forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
            if (r2 === 0) return
            const r = Math.sqrt(r2)
            const invR3 = 1 / (r2 * r)
            const coeff = -this.G * (masses[i] || 1) * (masses[j] || 1) * invR3
            const fx = coeff * dx, fy = coeff * dy, fz = coeff * dz
            const i3 = index3(i), j3 = index3(j)
            forces[i3] += fx; forces[i3 + 1] += fy; forces[i3 + 2] += fz
            forces[j3] -= fx; forces[j3 + 1] -= fy; forces[j3 + 2] -= fz
        })
    }
    fallbackPotential(state: SimulationState, ctx: ForceContext): number {
        const { masses } = state
        let V = 0
        forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
            if (r2 === 0) return
            V += -this.G * (masses[i] || 1) * (masses[j] || 1) / Math.sqrt(r2)
        })
        return V
    }
    protected getKernelParams(state: SimulationState): KernelParams { return { prefactor: -this.G, chargesOrMasses: state.masses, attractive: true } }
}

// Simple complementary error function wrapper (could be replaced with faster approximation if needed)
function erfc(x: number): number { return 1 - erf(x) }
function erf(x: number): number {
    // Numerical approximation (Abramowitz & Stegun 7.1.26)
    const sign = x < 0 ? -1 : 1
    x = Math.abs(x)
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
    const t = 1 / (1 + p * x)
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
    return sign * y
}
