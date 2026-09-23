package app.flatrate.mobility;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Keeps one ongoing notification alive for the whole active journey and updates
 * its text from a pre-computed timeline, so it also works while the app is
 * closed, in the background or the screen is off (and mirrors to a watch).
 */
public class TripLiveService extends Service {
    public static final String CHANNEL_ID = "flatrate_trip_live";
    private static final int NOTIFICATION_ID = 8701;
    private static final long TICK_MS = 20000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private JSONArray steps = new JSONArray();
    private JSONArray segments = new JSONArray();
    private long startsAt = 0L;
    private long endsAt = 0L;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (endsAt > 0 && System.currentTimeMillis() > endsAt + 300000L) {
                stopSelf();
                return;
            }
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.notify(NOTIFICATION_ID, build());
            syncWatch(true);
            handler.postDelayed(this, TICK_MS);
        }
    };

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "stop".equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (intent != null) {
            String raw = intent.getStringExtra("steps");
            try {
                steps = raw == null ? new JSONArray() : new JSONArray(raw);
            } catch (Exception ignored) {
                steps = new JSONArray();
            }
            String rawSegments = intent.getStringExtra("segments");
            try {
                segments = rawSegments == null ? new JSONArray() : new JSONArray(rawSegments);
            } catch (Exception ignored) {
                segments = new JSONArray();
            }
            startsAt = intent.getLongExtra("startsAt", 0L);
            endsAt = intent.getLongExtra("endsAt", 0L);
        }
        createChannel();
        startForeground(NOTIFICATION_ID, build());
        syncWatch(true);
        handler.removeCallbacks(tick);
        handler.postDelayed(tick, TICK_MS);
        return START_REDELIVER_INTENT;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(tick);
        syncWatch(false);
        stopForeground(true);
        super.onDestroy();
    }

    private void syncWatch(boolean active) {
        WatchSync.send(this, steps.toString(), segments.toString(), startsAt, endsAt, active);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Laufende Reise", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Zeigt deine aktive Reise dauerhaft in den Benachrichtigungen.");
        channel.setShowBadge(false);
        channel.enableVibration(false);
        channel.setSound(null, null);
        manager.createNotificationChannel(channel);
    }

    /** The step that applies right now: the last one whose time has passed. */
    private JSONObject currentStep() {
        long now = System.currentTimeMillis();
        JSONObject current = null;
        for (int i = 0; i < steps.length(); i += 1) {
            JSONObject step = steps.optJSONObject(i);
            if (step == null) continue;
            if (current == null || step.optLong("at", 0L) <= now) current = step;
            if (step.optLong("at", 0L) > now) break;
        }
        return current;
    }

    private Notification build() {
        JSONObject step = currentStep();
        String title = step == null ? "Reise läuft" : step.optString("title", "Reise läuft");
        String body = step == null ? "" : step.optString("body", "");

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        if (Build.VERSION.SDK_INT >= 36) {
            return buildLiveUpdate(title, body, contentIntent);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_LOW);

        int max = progressMax();
        builder.setProgress(max, progressNow(max), false);

        JSONArray lines = step == null ? null : step.optJSONArray("lines");
        if (lines != null && lines.length() > 0) {
            NotificationCompat.InboxStyle style = new NotificationCompat.InboxStyle();
            style.setBigContentTitle(title);
            style.setSummaryText(body);
            for (int i = 0; i < lines.length() && i < 7; i += 1) {
                style.addLine(lines.optString(i, ""));
            }
            builder.setStyle(style);
        }
        return builder.build();
    }

    /** Android 16's native progress-centric, promotable Live Update. */
    private Notification buildLiveUpdate(String title, String body, PendingIntent contentIntent) {
        Notification.ProgressStyle style = new Notification.ProgressStyle()
                .setStyledByProgress(true)
                .setProgressStartIcon(Icon.createWithResource(this, R.drawable.ic_trip_start))
                .setProgressTrackerIcon(Icon.createWithResource(this, R.drawable.ic_trip_tracker))
                .setProgressEndIcon(Icon.createWithResource(this, R.drawable.ic_trip_end));

        int total = 0;
        for (int i = 0; i < segments.length(); i += 1) {
            JSONObject segment = segments.optJSONObject(i);
            if (segment == null) continue;
            int length = segmentLength(segment);
            int color = "walk".equals(segment.optString("kind"))
                    ? Color.rgb(100, 116, 139)
                    : Color.rgb(14, 165, 164);
            style.addProgressSegment(new Notification.ProgressStyle.Segment(length)
                    .setId(i + 1)
                    .setColor(color));
            total += length;
            if (i < segments.length() - 1) {
                style.addProgressPoint(new Notification.ProgressStyle.Point(total)
                        .setId(i + 1)
                        .setColor(Color.rgb(245, 197, 66)));
            }
        }
        if (total == 0) {
            total = progressMax();
            style.addProgressSegment(new Notification.ProgressStyle.Segment(total)
                    .setId(1)
                    .setColor(Color.rgb(14, 165, 164)));
        }
        style.setProgress(progressNow(total));

        Bundle liveUpdateExtras = new Bundle();
        liveUpdateExtras.putBoolean(NotificationCompat.EXTRA_REQUEST_PROMOTED_ONGOING, true);
        Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(contentIntent)
                .setStyle(style)
                .setOngoing(true)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_NAVIGATION)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .addExtras(liveUpdateExtras)
                .setShortCriticalText(criticalText())
                .setWhen(endsAt > 0 ? endsAt : System.currentTimeMillis())
                .setShowWhen(true);
        return builder.build();
    }

    private int segmentLength(JSONObject segment) {
        long start = segment.optLong("startAt", startsAt);
        long end = segment.optLong("endAt", start + 60000L);
        return (int) Math.max(1L, Math.min(86400L, (end - start) / 1000L));
    }

    private int progressMax() {
        long duration = Math.max(1L, endsAt - startsAt);
        return (int) Math.max(1L, Math.min(86400L, duration / 1000L));
    }

    private int progressNow(int max) {
        if (endsAt <= startsAt) return 0;
        double ratio = (double) (System.currentTimeMillis() - startsAt) / (double) (endsAt - startsAt);
        return (int) Math.max(0, Math.min(max, Math.round(ratio * max)));
    }

    private String criticalText() {
        if (endsAt <= 0) return "Live";
        long minutes = Math.max(0L, (endsAt - System.currentTimeMillis() + 59999L) / 60000L);
        if (minutes == 0) return "Jetzt";
        if (minutes < 60) return minutes + " min";
        return "Live";
    }
}
