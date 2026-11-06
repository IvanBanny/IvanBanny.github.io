import * as optics from "./optics.js"

export const QUAD = `#version 300 es
void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

export const PHOTONS = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform vec4 lens;
uniform vec4 ripple;
uniform vec2 lattice;
uniform vec4 pose;
uniform vec2 stretch;
out vec2 pupil;
out vec3 jacobian;
flat out int band;

// differentiate the radial lens relief analytically
void relief(vec2 p, vec2 metric, float amplitude, float frequency, float phase,
            inout vec2 slope, inout vec3 hessian) {
    vec2 m = metric * p;
    float u = dot(p, m) * frequency + phase;
    float a = -2.0 * amplitude * frequency * sin(u);
    float b = -4.0 * amplitude * frequency * frequency * cos(u);
    slope += a * m;
    hessian += vec3(a * metric.x + b * m.x * m.x,
                    a * metric.y + b * m.y * m.y, b * m.x * m.y);
}

void main() {
    int channel = gl_InstanceID;
    int index = gl_VertexID;
    vec2 cell = vec2(index % ${optics.PUPIL_GRID + 1},
                     index / ${optics.PUPIL_GRID + 1});
    vec2 p = cell / ${optics.PUPIL_GRID}.0 * 2.0 - 1.0;
    float focus = lens.x + (float(channel) - 1.0) * 0.0014;
    float r2 = dot(p, p);
    float t = lens.y;
    float a = lens.z;
    float c = lens.w;
    vec2 slope = -1.12 * p + c * r2 * p
        + t * vec2(p.x * p.x - p.y * p.y, -2.0 * p.x * p.y)
        + a * vec2(p.y, p.x);
    vec3 hessian = vec3(
        -1.12 + c * (3.0 * p.x * p.x + p.y * p.y) + 2.0 * t * p.x,
        -1.12 + c * (p.x * p.x + 3.0 * p.y * p.y) - 2.0 * t * p.x,
        2.0 * c * p.x * p.y - 2.0 * t * p.y + a);
    vec2 metric = vec2(ripple.w, 1.0 / ripple.w);
    relief(p, metric, ripple.x, ripple.y, ripple.z, slope, hessian);
    relief(p, metric, ripple.x * 0.035, ripple.y * 2.1, ripple.z * 0.7, slope, hessian);
    vec2 wave = p * lattice.y + vec2(ripple.z * 0.3, -ripple.z * 0.2);
    vec2 s = sin(wave);
    vec2 cs = cos(wave);
    slope -= lattice.x * lattice.y * vec2(s.x * cs.y, cs.x * s.y);
    float k = lattice.x * lattice.y * lattice.y;
    hessian += k * vec3(-cs.x * cs.y, -cs.x * cs.y, s.x * s.y);

    vec2 q = p + focus * slope;
    float angle = pose.x;
    q = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * q;
    q = q * stretch * pose.y + pose.zw;
    gl_Position = vec4(q.x * 2.0 * resolution.y / resolution.x, q.y * 2.0, 0.0, 1.0);
    pupil = p;
    jacobian = vec3(1.0, 1.0, 0.0) + focus * hessian;
    band = channel;
}`

export const FLUX = `#version 300 es
precision highp float;
in vec2 pupil;
in vec3 jacobian;
flat in int band;
out vec4 color;
void main() {
    float aperture = 1.0 - smoothstep(0.86, 1.0, length(pupil));
    float determinant = abs(jacobian.x * jacobian.y - jacobian.z * jacobian.z);
    vec3 flux = vec3(0.0);
    flux[band] = aperture * 0.0035 / max(determinant, 0.004);
    color = vec4(flux, 1.0);
}`

