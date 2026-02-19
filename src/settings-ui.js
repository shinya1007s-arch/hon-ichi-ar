export const settingsUiComponent = {
  init() {
    const scene = this.el;
    const panel = document.getElementById('settingsPanel');
    const toggleBtn = document.getElementById('toggleSettingsBtn');
    
    const speedInp = document.getElementById('speedRange');
    const scaleInp = document.getElementById('scaleRange');
    const beforeInp = document.getElementById('beforeRange');
    const afterInp = document.getElementById('afterRange');

    const valSpeed = document.getElementById('val-speed');
    const valScale = document.getElementById('val-scale');
    const valBefore = document.getElementById('val-before');
    const valAfter = document.getElementById('val-after');

    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      toggleBtn.innerText = panel.classList.contains('hidden') ? '⚙️ 設定を開く' : '✖️ 設定を閉じる';
    });

    const updateSettings = () => {
      valSpeed.innerText = speedInp.value;
      valScale.innerText = scaleInp.value;
      valBefore.innerText = beforeInp.value;
      valAfter.innerText = afterInp.value;

      scene.setAttribute('marker-move', {
        speed: parseFloat(speedInp.value),
        modelScale: parseFloat(scaleInp.value),
        timeBeforeTurn: parseInt(beforeInp.value) * 1000,
        timeAfterTurn: parseInt(afterInp.value) * 1000
      });
    };

    [speedInp, scaleInp, beforeInp, afterInp].forEach(inp => {
      inp.addEventListener('input', updateSettings);
    });
  }
}