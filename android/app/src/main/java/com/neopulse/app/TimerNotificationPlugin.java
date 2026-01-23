package com.neopulse.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TimerNotification")
public class TimerNotificationPlugin extends Plugin {

    private static final String CHANNEL_ID = "neopulse_ticker";
    private static final int NOTIFICATION_ID = 1001;

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
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Timer Realtime", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            channel.enableVibration(false);
            channel.setSound(null, null);
            notificationManager.createNotificationChannel(channel);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher) // Use default launcher icon
                .setContentTitle(title)
                .setContentText(body)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setAutoCancel(false)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_LOW);

        // Chronometer Logic
        long now = System.currentTimeMillis();
        long elapsedRealtime = SystemClock.elapsedRealtime();

        if (timerEnd > now) {
            // Countdown mode (Rest Timer)
            long durationMs = timerEnd - now;
            builder.setUsesChronometer(true);
            builder.setChronometerCountDown(true);
            builder.setWhen(elapsedRealtime + durationMs);
        } else if (timerStart > 0) {
            // Stopwatch mode (Work)
            long elapsedMs = now - timerStart;
            builder.setUsesChronometer(true);
            builder.setChronometerCountDown(false);
            builder.setWhen(elapsedRealtime - elapsedMs);
        }

        // Action Intents (Reusing Widget Actions)
        builder.addAction(0, "Pausar", getPendingIntent("com.neopulse.app.ACTION_PAUSE"));
        builder.addAction(0, "Zerar", getPendingIntent("com.neopulse.app.ACTION_RESET"));
        builder.addAction(0, "Feito", getPendingIntent("com.neopulse.app.ACTION_NEXT"));

        // Content Intent (Open App)
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
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
