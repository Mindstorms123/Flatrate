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
import android.view.WindowManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Watch screen: half-circle stage dial; double pinch, tap or crown moves through the stages. */
public class WatchActivity extends Activity {
    private TripDial dial;
    private TicketDial ticketDial;
    private JSONArray tickets = new JSONArray();
    private int ticketIndex = 0;
    private boolean showingTicket = false;
    private float previousBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
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
        subscribeDoublePinch();
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
                if (showingTicket) stepTicket(crown > 0 ? 1 : -1);
                else dial.step(crown > 0 ? 1 : -1);
                crown = 0f;
            }
            return true;
        }
        return super.onGenericMotionEvent(event);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && showingTicket) {
            closeTicket();
            return true;
        }
        switch (keyCode) {
            case KeyEvent.KEYCODE_NAVIGATE_NEXT:
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_STEM_1:
            case KeyEvent.KEYCODE_STEM_2:
                if (showingTicket) stepTicket(1); else dial.step(1);
                return true;
            case KeyEvent.KEYCODE_NAVIGATE_PREVIOUS:
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_DPAD_LEFT:
                if (showingTicket) stepTicket(-1); else dial.step(-1);
                return true;
            case KeyEvent.KEYCODE_BACK:
            case KeyEvent.KEYCODE_HOME:
            case KeyEvent.KEYCODE_POWER:
            case KeyEvent.KEYCODE_STEM_PRIMARY:
                return super.onKeyDown(keyCode, event);
            default:
                if (showingTicket) stepTicket(1); else dial.step(1);
                return true;
        }
    }

    private Object gestureManager;
    private java.util.function.Consumer<Object> gestureListener;

    /** Wear OS 7 one-handed gestures: double pinch = primary action = next stage. Loaded by reflection so older watches just skip it. */
    private void subscribeDoublePinch() {
        try {
            Class<?> sdk = Class.forName("com.google.wear.Sdk");
            Class<?> mgrClass = Class.forName("com.google.wear.input.GestureInputManager");
            Class<?> eventClass = Class.forName("com.google.wear.input.GestureEvent");
            gestureManager = sdk.getMethod("getWearManager", android.content.Context.class, Class.class)
                    .invoke(null, this, mgrClass);
            if (gestureManager == null) return;
            int primary = eventClass.getField("ACTION_PRIMARY").getInt(null);
            java.lang.reflect.Method getAction = eventClass.getMethod("getAction");
            gestureListener = event -> {
                try {
                    if ((int) getAction.invoke(event) == primary) runOnUiThread(() -> {
                        if (showingTicket) stepTicket(1); else dial.step(1);
                    });
                } catch (Exception ignored) {}
            };
            mgrClass.getMethod("addGestureEventListener", int[].class, android.view.Window.class,
                    java.util.concurrent.Executor.class, java.util.function.Consumer.class)
                    .invoke(gestureManager, new int[] { primary }, getWindow(), getMainExecutor(), gestureListener);
        } catch (Throwable ignored) {
            // Watch without Wear OS 7 gestures – tap and crown still work.
        }
    }

    @Override
    protected void onDestroy() {
        restoreBrightness();
        try {
            if (gestureManager != null && gestureListener != null) {
                gestureManager.getClass().getMethod("removeGestureEventListener", java.util.function.Consumer.class)
                        .invoke(gestureManager, gestureListener);
            }
        } catch (Throwable ignored) {}
        super.onDestroy();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (showingTicket && ticketDial != null) ticketDial.requestFocus(); else dial.requestFocus();
        handler.post(tick);
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(tick);
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (!isChangingConfigurations()) finish();
    }

    private void openTicket() {
        if (tickets.length() == 0) return;
        showingTicket = true;
        ticketDial = new TicketDial(this);
        JSONObject ticket = tickets.optJSONObject(ticketIndex);
        if (ticket != null) ticketDial.setTicket(ticket);
        ticketDial.setOnClickListener(v -> stepTicket(1));
        previousBrightness = getWindow().getAttributes().screenBrightness;
        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL;
        getWindow().setAttributes(params);
        setContentView(ticketDial);
        ticketDial.requestFocus();
    }

    private void closeTicket() {
        showingTicket = false;
        restoreBrightness();
        setContentView(dial);
        dial.requestFocus();
    }

    private void restoreBrightness() {
        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.screenBrightness = previousBrightness;
        getWindow().setAttributes(params);
    }

    private void stepTicket(int delta) {
        if (tickets.length() == 0 || ticketDial == null) return;
        ticketIndex = ((ticketIndex + delta) % tickets.length() + tickets.length()) % tickets.length();
        JSONObject ticket = tickets.optJSONObject(ticketIndex);
        if (ticket != null) ticketDial.setTicket(ticket);
        ticketDial.performHapticFeedback(android.view.HapticFeedbackConstants.SEGMENT_TICK);
    }

    private void render() {
        SharedPreferences prefs = getSharedPreferences(WatchTripNotification.PREFS, MODE_PRIVATE);
        try {
            tickets = new JSONArray(prefs.getString("tickets", "[]"));
        } catch (Exception ignored) {
            tickets = new JSONArray();
        }
        dial.setTicketAction(tickets.length() > 0, this::openTicket);
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
