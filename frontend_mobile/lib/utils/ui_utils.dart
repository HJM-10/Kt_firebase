import 'package:flutter/material.dart';

class UiUtils {
  static Future<bool?> showAnimatedConfirmDialog(
          {required BuildContext context,
          required String title,
          required String message,
          String confirmText = 'Confirm',
          String cancelText = 'Cancel',
          bool isDanger = false}) =>
      showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          icon: Icon(
              isDanger ? Icons.warning_amber_rounded : Icons.help_outline,
              color: isDanger
                  ? Theme.of(context).colorScheme.error
                  : Theme.of(context).colorScheme.primary),
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(cancelText)),
            ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                style: isDanger
                    ? ElevatedButton.styleFrom(
                        backgroundColor: Theme.of(context).colorScheme.error,
                        foregroundColor: Theme.of(context).colorScheme.onError)
                    : null,
                child: Text(confirmText)),
          ],
        ),
      );
}
