package com.neopulse.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.view.View;
import android.widget.Chronometer;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class SessionWidget extends AppWidgetProvider {

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

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }
}
