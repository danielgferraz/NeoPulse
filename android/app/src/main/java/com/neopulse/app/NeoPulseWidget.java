package com.neopulse.app;

import com.neopulse.app.R;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.util.Log;
import org.json.JSONObject;

public class NeoPulseWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        // Capacitor Preferences stores data in a SharedPreferences file named "CapacitorStorage"
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String widgetDataStr = prefs.getString("neopulse_widget_data", null);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.neo_pulse_widget);

        // Default values
        views.setTextViewText(R.id.widget_monthly_count, "0 / -- TREINOS");
        views.setProgressBar(R.id.widget_progress, 100, 0, false);
        views.setTextViewText(R.id.widget_last_weight, "PESO: --- KG");

        if (widgetDataStr != null) {
            try {
                Log.d("NeoPulseWidget", "Widget Data Found: " + widgetDataStr);
                JSONObject data = new JSONObject(widgetDataStr);
                int count = data.optInt("count", 0);
                int goal = data.optInt("goal", 12);
                if (goal <= 0) goal = 12;
                String weight = data.optString("weight", "---");

                views.setTextViewText(R.id.widget_monthly_count, count + " / " + goal + " TREINOS");
                views.setProgressBar(R.id.widget_progress, goal, Math.min(count, goal), false);
                views.setTextViewText(R.id.widget_last_weight, "PESO: " + weight + " KG");
                Log.d("NeoPulseWidget", "Widget UI Updated: " + count + "/" + goal);
            } catch (Exception e) {
                Log.e("NeoPulseWidget", "Error parsing widget data", e);
            }
        } else {
            Log.d("NeoPulseWidget", "No data found for key 'neopulse_widget_data' in CapacitorStorage");
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
