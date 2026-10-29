import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';
import '../services/live_refresh.dart';

class PromoCodesScreen extends StatefulWidget {
  const PromoCodesScreen({super.key});
  @override
  State<PromoCodesScreen> createState() => _PromoCodesScreenState();
}

class _PromoCodesScreenState extends State<PromoCodesScreen>
    with LiveRefresh<PromoCodesScreen> {
  List<dynamic> _offers = [];
  bool _loading = true;
  String? _error;
  @override
  List<String> get liveResources => ['promo', 'bookings'];
  @override
  Future<void> refreshForLiveUpdates() => _load();
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await ApiService().dio.get('/promo');
      if (mounted) {
        setState(() {
          _offers = r.data['data'];
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Offers & discounts')),
      body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              children: [
                Text('More play. More savings.',
                    style: Theme.of(context).textTheme.headlineSmall),
                const Text(
                    'Enter a code when booking a court. Membership savings apply first. Cancelled or expired bookings restore your allowance.'),
                if (_error != null)
                  ListTile(
                      title: Text(_error!),
                      trailing: IconButton(
                          onPressed: _load, icon: const Icon(Icons.refresh))),
                if (_loading) const Center(child: CircularProgressIndicator()),
                if (!_loading && _offers.isEmpty)
                  const Padding(
                      padding: EdgeInsets.all(24),
                      child: Text('No offers available right now.')),
                ..._offers.map((p) => Card(
                    child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                  p['discountType'] == 'PERCENTAGE'
                                      ? '${p['discountValue']}% off'
                                      : 'PKR ${p['discountValue']} off',
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineSmall),
                              SelectableText(p['code'],
                                  style:
                                      Theme.of(context).textTheme.titleLarge),
                              const SizedBox(height: 8),
                              Text(
                                  'Minimum booking value: PKR ${p['minOrderAmount'] ?? 0}'),
                              Text(
                                  '${p['perCustomerLimit']} uses per customer · ${p['remainingUses'] ?? p['perCustomerLimit']} remaining'),
                              Text(p['expiresAt'] == null
                                  ? 'No expiry date'
                                  : 'Expires: ${DateTime.parse(p['expiresAt']).toUtc().add(const Duration(hours: 5)).toString().substring(0, 16)} Pakistan time'),
                              Text(p['available'] == false
                                  ? 'Allowance used or offer unavailable'
                                  : 'Use this code on the booking screen'),
                            ])))),
              ])));
}
