import 'package:flutter/material.dart';
import '../services/api_service.dart';

class AdminPaymentsScreen extends StatefulWidget {
  const AdminPaymentsScreen({super.key});

  @override
  State<AdminPaymentsScreen> createState() => _AdminPaymentsScreenState();
}

class _AdminPaymentsScreenState extends State<AdminPaymentsScreen> {
  final ApiService _apiService = ApiService();
  List<dynamic> _payments = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchPayments();
  }

  Future<void> _fetchPayments() async {
    setState(() => _isLoading = true);
    try {
      final res = await _apiService.dio.get('/payments');
      if (mounted) setState(() { _payments = res.data['data']; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Payments')),
      body: _isLoading ? const Center(child: CircularProgressIndicator()) : ListView.builder(
        itemCount: _payments.length,
        itemBuilder: (context, index) {
          final p = _payments[index];
          return ListTile(
            leading: const Icon(Icons.attach_money, color: Colors.green),
            title: Text('Rs. ${p['amount']}'),
            subtitle: Text('Status: ${p['status']}'),
            trailing: Text(p['paymentMethod'] ?? 'Unknown'),
          );
        },
      ),
    );
  }
}
