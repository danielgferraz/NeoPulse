package com.neopulse.app;

import com.neopulse.app.R;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class NeoPulseWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        // Capacitor Preferences stores data in a SharedPreferences file named "CapacitorStorage"
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String widgetDataStr = prefs.getString("neopulse_widget_data", null);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.neo_pulse_widget);

        if (widgetDataStr != null) {
            try {
                JSONObject data = new JSONObject(widgetDataStr);
                int count = data.optInt("count", 0);
                int goal = data.optInt("goal", 12);
                String weight = data.optString("weight", "---");

                views.setTextViewText(R.id.widget_monthly_count, count + " / " + goal + " TREINOS");
                views.setProgressBar(R.id.widget_progress, goal, count, false);
                views.setTextViewText(R.id.widget_last_weight, "PESO: " + weight + " KG");
            } catch (Exception e) {
                e.printStackTrace();
            }
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
