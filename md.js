(function($) {

    /**
     * The Vector3D object is in heavy use in this code. It is used
     * in all places where vector data is to be encoded or where
     * vector arithmetic is to be performed.
     */
    var Vector3D = function(x,y,z) {
        var _this = this;

        _this.x = x || 0;
        _this.y = y || 0;
        _this.z = z || 0;

    };

    // Return a random vector with dimensions between 0 and 1.
    Vector3D.random = function() {
        return new Vector3D(
            Math.random(),
            Math.random(),
            Math.random()
        );
    };

    // Return the Euclidean norm, or length of a vector.
    Vector3D.norm = function(v) {
        return Math.sqrt(
            v.x*v.x +
            v.y*v.y +
            v.z*v.z
        );
    };


    // Return the unit vector pointing in the direction of the given vector.
    Vector3D.unit = function(v) {
        return Vector3D.divide(v, Vector3D.length(v));
    };


    // Add two vectors v1 + v2.
    Vector3D.add = function(v1, v2) {
        return new Vector3D(
            v1.x + v2.x,
            v1.y + v2.y,
            v1.z + v2.z
        );
    };
 

    // Subtract two vectors v1 - v2.
    Vector3D.subtract = function(v1, v2) {
        return new Vector3D(
            v1.x - v2.x,
            v1.y - v2.y,
            v1.z - v2.z
        );
    };
 
    // Multiply a vector by a scalar v * a
    Vector3D.multiply = function(v, a) {
        return new Vector3D(
            v.x * a,
            v.y * a,
            v.z * a
        );
    };

    // Divide a vector by a scalar v / a
    Vector3D.divide = function(v, a) {
        return new Vector3D(
            v.x / a,
            v.y / a,
            v.z / a
        );
    };


    /**
     * The particle object encodes some information about a particle
     * like position, velocity and force. It makes use of the Vector3D
     * object to encode vector data.
     */
    var Particle = function() {
        var _this = this;

        _this.position = new Vector3D;
        _this.velocity = new Vector3D;
        _this.force    = new Vector3D;

        _this.mass     = 1.0;

        _this.randomize = function() {
            _this.position = Vector3D.random();
            _this.velocity = Vector3D.random();

            return _this;
        };
    };


    /**
     * This applies forces to input particles as though they were
     * interacting under gravitational potential.
     *
     * This is a nice, simple potential with some nice results.
     */
    function generate_gravitational_forces(particles, G) {
        //Use gravitational potential
        //-> F = GMm/(d*d) r/|r|
        for(i = 0; i < particles.length; ++i)
        for(j = i+1; j < particles.length; ++j) {
            var p1 = particles[i];
            var p2 = particles[j];

            var r  = Vector3D.subtract(p1.position, p2.position);
            var d  = Vector3D.norm(r);

            var fv = (function() {
                // Use d_min to prevent high potential when particles are close
                // to avoid super high accelerations in poor time resolution
                var d_min = 0.2;
                if(d > d_min) {
                    var f  = G * p1.mass * p2.mass / (d*d*d);
                    return Vector3D.multiply(r, f);
                } else {
                    var f  = G * p1.mass * p2.mass / (d_min*d_min*d_min);
                    return Vector3D.multiply(r, f);
                }
            })();

            p1.force = Vector3D.subtract(p1.force, fv);
            p2.force = Vector3D.add(p2.force, fv);
        }
    }


    /**
     * This applies forces to input particles equivalent to them
     * interacting in a Lennard-Jones potential.
     *
     * This potential is often used in MD codes, mostly as a sort of
     * a toy. This code appears to be quite sensitive to the values
     * of epsilon and delta. Too small and nothing will happen. Too
     * large and your particles will explode off in all directions.
     */
    function generate_Lennard_Jones_forces(particles, epsilon, delta) {
        // Use Lennard-Jones potential
        // V = 4*epsilon*((delta/d)^12 - (delta/d)^6)
        // F = 4*epsilon*(-12/d*(delta/d)^12 + 6/d*(delta/d)^6) r/|r|
        for(i = 0; i < particles.length; ++i)
        for(j = i+1; j < particles.length; ++j) {
            var p1 = particles[i];
            var p2 = particles[j];

            var r  = Vector3D.subtract(p1.position, p2.position);
            var d  = Vector3D.norm(r);

            var d6 = (delta/d);
                d6 = d6*d6*d6;
                d6 = d6*d6;

            var f  = 4*epsilon*(6/d)*(-2*d6*d6 + d6)/d;
            var fv = Vector3D.multiply(r, f);

            p1.force = Vector3D.subtract(p1.force, fv);
            p2.force = Vector3D.add(p2.force, fv);
        }
    }

    /**
     * Draw a given list of particles onto a given canvas element
     */
    function canvas_draw_particles(canvas, particles, options) {
        // Get canvas context.
        var ctx    = canvas.getContext("2d");

        // Wrap canvas in jQuery selector to access data method
        var $canvas = $(canvas);

        /**
         * initial_z encodes the max and min z positions of all the
         * particles, so their sizes can be easily calculated later.
         *
         * This is useful, because it fixes the size of particles. Getting
         * the max and min per run was tested, but it was found that an
         * abnormally close particle would make all the others look tiny,
         * so it may be better to use an absolute value here.
         *
         * Here, we check if the object has already been attached to
         * the canvas, and if not, we compute it and attach it.
         */
        var initial_z   = $canvas.data('initial_z') || (function() {
            var initial_z = {min: 100000, max: -100000};
            for(i = 0; i < particles.length; ++i) {
                var z = particles[i].position.z;
                if (z < initial_z.min) initial_z.min = z;
                if (z > initial_z.max) initial_z.max = z;
            }
            $canvas.data('initial_z', initial_z);

            return initial_z;
        })();

        /**
         * The view offset is used to place the center of the view
         * looking at the center of mass of the system.
         *
         * We assume the particles have vectors distributed between 0
         * and 1, so the original center should be 0.5. We look for
         * deviations from this and adjust accordingly later.
         */
        var view_offset = (function() {
            var view_offset = new Vector3D;
            var total_mass = 0;
            for(i = 0; i < particles.length; ++i) {
                var p = particles[i];
                view_offset = Vector3D.add(
                    view_offset, Vector3D.multiply(p.position, p.mass)
                );
                total_mass += p.mass;
            }
            view_offset = Vector3D.divide(view_offset, total_mass);
            view_offset = Vector3D.subtract(
                new Vector3D(0.5, 0.5, 0.5), view_offset
            );

            return view_offset;
        })();

        /**
         * Here we find the smallest side of the canvas to find the
         * square we're mainly working in, and then find how much
         * we need to widen our view after that.
         */
        var canvas_scale = (function() {
            if (canvas.width < canvas.height) return canvas.width;
            else                              return canvas.height;
        })()
        var canvas_height_offset = (canvas.height - canvas_scale)/2;
        var canvas_width_offset = (canvas.width - canvas_scale)/2;


        /**
         * Generate the size of a particle from its z-position.
         *
         * This function assumes the size of an object scales as the
         * distance squared. If a particle becomes particularly large,
         * we set the size to 0 so it doesn't potentially take up
         * our entire view. There are almost certainly a better
         * approach to take here.
         */
        function gen_particle_size(p_z, particle_mass) {
            var particle_size =
                (p_z - initial_z.min)/(initial_z.max-initial_z.min);
            
            particle_size = options.particle_size*particle_mass*(
                 particle_size*particle_size + 0.5
            );
            if (particle_size < 0) particle_size = 0;
            if (particle_size > 50) particle_size = 0;

            return particle_size;
        }


        // Clear the canvas from the previous run
        ctx.clearRect(0,0,canvas.width,canvas.height);

        // Loop over the particles and draw them to the screen.
        for(i = 0; i < particles.length; ++i) {
            var p = particles[i];

            particle_size = gen_particle_size(
                view_offset.z + p.position.z, p.mass
            );

            /**
             * Draw particles with motion blur
             *
             * We generate motion blur by finding positions in previous
             * timesteps by doing a very dumb Euler integration with
             * our velocity set in reverse. Since we're only interested
             * in short enough times for blur, and the blur itself is of
             * no real consequence, this should be fine. It looks pretty
             * enough anyway.
             */
            // This is how far back in time our blur goes
            var dt = 0.01;
            /**
             * These control roughly how granular our tail is
             * When alpha==1, we're looking at the current position
             * of the particle.
             */
            for(alpha = 0.2; alpha <= 1; alpha+=0.1) {
                // Find our fill style.
                if(1 - alpha > 0.01) ctx.fillStyle = "rgba(0,0,0,0.3)";
                else                 ctx.fillStyle = "rgba(0,0,0,1)";

                /**
                 * This draws a circle on the canvas using the previously
                 * defined fillStyle.
                 */
                ctx.beginPath();
                ctx.arc(
                    canvas_width_offset + canvas_scale* (
                        view_offset.x + p.position.x - (1-alpha)*p.velocity.x*dt
                    ),
                    canvas_height_offset + canvas_scale*(
                        view_offset.y + p.position.y - (1-alpha)*p.velocity.y*dt
                    ),
                    particle_size*(alpha*0.5 + 0.5),

                    0, Math.PI*2, true
                );
                ctx.closePath();
                ctx.fill();
            }
        }
    }


    /**
     * Check if particles have travelled outside the confines of
     * a given box. If so, bounce them off the side.
     */
    function apply_boundary_conditions(particles) {
        for(i = 0; i < particles.length; ++i) {
            var p = particles[i];

            /*
             * If the particle is outside the bounds of the
             * box, and is travelling further towards the
             * outside, turn it around.
             */
            if (
                p.position.x > 2.5 && p.velocity.x > 0 ||
                p.position.x < -1.5 && p.velocity.x < 0
            ) {
                console.log("bouncing");
                p.velocity.x = -p.velocity.x;
            }

            if (
                p.position.y > 2.5 && p.velocity.y > 0 ||
                p.position.y < -1.5 && p.velocity.y < 0
            ) {
                console.log("bouncing");
                p.velocity.y = -p.velocity.y;
            }

        }
    }

    $.fn.md = function(options) {

        options = options || {};

        /// Define the number of particles in the simulation
        var num_particles = options.num_particles || 10;

        /**
         * Define some time parameters
         *     run_time: the total time to run for
         *     dt: the time integration step
         *     step_delay: the time to wait between ticks
         */
        var run_time      = options.run_time || -1;
        var dt            = options.dt || 0.01;
        var step_delay    = options.step_delay || dt*1000;

        /// Define some potential parameters
        /**
         * Gravitational Potential
         *     G: the gravitational constant
         * Lennard-Jones Potential
         *     epsilon: depth of potential well
         *     delta: distance to bottom of well
         */
        var G             = options.G || 0.15;
        var epsilon = options.epsilon || 0.5;
        var delta   = options.delta   || 0.15;

        /// Define how big particles will appear when drawn
        var particle_size = options.particle_size || 2;


        console.log('RUNNING SIMULATION');

        // Generate some particles
        var particles = [];
        for(i = 0; i < num_particles; ++i) {
            var p = new Particle;

            // We want particles to be randomly distributed
            p.position = Vector3D.random();

            /* We may want particles to have some initial velocity.
             * Unless using large numbers of particles, this leads to
             * the center of mass having a velocity, so view port moves
             * with it, making movements look a little odd.
             */
            //p.velocity = Vector3D.multiply(Vector3D.random(), 1);
            p.mass = Math.random()*5+0.5;
            particles.push(p);
        }

        // Initialize our potentials if necessary
        // generate_Lennard_Jones_forces(particles, epsilon, delta);
        generate_gravitational_forces(particles, G);

        // Pull out the canvas element to draw on
        var canvas = this[0];

        (function run_tick(t, run_time, dt) {
            // Draw current positions of particles
            canvas_draw_particles(canvas, particles, {
                particle_size:particle_size,
            });


            /*
             * Begin position, velocity and force updates here
             */

            //Run initial timestep update using Velocity Verlet
            for(i = 0; i < particles.length; ++i) {
                var p = particles[i];

                p.velocity = Vector3D.add(
                    p.velocity,
                    Vector3D.multiply(p.force, 0.5*dt/p.mass)
                );

                p.position = Vector3D.add(
                    p.position,
                    Vector3D.multiply(p.velocity, dt)
                );
            }

            /*
             * Generate updated forces
             */
            // Reset all forces to 0
            for(i=0; i < particles.length; ++i) {
                particles[i].force = new Vector3D;
            }
            // Run our force generating routine
            // generate_Lennard_Jones_forces(particles, epsilon, delta);
            generate_gravitational_forces(particles, G);

            //Run final timestep update using Velocity Verlet
            for(i = 0; i < particles.length; ++i) {
                var p = particles[i];

                p.velocity = Vector3D.add(
                    p.velocity,
                    Vector3D.multiply(p.force, 0.5*dt/p.mass)
                );
            }

            /*
             * There have been some problems with viewport tracking
             * where some particles may have achieved escape
             * velocity and energy hasn't been conserved. This could
             * be from some time resolution errors.
             *
             * We solve this by putting particles in a finite box and
             * having them bounce off the sides.
             */
            apply_boundary_conditions(particles);


            /*
             * If the current time is less than the total runtime,
             * or if the simulation is to run indefinitely,
             * wait step_delay milliseconds and run the next tick.
             * Otherwise, end.
             */
            if(t < run_time || run_time < 0) {
                setTimeout(function() {
                    run_tick(t+dt, run_time, dt);
                }, step_delay);
            }
            else {
                console.log("Simulation Complete");
            }
        })(0, run_time, dt);
    };
})(jQuery);
