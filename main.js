import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Stats from "three/addons/libs/stats.module.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { vs } from "./shader/vs";
import { fs } from "./shader/fs";

let camera, scene, renderer;
let material, cubeCamera;
let stats, clock, dolly, gui;
const up = new THREE.Vector3(0, 1, 0);
const interval = 40;

const canvas = document.querySelector("#canvas");

const config = {
  resolution: "full",
};

init();
render();

function init() {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;

  scene = new THREE.Scene();

  clock = new THREE.Clock();
  dolly = new THREE.Group();
  scene.add(dolly);
  camera = new THREE.PerspectiveCamera(
    60,
    canvas.width / canvas.height,
    1,
    1000
  );
  camera.position.set(0, -1, 5);
  dolly.add(camera);

  const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(2048, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  cubeRenderTarget.texture.type = THREE.HalfFloatType;
  cubeCamera = new THREE.CubeCamera(1, 10000, cubeRenderTarget);
  setCubeTexture();
  const geometry = new THREE.PlaneGeometry(2.0, 2.0);
  material = new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      interval: { value: interval },
      resolution: { value: new THREE.Vector2(canvas.width, canvas.height) },
      cameraWorldMatrix: { value: camera.matrixWorld },
      cameraProjectionMatrixInverse: {
        value: camera.projectionMatrixInverse.clone(),
      },
      cubeTexture: { value: cubeRenderTarget.texture },
      backgroundIntensity: { value: 1 },
    },
    vertexShader: vs,
    fragmentShader: fs,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // Controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false;
  controls.update();

  stats = new Stats();
  onWindowResize();

    // GUI
    gui = new GUI();
    gui
      .add(config, "resolution", ["256", "512", "800", "full"])
      .name("Resolution")
      .onChange(onWindowResize);

    window.addEventListener("resize", onWindowResize);
    document.body.appendChild(stats.dom);
}

function setCubeTexture() {
  const sky = new Sky();
  sky.visible = false;
  sky.scale.setScalar(1000);
  scene.add(sky);
  const sun = new THREE.Vector3();
  const params = {
    turbidity: 10,
    rayleigh: 3,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.7,
    elevation: 2,
    azimuth: 180,
  };

  const uniforms = sky.material.uniforms;
  uniforms["turbidity"].value = params.turbidity;
  uniforms["rayleigh"].value = params.rayleigh;
  uniforms["mieCoefficient"].value = params.mieCoefficient;
  uniforms["mieDirectionalG"].value = params.mieDirectionalG;
  const phi = THREE.MathUtils.degToRad(90 - params.elevation);
  const theta = THREE.MathUtils.degToRad(params.azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  uniforms["sunPosition"].value.copy(sun);

  const toneMapping = renderer.toneMapping;
  const toneMappingExposure = renderer.toneMappingExposure;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  sky.visible = true;
  cubeCamera.update(renderer, scene);

  sky.visible = false;
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = toneMappingExposure;
}

function onWindowResize() {
  if (config.resolution === "full") {
    renderer.setSize(window.innerWidth, window.innerHeight);
  } else {
    renderer.setSize(parseInt(config.resolution), parseInt(config.resolution));
  }

  camera.aspect = canvas.width / canvas.height;
  camera.updateProjectionMatrix();

  material.uniforms.resolution.value.set(canvas.width, canvas.height);
  material.uniforms.cameraProjectionMatrixInverse.value.copy(
    camera.projectionMatrixInverse
  );
}

function render() {
  stats.begin();

  const elapsedTime = clock.getElapsedTime();
  material.uniforms.iTime.value = elapsedTime;

  dolly.quaternion.setFromAxisAngle(
    up,
    -(Math.PI * 2 * elapsedTime) / interval
  );
  renderer.render(scene, camera);

  stats.end();
  requestAnimationFrame(render);
}
