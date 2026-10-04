import type { Storyboard } from './api'

// The storyboard states size and frame rate as text ("8s, 1920x1080,
// 30fps"): in inputs.specs, else in build.render. Without them, the skill's
// defaults.
const DEFAULT_SIZE = { width: 1920, height: 1080 }
const DEFAULT_FPS = 30

function specText(storyboard: Storyboard) {
  return [storyboard.inputs?.specs, storyboard.build?.render].filter(Boolean).join(' ')
}

export function frameSize(storyboard: Storyboard) {
  const match = /(\d{3,5})\s*[x×]\s*(\d{3,5})/.exec(specText(storyboard))
  return match === null ? DEFAULT_SIZE : { width: Number(match[1]), height: Number(match[2]) }
}

export function frameRate(storyboard: Storyboard) {
  const match = /(\d{2,3})\s*fps/i.exec(specText(storyboard))
  return match === null ? DEFAULT_FPS : Number(match[1])
}

export function filmLength(storyboard: Storyboard) {
  return storyboard.shots.reduce((total, shot) => total + shot.duration, 0)
}
