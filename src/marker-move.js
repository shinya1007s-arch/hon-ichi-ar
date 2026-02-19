
// ============================================================================
// 設定エリア: 各マーカーの挙動（速さ、大きさ、時間）をここで変更できます
// ============================================================================
const MARKER_CONFIG = {
  // 右折するマーカー
  'Ichi_Start_RightTurn': {
    type: 'turn_sequence',
    model: '#ichiModel',   // 使用する3DモデルのID
    message: 'スタート【右折】開始', // 画面に表示するメッセージ
    speed: 0.5,            // 移動速度 (m/s)
    scale: 5.0,            // モデルの大きさ
    timeBeforeTurn: 3000,  // 曲がるまでの直進時間 (ミリ秒)
    turnAngle: -90,        // 曲がる角度 (度数法。マイナスで右、プラスで左)
    timeAfterTurn: 3000,   // 曲がった後の直進時間 (ミリ秒)
  },

  // 左折するマーカー
  'Hon_Start_LeftTurn': {
    type: 'turn_sequence',
    model: '#ichiModel',
    message: 'スタート【左折】開始',
    speed: 0.5,
    scale: 5.0,
    timeBeforeTurn: 3000,
    turnAngle: 90,
    timeAfterTurn: 3000,
  },

  // 階段を降りるマーカー（既存）
  'GoDownTheStairsMarker': {
    type: 'turn_sequence',
    model: '#ichiModel',
    message: '【階段モード】',
    speed: 0.5,
    scale: 5.0,
    timeBeforeTurn: 30000, // 30秒直進
    turnAngle: -90,        // 右へ90度
    timeAfterTurn: 10000,  // 10秒直進して消える
  },

  // ゴールマーカー（既存）
  'HonIchi_Goal2': {
    type: 'goal',
    model: '#goalModel',
    message: '【ゴール】認識！',
    scale: 5.0,
  }
}

// ============================================================================
// システムロジック
// ============================================================================

