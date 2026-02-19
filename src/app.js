import './index.css'

import { markerMoveComponent } from './marker-move'
import { cameraToggleComponent } from './camera-toggle'
import { settingsUiComponent } from './settings-ui'

AFRAME.registerComponent('marker-move', markerMoveComponent)
AFRAME.registerComponent('camera-toggle', cameraToggleComponent)
AFRAME.registerComponent('settings-ui', settingsUiComponent)

const onxrloaded = () => {
    XR8.XrController.configure({
        imageTargetData: [
            // require('../image-targets/ForwardMarker.json'),
            // require('../image-targets/BackMarker.json'),
            // require('../image-targets/LeftMarker.json'),
            // require('../image-targets/RightMarker.json'),
            require('../image-targets/GoDownTheStairsMarker.json'),
            require('../image-targets/HonIchi_Goal2.json'),
            require('../image-targets/Ichi_Start_RightTurn.json'),
            require('../image-targets/Hon_Start_LeftTurn.json'),
        ],
    })
}
window.XR8 ? onxrloaded() : window.addEventListener('xrloaded', onxrloaded)