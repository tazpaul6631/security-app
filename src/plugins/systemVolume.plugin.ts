import { registerPlugin } from '@capacitor/core'

export interface MediaVolumeState {
  current: number
  max: number
  percent: number
}

interface SystemVolumePlugin {
  getMediaVolume(): Promise<MediaVolumeState>

  setMediaVolume(options: { percent: number }): Promise<{
    current: number
    max: number
  }>
}

export const SystemVolume = registerPlugin<SystemVolumePlugin>('SystemVolume')
