package com.neopulse.app;

import com.neopulse.app.R;

import android.app.PendingIntent;
import android.content.Intent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.util.Log;
import android.view.View;
import android.widget.Chronometer;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class SessionWidget extends AppWidgetProvider {

    private static final String ACTION_PAUSE = "com.neopulse.app.ACTION_PAUSE";
    private static final String ACTION_RESET = "com.neopulse.app.ACTION_RESET";
    private static final String ACTION_NEXT = "com.neopulse.app.ACTION_NEXT";

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String sessionDataStr = prefs.getString("neopulse_session_data", null);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.session_widget);

        if (sessionDataStr != null) {
            try {
                JSONObject data = new JSONObject(sessionDataStr);
                String exercise = data.optString("exercise", "SESSÃO");
                String next = data.optString("next", "---");
                int currentSet = data.optInt("currentSet", 0);
                int totalSets = data.optInt("totalSets", 0);
                long timerEnd = data.optLong("timerEnd", 0);

                views.setTextViewText(R.id.session_exercise_name, exercise.toUpperCase());
                views.setTextViewText(R.id.session_sets_info, "SÉRIE " + currentSet + " / " + totalSets);
                views.setTextViewText(R.id.session_next_exercise, "PRÓXIMO: " + next.toUpperCase());

                if (timerEnd > System.currentTimeMillis()) {
                    views.setViewVisibility(R.id.session_timer, View.VISIBLE);
                    long duration = timerEnd - System.currentTimeMillis();
                    views.setChronometer(R.id.session_timer, SystemClock.elapsedRealtime() + duration, null, true);
                    views.setChronometerCountDown(R.id.session_timer, true);
                } else {
                    views.setViewVisibility(R.id.session_timer, View.GONE);
                }

            } catch (Exception e) {
                e.printStackTrace();
            }
        } else {
            views.setTextViewText(R.id.session_exercise_name, "NEOPULSE");
            views.setTextViewText(R.id.session_sets_info, "SEM SESSÃO ATIVA");
            views.setViewVisibility(R.id.session_timer, View.GONE);
            views.setTextViewText(R.id.session_next_exercise, "ABRA O APP PARA TREINAR");
        }

        // Set PendingIntents for buttons
        views.setOnClickPendingIntent(R.id.session_btn_pause, getPendingSelfIntent(context, ACTION_PAUSE));
        views.setOnClickPendingIntent(R.id.session_btn_reset, getPendingSelfIntent(context, ACTION_RESET));
        views.setOnClickPendingIntent(R.id.session_btn_next, getPendingSelfIntent(context, ACTION_NEXT));

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (action != null && (action.equals(ACTION_PAUSE) || action.equals(ACTION_RESET) || action.equals(ACTION_NEXT))) {
            Log.d("SessionWidget", "Action received: " + action);
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String command = "";
            if (action.equals(ACTION_PAUSE)) command = "pause";
            else if (action.equals(ACTION_RESET)) command = "reset";
            else if (action.equals(ACTION_NEXT)) command = "next";

            prefs.edit().putString("neopulse_widget_command", command).apply();

            // Notify WidgetProvider to refresh UI if needed, but the PWA polling is the main mechanism.
            // We refresh the widget anyway to show feedback.
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisAppWidget = new ComponentName(context.getPackageName(), SessionWidget.class.getName());
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidget);
            onUpdate(context, appWidgetManager, appWidgetIds);
        }
    }

    private static PendingIntent getPendingSelfIntent(Context context, String action) {
        Intent intent = new Intent(context, SessionWidget.class);
        intent.setAction(action);
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
