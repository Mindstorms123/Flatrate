package app.flatrate.mobility;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.text.TextPaint;
import android.view.View;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.EnumMap;
import java.util.Map;

/** Full-screen high-contrast ticket code made from the original wallet bytes. */
public class TicketDial extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final TextPaint text = new TextPaint(Paint.ANTI_ALIAS_FLAG);
    private Bitmap barcode;
    private String title = "Ticket";
    private String validUntil = "";

    public TicketDial(Context context) {
        super(context);
        text.setTextAlign(Paint.Align.CENTER);
        setBackgroundColor(Color.WHITE);
    }

    void setTicket(JSONObject ticket) {
        if (ticket == null) return;
        title = ticket.optString("title", "Ticket");
        validUntil = ticket.optString("validUntil", "");
        barcode = createBarcode(ticket.optString("barcodeBytes", ""), ticket.optString("barcodeFormat", "QR"));
        invalidate();
    }

    private BarcodeFormat format(String raw) {
        String value = raw == null ? "" : raw.toUpperCase();
        if (value.contains("PDF417")) return BarcodeFormat.PDF_417;
        if (value.contains("AZTEC")) return BarcodeFormat.AZTEC;
        if (value.contains("CODE128")) return BarcodeFormat.CODE_128;
        return BarcodeFormat.QR_CODE;
    }

    private Bitmap createBarcode(String base64, String rawFormat) {
        try {
            byte[] bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
            String payload = new String(bytes, StandardCharsets.ISO_8859_1);
            Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            hints.put(EncodeHintType.CHARACTER_SET, "ISO-8859-1");
            hints.put(EncodeHintType.MARGIN, 1);
            BarcodeFormat barcodeFormat = format(rawFormat);
            int width = barcodeFormat == BarcodeFormat.PDF_417 ? 360 : 300;
            int height = barcodeFormat == BarcodeFormat.PDF_417 ? 180 : 300;
            BitMatrix matrix = new MultiFormatWriter().encode(payload, barcodeFormat, width, height, hints);
            Bitmap image = Bitmap.createBitmap(matrix.getWidth(), matrix.getHeight(), Bitmap.Config.ARGB_8888);
            for (int y = 0; y < matrix.getHeight(); y += 1) {
                for (int x = 0; x < matrix.getWidth(); x += 1) {
                    image.setPixel(x, y, matrix.get(x, y) ? Color.BLACK : Color.WHITE);
                }
            }
            return image;
        } catch (Exception ignored) {
            return null;
        }
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float density = getResources().getDisplayMetrics().density;
        float width = getWidth();
        text.setColor(Color.BLACK);
        text.setFakeBoldText(true);
        text.setTextSize(15 * density);
        canvas.drawText(title.length() > 28 ? title.substring(0, 27) + "…" : title, width / 2f, 25 * density, text);
        if (barcode != null) {
            int maxWidth = Math.round(width - 28 * density);
            int maxHeight = Math.round(getHeight() - 76 * density);
            float scale = Math.min((float) maxWidth / barcode.getWidth(), (float) maxHeight / barcode.getHeight());
            int drawWidth = Math.round(barcode.getWidth() * scale);
            int drawHeight = Math.round(barcode.getHeight() * scale);
            int left = Math.round((width - drawWidth) / 2f);
            int top = Math.round((getHeight() - drawHeight) / 2f);
            paint.setFilterBitmap(false);
            canvas.drawBitmap(barcode, null, new Rect(left, top, left + drawWidth, top + drawHeight), paint);
        } else {
            text.setFakeBoldText(false);
            text.setTextSize(13 * density);
            canvas.drawText("Code nicht darstellbar", width / 2f, getHeight() / 2f, text);
        }
        if (!validUntil.isEmpty()) {
            text.setFakeBoldText(false);
            text.setTextSize(11 * density);
            canvas.drawText("Gültig bis " + validUntil.substring(0, Math.min(10, validUntil.length())), width / 2f,
                    getHeight() - 14 * density, text);
        }
    }
}