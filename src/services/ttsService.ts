import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { SystemVolume } from '@/plugins/systemVolume.plugin'

const IMPORTANT_TTS_MIN_VOLUME = 0.5

/** TTS quan trọng: tăng volume tạm nếu quá nhỏ, đọc xong restore (nếu user không chỉnh tay). */
export async function speakImportantText(text: string, lang = 'vi-VN'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  let originalVolume: number | null = null
  let forcedVolume: number | null = null
  let maxVolume: number | null = null

  try {
    const volumeState = await SystemVolume.getMediaVolume()

    originalVolume = volumeState.current
    maxVolume = volumeState.max

    if (volumeState.percent < IMPORTANT_TTS_MIN_VOLUME) {
      const result = await SystemVolume.setMediaVolume({
        percent: IMPORTANT_TTS_MIN_VOLUME,
      })

      forcedVolume = result.current
    }

    await TextToSpeech.stop()
    await TextToSpeech.speak({
      text,
      lang,
      rate: 1,
      pitch: 1,
      volume: 1,
    })
  } catch (error) {
    console.warn('[Important TTS] Failed:', error)
  } finally {
    if (originalVolume === null || forcedVolume === null || maxVolume === null) {
      return
    }

    try {
      const currentVolume = await SystemVolume.getMediaVolume()

      // Chỉ restore nếu người dùng không tự chỉnh volume trong lúc TTS đang đọc.
      if (currentVolume.current === forcedVolume) {
        await SystemVolume.setMediaVolume({
          percent: originalVolume / maxVolume,
        })
      }
    } catch (error) {
      console.warn('[Important TTS] Restore volume failed:', error)
    }
  }
}
