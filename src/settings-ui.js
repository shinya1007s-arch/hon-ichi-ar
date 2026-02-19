
import { MARKER_CONFIG } from './marker-move'

export const settingsUiComponent = {
  init() {
    const panel = document.getElementById('settingsPanel');
    const toggleBtn = document.getElementById('toggleSettingsBtn');

    // パネルの表示切り替え
    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      toggleBtn.innerText = panel.classList.contains('hidden') ? '⚙️ 設定を開く' : '✖️ 設定を閉じる';
    });

    // MARKER_CONFIG に基づいてUIを動的に生成
    Object.keys(MARKER_CONFIG).forEach(markerName => {
      const config = MARKER_CONFIG[markerName];
      const section = document.createElement('div');
      section.className = 'marker-section';
      section.style.borderBottom = '1px solid #ccc';
      section.style.padding = '10px 0';
      section.style.marginBottom = '10px';

      // マーカー名のヘッダー
      const title = document.createElement('h3');
      title.innerText = config.message || markerName;
      title.style.margin = '0 0 10px 0';
      title.style.fontSize = '16px';
      section.appendChild(title);

      // スピード調整
      if (config.speed !== undefined) {
        this.createSlider(section, '移動速度', config.speed, 0.1, 20.0, 0.1, (val) => {
          config.speed = parseFloat(val);
          this.notifyUpdate(markerName);
        });
      }

      // 大きさ調整
      if (config.scale !== undefined) {
        this.createSlider(section, '大きさ', config.scale, 0.5, 50.0, 0.5, (val) => {
          config.scale = parseFloat(val);
          this.notifyUpdate(markerName);
        });
      }

      // ターン設定（ターンシーケンスの場合のみ）
      if (config.type === 'turn_sequence') {
        this.createSlider(section, '曲がるまで(秒)', config.timeBeforeTurn / 1000, 1, 60, 1, (val) => {
          config.timeBeforeTurn = parseInt(val) * 1000;
          this.notifyUpdate(markerName);
        });

        this.createSlider(section, '曲がった後(秒)', config.timeAfterTurn / 1000, 1, 60, 1, (val) => {
          config.timeAfterTurn = parseInt(val) * 1000;
          this.notifyUpdate(markerName);
        });

        // 角度調整も追加（隠し機能的）
        this.createSlider(section, '回転角度', config.turnAngle, -180, 180, 10, (val) => {
          config.turnAngle = parseInt(val);
          this.notifyUpdate(markerName);
        });
      }

      panel.appendChild(section);
    });
  },

  createSlider(parent, labelText, initialVal, min, max, step, callback) {
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.style.marginBottom = '5px';

    const label = document.createElement('label');
    label.innerText = `${labelText}: ${initialVal}`;
    label.style.display = 'block';
    label.style.fontSize = '12px';

    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = initialVal;
    input.style.width = '100%';

    input.addEventListener('input', (e) => {
      const val = e.target.value;
      label.innerText = `${labelText}: ${val}`;
      callback(val);
    });

    row.appendChild(label);
    row.appendChild(input);
    parent.appendChild(row);
  },

  notifyUpdate(markerName) {
    // 変更があったことをマーカーコンポーネントに通知する
    // 現在アクティブなマーカーがこれなら、即座に反映される
    const scene = this.el.sceneEl;
    if (scene && scene.components['marker-move']) {
      // 現在のマーカーが変更対象と同じ場合のみ更新
      const comp = scene.components['marker-move'];
      if (comp.currentMarkerName === markerName) {
        comp.updateCurrentMarkerSettings();
      }
    }
  }
}