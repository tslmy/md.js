import { index3 } from '../simulation/state.js';
import { forEachPair } from './forceInterfaces.js';
export class LennardJones {
    constructor(params) {
        this.params = params;
        this.name = 'lennardJones';
    }
    apply(state, ctx) {
        const { epsilon, sigma } = this.params;
        const { forces } = state;
        forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
            if (r2 === 0)
                return;
            const i3 = index3(i);
            const j3 = index3(j);
            const invR2 = 1 / r2;
            const sr2 = (sigma * sigma) * invR2;
            const sr6 = sr2 * sr2 * sr2;
            const sr12 = sr6 * sr6;
            const coeff = 24 * epsilon * (2 * sr12 - sr6) * invR2; // already /r^2, multiply by vector components
            const fx = coeff * dx;
            const fy = coeff * dy;
            const fz = coeff * dz;
            forces[i3] += fx;
            forces[i3 + 1] += fy;
            forces[i3 + 2] += fz;
            forces[j3] -= fx;
            forces[j3 + 1] -= fy;
            forces[j3 + 2] -= fz;
        });
    }
    /** Total Lennard-Jones potential energy: Σ 4ε[(σ/r)^12 - (σ/r)^6] over unique pairs within cutoff. */
    potential(state, ctx) {
        const { epsilon, sigma } = this.params;
        let V = 0;
        forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
            if (r2 === 0)
                return;
            const invR2 = 1 / r2;
            const sr2 = (sigma * sigma) * invR2;
            const sr6 = sr2 * sr2 * sr2;
            const sr12 = sr6 * sr6;
            V += 4 * epsilon * (sr12 - sr6);
        });
        return V;
    }
}
//# sourceMappingURL=lennardJones.js.map