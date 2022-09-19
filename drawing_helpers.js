'use strict'

import * as THREE from 'three'
/**
 * Draw a circle in the center of the canvas.
 * Credit: http://jsfiddle.net/7yDGy/1/
 */
function generateTexture (size = 32, fillStyle = '#fff') {
  // create canvas
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  // get context
  const context = canvas.getContext('2d')
  // draw circle
  const centerX = size / 2
  const centerY = size / 2
  const radius = size / 2
  context.beginPath()
  context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false)
  context.fillStyle = fillStyle
  context.fill()
  return canvas
}

function drawBox (spaceBoundaryX, spaceBoundaryY, spaceBoundaryZ, scene) {
  const boxGeometry = new THREE.BoxGeometry(
    2 * spaceBoundaryX,
    2 * spaceBoundaryY,
    2 * spaceBoundaryZ
  )
  const boxMaterial = new THREE.MeshBasicMaterial({
    color: 0xaaaaaa,
    wireframe: true,
    opacity: 0.8
  })
  // add this object to the scene
  const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial)
  scene.add(boxMesh)
  return boxMesh
}

export { generateTexture, drawBox }
