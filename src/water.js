import * as THREE from 'three';

export function createWater() {
  const geo = new THREE.PlaneGeometry(600, 600, 180, 180);
  geo.rotateX(-Math.PI / 2);

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x0b4f8a) },
      uShallow: { value: new THREE.Color(0x2c8fd4) },
      uSky: { value: new THREE.Color(0xd9edfb) },
      uSunDir: { value: new THREE.Vector3(0.45, 0.75, 0.35).normalize() },
    },
  ]);

  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      float waveH(vec2 p) {
        float h = 0.0;
        h += sin(dot(p, vec2(0.12, 0.08)) + uTime * 0.9) * 0.22;
        h += sin(dot(p, vec2(-0.07, 0.15)) + uTime * 0.7) * 0.18;
        h += sin(dot(p, vec2(0.25, -0.2)) + uTime * 1.6) * 0.07;
        h += sin(dot(p, vec2(0.4, 0.33)) + uTime * 2.1) * 0.04;
        return h;
      }

      void main() {
        vec3 p = position;
        float e = 0.4;
        float h  = waveH(p.xz);
        float hx = waveH(p.xz + vec2(e, 0.0));
        float hz = waveH(p.xz + vec2(0.0, e));
        p.y += h;
        vNormal = normalize(vec3(h - hx, e, h - hz));
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #ifdef USE_FOG
          vFogDepth = -mvPosition.z;
        #endif
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uSunDir;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vNormal);
        vec3 col;
        float alpha;

        if (gl_FrontFacing) {
          // вид сверху: глубокая вода + отражение неба по Френелю + солнечный блик
          float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);
          col = mix(uDeep, uSky, fres * 0.85);
          vec3 H = normalize(uSunDir + V);
          col += vec3(1.0, 0.98, 0.92) * pow(max(dot(N, H), 0.0), 180.0) * 1.4;
          alpha = mix(0.86, 0.97, fres);
        } else {
          // вид снизу: светящийся «потолок» с солнечным пятном и рябью
          N = -N;
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          col = mix(uShallow, vec3(0.85, 0.95, 1.0), fres * 0.7);
          float spot = pow(max(dot(normalize(vWorldPos - cameraPosition), uSunDir), 0.0), 28.0);
          col += vec3(1.0, 0.97, 0.9) * spot * 0.9;
          float rip = sin(vWorldPos.x * 0.8 + uTime) * sin(vWorldPos.z * 0.7 - uTime * 1.3);
          col += rip * 0.04;
          alpha = 0.78;
        }

        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'water';
  mesh.renderOrder = 1;

  return {
    mesh,
    update(t) {
      uniforms.uTime.value = t;
    },
  };
}
