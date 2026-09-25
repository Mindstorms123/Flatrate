package app.flatrate.mobility;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TicketBrowserPlugin.class);
        registerPlugin(TripLivePlugin.class);
        registerPlugin(ScreenBrightnessPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
