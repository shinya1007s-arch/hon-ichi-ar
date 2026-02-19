// marker-move.js
export const markerMoveComponent = {
  schema: {
    speed: { default: 0.5 },
    modelScale: { default: 5.0 },
    timeBeforeTurn: { default: 30000 },
    timeAfterTurn: { default: 10000 },
  },

  init() {
    this.prompt = document.getElementById('promptText')
    this.ground = document.getElementById('ground')
    this.sceneEl = this.el.sceneEl
    this.camera = document.getElementById('camera')
    this.modelDirection = new THREE.Vector3()
    this.modelEntity = null
    this.state = 'scanning-marker'
    this.stairsMode = false
    this.goalMode = false
    this.timer1 = null
    this.timer2 = null

    this.el.addEventListener('xrimagefound', e => this.onImageFound(e))
    this.ground.addEventListener('click', e => this.onGroundClick(e))
  },

  onImageFound(event) {
    if (this.state === 'moving' || this.state === 'goal-display') return
    const markerName = event.detail.name
    const cameraQuaternion = this.camera.object3D.quaternion
    let baseDirection
    let promptMessage = ''
    this.stairsMode = false
    this.goalMode = false

    const euler = new THREE.Euler().setFromQuaternion(cameraQuaternion, 'YXZ')
    const yawOnlyQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0))

    switch (markerName) {
      // case 'ForwardMarker': baseDirection = new THREE.Vector3(0, 0, -1); promptMessage = '【前】へ進みます'; break
      // case 'BackMarker': baseDirection = new THREE.Vector3(0, 0, 1); promptMessage = '【後】へ進みます'; break
      // case 'LeftMarker': baseDirection = new THREE.Vector3(-1, 0, 0); promptMessage = '【左】へ進みます'; break
      // case 'RightMarker': baseDirection = new THREE.Vector3(1, 0, 0); promptMessage = '【右】へ進みます'; break
      case 'GoDownTheStairsMarker':
        baseDirection = new THREE.Vector3(0, 0, -1)
        promptMessage = '【階段モード】'
        this.stairsMode = true
        break
      case 'HonIchi_Goal2':
        baseDirection = new THREE.Vector3(0, 0, -1)
        promptMessage = '【ゴール】認識！'
        this.goalMode = true
        break
      default: return
    }

    baseDirection.applyQuaternion(yawOnlyQuaternion)
    this.modelDirection.copy(baseDirection)
    this.state = 'scanning-surface'
    this.prompt.style.display = 'block'
    this.prompt.innerHTML = `${promptMessage}<br>地面をタップして配置`
  },

  onGroundClick(event) {
    if (this.state === 'moving' || this.state === 'goal-display') {
      this.resetModel()
      return
    }
    if (this.state !== 'scanning-surface') return

    this.prompt.style.display = 'none'
    const touchPoint = event.detail.intersection.point
    const newElement = document.createElement('a-entity')
    newElement.setAttribute('position', touchPoint)

    // 基本の向き（進行方向）をセット
    this.updateRotation(newElement, this.modelDirection)
    // ※前回のここで追加した回転処理は削除しました

    newElement.setAttribute('visible', 'false')
    newElement.setAttribute('scale', '0.0001 0.0001 0.0001')

    const modelId = this.goalMode ? '#goalModel' : '#ichiModel'
    newElement.setAttribute('gltf-model', modelId)
    this.sceneEl.appendChild(newElement)
    this.modelEntity = newElement

    newElement.addEventListener('model-loaded', () => {
      // 【★修正箇所】 ゴールモードの場合のみ、モデルロード後に180度反転させる
      // Three.jsのobject3Dを直接操作して、現在のY軸回転に180度(Math.PIラジアン)を加算
      if (this.goalMode) {
        newElement.object3D.rotation.y += Math.PI
      }

      newElement.setAttribute('visible', 'true')
      newElement.setAttribute('animation-mixer', { clip: '*', loop: 'repeat' })
      const scale = this.data.modelScale
      newElement.setAttribute('animation', {
        property: 'scale',
        to: `${scale} ${scale} ${scale}`,
        easing: 'easeOutElastic',
        dur: 800,
        fill: 'forwards',
      })

      setTimeout(() => {
        if (this.goalMode) {
          this.state = 'goal-display'
          this.prompt.innerHTML = 'ゴール！おめでとう！<br>(タップで終了)'
        } else {
          this.state = 'moving'
          this.prompt.innerHTML = '移動中...<br>(タップで停止)'
          if (this.stairsMode) this.startStairsSequence(newElement)
        }
        this.prompt.style.display = 'block'
      }, 800)
    })
  },

  startStairsSequence(entity) {
    this.timer1 = setTimeout(() => {
      if (!this.modelEntity) return
      const axis = new THREE.Vector3(0, 1, 0)
      this.modelDirection.applyAxisAngle(axis, -Math.PI / 2)
      this.updateRotation(entity, this.modelDirection)
    }, this.data.timeBeforeTurn)

    const totalTime = this.data.timeBeforeTurn + this.data.timeAfterTurn
    this.timer2 = setTimeout(() => {
      if (!this.modelEntity) return
      this.resetModel()
    }, totalTime)
  },

  resetModel() {
    this.state = 'scanning-marker'
    this.goalMode = false
    this.stairsMode = false
    if (this.timer1) clearTimeout(this.timer1)
    if (this.timer2) clearTimeout(this.timer2)
    if (this.modelEntity) {
      this.modelEntity.parentNode.removeChild(this.modelEntity)
      this.modelEntity = null
    }
    this.prompt.innerHTML = 'マーカーをスキャンしてください'
    this.prompt.style.display = 'block'
  },

  updateRotation(entity, direction) {
    const angle = Math.atan2(direction.x, direction.z)
    entity.setAttribute('rotation', `0 ${THREE.MathUtils.radToDeg(angle)} 0`)
  },

  tick(time, timeDelta) {
    if (this.state !== 'moving' || !this.modelEntity || this.goalMode) return
    const moveVector = this.modelDirection.clone().multiplyScalar(this.data.speed * (timeDelta / 1000))
    this.modelEntity.object3D.position.add(moveVector)
  },
}
