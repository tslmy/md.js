import { index3 } from '../simulation/state.js';
import { forEachPair } from './forceInterfaces.js';
export class Gravity {
    constructor(params) {
        this.params = params;
        this.name = 'gravity';
    }
    apply(state, ctx) {
        const { G } = this.params;
        const { forces, masses } = state;
        forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
            if (r2 === 0)
                return;
            const r = Math.sqrt(r2);
            const invR3 = 1 / (r2 * r);
            const mProd = (masses[i] || 1) * (masses[j] || 1);
            // Attractive: negative coefficient times displacement components.
            const coeff = -G * mProd * invR3;
            const i3 = index3(i);
            const j3 = index3(j);
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
    potential(state, ctx) {
        const { G } = this.params;
        const { masses } = state;
        let V = 0;
        forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
            if (r2 === 0)
                return;
            V += -G * (masses[i] || 1) * (masses[j] || 1) / Math.sqrt(r2);
        });
        return V;
    }
}
//# sourceMappingURL=gravity.js.map
