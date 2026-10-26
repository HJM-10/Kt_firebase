package com.example.smart_sports_hub

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel("arena_updates", "Arena updates", NotificationManager.IMPORTANCE_HIGH)
            channel.description = "Booking, payment, membership and complaint updates"
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
