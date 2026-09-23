package app.flatrate.mobility;

import android.app.Dialog;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.ProgressBar;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "TicketBrowser")
public class TicketBrowserPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private Dialog dialog;
    private boolean finished;

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("Bitte verwende eine sichere HTTPS-Adresse.");
            return;
        }
        finished = false;
        getActivity().runOnUiThread(() -> showBrowser(call, url));
    }

    private void showBrowser(PluginCall call, String startUrl) {
        dialog = new Dialog(getActivity(), android.R.style.Theme_Material_NoActionBar);
        LinearLayout layout = new LinearLayout(getActivity());
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.rgb(8, 18, 29));

        ProgressBar progress = new ProgressBar(getActivity(), null, android.R.attr.progressBarStyleHorizontal);
        layout.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 6));

        WebView webView = new WebView(getActivity());
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setUserAgentString(webView.getSettings().getUserAgentString() + " FlatrateApp/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value);
                progress.setVisibility(value >= 100 ? ProgressBar.GONE : ProgressBar.VISIBLE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String next = request.getUrl().toString();
                if (looksLikePass(next)) {
                    downloadPass(call, next, view.getSettings().getUserAgentString(), null);
                    return true;
                }
                return false;
            }
        });
        webView.setDownloadListener((downloadUrl, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (looksLikePass(downloadUrl) || isPassMime(mimeType) || contentDisposition != null) {
                downloadPass(call, downloadUrl, userAgent, contentDisposition);
            }
        });
        layout.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        dialog.setContentView(layout);
        dialog.setOnCancelListener(ignored -> {
            if (!finished) {
                finished = true;
                call.reject("Login abgebrochen.");
            }
        });
        dialog.show();
        webView.loadUrl(startUrl);
    }

    private boolean looksLikePass(String url) {
        String lower = url.toLowerCase();
        return lower.contains(".pkpass") || lower.contains("pkpass") || lower.contains("wallet-pass");
    }

    private boolean isPassMime(String mime) {
        if (mime == null) return false;
        String lower = mime.toLowerCase();
        return lower.contains("pkpass") || lower.contains("application/zip") || lower.contains("octet-stream");
    }

    private void downloadPass(PluginCall call, String downloadUrl, String userAgent, String contentDisposition) {
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(downloadUrl).openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("Accept", "application/vnd.apple.pkpass,application/zip,application/octet-stream,*/*");
                connection.setRequestProperty("User-Agent", userAgent == null ? "FlatrateApp/1.0" : userAgent);
                String cookies = CookieManager.getInstance().getCookie(downloadUrl);
                if (cookies != null) connection.setRequestProperty("Cookie", cookies);
                connection.connect();
                if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) {
                    throw new Exception("Download fehlgeschlagen (" + connection.getResponseCode() + ").");
                }
                try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        output.write(buffer, 0, read);
                        if (output.size() > 4 * 1024 * 1024) throw new Exception("Die Wallet-Datei ist zu groß.");
                    }
                    byte[] bytes = output.toByteArray();
                    if (bytes.length < 4 || bytes[0] != 0x50 || bytes[1] != 0x4b) throw new Exception("Der Download ist keine gültige Wallet-Datei.");
                    String disposition = connection.getHeaderField("Content-Disposition");
                    String name = fileName(disposition != null ? disposition : contentDisposition, downloadUrl);
                    JSObject result = new JSObject();
                    result.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
                    result.put("name", name);
                    finished = true;
                    getActivity().runOnUiThread(() -> {
                        if (dialog != null) dialog.dismiss();
                        call.resolve(result);
                    });
                }
            } catch (Exception error) {
                getActivity().runOnUiThread(() -> call.reject(error.getMessage()));
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private String fileName(String disposition, String url) {
        if (disposition != null) {
            for (String part : disposition.split(";")) {
                String clean = part.trim();
                if (clean.startsWith("filename=")) return clean.substring(9).replace("\"", "");
            }
        }
        String segment = Uri.parse(url).getLastPathSegment();
        return segment != null && segment.toLowerCase().endsWith(".pkpass") ? segment : "ticket.pkpass";
    }

    @Override protected void handleOnDestroy() {
        if (dialog != null) dialog.dismiss();
        executor.shutdownNow();
    }
}
