
// ============================================================================
// 設定エリア: 各マーカーの挙動（速さ、大きさ、時間）をここで変更できます
// ============================================================================
export const MARKER_CONFIG = {
  // 右折するマーカー
  'Ichi_Start_RightTurn': {
    type: 'turn_sequence',
    model: '#ichiModel',   // 使用する3DモデルのID
    message: 'スタート【右折】開始', // 画面に表示するメッセージ
    speed: 6.0,            // 移動速度 (m/s)
    scale: 1.0,            // モデルの大きさ
    timeBeforeTurn: 10000,  // 曲がるまでの直進時間 (ミリ秒)
    turnAngle: -90,        // 曲がる角度 (度数法。マイナスで右、プラスで左)
    timeAfterTurn: 1000,   // 曲がった後の直進時間 (ミリ秒)
  },

  // 左折するマーカー
  'Hon_Start_LeftTurn': {
    type: 'turn_sequence',
    model: '#ichiModel',
    message: 'スタート【左折】開始',
    speed: 9.6,
    scale: 1.0,
    timeBeforeTurn: 10000,
    turnAngle: 90,
    timeAfterTurn: 1000,
  },

  // 階段を降りるマーカー（既存）
  'GoDownTheStairsMarker': {
    type: 'turn_sequence',
    model: '#ichiModel',
    message: '【階段モード】',
    speed: 4.3,
    scale: 1.0,
    timeBeforeTurn: 3000, // 30秒直進
    turnAngle: -90,        // 右へ90度
    timeAfterTurn: 1000,  // 10秒直進して消える
  },

  // ゴールマーカー（既存）
  'HonIchi_Goal2': {
    type: 'goal',
    model: '#goalModel',
    message: '【ゴール】認識！',
    scale: 2.0,
  }
}

// ============================================================================
// システムロジック
// ============================================================================

