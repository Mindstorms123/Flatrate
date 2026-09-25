package app.flatrate.mobility;

import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Temporarily maximizes this app window's brightness while a ticket is enlarged. */
@CapacitorPlugin(name = "ScreenBrightness")
public class ScreenBrightnessPlugin extends Plugin {
    private Float previousBrightness;

    @PluginMethod
    public void maximize(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowManager.LayoutParams params = window.getAttributes();
            if (previousBrightness == null) previousBrightness = params.screenBrightness;
            params.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL;
            window.setAttributes(params);
            call.resolve();
        });
    }

    @PluginMethod
    public void restore(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            restoreBrightness();
            call.resolve();
        });
    }

    private void restoreBrightness() {
        if (previousBrightness == null || getActivity() == null) return;
        Window window = getActivity().getWindow();
        WindowManager.LayoutParams params = window.getAttributes();
        params.screenBrightness = previousBrightness;
        window.setAttributes(params);
        previousBrightness = null;
    }

    @Override
    protected void handleOnDestroy() {
        if (getActivity() != null) getActivity().runOnUiThread(this::restoreBrightness);
    }
}