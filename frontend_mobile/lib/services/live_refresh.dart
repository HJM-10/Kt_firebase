import 'package:flutter/material.dart';
import 'api_service.dart';

mixin LiveRefresh<T extends StatefulWidget> on State<T> {
  List<String> get liveResources;
  Future<void> refreshForLiveUpdates();
  void _liveChange(dynamic event) {
    if (mounted && event is Map && liveResources.contains(event['resource'])) {
      refreshForLiveUpdates();
    }
  }
  void _liveReconnect(dynamic _) { if (mounted) refreshForLiveUpdates(); }
  @override
  void initState() {
    super.initState();
    ApiService().socket.on('resource_changed', _liveChange);
    ApiService().socket.on('connect', _liveReconnect);
  }
  @override
  void dispose() {
    ApiService().socket.off('resource_changed', _liveChange);
    ApiService().socket.off('connect', _liveReconnect);
    super.dispose();
  }
}