export const PROJECT = `#version 300 es
precision highp float;
uniform sampler2D light;
uniform vec2 resolution;
uniform sampler2D glyphs;
uniform float render_scale;
uniform float journey;
uniform float generation_focus;
uniform float time;
out vec4 color;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float haze(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(cell), hash(cell + vec2(1, 0)), f.x),
               mix(hash(cell + vec2(0, 1)), hash(cell + vec2(1, 1)), f.x), f.y);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    vec2 texel = 1.0 / vec2(textureSize(light, 0));
    vec3 sharp = texture(light, uv).rgb;
    vec3 bloom = sharp * 0.2;
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398;
        vec2 d = vec2(cos(a), sin(a)) * texel;
        bloom += texture(light, uv + d * 3.5).rgb * 0.075;
        bloom += texture(light, uv + d * 10.0).rgb * 0.025;
    }
    float horizon = 0.45 + sin(journey * 0.8) * 0.055;
    float cloud = haze(vec2(uv.x * 3.5 + time * 0.004, uv.y * 12.0 + journey * 0.10));
    cloud += haze(vec2(uv.x * 8.0 - time * 0.006, uv.y * 28.0)) * 0.30;
    float band = exp(-pow((uv.y - horizon) / 0.18, 2.0));
    // retain a golden horizon while keeping the light in an orange spectrum
    vec3 copper = vec3(0.66, 0.29, 0.075);
    vec3 amber = vec3(1.0, 0.60, 0.12);
    vec3 smoke = vec3(0.46, 0.34, 0.20);
    vec3 sky = mix(copper, amber,
                   smoothstep(-0.12, horizon + 0.04, uv.y));
    sky = mix(sky, smoke, smoothstep(horizon + 0.05, 1.20, uv.y));
    sky += band * vec3(0.045, 0.065, 0.015);
    sky += (cloud - 0.58) * vec3(0.075, 0.045, 0.012);
    vec2 sun = (uv - vec2(0.73, horizon + 0.025))
        * vec2(resolution.x / resolution.y, 1.0);
    sky += exp(-dot(sun, sun) * 4.0) * vec3(0.06, 0.055, 0.012);
    vec3 illumination = 1.0 - exp(-(sharp * 1.5 + bloom * 0.35) * 2.0);
    // soften the entire projection as if a cloud passed in front of the sun
    float ambient_visibility = mix(1.0, 0.20, generation_focus);
    illumination *= ambient_visibility;
    vec3 projected = mix(sky, vec3(1.0, 0.76, 0.30), illumination * 0.90);

    // keep the character field independent of the optical caustics
    vec2 cell_size = vec2(13.0, 18.0);
    vec2 scroll_offset = journey * vec2(18.0, 110.0);
    vec2 pixel = gl_FragCoord.xy / render_scale + scroll_offset;
    vec2 cell = floor(pixel / cell_size);
    vec2 sample_uv = ((cell + 0.5) * cell_size - scroll_offset)
        * render_scale / resolution;
    vec2 q = sample_uv * vec2(resolution.x / resolution.y, 1.0);
    q.y += journey * 0.14;
    q.x += (q.y - 0.5) * sin(journey * 0.8) * 0.10;
    float drift = time * 0.065 + journey * 0.65;
    float field = q.y + 0.12 * sin(q.x * 3.8 - drift)
        + 0.055 * sin(q.x * 8.0 + drift * 0.7 + q.y * 2.0);
    float spacing = 11.0 + sin(journey * 0.9) * 1.5;
    float contour = abs(fract(field * spacing + drift * 0.12) - 0.5);
    float gate = 1.0 - smoothstep(0.075, 0.24, contour);
    float envelope = haze(vec2(q.x * 3.0 - drift * 0.22, q.y * 5.0 + drift * 0.12));
    gate *= smoothstep(0.20, 0.60, envelope) * step(0.20, hash(cell + 41.0));
    float strength = dot(texture(light, sample_uv).rgb, vec3(0.2126, 0.7152, 0.0722));
    gate *= 1.0 - smoothstep(0.002, 0.045, strength);
    gate *= smoothstep(0.29, 0.44, sample_uv.x)
        * smoothstep(0.07, 0.20, sample_uv.y)
        * (1.0 - smoothstep(0.86, 0.96, sample_uv.y));
    float character = floor(mod(floor(field * 33.0)
        + floor(cell.x * 0.18) + floor(drift), 10.0));
    vec2 letter = fract(pixel / cell_size);
    float ink = texture(glyphs, vec2((character + letter.x) / 12.0, letter.y)).a;
    gate *= ambient_visibility;
    projected = mix(projected, vec3(0.32, 0.16, 0.045), ink * gate * 0.42);
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    // darker copper edges keep the fixed navigation readable without panels
    float edge = max(1.0 - smoothstep(0.0, 0.13, uv.y),
                     smoothstep(0.86, 1.0, uv.y));
    projected *= 1.0 - edge * 0.28;
    color = vec4(projected + (grain - 0.5) * 0.005, 1.0);
}`
