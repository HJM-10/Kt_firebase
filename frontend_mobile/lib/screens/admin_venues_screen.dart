import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'slots_screen.dart';

class AdminVenuesScreen extends StatefulWidget {
  const AdminVenuesScreen({super.key});

  @override
  State<AdminVenuesScreen> createState() => _AdminVenuesScreenState();
}

class _AdminVenuesScreenState extends State<AdminVenuesScreen> {
  final ApiService _apiService = ApiService();
  List<dynamic> _venues = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchVenues();
  }

  Future<void> _fetchVenues() async {
    setState(() => _isLoading = true);
    try {
      final res = await _apiService.dio.get('/venues');
      if (mounted) {
        setState(() {
          _venues = res.data['data'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _deleteVenue(int id) async {
    try {
      await _apiService.dio.delete('/venues/$id');
      _fetchVenues();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Failed to delete')));
      }
    }
  }

  void _showAddVenueDialog({dynamic venue}) async {
    final nameCtrl = TextEditingController(text: venue?['name'] ?? '');
    final descCtrl = TextEditingController(text: venue?['description'] ?? '');
    final priceCtrl = TextEditingController(
        text: venue != null ? venue['pricePerSlot'].toString() : '');
    final capacityCtrl = TextEditingController(
        text: venue != null && venue['capacity'] != null
            ? venue['capacity'].toString()
            : '');

    // Fetch sports for dropdown
    List<dynamic> sports = [];
    try {
      final res = await _apiService.dio.get('/sports');
      sports = res.data['data'];
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to load sports')));
      }
      return;
    }

    if (!mounted || sports.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Please add a sport first')));
      }
      return;
    }

    int selectedSportId = venue != null ? venue['sportId'] : sports.first['id'];

    if (!mounted) return;

    showDialog(
        context: context,
        builder: (context) {
          return StatefulBuilder(builder: (context, setDialogState) {
            InputDecoration inputDeco(String label, IconData icon) {
              return InputDecoration(
                labelText: label,
                prefixIcon:
                    Icon(icon, color: Theme.of(context).colorScheme.primary),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none),
                filled: true,
                fillColor: Theme.of(context).brightness == Brightness.dark
                    ? Colors.white.withValues(alpha: 0.05)
                    : Colors.black.withValues(alpha: 0.05),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              );
            }

            return Dialog(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20)),
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(venue == null ? 'Add New Venue' : 'Edit Venue',
                          style: const TextStyle(
                              fontSize: 22, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 20),
                      TextField(
                          controller: nameCtrl,
                          decoration:
                              inputDeco('Venue Name', Icons.location_on)),
                      const SizedBox(height: 16),
                      TextField(
                          controller: descCtrl,
                          decoration:
                              inputDeco('Description', Icons.description)),
                      const SizedBox(height: 16),
                      TextField(
                          controller: priceCtrl,
                          decoration: inputDeco(
                              'Price Per Slot (Rs)', Icons.attach_money),
                          keyboardType: TextInputType.number),
                      const SizedBox(height: 16),
                      TextField(
                          controller: capacityCtrl,
                          decoration:
                              inputDeco('Capacity (People)', Icons.group),
                          keyboardType: TextInputType.number),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<int>(
                        initialValue: selectedSportId,
                        items: sports
                            .map((s) => DropdownMenuItem<int>(
                                value: s['id'], child: Text(s['name'])))
                            .toList(),
                        onChanged: (val) =>
                            setDialogState(() => selectedSportId = val!),
                        decoration: inputDeco('Sport', Icons.sports_soccer),
                        icon: Icon(Icons.arrow_drop_down,
                            color: Theme.of(context).colorScheme.primary),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                              onPressed: () => Navigator.pop(context),
                              child: const Text('Cancel',
                                  style: TextStyle(color: Colors.grey))),
                          const SizedBox(width: 12),
                          ElevatedButton(
                            onPressed: () async {
                              if (nameCtrl.text.isEmpty ||
                                  priceCtrl.text.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                        content: Text(
                                            'Name and Price are required')));
                                return;
                              }
                              try {
                                final data = {
                                  'name': nameCtrl.text,
                                  'description': descCtrl.text,
                                  'sportId': selectedSportId,
                                  'pricePerSlot': num.parse(priceCtrl.text),
                                  'capacity': capacityCtrl.text.isNotEmpty
                                      ? int.parse(capacityCtrl.text)
                                      : null,
                                };
                                if (venue == null) {
                                  await _apiService.dio
                                      .post('/venues', data: data);
                                } else {
                                  await _apiService.dio.put(
                                      '/venues/${venue['id']}',
                                      data: data);
                                }
                                if (context.mounted) Navigator.pop(context);
                                _fetchVenues();
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                          content: Text(
                                              'Error ${venue == null ? 'adding' : 'editing'} venue')));
                                }
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF174C36),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 24, vertical: 12),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8)),
                            ),
                            child: Text(
                                venue == null ? 'Create Venue' : 'Save Changes',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold)),
                          )
                        ],
                      )
                    ],
                  ),
                ),
              ),
            );
          });
        });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Venues')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _venues.length,
              itemBuilder: (context, index) {
                final venue = _venues[index];
                return ListTile(
                  title: Text(venue['name']),
                  subtitle: Text(venue['sport']?['name'] ?? 'Unknown Sport'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                          icon: const Icon(Icons.calendar_month),
                          tooltip: 'Manage availability',
                          onPressed: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) =>
                                      SlotsScreen(venueId: venue['id'])))),
                      IconButton(
                          icon: Icon(Icons.edit,
                              color: Theme.of(context).colorScheme.primary),
                          onPressed: () => _showAddVenueDialog(venue: venue)),
                      IconButton(
                          icon: const Icon(Icons.delete, color: Colors.red),
                          onPressed: () => _deleteVenue(venue['id'])),
                    ],
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddVenueDialog(),
        child: const Icon(Icons.add),
      ),
    );
  }
}
