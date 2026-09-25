package app.flatrate.mobility;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.core.app.NotificationCompat;
import androidx.wear.ongoing.OngoingActivity;
import androidx.wear.ongoing.Status;

import org.json.JSONArray;
import org.json.JSONObject;

/** Builds the watch's own ongoing live-journey notification with progress. */
public final class WatchTripNotification {
    static final String CHANNEL_ID = "flatrate_trip_live";
    static final int ID = 8701;
    static final String PREFS = "flatrate_watch";

    private WatchTripNotification() {}

    static void show(Context context, String stepsRaw, String segmentsRaw, long startsAt, long endsAt) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString("steps", stepsRaw)
                .putLong("startsAt", startsAt)
                .putLong("endsAt", endsAt)
                .apply();

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Laufende Reise", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setSound(null, null);
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);

        JSONObject step = currentStep(stepsRaw);
        String title = step == null ? "Reise läuft" : step.optString("title", "Reise läuft");
        String body = step == null ? "" : step.optString("body", "");

        Intent open = new Intent(context, WatchActivity.class);
        PendingIntent contentIntent = PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        int max = (int) Math.max(1L, Math.min(86400L, (endsAt - startsAt) / 1000L));
        int now = 0;
        if (endsAt > startsAt) {
            double ratio = (double) (System.currentTimeMillis() - startsAt) / (double) (endsAt - startsAt);
            now = (int) Math.max(0, Math.min(max, Math.round(ratio * max)));
        }
        String chip = step == null ? "" : step.optString("chip", "");
        String critical = chip.isEmpty() ? criticalText(endsAt) : chip;

        // Kept deliberately simple: promoted/critical-text flags crash the watch's notification shade.
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_trip_tracker)
                .setContentTitle(title)
                .setContentText(critical + " · " + body)
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setProgress(max, now, false);

        try {
            OngoingActivity ongoing = new OngoingActivity.Builder(context, ID, builder)
                    .setStaticIcon(R.drawable.ic_trip_tracker)
                    .setTouchIntent(contentIntent)
                    .setStatus(new Status.Builder().addTemplate(statusText(critical, title, body)).build())
                    .build();
            ongoing.apply(context);
        } catch (Exception ignored) {
            // Watch face chip is optional.
        }

        Notification notification = builder.build();
        manager.notify(ID, notification);
    }

    /** Short chip text: remaining time plus where to go next. */
    static String statusText(String critical, String title, String body) {
        String next = title == null ? "" : title;
        if (next.length() > 18) next = next.substring(0, 17) + "…";
        return next;
    }

    static void cancel(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.cancel(ID);
    }

    static JSONObject currentStep(String raw) {
        try {
            JSONArray steps = new JSONArray(raw);
            long now = System.currentTimeMillis();
            JSONObject current = null;
            for (int i = 0; i < steps.length(); i += 1) {
                JSONObject step = steps.optJSONObject(i);
                if (step == null) continue;
                if (current == null || step.optLong("at", 0L) <= now) current = step;
                if (step.optLong("at", 0L) > now) break;
            }
            return current;
        } catch (Exception error) {
            return null;
        }
    }

    static String criticalText(long endsAt) {
        if (endsAt <= 0) return "Live";
        long minutes = Math.max(0L, (endsAt - System.currentTimeMillis() + 59999L) / 60000L);
        if (minutes == 0) return "Jetzt";
        if (minutes < 60) return minutes + " min";
        return "Live";
    }
}
