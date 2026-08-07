import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

export async function speakText(text: string, lang = 'vi-VN') {
  if (!Capacitor.isNativePlatform()) return
  try {
    await TextToSpeech.stop()
    await TextToSpeech.speak({
      text,
      lang,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
    })
  } catch (e) {
    console.warn('TTS not available:', e)
  }
}
