import * as THREE from 'three'
const OrbitControls = require('three-orbit-controls')(THREE)
import {MTLLoader, OBJLoader} from 'three-obj-mtl-loader'


const emitEvent = (element, eventName, data) => {
  element.dispatchEvent(new window.CustomEvent(eventName, {
    detail: data
  }))
}

/*
 * Default configuration for camera.
 */
const setCamera = (aspect) => {
  const camera = new THREE.PerspectiveCamera(
    45,
    aspect,
    0.01,
    1000
  )
  camera.position.z = 5
  camera.updateProjectionMatrix()
  return camera
}

/*
 * Add lights to given scene (ambient and spots).
 */
const setLights = (scene) => {
  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  const backLight = new THREE.DirectionalLight(0xffffff, 0.3)
  const keyLight = new THREE.DirectionalLight(
    new THREE.Color('#EEEEEE'),
    0.01
  )
  const fillLight = new THREE.DirectionalLight(
    new THREE.Color('#EEEEEE'),
    0.01
  )

  keyLight.position.set(-100, 0, 100)
  fillLight.position.set(100, 0, 100)
  backLight.position.set(100, 0, -100).normalize()

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.3)
  hemiLight.groundColor.setHSL(0.095, 1, 0.95)
  hemiLight.position.set(0, 100, 0)
  scene.add(hemiLight)

  scene.add(ambient)
  scene.add(keyLight)
  scene.add(fillLight)
  scene.add(backLight)

  scene.lights = { keyLight, fillLight, backLight, ambient }
  return scene
}

/*
 * Link an orbit control to given camera and renderer.
 */
var autorotateTimeout;

const setControls = (camera, renderer) => {
  const controls = new OrbitControls(
    camera,
    renderer.domElement
  )
  controls.addEventListener('start', function(){
    clearTimeout(autorotateTimeout);
    controls.autoRotate = false;
  });

  // restart autorotate after the last interaction & an idle time has passed
  controls.addEventListener('end', function(){
    autorotateTimeout = setTimeout(function(){
      controls.autoRotate = true;
    }, 1000);
  });
  controls.autoRotate = true
  controls.enableZoom = true
  camera.controls = controls
  return controls
}

/*
 * Configure Three renderer.
 */
const setRenderer = (width, height) => {
  const renderer = new THREE.WebGLRenderer()
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setClearColor(new THREE.Color('hsl(0, 0%, 10%)'))
  return renderer
}

/*
 * Render function required by Three.js to display things.
 */
const render = (element, renderer, scene, camera) => {
  element.appendChild(renderer.domElement)
  const animate = () => {
    camera.controls.update()
    window.requestAnimationFrame(animate)
    renderer.render(scene, camera)
  }
  animate()
  return scene
}

/*
 * Build the scene in which the object will be displayed. It configures Three
 * properly and adds camera, lights and controls.
 */
const prepareScene = (domElement) => {
  const scene = new THREE.Scene()
  const element = domElement
  const width = element.offsetWidth
  const height = element.offsetHeight

  const camera = setCamera(width / height)
  const renderer = setRenderer(width, height, scene, camera)
  setControls(camera, renderer)
  setLights(scene)
  render(element, renderer, scene, camera)
  window.addEventListener(
    'resize',
    onWindowResize(element, camera, renderer),
    false
  )
  scene.camera = camera
  scene.element = domElement
  return scene
}

/*
 * Load a mesh (.obj) into the given scene. Materials can be specified too
 * (.mtl).
 */
const loadObject = (scene, url, materialUrl, callback) => {
  const objLoader = new OBJLoader()
  if (scene.locked) return false
  scene.locked = true

  if (materialUrl) {
    const mtlLoader = new MTLLoader()
    mtlLoader.load(materialUrl, (materials) => {
      materials.preload()
      objLoader.setMaterials(materials)
      loadObj(objLoader, scene, url, callback)
    })
  } else {
    loadObj(objLoader, scene, url, callback)
  }

  return objLoader
}

/*
 * Load an .obj file. If no materials is configured on the loader, it sets
 * a phong grey material by default.
 */
const loadObj = (objLoader, scene, url, callback) => {
  const material = new THREE.MeshPhongMaterial({ color: 0xbbbbcc })

  objLoader.load(url, (obj) => {
    if (!objLoader.materials) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = material
        }
      })
    }
    scene.add(obj)
    fitCameraToObject(scene.camera, obj, scene.lights)
    scene.locked = false
    if (callback) callback(obj)
    emitEvent(scene.element, 'loaded', {obj})
  },
  (xhr) => {
    if (xhr.total === 0) {
      emitEvent(scene.element, 'loading', {
        loaded: 0,
        total: 100
      })
    } else {
      emitEvent(scene.element, 'loading', {
        loaded: xhr.loaded,
        total: xhr.total
      })
    }
  },
  (err) => {
    emitEvent(scene.element, 'error', {err})
    if (callback) callback(err)
  })
}

/*
 * Remove all meshes from the scene.
 */
const clearScene = (scene) => {
  scene.children.forEach((obj) => {
    if (obj.type === 'Group') {
      scene.remove(obj)
    }
  })
}

/*
 * Put back camera in its original position.
 */
const resetCamera = (scene) => {
  scene.camera.controls.reset()
}

/*
 * Display the viewer through the fullscreen feature of the browser.
 */
const goFullScreen = (element) => {
  const hasWebkitFullScreen = 'webkitCancelFullScreen' in document
  const hasMozFullScreen = 'mozCancelFullScreen' in document

  if (hasWebkitFullScreen) {
    element.webkitRequestFullScreen()
    const evt = window.document.createEvent('UIEvents')
    evt.initUIEvent('resize', true, false, window, 0)
    window.dispatchEvent(evt)
    return true
  } else if (hasMozFullScreen) {
    return element.mozRequestFullScreen()
  } else {
    return false
  }
}

/*
 * When the window is resized, the camera aspect ratio needs to be updated to
 * avoid distortions.
 */
const onWindowResize = (element, camera, renderer) => () => {
  const isFullscreen = !window.screenTop && !window.screenY
  const width = isFullscreen ? window.innerWidth : element.offsetWidth
  const height = isFullscreen ? window.innerHeight : element.offsetHeight
  const aspect = width / height

  camera.aspect = aspect
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

/*
 * Depending on the object size, the camera Z position must be bigger or
 * smaller to make sure the object fill all the space without getting outside
 * camera point of view.
 */
const fitCameraToObject = (camera, object, lights) => {
  const fov = camera.fov
  const boundingBox = new THREE.Box3()
  const size = new THREE.Vector3()
  boundingBox.setFromObject(object)
  resetObjectPosition(boundingBox, object)
  boundingBox.getSize(size)

  let cameraZ = Math.abs(size.y / 2 * Math.tan(fov * 2))
  const z = Math.max(cameraZ, size.z) * 1.5
  camera.position.z = z
  camera.updateProjectionMatrix()

  lights.keyLight.position.set(-z, 0, z)
  lights.fillLight.position.set(z, 0, z)
  lights.backLight.position.set(z, 0, -z)
}

/*
 * Move object to the center.
 */
const resetObjectPosition = (boundingBox, object) => {
  const size = new THREE.Vector3()
  boundingBox.setFromObject(object)
  boundingBox.getSize(size)
  object.position.x = -boundingBox.min.x - size.x / 2
  object.position.y = -boundingBox.min.y - size.y / 2
  object.position.z = -boundingBox.min.z - size.z / 2
  object.rotation.z = 0
}

export {
  prepareScene, loadObject, clearScene, resetCamera, goFullScreen
}
