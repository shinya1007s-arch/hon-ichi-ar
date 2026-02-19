export const cameraToggleComponent = {
  init() {
    const btn = document.getElementById('camBtn');
    const sky = document.getElementById('cameraMask');
    let isCameraOn = true;

    btn.addEventListener('click', () => {
      isCameraOn = !isCameraOn;
      if (isCameraOn) {
        sky.setAttribute('visible', 'false');
        btn.innerText = 'Camera OFF';
      } else {
        sky.setAttribute('visible', 'true');
        btn.innerText = 'Camera ON';
      }
    });
  },
};