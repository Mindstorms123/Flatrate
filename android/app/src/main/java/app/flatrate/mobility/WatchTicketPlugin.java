package app.flatrate.mobility;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Sends locally stored wallet ticket codes to the paired Wear OS app. */
@CapacitorPlugin(name = "WatchTickets")
public class WatchTicketPlugin extends Plugin {
    @PluginMethod
    public void sync(PluginCall call) {
        WatchSync.sendTickets(getContext(), call.getString("tickets", "[]"));
        call.resolve();
    }
}