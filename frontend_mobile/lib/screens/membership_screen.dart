import '../services/live_refresh.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/payment_service.dart';
import '../services/api_errors.dart';

class MembershipScreen extends StatefulWidget {
  const MembershipScreen({super.key});

  @override
  State<MembershipScreen> createState() => _MembershipScreenState();
}

class _MembershipScreenState extends State<MembershipScreen>
    with LiveRefresh<MembershipScreen> {
  @override
  List<String> get liveResources => ['membership', 'payments'];
  @override
  Future<void> refreshForLiveUpdates() => _fetchMembership();
  final ApiService _apiService = ApiService();
  Map<String, dynamic>? _membership;
  bool _isLoading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _fetchMembership();
  }

  Future<void> _fetchMembership() async {
    try {
      final res = await _apiService.dio.get('/membership/my');
      if (!mounted) return;
      setState(() {
        _membership = res.data['data'];
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  Future<void> _purchaseTier(String tier) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final res = await _apiService.dio
          .post('/membership/purchase', data: {'tier': tier});
      if (res.data['success']) {
        await _fetchMembership();
        if (res.data['data']['paymentId'] != null) {
          await PaymentService.checkout(res.data['data']['paymentId']);
        }
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text(
                'Membership request submitted! Complete payment to activate.')));
        _fetchMembership();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(title: const Text('Memberships')),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_membership != null) ...[
                    Card(
                      color: const Color(0xFFE8D6A9),
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          children: [
                            Text('Current Tier: ${_membership!['tier']}',
                                style: const TextStyle(
                                    fontSize: 24,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.black)),
                            const SizedBox(height: 8),
                            Text('Card: ${_membership!['cardNumber']}',
                                style: const TextStyle(
                                    fontSize: 16, color: Colors.black87)),
                            const SizedBox(height: 8),
                            Text(_membership!['status'] ?? 'INACTIVE',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Colors.black54)),
                          ],
                        ),
                      ),
                    ),
                    Text(_membership!['endDate'] == null
                        ? 'Basic card has no expiry'
                        : 'Valid until ${_membership!['endDate'].toString().split('T').first}'),
                    const SizedBox(height: 24),
                  ],
                  const Text('Available Tiers',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  _buildTierCard('BASIC', 'Free arena membership card', 0),
                  _buildTierCard(
                      'SILVER', '10% Discount on all bookings', 1000),
                  _buildTierCard('GOLD', '20% Discount on all bookings', 2500),
                  const Text(
                      'Renewals add one year to your current expiry. Upgrades cost the full annual price and begin a new year when paid. Current benefits remain until payment.'),
                  const SizedBox(height: 24),
                  const Text('Membership history',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  for (final h in (_membership?['history'] as List? ?? []))
                    ListTile(
                      title: Text('${h['kind']} · ${h['tier']}'),
                      subtitle: Text(
                          '${h['payment']?['status'] ?? h['status']} · ${h['createdAt'].toString().split('T').first}'),
                      trailing: h['status'] == 'PENDING' &&
                              h['payment']?['status'] == 'PENDING'
                          ? TextButton(
                              onPressed:
                                  _busy ? null : () => _purchaseTier(h['tier']),
                              child: const Text('Pay'))
                          : null,
                    ),
                ],
              ));
  }

  Widget _buildTierCard(String tier, String desc, int price) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(tier,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.bold)),
                Text('Rs. $price / yr',
                    style: const TextStyle(
                        fontSize: 16,
                        color: Colors.green,
                        fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 8),
            Text(desc),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _busy ? null : () => _purchaseTier(tier),
                child: Text(_membership?['isActive'] == true &&
                        _membership?['tier'] == tier &&
                        tier != 'BASIC'
                    ? 'Renew'
                    : 'Choose $tier'),
              ),
            )
          ],
        ),
      ),
    );
  }
}
