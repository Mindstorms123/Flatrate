package app.flatrate.mobility;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.view.View;

import java.util.ArrayList;
import java.util.List;

/** Full-screen watch dial: a half circle along the edge split into stages, the chosen stage in the middle. */
public class TripDial extends View {
    static final class Stage {
        String text;
        char state; // '✓' done, '▶' now, '·' ahead
    }

    private final Paint arc = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final TextPaint head = new TextPaint(Paint.ANTI_ALIAS_FLAG);
    private final TextPaint text = new TextPaint(Paint.ANTI_ALIAS_FLAG);
    private final TextPaint meta = new TextPaint(Paint.ANTI_ALIAS_FLAG);
    private final RectF box = new RectF();

    private List<Stage> stages = new ArrayList<>();
    private int viewed = 0;
    private float progress = 0f;
    private float shownProgress = 0f;
    private float shownFocus = 0f;
    private float fade = 1f;
    private String title = "";
    private String body = "";
    private String remaining = "";

    public TripDial(Context context) {
        super(context);
        float d = d();
        arc.setStyle(Paint.Style.STROKE);
        arc.setStrokeCap(Paint.Cap.ROUND);
        arc.setStrokeWidth(7 * d);
        head.setColor(0xFFFFFFFF);
        head.setFakeBoldText(true);
        head.setTextSize(17 * d);
        text.setColor(0xFFCBD5E1);
        text.setTextSize(13 * d);
        meta.setColor(0xFFF5C542);
        meta.setTextSize(12 * d);
        meta.setTextAlign(Paint.Align.CENTER);
        meta.setFakeBoldText(true);
    }

    private float d() { return getResources().getDisplayMetrics().density; }

    void setTrip(List<Stage> stages, float progress, String title, String body, String remaining) {
        boolean first = this.stages.isEmpty();
        this.stages = stages;
        this.progress = Math.max(0f, Math.min(1f, progress));
        this.title = title;
        this.body = body;
        this.remaining = remaining;
        if (first) viewed = currentIndex();
        viewed = Math.max(0, Math.min(viewed, Math.max(0, stages.size() - 1)));
        invalidate();
    }

    int currentIndex() {
        for (int i = 0; i < stages.size(); i += 1) if (stages.get(i).state != '✓') return i;
        return Math.max(0, stages.size() - 1);
    }

    /** Next stage; wraps back to the current one after the last. */
    void step(int delta) {
        if (stages.isEmpty()) return;
        int n = stages.size();
        viewed = ((viewed + delta) % n + n) % n;
        fade = 0f;
        buzz();
        invalidate();
    }

    /** Short tick on the watch motor for every stage change. */
    private void buzz() {
        boolean done = performHapticFeedback(android.view.HapticFeedbackConstants.SEGMENT_TICK,
                android.view.HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING);
        try {
            android.os.Vibrator v = getContext().getSystemService(android.os.Vibrator.class);
            if (v != null && v.hasVibrator()) {
                v.vibrate(android.os.VibrationEffect.createPredefined(
                        done ? android.os.VibrationEffect.EFFECT_TICK : android.os.VibrationEffect.EFFECT_CLICK));
            }
        } catch (Exception ignored) {}
    }

    /** Double pinch arrives as an accessibility click / scroll on the focused view. */
    @Override
    public boolean performAccessibilityAction(int action, android.os.Bundle args) {
        if (action == android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK
                || action == android.view.accessibility.AccessibilityNodeInfo.ACTION_SCROLL_FORWARD) {
            step(1);
            return true;
        }
        if (action == android.view.accessibility.AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD) {
            step(-1);
            return true;
        }
        return super.performAccessibilityAction(action, args);
    }

