import { index3 } from '../simulation/state.js';
import { forEachPair } from './forceInterfaces.js';
export class Coulomb {
    constructor(params) {
        this.params = params;
        this.name = 'coulomb';
    }
    apply(state, ctx) {
        const { K } = this.params;
        const { forces, charges } = state;
        forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
            if (r2 === 0)
                return;
            const r = Math.sqrt(r2);
            const invR3 = 1 / (r2 * r);
            const coeff = K * (charges[i] || 0) * (charges[j] || 0) * invR3;
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
        const { K } = this.params;
        const { charges } = state;
        let V = 0;
        forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
            if (r2 === 0)
                return;
            V += K * (charges[i] || 0) * (charges[j] || 0) / Math.sqrt(r2);
        });
        return V;
    }
}
//# sourceMappingURL=coulomb.js.map
