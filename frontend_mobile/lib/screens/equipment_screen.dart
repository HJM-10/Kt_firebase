import '../services/live_refresh.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';
import '../services/payment_service.dart';

class EquipmentScreen extends StatefulWidget {
  const EquipmentScreen({super.key});

  @override
  State<EquipmentScreen> createState() => _EquipmentScreenState();
}

class _EquipmentScreenState extends State<EquipmentScreen>
    with LiveRefresh<EquipmentScreen> {
  @override
  List<String> get liveResources => ['equipment'];
  @override
  Future<void> refreshForLiveUpdates() => _fetchEquipment();
  final ApiService _apiService = ApiService();
  List<dynamic> _equipment = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchEquipment();
  }

  Future<void> _fetchEquipment() async {
    try {
      final res = await _apiService.dio.get('/equipment');
      if (!mounted) return;
      setState(() {
        _equipment = res.data['data'];
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  void _showRentalDialog(Map<String, dynamic> eq) {
    showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: const Text('Confirm Rental'),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Equipment: ${eq['name']}',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 8),
                Text('Fee: Rs. ${eq['pricePerSlot']}',
                    style: const TextStyle(
                        color: Colors.green, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                Text((eq['pricePerSlot'] as num) == 0
                    ? 'Confirm this free equipment rental?'
                    : 'To complete your rental, you will be redirected to our secure payment gateway to pay the fee. Your rental is only confirmed after the payment is verified.'),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  _processRental(eq['id'] as int);
                },
                child: Text((eq['pricePerSlot'] as num) == 0
                    ? 'Confirm rental'
                    : 'Proceed to Pay'),
              ),
            ],
          );
        });
  }

  Future<void> _processRental(int eqId) async {
    try {
      final rentalDate =
          DateTime.now().add(const Duration(hours: 1)).toIso8601String();
      final res = await _apiService.dio.post('/equipment/$eqId/rent',
          data: {'quantity': 1, 'rentalDate': rentalDate});
      if (res.data['success']) {
        if ((res.data['data']['totalPrice'] as num) > 0 &&
            res.data['data']['paymentId'] != null) {
          await PaymentService.checkout(res.data['data']['paymentId']);
        }
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Rental processed successfully!')),
        );
        _fetchEquipment();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(apiErrorMessage(e))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(title: const Text('Equipment Rental')),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : GridView.builder(
                padding: const EdgeInsets.all(16),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.75,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16),
                itemCount: _equipment.length,
                itemBuilder: (context, index) {
                  final eq = _equipment[index];
                  final isAvailable = eq['isActive'] && eq['quantity'] > 0;
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Center(
                              child: Icon(Icons.sports_soccer,
                                  size: 48,
                                  color:
                                      Theme.of(context).colorScheme.primary)),
                          const Spacer(),
                          Text(eq['name'],
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          Text('Rs. ${eq['pricePerSlot']} / slot',
                              style: const TextStyle(
                                  color: Colors.green,
                                  fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          Text('${eq['quantity']} total stock',
                              style: const TextStyle(
                                  fontSize: 12, color: Colors.grey)),
                          const SizedBox(height: 8),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: isAvailable
                                  ? () => _showRentalDialog(eq)
                                  : null,
                              child: Text((eq['pricePerSlot'] as num) == 0
                                  ? 'Rent for free'
                                  : 'Pay Rs. ${eq['pricePerSlot']}'),
                            ),
                          )
                        ],
                      ),
                    ),
                  );
                },
              ));
  }
}