export const markerMoveComponent = {
  schema: {
    // これらのプロパティは MARKER_CONFIG から動的に反映されるキャッシュ用
    speed: { default: 0.5 },
    modelScale: { default: 5.0 },
    timeBeforeTurn: { default: 3000 },
    timeAfterTurn: { default: 3000 },
    turnAngle: { default: 0 },
  },

  init() {
    this.prompt = document.getElementById('promptText')
    this.ground = document.getElementById('ground')
    this.sceneEl = this.el.sceneEl
    this.camera = document.getElementById('camera')
    this.modelDirection = new THREE.Vector3()
    this.modelEntity = null
    this.state = 'scanning-marker'

    this.currentMarkerName = null
    this.currentConfig = null
    this.timer1 = null
    this.timer2 = null

    this.el.addEventListener('xrimagefound', e => this.onImageFound(e))
    this.ground.addEventListener('click', e => this.onGroundClick(e))
  },

  // UIから設定が変更された時に呼ばれる
  updateCurrentMarkerSettings() {
    if (!this.currentMarkerName) return

    const config = MARKER_CONFIG[this.currentMarkerName]
    if (!config) return

    // コンポーネントのプロパティを更新（これで this.data が最新になる）
    this.el.setAttribute('marker-move', {
      speed: config.speed !== undefined ? config.speed : 0.5,
      modelScale: config.scale !== undefined ? config.scale : 5.0,
      timeBeforeTurn: config.timeBeforeTurn !== undefined ? config.timeBeforeTurn : 3000,
      timeAfterTurn: config.timeAfterTurn !== undefined ? config.timeAfterTurn : 3000,
      turnAngle: config.turnAngle !== undefined ? config.turnAngle : 0
    })

    // すでにモデルが表示されている場合は、即座にスケールなどを反映
    if (this.modelEntity) {
      const s = this.data.modelScale
      this.modelEntity.setAttribute('scale', `${s} ${s} ${s}`)

      const principals = document.querySelectorAll('[gltf-model="#principalModel"]')
      const pScale = s * 2
      principals.forEach(p => p.setAttribute('scale', `${pScale} ${pScale} ${pScale}`))
    }
  },

  onImageFound(event) {
    if (this.state === 'moving' || this.state === 'goal-display') return

    const markerName = event.detail.name
    const config = MARKER_CONFIG[markerName]
    if (!config) return

    this.currentMarkerName = markerName
    this.currentConfig = config

    // 現在の設定を反映
    this.updateCurrentMarkerSettings()

    const cameraQuaternion = this.camera.object3D.quaternion
    const euler = new THREE.Euler().setFromQuaternion(cameraQuaternion, 'YXZ')
    const yawOnlyQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0))

    let baseDirection = new THREE.Vector3(0, 0, -1)
    baseDirection.applyQuaternion(yawOnlyQuaternion)
    this.modelDirection.copy(baseDirection)

    this.state = 'scanning-surface'
    this.prompt.style.display = 'block'
    this.prompt.innerHTML = `${config.message}<br>地面をタップして配置`
  },

  onGroundClick(event) {
    if (this.state === 'moving' || this.state === 'goal-display') {
      this.resetModel()
      return
    }
    if (this.state !== 'scanning-surface' || !this.currentConfig) return

    this.prompt.style.display = 'none'
    const touchPoint = event.detail.intersection.point

    // ===============================================
    // メインモデルの生成
    // ===============================================
    const newElement = document.createElement('a-entity')
    newElement.setAttribute('position', touchPoint)
    this.updateRotation(newElement, this.modelDirection)
    newElement.setAttribute('visible', 'false')
    newElement.setAttribute('scale', '0.0001 0.0001 0.0001')
    newElement.setAttribute('gltf-model', this.currentConfig.model)
    this.sceneEl.appendChild(newElement)
    this.modelEntity = newElement

    // ===============================================
    // 【新機能】ゴールの時の校長先生出現確率 (46%)
    // ===============================================
    let principalEntity = null
    if (this.currentConfig.type === 'goal') {
      if (Math.random() <= 0.46) { // 46%以下の確率
        principalEntity = document.createElement('a-entity')

        // メインモデルの少し横に配置
        const offset = new THREE.Vector3(1.5, 0, 0)
        offset.applyQuaternion(newElement.object3D.quaternion)
        const pPos = touchPoint.clone().add(offset)

        principalEntity.setAttribute('position', pPos)
        this.updateRotation(principalEntity, this.modelDirection)

        principalEntity.setAttribute('visible', 'false')
        principalEntity.setAttribute('scale', '0.0001 0.0001 0.0001')
        // 【変更】 .glb に対応したIDを使用
        principalEntity.setAttribute('gltf-model', '#principalModel')
        this.sceneEl.appendChild(principalEntity)
      }
    }

    newElement.addEventListener('model-loaded', () => {
      // ユーザー設定値は this.data (UIから更新される) を使う
      if (this.currentConfig.type === 'goal') {
        const currentRotation = newElement.getAttribute('rotation')
        newElement.setAttribute('rotation', {
          x: currentRotation.x,
          y: currentRotation.y + 180,
          z: currentRotation.z
        })
      }

      newElement.setAttribute('visible', 'true')
      newElement.setAttribute('animation-mixer', { clip: '*', loop: 'repeat' })

      const targetScale = this.data.modelScale
      newElement.setAttribute('animation', {
        property: 'scale',
        to: `${targetScale} ${targetScale} ${targetScale}`,
        easing: 'easeOutElastic',
        dur: 800,
        fill: 'forwards',
      })

      if (principalEntity) {
        principalEntity.addEventListener('model-loaded', () => {
          const pRot = principalEntity.getAttribute('rotation')
          principalEntity.setAttribute('rotation', {
            x: pRot.x,
            y: pRot.y + 180,
            z: pRot.z
          })
          principalEntity.setAttribute('visible', 'true')
          const pTargetScale = targetScale * 2
          principalEntity.setAttribute('animation', {
            property: 'scale',
            to: `${pTargetScale} ${pTargetScale} ${pTargetScale}`,
            easing: 'easeOutElastic',
            dur: 800,
            fill: 'forwards',
          })

          // 校長先生にもアニメーションミキサーを適用（動く場合）
          const model = principalEntity.getObject3D('mesh')
          if (model && model.animations && model.animations.length > 0) {
            console.log('Principal animations:', model.animations.map(a => a.name))
            principalEntity.setAttribute('animation-mixer', { clip: '*', loop: 'repeat' })
          } else {
            console.warn('Principal model has no animations or mesh not found')
          }
        })
      }

      setTimeout(() => {
        if (this.currentConfig.type === 'goal') {
          this.state = 'goal-display'
          this.prompt.innerHTML = 'ゴール！おめでとう！<br>(タップで終了)'
        } else {
          this.state = 'moving'
          this.prompt.innerHTML = '移動中...<br>(タップで停止)'

          if (this.currentConfig.type === 'turn_sequence') {
            this.startTurnSequence(newElement)
          }
        }
        this.prompt.style.display = 'block'
      }, 800)
    })
  },

  startTurnSequence(entity) {
    this.timer1 = setTimeout(() => {
      if (!this.modelEntity) return

      const axis = new THREE.Vector3(0, 1, 0)
      const radians = (this.data.turnAngle * Math.PI) / 180
      this.modelDirection.applyAxisAngle(axis, radians)
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
    this.currentConfig = null
    this.currentMarkerName = null

    if (this.timer1) clearTimeout(this.timer1)
    if (this.timer2) clearTimeout(this.timer2)

    if (this.modelEntity) {
      this.modelEntity.parentNode.removeChild(this.modelEntity)
      this.modelEntity = null
    }

    const principals = document.querySelectorAll('[gltf-model="#principalModel"]')
    principals.forEach(p => p.parentNode.removeChild(p))

    this.prompt.innerHTML = 'マーカーをスキャンしてください'
    this.prompt.style.display = 'block'
  },

  updateRotation(entity, direction) {
    const angle = Math.atan2(direction.x, direction.z)
    entity.setAttribute('rotation', `0 ${THREE.MathUtils.radToDeg(angle)} 0`)
  },

  tick(time, timeDelta) {
    if (this.state !== 'moving' || !this.modelEntity || !this.currentConfig) return
    if (this.currentConfig.type === 'goal') return

    const speed = this.data.speed
    const moveVector = this.modelDirection.clone().multiplyScalar(speed * (timeDelta / 1000))
    this.modelEntity.object3D.position.add(moveVector)
  },
}
