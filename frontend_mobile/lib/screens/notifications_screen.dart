import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/live_refresh.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen>
    with LiveRefresh<NotificationsScreen> {
  @override
  List<String> get liveResources => ['notifications'];
  @override
  Future<void> refreshForLiveUpdates() => _fetchNotifications();
  final ApiService _apiService = ApiService();
  List<dynamic> _notifications = [];
  bool _isLoading = true;
  int _page = 1;
  bool _hasMore = false;

  @override
  void initState() {
    super.initState();
    _fetchNotifications();
  }

  Future<void> _fetchNotifications() async {
    try {
      final res = await _apiService.dio.get('/notifications', queryParameters: {'page': _page});
      if (!mounted) return;
      setState(() {
        _notifications = res.data['data'];
        _isLoading = false;
        _hasMore = res.data['hasMore'] == true;
      });
      final ids = _notifications
          .where((n) => n['isRead'] != true)
          .map((n) => n['id'])
          .toList();
      if (ids.isNotEmpty) {
        await _apiService.dio
            .patch('/notifications/read', data: {'notificationIds': ids});
        if (mounted) {
          setState(() {
            for (final n in _notifications) {
              n['isRead'] = true;
            }
          });
        }
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(title: const Text('Notifications'), actions: [IconButton(onPressed: _fetchNotifications, icon: const Icon(Icons.refresh))]),
        bottomNavigationBar: SafeArea(child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
          TextButton(onPressed: _page == 1 ? null : () { setState(() => _page--); _fetchNotifications(); }, child: const Text('Previous')),
          Text('Page $_page'),
          TextButton(onPressed: !_hasMore ? null : () { setState(() => _page++); _fetchNotifications(); }, child: const Text('Next')),
        ])),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : ListView.builder(
                itemCount: _notifications.length,
                itemBuilder: (context, index) {
                  final n = _notifications[index];
                  return ListTile(
                    leading:
                        const CircleAvatar(child: Icon(Icons.notifications)),
                    title: Text(n['title'],
                        style: TextStyle(
                            fontWeight: n['isRead']
                                ? FontWeight.normal
                                : FontWeight.bold)),
                    subtitle: Text((n['body'] as String?) ?? ''),
                  );
                },
              ));
  }
}
