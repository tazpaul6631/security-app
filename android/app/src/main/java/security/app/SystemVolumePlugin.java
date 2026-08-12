package security.app;

import android.content.Context;
import android.media.AudioManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemVolume")
public class SystemVolumePlugin extends Plugin {

    private AudioManager getAudioManager() {
        return (AudioManager) getContext()
            .getSystemService(Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public void getMediaVolume(PluginCall call) {
        AudioManager audioManager = getAudioManager();

        int current = audioManager.getStreamVolume(
            AudioManager.STREAM_MUSIC
        );

        int max = audioManager.getStreamMaxVolume(
            AudioManager.STREAM_MUSIC
        );

        JSObject result = new JSObject();
        result.put("current", current);
        result.put("max", max);
        result.put(
            "percent",
            max > 0 ? (double) current / max : 0
        );

        call.resolve(result);
    }

    @PluginMethod
    public void setMediaVolume(PluginCall call) {
        Double percent = call.getDouble("percent");

        if (percent == null) {
            call.reject("percent is required");
            return;
        }

        AudioManager audioManager = getAudioManager();

        if (audioManager.isVolumeFixed()) {
            call.reject("Device volume is fixed");
            return;
        }

        double safePercent = Math.max(
            0.0,
            Math.min(1.0, percent)
        );

        int max = audioManager.getStreamMaxVolume(
            AudioManager.STREAM_MUSIC
        );

        int target = (int) Math.round(
            max * safePercent
        );

        try {
            audioManager.setStreamVolume(
                AudioManager.STREAM_MUSIC,
                target,
                0
            );

            JSObject result = new JSObject();
            result.put("current", target);
            result.put("max", max);

            call.resolve(result);
        } catch (SecurityException error) {
            call.reject(
                "Unable to change media volume",
                error
            );
        }
    }
}
