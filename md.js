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


    $.fn.md = function(options) {

        options = options || {};

        var num_particles = options.num_particles || 5;
        var G             = options.G || 1;
        var run_time      = options.run_time || 0.5;
        var dt            = options.dt || 0.1;

        // Get canvas from attached jQuery object
        var canvas = this[0];
        var ctx    = canvas.getContext("2d");

        console.log('RUNNING SIMULATION');

        var particles = [];
        for(i = 0; i < num_particles; ++i) {
            p = new Particle;
            p.position.randomize();
            particles.push(p);
        }

        (function run_tick(t, run_time, dt) {
            //Display particles
            canvas.width = canvas.width;
            for(i = 0; i < num_particles; ++i) {
                var v = particles[i].position;

                ctx.beginPath();
                ctx.arc(100*v.x,100*v.y,3,0,Math.PI*2,true);
                ctx.closePath();
                ctx.fill();
            }

            //Zero out force vectors
            for(i=0; i < num_particles; ++i) {
                particles[i].force = new Vector3D;
            }

            //Use gravitational potential
            //-> F = GMm/(d*d) r/|r|
            for(i = 0; i < num_particles; ++i)
            for(j = i+1; j < num_particles; ++j) {
                var p1 = particles[i];
                var p2 = particles[j];

                var r  = Vector3D.subtract(p1.position, p2.position);
                var d  = r.length();
                var f  = G * p1.mass * p2.mass / (d*d);
                var fv = Vector3D.multiply(r, f);

                p1.force = Vector3D.subtract(p1.force, fv);
                p2.force = Vector3D.add(p2.force, fv);
            }

            //Run timestep update using Euler
            for(i = 0; i < num_particles; ++i) {
                p = particles[i];

                p.velocity = Vector3D.add(
                    Vector3D.multiply(p.force, dt),
                    p.velocity
                );

                p.position = Vector3D.add(
                    Vector3D.multiply(p.velocity, dt),
                    p.position
                );
            }

            if(t < run_time) {
                setTimeout(function() {
                    run_tick(t+dt, run_time, dt);
                }, 1000);
            }
            else {
                console.log("Simulation Complete");
            }
        })(0, run_time, dt);

    };
})(jQuery);
