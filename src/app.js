import './index.css'

import {markerMoveComponent} from './marker-move'
import {cameraToggleComponent} from './camera-toggle'
import {settingsUiComponent} from './settings-ui'

AFRAME.registerComponent('marker-move', markerMoveComponent)
AFRAME.registerComponent('camera-toggle', cameraToggleComponent)
AFRAME.registerComponent('settings-ui', settingsUiComponent)