export const markerMoveComponent = {
  schema: {
    // これらのプロパティは setAttribute で外部から変更可能です（UIスラッシュ等）
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

    // 現在認識しているマーカーの静的設定（モデルIDやメッセージなど）
    this.currentConfig = null
    this.timer1 = null
    this.timer2 = null

    // UI要素の参照（認識時に値をセットするため）
    this.uiElements = {
      speed: document.getElementById('speedRange'),
      scale: document.getElementById('scaleRange'),
      before: document.getElementById('beforeRange'),
      after: document.getElementById('afterRange'),
      valSpeed: document.getElementById('val-speed'),
      valScale: document.getElementById('val-scale'),
      valBefore: document.getElementById('val-before'),
      valAfter: document.getElementById('val-after'),
    }

    this.el.addEventListener('xrimagefound', e => this.onImageFound(e))
    this.ground.addEventListener('click', e => this.onGroundClick(e))
  },

  update(oldData) {
    if (this.modelEntity && this.data.modelScale !== oldData.modelScale) {
      const s = this.data.modelScale
      this.modelEntity.setAttribute('scale', `${s} ${s} ${s}`)

      // 校長先生も追従させる
      const principals = document.querySelectorAll('[gltf-model="#principalModel"]')
      principals.forEach(p => p.setAttribute('scale', `${s} ${s} ${s}`))
    }
  },

  onImageFound(event) {
    if (this.state === 'moving' || this.state === 'goal-display') return

    const markerName = event.detail.name
    const config = MARKER_CONFIG[markerName]

    if (!config) return

    this.currentConfig = config

    // 【UI連携】現在のマーカーの設定値をコンポーネント自身に反映させる
    // これにより、UIの初期値がマーカーの設定と一致し、スライダー操作も有効になる
    const newSpeed = config.speed !== undefined ? config.speed : 0.5
    const newScale = config.scale !== undefined ? config.scale : 5.0
    const newBefore = config.timeBeforeTurn !== undefined ? config.timeBeforeTurn : 3000
    const newAfter = config.timeAfterTurn !== undefined ? config.timeAfterTurn : 3000
    const newAngle = config.turnAngle !== undefined ? config.turnAngle : 0

    this.el.setAttribute('marker-move', {
      speed: newSpeed,
      modelScale: newScale,
      timeBeforeTurn: newBefore,
      timeAfterTurn: newAfter,
      turnAngle: newAngle
    })

    // UIのスライダーと表示数値も更新する
    if (this.uiElements.speed) {
      this.uiElements.speed.value = newSpeed
      this.uiElements.valSpeed.innerText = newSpeed
    }
    if (this.uiElements.scale) {
      this.uiElements.scale.value = newScale
      this.uiElements.valScale.innerText = newScale
    }
    if (this.uiElements.before) {
      // UIは「秒」単位、内部は「ミリ秒」単位なので変換
      const sec = newBefore / 1000
      this.uiElements.before.value = sec
      this.uiElements.valBefore.innerText = sec
    }
    if (this.uiElements.after) {
      const sec = newAfter / 1000
      this.uiElements.after.value = sec
      this.uiElements.valAfter.innerText = sec
    }

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
        // メインモデルの少し横（ローカル座標系で X+1.5m くらい）に配置したいが、
        // 簡易的にワールド座標で少しずらす（完全に重ならないように）
        const offset = new THREE.Vector3(1.5, 0, 0)
        offset.applyQuaternion(newElement.object3D.quaternion) // メインモデルの向きに合わせて横にずらす
        const pPos = touchPoint.clone().add(offset)

        principalEntity.setAttribute('position', pPos)
        // 校長先生もこちらを向く（またはメインモデルと同じ向き）
        this.updateRotation(principalEntity, this.modelDirection)

        principalEntity.setAttribute('visible', 'false')
        principalEntity.setAttribute('scale', '0.0001 0.0001 0.0001')
        principalEntity.setAttribute('gltf-model', '#principalModel')
        this.sceneEl.appendChild(principalEntity)

        // ゴールなので180度反転（校長先生も）
        // 注: まだロードされていないのでここではrotation属性だけセットしておく手もあるが、
        // ロードイベント内で処理する方が安全。
      }
    }

    newElement.addEventListener('model-loaded', () => {
      const config = this.currentConfig // ここでは this.currentConfig を参照（静的プロパティ用）
      // 数値系は this.data を参照する（UI調整後かもしれないので）

      if (config.type === 'goal') {
        const currentRotation = newElement.getAttribute('rotation')
        newElement.setAttribute('rotation', {
          x: currentRotation.x,
          y: currentRotation.y + 180,
          z: currentRotation.z
        })
      }

      newElement.setAttribute('visible', 'true')
      newElement.setAttribute('animation-mixer', { clip: '*', loop: 'repeat' })

      const targetScale = this.data.modelScale // 【変更】this.data (UI値) を使用
      newElement.setAttribute('animation', {
        property: 'scale',
        to: `${targetScale} ${targetScale} ${targetScale}`,
        easing: 'easeOutElastic',
        dur: 800,
        fill: 'forwards',
      })

      // 校長先生がいる場合のアニメーションと回転設定
      if (principalEntity) {
        principalEntity.addEventListener('model-loaded', () => {
          // 校長先生も180度反転（ゴール時）
          const pRot = principalEntity.getAttribute('rotation')
          principalEntity.setAttribute('rotation', {
            x: pRot.x,
            y: pRot.y + 180,
            z: pRot.z
          })
          principalEntity.setAttribute('visible', 'true')
          // 校長先生は少し小さめかもしれないが、とりあえず同じスケール設定にする
          principalEntity.setAttribute('animation', {
            property: 'scale',
            to: `${targetScale} ${targetScale} ${targetScale}`,
            easing: 'easeOutElastic',
            dur: 800,
            fill: 'forwards',
          })
        })
      }

      setTimeout(() => {
        if (config.type === 'goal') {
          this.state = 'goal-display'
          this.prompt.innerHTML = 'ゴール！おめでとう！<br>(タップで終了)'
        } else {
          this.state = 'moving'
          this.prompt.innerHTML = '移動中...<br>(タップで停止)'

          if (config.type === 'turn_sequence') {
            this.startTurnSequence(newElement)
          }
        }
        this.prompt.style.display = 'block'
      }, 800)
    })
  },

  startTurnSequence(entity) {
    // 【変更】 config ではなく this.data (UI値) を使用する

    // 1. 指定時間後に曲がる
    this.timer1 = setTimeout(() => {
      if (!this.modelEntity) return

      const axis = new THREE.Vector3(0, 1, 0)
      const radians = (this.data.turnAngle * Math.PI) / 180
      this.modelDirection.applyAxisAngle(axis, radians)
      this.updateRotation(entity, this.modelDirection)

    }, this.data.timeBeforeTurn)

    // 2. さらに指定時間後に消える（合計時間後）
    const totalTime = this.data.timeBeforeTurn + this.data.timeAfterTurn
    this.timer2 = setTimeout(() => {
      if (!this.modelEntity) return
      this.resetModel()
    }, totalTime)
  },

  resetModel() {
    this.state = 'scanning-marker'
    this.currentConfig = null

    if (this.timer1) clearTimeout(this.timer1)
    if (this.timer2) clearTimeout(this.timer2)

    if (this.modelEntity) {
      this.modelEntity.parentNode.removeChild(this.modelEntity)
      this.modelEntity = null
    }

    // 校長先生も消す必要があるが、this.modelEntityしか保持していない...
    // 簡易的に、シーン内の #principalModel を持つエンティティを全て消す
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

    const speed = this.data.speed // 【変更】this.data (UI値) を使用
    const moveVector = this.modelDirection.clone().multiplyScalar(speed * (timeDelta / 1000))
    this.modelEntity.object3D.position.add(moveVector)
  },
}
