package com.whofed.me;

import android.os.Build;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.statusbar.StatusBarPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
        super.onCreate(savedInstanceState);

        // Register StatusBar plugin (needed for header to work)
        registerPlugin(StatusBarPlugin.class);

        // Force light mode system bars
        Window window = getWindow();
        View decorView = window.getDecorView();

        // Explicitly set white background for both status bar and navigation bar
        window.setStatusBarColor(Color.WHITE);
        window.setNavigationBarColor(Color.WHITE);

        // Set navigation bar divider color (Android 9+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.setNavigationBarDividerColor(Color.WHITE);
        }

        // Enforce Light Status Bar Icons (Dark Content)
        WindowInsetsControllerCompat windowInsetsController =
            WindowCompat.getInsetsController(window, decorView);
        windowInsetsController.setAppearanceLightStatusBars(true);
        windowInsetsController.setAppearanceLightNavigationBars(true);

        // Force show the navigation bar
        windowInsetsController.show(androidx.core.view.WindowInsetsCompat.Type.navigationBars());
    }
}
