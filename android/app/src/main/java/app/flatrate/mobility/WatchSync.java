package app.flatrate.mobility;

import android.content.Context;

import com.google.android.gms.wearable.PutDataMapRequest;
import com.google.android.gms.wearable.PutDataRequest;
import com.google.android.gms.wearable.Wearable;

/** Sends the active journey to the Flatrate watch app (if one is installed). */
final class WatchSync {
    private WatchSync() {}

    static void send(Context context, String steps, String segments, long startsAt, long endsAt, boolean active) {
        try {
            PutDataMapRequest map = PutDataMapRequest.create("/flatrate/trip");
            map.getDataMap().putBoolean("active", active);
            map.getDataMap().putString("steps", steps);
            map.getDataMap().putString("segments", segments);
            map.getDataMap().putLong("startsAt", startsAt);
            map.getDataMap().putLong("endsAt", endsAt);
            map.getDataMap().putLong("sentAt", System.currentTimeMillis());
            PutDataRequest request = map.asPutDataRequest().setUrgent();
            Wearable.getDataClient(context).putDataItem(request);
        } catch (Exception ignored) {
            // No watch or no Play services – the phone notification still works.
        }
    }
}
