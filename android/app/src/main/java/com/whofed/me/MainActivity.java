package com.whofed.me;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import android.util.Log;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.statusbar.StatusBarPlugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "WhoFed_MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        Log.d(TAG, "=== onCreate START ===");
        Log.d(TAG, "Android SDK Version: " + Build.VERSION.SDK_INT);

        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
        Log.d(TAG, "Set night mode to MODE_NIGHT_NO");

        super.onCreate(savedInstanceState);

        // Register StatusBar plugin (needed for header to work)
        registerPlugin(StatusBarPlugin.class);
        Log.d(TAG, "StatusBar plugin registered");

        // Force light mode system bars
        final Window window = getWindow();
        final View decorView = window.getDecorView();
        Log.d(TAG, "Got window and decorView");

        // CRITICAL: Set window flags BEFORE setting colors
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        Log.d(TAG, "Set window flags for system bar control");

        // For Android 15 (SDK 36), we need to handle edge-to-edge mode
        // Disable edge-to-edge layout so we can control system bars
        WindowCompat.setDecorFitsSystemWindows(window, true);
        Log.d(TAG, "Set decorFitsSystemWindows to true (disable edge-to-edge)");

        // Use post() to ensure window is fully initialized before setting colors
        decorView.post(new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "[POST] Window should be ready, setting colors...");

                // Log current colors before setting
                Log.d(TAG, "[POST] Current StatusBar color BEFORE: " + window.getStatusBarColor());
                Log.d(TAG, "[POST] Current NavigationBar color BEFORE: " + window.getNavigationBarColor());

                // Explicitly set white background for both status bar and navigation bar
                window.setStatusBarColor(Color.WHITE);
                window.setNavigationBarColor(Color.WHITE);
                Log.d(TAG, "[POST] Set StatusBar color to WHITE: " + Color.WHITE);
                Log.d(TAG, "[POST] Set NavigationBar color to WHITE: " + Color.WHITE);

                // Verify colors were set
                Log.d(TAG, "[POST] Current StatusBar color AFTER: " + window.getStatusBarColor());
                Log.d(TAG, "[POST] Current NavigationBar color AFTER: " + window.getNavigationBarColor());

                // Set navigation bar divider color (Android 9+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    window.setNavigationBarDividerColor(Color.WHITE);
                    Log.d(TAG, "[POST] Set NavigationBar divider color to WHITE (Android 9+)");
                    Log.d(TAG, "[POST] NavigationBar divider color: " + window.getNavigationBarDividerColor());
                }

                // Enforce Light Status Bar Icons (Dark Content)
                WindowInsetsControllerCompat windowInsetsController =
                    WindowCompat.getInsetsController(window, decorView);
                Log.d(TAG, "[POST] Got WindowInsetsController");

                windowInsetsController.setAppearanceLightStatusBars(true);
                Log.d(TAG, "[POST] Set appearance light status bars to TRUE");

                windowInsetsController.setAppearanceLightNavigationBars(true);
                Log.d(TAG, "[POST] Set appearance light navigation bars to TRUE");

                // Force show the navigation bar
                windowInsetsController.show(androidx.core.view.WindowInsetsCompat.Type.navigationBars());
                Log.d(TAG, "[POST] Called show() on navigation bars");

                Log.d(TAG, "[POST] All system bar configuration complete");
            }
        });

        // Handle deep link if app was launched from a link
        handleDeepLink(getIntent());

        Log.d(TAG, "=== onCreate END ===");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Log.d(TAG, "=== onNewIntent called ===");
        setIntent(intent);
        handleDeepLink(intent);
    }

    private void handleDeepLink(Intent intent) {
        Uri data = intent.getData();
        if (data == null) {
            Log.d(TAG, "[DeepLink] No URI data in intent");
            return;
        }

        String scheme = data.getScheme();
        String host = data.getHost();
        Log.d(TAG, "[DeepLink] Received deep link - Scheme: " + scheme + ", Host: " + host);
        Log.d(TAG, "[DeepLink] Full URI: " + data.toString());

        // Handle whofed://join?k=...
        if ("whofed".equals(scheme) && "join".equals(host)) {
            String inviteKey = data.getQueryParameter("k");
            if (inviteKey != null && !inviteKey.isEmpty()) {
                Log.d(TAG, "[DeepLink] Processing join invite with key: " + inviteKey);

                // Navigate to the join page in the webview
                final String url = "/join/?k=" + inviteKey;

                // Post to ensure bridge is ready
                getBridge().getWebView().post(new Runnable() {
                    @Override
                    public void run() {
                        Log.d(TAG, "[DeepLink] Navigating webview to: " + url);
                        getBridge().getWebView().loadUrl("javascript:window.location.href = '" + url + "'");
                    }
                });
            } else {
                Log.w(TAG, "[DeepLink] Join link missing 'k' parameter");
            }
        } else {
            Log.d(TAG, "[DeepLink] Unhandled deep link scheme/host: " + scheme + "://" + host);
        }
    }
}
