import * as THREE from 'three';

// Небесный купол с градиентом и солнцем. Под водой плавно растворяется в цвет тумана.
export function createSky() {
  const geo = new THREE.SphereGeometry(420, 32, 16);
  const uniforms = {
    uTop: { value: new THREE.Color(0x2f7fc9) },
    uHorizon: { value: new THREE.Color(0xe4f1fb) },
    uSun: { value: new THREE.Vector3(0.45, 0.4, 0.35).normalize() },
    uFogColor: { value: new THREE.Color(0xe4f1fb) },
    uFogMix: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uSun;
      uniform vec3 uFogColor;
      uniform float uFogMix;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.6));
        float s = max(dot(d, uSun), 0.0);
        col += vec3(1.0, 0.96, 0.88) * pow(s, 260.0) * 1.6;   // диск
        col += vec3(1.0, 0.92, 0.75) * pow(s, 10.0) * 0.28;   // ореол
        col = mix(col, uFogColor, uFogMix);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;

  return {
    mesh,
    setFog(color, mix) {
      uniforms.uFogColor.value.copy(color);
      uniforms.uFogMix.value = mix;
    },
  };
}
