import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../widgets/arena_desk.dart';

class AdminReportsScreen extends StatefulWidget {
  const AdminReportsScreen({super.key});

  @override
  State<AdminReportsScreen> createState() => _AdminReportsScreenState();
}

class _AdminReportsScreenState extends State<AdminReportsScreen> {
  final ApiService _apiService = ApiService();
  Map<String, dynamic>? _revenue;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchReports();
  }

  Future<void> _fetchReports() async {
    setState(() => _isLoading = true);
    try {
      final res = await _apiService.dio.get('/reports/revenue');
      if (mounted) {
        setState(() {
          _revenue = res.data['data'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reports & Analytics')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  Card(
                    child: ListTile(
                      leading: ArenaIcon(ArenaSymbol.money,
                          color: Theme.of(context).colorScheme.secondary,
                          size: 32),
                      title: const Text('Total Revenue'),
                      subtitle: Text('Rs. ${_revenue?['totalRevenue'] ?? 0}',
                          style: const TextStyle(
                              fontSize: 24, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
