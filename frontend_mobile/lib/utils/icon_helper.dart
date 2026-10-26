import 'package:flutter/material.dart';

class IconHelper {
  static IconData getIcon(String? iconName) {
    switch (iconName) {
      case 'Dumbbell':
        return Icons.fitness_center;
      case 'Trophy':
        return Icons.emoji_events;
      case 'Activity':
        return Icons.local_activity;
      case 'Target':
        return Icons.track_changes;
      case 'Flame':
        return Icons.local_fire_department;
      case 'Swords':
        return Icons.sports_kabaddi; // Closest to swords
      case 'Shield':
        return Icons.security;
      case 'Star':
        return Icons.star;
      default:
        return Icons.emoji_events; // Default to Trophy
    }
  }
}

