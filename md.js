(function($) {

    var Vector3D = function(x,y,z) {
        var _this = this;

        _this.x = x || 0;
        _this.y = y || 0;
        _this.z = z || 0;

        _this.randomize = function() {
            _this.x = Math.random();
            _this.y = Math.random();
            _this.z = Math.random();

            return _this;
        };

        _this.length = function() {
            return Math.sqrt(
                _this.x*_this.x +
                _this.y*_this.y +
                _this.z*_this.z
            );
        };

    };


    Vector3D.unit = function(v) {
        return Vector3D.divide(v, v.length());
    };


    Vector3D.add = function(v1, v2) {
        return new Vector3D(
            v1.x + v2.x,
            v1.y + v2.y,
            v1.z + v2.z
        );
    };
 
    Vector3D.subtract = function(v1, v2) {
        return new Vector3D(
            v1.x - v2.x,
            v1.y - v2.y,
            v1.z - v2.z
        );
    };
 
    Vector3D.multiply = function(v, a) {
        return new Vector3D(
            v.x * a,
            v.y * a,
            v.z * a
        );
    };

    Vector3D.divide = function(v, a) {
        return new Vector3D(
            v.x / a,
            v.y / a,
            v.z / a
        );
    };

    // Finds the distance between two vectors
    Vector3D.distance = function(v1, v2) {
        return Vector3D.relativeVector(v1, v2).length();
    };


    var Particle = function() {
        var _this = this;

        _this.position = new Vector3D;
        _this.velocity = new Vector3D;
        _this.force    = new Vector3D;

        _this.mass     = 1.0;

        _this.randomize = function() {
            _this.position.randomize();
            _this.velocity.randomize();

            return _this;
        };
    };


    function generate_gravitational_forces(particles, G) {
        //Use gravitational potential
        //-> F = GMm/(d*d) r/|r|
        for(i = 0; i < particles.length; ++i)
        for(j = i+1; j < particles.length; ++j) {
            var p1 = particles[i];
            var p2 = particles[j];

            var r  = Vector3D.subtract(p1.position, p2.position);
            var d  = r.length();

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

    function generate_Lennard_Jones_forces(particles, epsilon, delta) {
        // Use Lennard-Jones potential
        // V = 4*epsilon*((delta/d)^12 - (delta/d)^6)
        // F = 4*epsilon*(-12/d*(delta/d)^12 + 6/d*(delta/d)^6) r/|r|
        for(i = 0; i < particles.length; ++i)
        for(j = i+1; j < particles.length; ++j) {
            var p1 = particles[i];
            var p2 = particles[j];

            var r  = Vector3D.subtract(p1.position, p2.position);
            var d  = r.length();

            var d6 = (delta/d);
                d6 = d6*d6*d6;
                d6 = d6*d6;

            var f  = 4*epsilon*(6/d)*(-2*d6*d6 + d6)/d;
            var fv = Vector3D.multiply(r, f);

            p1.force = Vector3D.subtract(p1.force, fv);
            p2.force = Vector3D.add(p2.force, fv);
        }
    }

    function canvas_draw_particles(canvas, particles, options) {
        var ctx    = canvas.getContext("2d");

        var $canvas = $(canvas);

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

        var total_mass = $canvas.data('total_mass') || (function() {
            var total_mass = 0;
            for(i = 0; i < particles.length; ++i) {
                total_mass += particles[i].mass;
            }
            $canvas.data('total_mass', total_mass);

            return total_mass;
        })();

        var view_offset = $canvas.data('view_offset') || (function() {
            var view_offset = new Vector3D;
            for(i = 0; i < particles.length; ++i) {
                var p = particles[i];
                view_offset = Vector3D.add(
                    view_offset, Vector3D.multiply(p.position, p.mass)
                );
            }
            view_offset = Vector3D.divide(view_offset, total_mass);
            view_offset = Vector3D.subtract(
                new Vector3D(0.5, 0.5, 0.5), view_offset
            );
            $canvas.data('view_offset', view_offset);

            return view_offset;
        })();

        var canvas_scale = (function() {
            if (canvas.width < canvas.height) return canvas.width;
            else                              return canvas.height;
        })()
        var canvas_height_offset = (canvas.height - canvas_scale)/2;
        var canvas_width_offset = (canvas.width - canvas_scale)/2;


        //Display particles
        ctx.clearRect(0,0,canvas.width,canvas.height);

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

        var center = new Vector3D;
        for(i = 0; i < particles.length; ++i) {
            var p = particles[i];

            particle_size = gen_particle_size(
                view_offset.z + p.position.z, p.mass
            );

            // Draw particles with motion blur
            var dt = 0.01;
            for(alpha = 0.2; alpha <= 1; alpha+=0.1) {
                if(1 - alpha > 0.01) ctx.fillStyle = "rgba(0,0,0,0.3)";
                else                 ctx.fillStyle = "rgba(0,0,0,1)";
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

            center = Vector3D.add(
                center, Vector3D.multiply(p.position, p.mass)
            );
        }
        center = Vector3D.divide(center, total_mass);
        center = Vector3D.subtract(
            new Vector3D(0.5, 0.5, 0.5), center
        );

        $canvas.data('view_offset', center);
    }


    function apply_boundary_conditions(particles) {
        for(i = 0; i < particles.length; ++i) {
            var p = particles[i];

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

        var num_particles = options.num_particles || 10;
        var G             = options.G || 1;
        var run_time      = options.run_time || -1;
        var dt            = options.dt || 0.005;
        var step_delay    = options.step_delay || dt*1000;

        var epsilon = options.epsilon || 0.5;
        var delta   = options.delta   || 0.15;

        var particle_size = options.particle_size || 2;


        console.log('RUNNING SIMULATION');

        var particles = [];
        for(i = 0; i < num_particles; ++i) {
            var p = new Particle;
            p.position.randomize();
            //p.velocity = Vector3D.multiply((new Vector3D()).randomize(), 1);
            p.mass = Math.random()*5+0.5;
            particles.push(p);
        }
        // generate_Lennard_Jones_forces(particles, epsilon, delta);
        generate_gravitational_forces(particles, G);

        var canvas = this[0];

        (function run_tick(t, run_time, dt) {
            canvas_draw_particles(canvas, particles, {
                particle_size:particle_size,
            });


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

            // Generate updated forces
            for(i=0; i < particles.length; ++i) {
                particles[i].force = new Vector3D;
            }
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

            apply_boundary_conditions(particles);


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
