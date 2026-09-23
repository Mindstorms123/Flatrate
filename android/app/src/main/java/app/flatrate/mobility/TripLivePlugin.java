package app.flatrate.mobility;

import android.content.Intent;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Starts and stops the ongoing live-journey notification. */
@CapacitorPlugin(name = "TripLive")
public class TripLivePlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        JSArray steps = call.getArray("steps");
        JSArray segments = call.getArray("segments");
        long startsAt = call.getData().optLong("startsAt", 0L);
        long endsAt = call.getData().optLong("endsAt", 0L);
        Intent intent = new Intent(getContext(), TripLiveService.class);
        intent.putExtra("steps", steps == null ? "[]" : steps.toString());
        intent.putExtra("segments", segments == null ? "[]" : segments.toString());
        intent.putExtra("startsAt", startsAt);
        intent.putExtra("endsAt", endsAt);
        try {
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (Exception error) {
            call.reject("Live-Benachrichtigung konnte nicht gestartet werden", error);
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), TripLiveService.class));
        call.resolve();
    }
}
