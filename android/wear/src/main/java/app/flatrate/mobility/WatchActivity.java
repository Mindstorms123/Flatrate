package app.flatrate.mobility;

import android.Manifest;
import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Watch screen: half-circle stage dial; double pinch, tap or crown moves through the stages. */
public class WatchActivity extends Activity {
    private TripDial dial;
    private float crown = 0f;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable tick = new Runnable() {
        @Override public void run() { render(); handler.postDelayed(this, 15000); }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setBackgroundColor(0xFF000000);
        dial = new TripDial(this);
        dial.setFocusable(true);
        dial.setFocusableInTouchMode(true);
        dial.setOnClickListener(v -> dial.step(1));
        dial.setHapticFeedbackEnabled(true);
        setContentView(dial);
        dial.requestFocus();
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
        }
    }

    @Override
    public boolean onGenericMotionEvent(MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_SCROLL
                && event.isFromSource(InputDevice.SOURCE_ROTARY_ENCODER)) {
            crown += -event.getAxisValue(MotionEvent.AXIS_SCROLL);
            if (Math.abs(crown) >= 1f) {
                dial.step(crown > 0 ? 1 : -1);
                crown = 0f;
            }
            return true;
        }
        return super.onGenericMotionEvent(event);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_NAVIGATE_NEXT:
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_STEM_1:
            case KeyEvent.KEYCODE_STEM_2:
                dial.step(1);
                return true;
            case KeyEvent.KEYCODE_NAVIGATE_PREVIOUS:
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_DPAD_LEFT:
                dial.step(-1);
                return true;
            case KeyEvent.KEYCODE_BACK:
            case KeyEvent.KEYCODE_HOME:
            case KeyEvent.KEYCODE_POWER:
            case KeyEvent.KEYCODE_STEM_PRIMARY:
                return super.onKeyDown(keyCode, event);
            default:
                dial.step(1);
                return true;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        dial.requestFocus();
        handler.post(tick);
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(tick);
    }

    private void render() {
        SharedPreferences prefs = getSharedPreferences(WatchTripNotification.PREFS, MODE_PRIVATE);
        String raw = prefs.getString("steps", null);
        long startsAt = prefs.getLong("startsAt", 0L);
        long endsAt = prefs.getLong("endsAt", 0L);
        List<TripDial.Stage> stages = new ArrayList<>();
        if (raw == null) {
            dial.setTrip(stages, 0f, "Flatrate", "Hinterlege eine Reise auf dem Handy – sie erscheint dann live hier.", "Keine Reise");
            return;
        }
        float progress = endsAt > startsAt
                ? (float) (System.currentTimeMillis() - startsAt) / (float) (endsAt - startsAt) : 0f;
        JSONObject step = WatchTripNotification.currentStep(raw);
        JSONArray lines = step == null ? null : step.optJSONArray("lines");
        if (lines != null) {
            for (int i = 0; i < lines.length(); i += 1) {
                TripDial.Stage s = new TripDial.Stage();
                s.text = lines.optString(i);
                s.state = s.text.isEmpty() ? '·' : s.text.charAt(0);
                stages.add(s);
            }
        }
        dial.setTrip(stages, progress,
                step == null ? "Reise läuft" : step.optString("title"),
                step == null ? "" : step.optString("body"),
                WatchTripNotification.criticalText(endsAt));
    }
}