    @Override
    public void onInitializeAccessibilityNodeInfo(android.view.accessibility.AccessibilityNodeInfo info) {
        super.onInitializeAccessibilityNodeInfo(info);
        info.setClickable(true);
        info.setScrollable(true);
        info.addAction(android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK);
        info.addAction(android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD);
        info.addAction(android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_BACKWARD);
        info.setContentDescription("Reiseetappen, antippen für nächste Etappe");
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float d = d();
        float w = getWidth(), h = getHeight();
        float inset = 8 * d;
        box.set(inset, inset, w - inset, h - inset);
        shownProgress += (progress - shownProgress) * 0.1f;
        shownFocus += (viewed - shownFocus) * 0.18f;
        fade = Math.min(1f, fade + 0.08f);

        int n = Math.max(1, stages.size());
        float start = 180f, sweep = 180f, gap = n > 1 ? 4f : 0f;
        float each = (sweep - gap * (n - 1)) / n;
        for (int i = 0; i < stages.size(); i += 1) {
            Stage s = stages.get(i);
            int color = s.state == '✓' ? 0xFF334155 : s.state == '▶' ? 0xFF0EA5A4 : 0xFF1E3A5F;
            float emphasis = Math.max(0f, 1f - Math.abs(shownFocus - i));
            arc.setColor(color);
            arc.setStrokeWidth((6 + 5 * emphasis) * d);
            canvas.drawArc(box, start + i * (each + gap), each, false, arc);
        }

        // Live position on the half circle, pulsing.
        double a = Math.toRadians(start + sweep * shownProgress);
        float r = box.width() / 2f;
        float cx = box.centerX() + (float) Math.cos(a) * r;
        float cy = box.centerY() + (float) Math.sin(a) * r;
        float pulse = (float) (0.5 + 0.5 * Math.sin(System.currentTimeMillis() / 260.0));
        dot.setColor(0xFFF5C542);
        dot.setAlpha(80);
        canvas.drawCircle(cx, cy, (9 + 5 * pulse) * d, dot);
        dot.setAlpha(255);
        canvas.drawCircle(cx, cy, 6 * d, dot);

        // Center content.
        float textWidth = w * 0.72f;
        float left = (w - textWidth) / 2f;
        String header, content, label;
        if (stages.isEmpty()) {
            header = title; content = body; label = remaining;
        } else if (viewed == currentIndex()) {
            header = title; content = body; label = remaining + " · Jetzt";
        } else {
            Stage s = stages.get(viewed);
            header = (viewed + 1) + " / " + stages.size() + (s.state == '✓' ? " · erledigt" : " · danach");
            content = s.text.length() > 2 ? s.text.substring(2) : s.text;
            label = "Krone drehen: weiter";
        }
        int alpha = Math.round(255 * fade);
        float offset = (1f - fade) * 14 * d;
        meta.setAlpha(alpha);
        head.setAlpha(alpha);
        text.setAlpha(alpha);

        StaticLayout headL = StaticLayout.Builder.obtain(header, 0, header.length(), head, (int) textWidth)
                .setAlignment(Layout.Alignment.ALIGN_CENTER).setMaxLines(2).build();
        StaticLayout bodyL = StaticLayout.Builder.obtain(content, 0, content.length(), text, (int) textWidth)
                .setAlignment(Layout.Alignment.ALIGN_CENTER).setMaxLines(5).build();
        float total = 18 * d + headL.getHeight() + 6 * d + bodyL.getHeight();
        float y = (h - total) / 2f + 10 * d + offset;
        canvas.drawText(label, w / 2f, y + 12 * d, meta);
        y += 18 * d;
        canvas.save();
        canvas.translate(left, y);
        headL.draw(canvas);
        canvas.translate(0, headL.getHeight() + 6 * d);
        bodyL.draw(canvas);
        canvas.restore();

        // Stage dots at the bottom.
        float dotsY = h - 26 * d;
        float spacing = 10 * d;
        float dx = w / 2f - spacing * (stages.size() - 1) / 2f;
        for (int i = 0; i < stages.size(); i += 1) {
            dot.setColor(i == viewed ? 0xFFFFFFFF : 0xFF475569);
            canvas.drawCircle(dx + i * spacing, dotsY, (i == viewed ? 3.5f : 2.5f) * d, dot);
        }
        postInvalidateOnAnimation();
    }
}
