package app.flatrate.mobility;

import com.google.android.gms.wearable.DataEvent;
import com.google.android.gms.wearable.DataEventBuffer;
import com.google.android.gms.wearable.DataMap;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.WearableListenerService;

/** Receives the active journey from the phone and mirrors it as a live notification. */
public class WatchTripListener extends WearableListenerService {
    @Override
    public void onDataChanged(DataEventBuffer events) {
        for (DataEvent event : events) {
            String path = event.getDataItem().getUri().getPath();
            if ("/flatrate/tickets".equals(path)) {
                if (event.getType() == DataEvent.TYPE_DELETED) {
                    getSharedPreferences(WatchTripNotification.PREFS, MODE_PRIVATE).edit().remove("tickets").apply();
                } else {
                    DataMap tickets = DataMapItem.fromDataItem(event.getDataItem()).getDataMap();
                    getSharedPreferences(WatchTripNotification.PREFS, MODE_PRIVATE).edit()
                            .putString("tickets", tickets.getString("tickets", "[]")).apply();
                }
                continue;
            }
            if (!"/flatrate/trip".equals(path)) continue;
            if (event.getType() == DataEvent.TYPE_DELETED) {
                WatchTripNotification.cancel(this);
                continue;
            }
            DataMap map = DataMapItem.fromDataItem(event.getDataItem()).getDataMap();
            if (map.getBoolean("active", false)) {
                WatchTripNotification.show(this,
                        map.getString("steps", "[]"),
                        map.getString("segments", "[]"),
                        map.getLong("startsAt", 0L),
                        map.getLong("endsAt", 0L));
            } else {
                WatchTripNotification.cancel(this);
            }
        }
    }
}
