package com.neopulse.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import androidx.core.app.NotificationCompat;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import androidx.media.app.NotificationCompat.MediaStyle;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.neopulse.app.R;
import com.neopulse.app.SessionWidget;

@CapacitorPlugin(name = "TimerNotification")
public class TimerNotificationPlugin extends Plugin {

    private static final String CHANNEL_ID = "neopulse_premium_v2";
    private static final int NOTIFICATION_ID = 1001;
    private static final int NEOPULSE_GREEN = Color.parseColor("#00FF41");

    @PluginMethod
    public void startTimer(PluginCall call) {
        String title = call.getString("title", "NeoPulse");
        String body = call.getString("body", "Treino Ativo");
        long timerEnd = call.getLong("timerEnd", 0L);
        long timerStart = call.getLong("timerStart", 0L);
        boolean isStopwatch = call.getBoolean("isStopwatch", false);

        Context context = getContext();
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        // Create Channel for Android O+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Using DEFAULT importance but with null sound to keep it silent as requested
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Timer Realtime", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setShowBadge(false);
            channel.enableVibration(false);
            channel.setSound(null, null);
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            notificationManager.createNotificationChannel(channel);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setLargeIcon(BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher)) // Premium Look
                .setContentTitle(title.toUpperCase())
                .setContentText(body)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setAutoCancel(false)
                .setShowWhen(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_HIGH) 
                .setColor(NEOPULSE_GREEN)
                .setColorized(true);

        // Advanced Chronometer Logic
        long elapsedRealtime = SystemClock.elapsedRealtime();
        long now = System.currentTimeMillis();

        if (timerEnd > now) {
            // Countdown (Rest)
            long durationMs = timerEnd - now;
            builder.setUsesChronometer(true);
            builder.setChronometerCountDown(true);
            builder.setWhen(elapsedRealtime + durationMs);
        } else if (timerStart > 0) {
            // Stopwatch (Work)
            long elapsedMs = now - timerStart;
            builder.setUsesChronometer(true);
            builder.setChronometerCountDown(false);
            builder.setWhen(elapsedRealtime - elapsedMs);
        }

        // Action Buttons
        builder.addAction(android.R.drawable.ic_media_pause, "Pausar", getPendingIntent("com.neopulse.app.ACTION_PAUSE"));
        builder.addAction(android.R.drawable.ic_menu_rotate, "Zerar", getPendingIntent("com.neopulse.app.ACTION_RESET"));
        builder.addAction(android.R.drawable.ic_input_add, "Feito", getPendingIntent("com.neopulse.app.ACTION_NEXT"));

        // APPLY MediaStyle for the "Spotify" look
        builder.setStyle(new MediaStyle()
                .setShowActionsInCompactView(0, 1, 2) // Show all 3 buttons in compact mode
                .setMediaSession(null));

        // Content Intent (Open App)
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            builder.setContentIntent(pendingIntent);
        }

        notificationManager.notify(NOTIFICATION_ID, builder.build());
        call.resolve();
    }

    @PluginMethod
    public void stopTimer(PluginCall call) {
        NotificationManager notificationManager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.cancel(NOTIFICATION_ID);
        call.resolve();
    }

    private PendingIntent getPendingIntent(String action) {
        Intent intent = new Intent(getContext(), SessionWidget.class);
        intent.setAction(action);
        intent.setPackage(getContext().getPackageName());
        return PendingIntent.getBroadcast(getContext(), 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
