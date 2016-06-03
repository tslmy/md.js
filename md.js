    /* js fixes */
    function randomlyChooseFrom(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
    // http://stackoverflow.com/questions/808826/draw-arrow-on-canvas-tag
    function drawArrow(ctx, strokeStyle, fromx, fromy, tox, toy){
        //variables to be used when creating the arrow
        var headlen = 2;
        var strokeStyle = strokeStyle || "rgba(0,0,0,.2)";
        var angle = Math.atan2(toy-fromy,tox-fromx);

        //starting path of the arrow from the start square to the end square and drawing the stroke
        ctx.beginPath();
        ctx.moveTo(fromx, fromy);
        ctx.lineTo(tox, toy);
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.stroke();

        //starting a new path from the head of the arrow to one of the sides of the point
        ctx.beginPath();
        ctx.moveTo(tox, toy);
        ctx.lineTo(tox-headlen*Math.cos(angle-Math.PI/7),toy-headlen*Math.sin(angle-Math.PI/7));

        //path from the side point of the arrow, to the other side point
        ctx.lineTo(tox-headlen*Math.cos(angle+Math.PI/7),toy-headlen*Math.sin(angle+Math.PI/7));

        //path from the side point back to the tip of the arrow, and then again to the opposite side point
        ctx.lineTo(tox, toy);
        ctx.lineTo(tox-headlen*Math.cos(angle-Math.PI/7),toy-headlen*Math.sin(angle-Math.PI/7));

        //draws the paths created above
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = strokeStyle;
        ctx.fill();
    }

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
        return Vector3D.divide(v, Vector3D.norm(v));
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

    // http://stackoverflow.com/questions/1484506/random-color-generator-in-javascript
    /* function getRandomColorHex() {
        var letters = '0123456789ABCDEF'.split('');
        var color = '#';
        for (var i = 0; i < 6; i++ ) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    } */
    function getRandomColor() {
        return 'rgba('+Math.floor(Math.random()*255).toString()+','+
                       Math.floor(Math.random()*255).toString()+','+
                       Math.floor(Math.random()*255).toString();
    }
    

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

        _this.color    = 'rgba(100,100,100';
        _this.mass     = 1.0;
        _this.charge   = 0;

        _this.randomize = function() {
            _this.position = Vector3D.random();
            _this.velocity = Vector3D.random();
            _this.color    = getRandomColor();
            return _this;
        };
    };

    function generate_coulomb_forces(particles, k) {
        //Use coulomb potential
        //-> F = - kQq/(d*d) r/|r|
        for(var i = 0; i < particles.length; ++i)
        for(var j = i+1; j < particles.length; ++j) {
            var p1 = particles[i];
            var p2 = particles[j];

            var r  = Vector3D.subtract(p1.position, p2.position);
            var d  = Vector3D.norm(r);

            var fv = (function() {
                // Use d_min to prevent high potential when particles are close
                // to avoid super high accelerations in poor time resolution
                var d_min = 0.2;
                if (d < d_min) {
                    d = d_min;
                }
                var f  = - k * p1.charge * p2.charge / (d*d*d);
                return Vector3D.multiply(r, f);
            })();

            p1.force = Vector3D.subtract(p1.force, fv);
            p2.force = Vector3D.add(p2.force, fv);
        }
    }

    /**
     * This applies forces to input particles as though they were
     * interacting under gravitational potential.
     *
     * This is a nice, simple potential with some nice results.
     */
    function generate_gravitational_forces(particles, G) {
        //Use gravitational potential
        //-> F = GMm/(d*d) r/|r|
        for(var i = 0; i < particles.length; ++i)
        for(var j = i+1; j < particles.length; ++j) {
            var p1 = particles[i];
            var p2 = particles[j];

            var r  = Vector3D.subtract(p1.position, p2.position);
            var d  = Vector3D.norm(r);

            var fv = (function() {
                // Use d_min to prevent high potential when particles are close
                // to avoid super high accelerations in poor time resolution
                var d_min = 0.2;
                if (d < d_min) {
                    d = d_min;
                }
                var f  = G * p1.mass * p2.mass / (d*d*d);
                return Vector3D.multiply(r, f);
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
        for(var i = 0; i < particles.length; ++i)
        for(var j = i+1; j < particles.length; ++j) {
            var p1 = particles[i];
            var p2 = particles[j];

            var r  = Vector3D.subtract(p1.position, p2.position);
            var d  = Vector3D.norm(r);

            var r = Vector3D.unit(r);

            var d6 = (delta/d);
            if (d6 < 0.5) d6 = 0.5;
                d6 = d6*d6*d6;
                d6 = d6*d6;

            var f  = 4*epsilon*(6/d)*(-2*d6*d6 + d6);
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
         * The view offset is used to place the center of the view
         * looking at the center of mass of the system.
         *
         * We assume the particles have vectors distributed between 0
         * and 1, so the original center should be 0.5. We look for
         * deviations from this and adjust accordingly later.
         */
        var view_offset = (function() {
            var center_of_mass = new Vector3D;
            var total_mass = 0;
            for(var i = 0; i < particles.length; ++i) {
                var p = particles[i];
                center_of_mass = Vector3D.add(
                    center_of_mass, Vector3D.multiply(p.position, p.mass)
                );
                total_mass += p.mass;
            }
            center_of_mass = Vector3D.divide(center_of_mass, total_mass);

            /**
             * Center of mass may not be where the most particles are
             * We define a function that finds the center we should be
             * looking at by weighting particles according to their
             * distance from the center of mass
             */
            var view_offset = new Vector3D;
            var total_weight = 0;
            var d_minor_cutoff = 3;
            var d_major_cutoff = 500;
            for (i = 0; i < particles.length; ++i) {
                var p = particles[i];

                var d = Vector3D.norm(
                    Vector3D.subtract(center_of_mass, p.position)
                );

                var weight
                if (d > d_minor_cutoff) {
                    var d_off = d-d_minor_cutoff;
                    weight = 1/(d_off*d_off+1);
                } else if ( d > d_major_cutoff ) {
                    weight = 0;
                } else {
                    weight = 1;
                }
                weight = weight*p.mass;

                view_offset = Vector3D.add(
                    view_offset, Vector3D.multiply(p.position, weight)
                );

                total_weight += weight;
            }

            view_offset = Vector3D.divide(view_offset, total_weight);
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
        function gen_particle_size(focal_length, pos, particle_mass) {
            var particle_size =
                (options.particle_size*particle_mass)*(focal_length/pos.z); 

            // Particle size must not be negative!
            particle_size = Math.max(0, particle_size);

            return particle_size;
        }
        function gen_particle_pos(focal_length, pos) {
            var center = 0.5;
            return new Vector3D(
                (pos.x-center)*focal_length/pos.z +center,
                (pos.y-center)*focal_length/pos.z +center,
                pos.z
            );
        }


        // Clear the canvas from the previous run
        ctx.clearRect(0,0,canvas.width,canvas.height);

        // Loop over the particles and draw them to the screen.
        for(var i = 0; i < particles.length; ++i) {
            var p = particles[i];
            var init_pos = Vector3D.add(p.position, view_offset);

            var focal_length = 0.4;

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
            var dt = 0.004;
            /**
             * These control roughly how granular our tail is
             * When alpha==1, we're looking at the current position
             * of the particle.
             */
            for(var alpha = 0.2; alpha <= 1; alpha+=0.1) {
                // Find our fill style.
                ctx.fillStyle = p.color + "," + alpha.toString() + ")";
                var pos = gen_particle_pos(
                    focal_length,
                    Vector3D.subtract(
                        init_pos,
                        Vector3D.multiply(p.velocity, (1-alpha)*dt)
                    )
                );
                var particle_size = gen_particle_size(
                    focal_length, pos, p.mass
                );



                /**
                 * This draws a circle on the canvas using the previously
                 * defined fillStyle.
                 */
                ctx.beginPath();
                ctx.arc(
                    canvas_width_offset + canvas_scale*pos.x,
                    canvas_height_offset + canvas_scale*pos.y,
                    particle_size*(alpha*0.5 + 0.5),

                    0, 2*Math.PI, true
                );
                ctx.closePath();
                ctx.fill();
            }
            ctx.fillText(chargeToString(p.charge), 
                    canvas_width_offset + canvas_scale*pos.x,
                    canvas_height_offset + canvas_scale*pos.y); 
            drawArrow(ctx, 'rgba(0,0,0,.3)',
                canvas_width_offset + canvas_scale*pos.x,
                canvas_height_offset + canvas_scale*pos.y,
                canvas_width_offset + canvas_scale*pos.x + p.force.x/3,
                canvas_height_offset + canvas_scale*pos.y + p.force.y/3);
            drawArrow(ctx, 'rgba(0,100,200,.5)',
                canvas_width_offset + canvas_scale*pos.x,
                canvas_height_offset + canvas_scale*pos.y,
                canvas_width_offset + canvas_scale*pos.x + p.velocity.x*15,
                canvas_height_offset + canvas_scale*pos.y + p.velocity.y*15);
        }
    }


    /**
     * Check if particles have travelled outside the confines of
     * a given box. If so, bounce them off the side.
     */
    function apply_boundary_conditions(particles) {
        for(i = 0; i < particles.length; ++i) {
            var p = particles[i];

            /**
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
    function chargeToString(charge) {
        if (charge == 0) {
            return '';
        }
        if (charge>0) {
            if (charge == 1) {return '+'}
            else {return charge.toString()+'+'};
        }
        if (charge<0) {
            if (charge == -1) {return '-'}
            else {return (-charge).toString()+'-'};
        }
    }
    var particles = [];
    $.fn.md = function(options) {

        options = options || {};

        // Define the number of particles in the simulation
        var num_particles = options.num_particles || 20;

        /**
         * Define some time parameters
         *     run_time: the total time to run for
         *     dt: the time integration step
         *     step_delay: the time to wait between ticks
         */
        var run_time      = options.run_time || -1;
        var dt            = options.dt || 0.001;
        var step_delay    = options.step_delay || dt*1000;
        var frameskip     = options.frameskip || 5;

        // Define some potential parameters
        /**
         * Gravitational Potential
         *     G: the gravitational constant
         * Lennard-Jones Potential
         *     epsilon: depth of potential well
         *     delta: distance to bottom of well
         */
        var G       = options.G       || 0.15;
        var epsilon = options.epsilon || 1;
        var delta   = options.delta   || 0.1;
        var k       = options.k       || .5;

        // Define how big particles will appear when drawn
        var particle_size = options.particle_size || 2;


        console.log('RUNNING SIMULATION');

        // Generate some particles
        //var particles = [];
        for(var i = 0; i < num_particles; ++i) {
            var p = new Particle;

            // We want particles to be randomly distributed
            p.position = Vector3D.random();
            p.color = getRandomColor();

            /**
             * We may want particles to have some initial velocity.
             * Unless using large numbers of particles, this leads to
             * the center of mass having a velocity, so view port moves
             * with it, making movements look a little odd.
             */
            //p.velocity = Vector3D.multiply(Vector3D.random(), 1);
            //p.velocity = new Vector3D(0,0,1);
            p.mass = Math.random()*4.5+0.5;
            p.charge = randomlyChooseFrom([-2,-1,0,1,2]);
            particles.push(p);
        }

        // Define force generation function
        function generate_forces(particles) {
            generate_Lennard_Jones_forces(particles, epsilon, delta);
            generate_gravitational_forces(particles, G);
            generate_coulomb_forces(particles, k);
        }

        // Initialize our potentials if necessary
        generate_forces(particles);
        console.log(particles);//for debugging
        // Pull out the canvas element to draw on
        var canvas = this[0];

        var count = 0;
        (function run_tick(t, run_time, dt) {
            if ( count++ % frameskip == 0) {
                // Draw current positions of particles
                canvas_draw_particles(canvas, particles, {
                    particle_size:particle_size,
                });
            }


            /**
             * Begin position, velocity and force updates here
             */

            // Run initial timestep update using Velocity Verlet
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

            /**
             * Generate updated forces
             */
            // Reset all forces to 0
            for(i=0; i < particles.length; ++i) {
                particles[i].force = new Vector3D;
            }

            // Run our force generating routine
            generate_forces(particles);

            // Run final timestep update using Velocity Verlet
            for(i = 0; i < particles.length; ++i) {
                var p = particles[i];

                p.velocity = Vector3D.add(
                    p.velocity,
                    Vector3D.multiply(p.force, 0.5*dt/p.mass)
                );
            }

            /**
             * There have been some problems with viewport tracking
             * where some particles may have achieved escape
             * velocity and energy hasn't been conserved. This could
             * be from some time resolution errors.
             *
             * We solve this by putting particles in a finite box and
             * having them bounce off the sides.
             */
            //apply_boundary_conditions(particles);


            /**
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

