package app.flatrate.mobility;

import android.Manifest;
import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

/** Small watch screen: asks for notification permission and shows the current trip. */
public class WatchActivity extends Activity {
    private TextView text;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        text = new TextView(this);
        text.setGravity(Gravity.CENTER);
        text.setPadding(36, 48, 36, 48);
        text.setTextSize(15);
        ScrollView scroll = new ScrollView(this);
        scroll.addView(text);
        setContentView(scroll);
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        SharedPreferences prefs = getSharedPreferences(WatchTripNotification.PREFS, MODE_PRIVATE);
        String raw = prefs.getString("steps", null);
        if (raw == null) {
            text.setText("Flatrate\n\nKeine aktive Reise.\nHinterlege eine Reise auf dem Handy – sie erscheint dann live hier.");
            return;
        }
        JSONObject step = WatchTripNotification.currentStep(raw);
        StringBuilder out = new StringBuilder();
        if (step != null) {
            out.append(step.optString("title")).append("\n\n").append(step.optString("body")).append("\n");
            JSONArray lines = step.optJSONArray("lines");
            if (lines != null) for (int i = 0; i < lines.length(); i += 1) out.append("\n").append(lines.optString(i));
        }
        text.setText(out.toString());
    }
}
