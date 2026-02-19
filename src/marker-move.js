
// ============================================================================
// 設定エリア: 各マーカーの挙動（速さ、大きさ、時間）をここで変更できます
// ============================================================================
const MARKER_CONFIG = {
  // 右折するマーカー
  'Ichi_Start_RightTurn': {
    type: 'turn_sequence',
    model: '#ichiModel',   // 使用する3DモデルのID
    message: '【右折】開始', // 画面に表示するメッセージ
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
    message: '【左折】開始',
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

// 以下のマーカーは現在無効化されています（設定を残しておきたい場合はここに書いてください）
// 'ForwardMarker', 'BackMarker', 'LeftMarker', 'RightMarker' は現在使用していません

// ============================================================================
// システムロジック（ここより下は基本的に触らないでOK）
// ============================================================================

export const markerMoveComponent = {
  schema: {
    // これらのデフォルト値は MARKER_CONFIG がない場合のフォールバックとして使われます
    speed: { default: 0.5 },
    modelScale: { default: 5.0 },
  },

  init() {
    this.prompt = document.getElementById('promptText')
    this.ground = document.getElementById('ground')
    this.sceneEl = this.el.sceneEl
    this.camera = document.getElementById('camera')
    this.modelDirection = new THREE.Vector3()
    this.modelEntity = null
    this.state = 'scanning-marker'

    // 現在認識しているマーカーの設定を保持する変数
    this.currentConfig = null
    this.timer1 = null
    this.timer2 = null

    this.el.addEventListener('xrimagefound', e => this.onImageFound(e))
    this.ground.addEventListener('click', e => this.onGroundClick(e))
  },

  onImageFound(event) {
    if (this.state === 'moving' || this.state === 'goal-display') return

    const markerName = event.detail.name
    // 設定リストから該当するマーカーの設定を取得
    const config = MARKER_CONFIG[markerName]

    // 設定がない（または無効化されている）マーカーなら何もしない
    if (!config) return

    this.currentConfig = config

    const cameraQuaternion = this.camera.object3D.quaternion
    const euler = new THREE.Euler().setFromQuaternion(cameraQuaternion, 'YXZ')
    const yawOnlyQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0))

    // 基本は手前（Z軸マイナス方向）に向かってくる
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
    const newElement = document.createElement('a-entity')
    newElement.setAttribute('position', touchPoint)

    // 基本の向きをセット
    this.updateRotation(newElement, this.modelDirection)

    newElement.setAttribute('visible', 'false')
    // 初期スケールは極小にしておく（アニメーションで大きくする）
    newElement.setAttribute('scale', '0.0001 0.0001 0.0001')

    // GLTFモデルを割り当て
    newElement.setAttribute('gltf-model', this.currentConfig.model)
    this.sceneEl.appendChild(newElement)
    this.modelEntity = newElement

    newElement.addEventListener('model-loaded', () => {
      const config = this.currentConfig

      // ゴールモードの場合のみ、モデルロード後に180度反転させる（元のロジック維持）
      if (config.type === 'goal') {
        // newElement.object3D.rotation.y += Math.PI // コメントアウト: object3D直接操作はA-Frameと競合する可能性あり
        // 代わりに rotation属性を更新
        const currentRotation = newElement.getAttribute('rotation')
        newElement.setAttribute('rotation', {
          x: currentRotation.x,
          y: currentRotation.y + 180,
          z: currentRotation.z
        })
      }

      newElement.setAttribute('visible', 'true')
      newElement.setAttribute('animation-mixer', { clip: '*', loop: 'repeat' })

      // スケールアニメーション
      const targetScale = config.scale || 5.0
      newElement.setAttribute('animation', {
        property: 'scale',
        to: `${targetScale} ${targetScale} ${targetScale}`,
        easing: 'easeOutElastic',
        dur: 800,
        fill: 'forwards',
      })

      setTimeout(() => {
        if (config.type === 'goal') {
          this.state = 'goal-display'
          this.prompt.innerHTML = 'ゴール！おめでとう！<br>(タップで終了)'
        } else {
          this.state = 'moving'
          this.prompt.innerHTML = '移動中...<br>(タップで停止)'

          // ターンシーケンスがある場合のみタイマーセット
          if (config.type === 'turn_sequence') {
            this.startTurnSequence(newElement, config)
          }
        }
        this.prompt.style.display = 'block'
      }, 800)
    })
  },

  startTurnSequence(entity, config) {
    // 1. 指定時間後に曲がる
    this.timer1 = setTimeout(() => {
      if (!this.modelEntity) return

      const axis = new THREE.Vector3(0, 1, 0)
      // 角度をラジアンに変換して回転
      // 時計回りがマイナス、反時計回りがプラス
      const radians = (config.turnAngle * Math.PI) / 180

      // ベクトルを回転
      this.modelDirection.applyAxisAngle(axis, radians)

      // モデル自体の向きも更新
      this.updateRotation(entity, this.modelDirection)

    }, config.timeBeforeTurn)

    // 2. さらに指定時間後に消える（合計時間後）
    const totalTime = config.timeBeforeTurn + config.timeAfterTurn
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

    const speed = this.currentConfig.speed || 0.5
    const moveVector = this.modelDirection.clone().multiplyScalar(speed * (timeDelta / 1000))
    this.modelEntity.object3D.position.add(moveVector)
  },
}
