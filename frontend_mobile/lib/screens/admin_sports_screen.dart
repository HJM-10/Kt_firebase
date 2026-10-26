import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../widgets/clubhouse.dart';
import '../widgets/arena_desk.dart';

class AdminSportsScreen extends StatefulWidget {
  const AdminSportsScreen({super.key});

  @override
  State<AdminSportsScreen> createState() => _AdminSportsScreenState();
}

class _AdminSportsScreenState extends State<AdminSportsScreen> {
  final ApiService _apiService = ApiService();
  List<dynamic> _sports = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchSports();
  }

  Future<void> _fetchSports() async {
    setState(() => _isLoading = true);
    try {
      final res = await _apiService.dio.get('/sports');
      if (mounted) {
        setState(() {
          _sports = res.data['data'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _deleteSport(int id) async {
    try {
      await _apiService.dio.delete('/sports/$id');
      _fetchSports();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Sport deleted')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to delete sport')));
      }
    }
  }

  void _showAddSportDialog({dynamic sport}) {
    final nameCtrl = TextEditingController(text: sport?['name'] ?? '');
    final descCtrl = TextEditingController(text: sport?['description'] ?? '');
    final iconCtrl = TextEditingController(text: sport?['icon'] ?? '');

    showDialog(
      context: context,
      builder: (context) {
        InputDecoration inputDeco(String label) {
          return InputDecoration(
            labelText: label,
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
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(sport == null ? 'Add Sport' : 'Edit Sport',
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.bold)),
                const SizedBox(height: 20),
                TextField(
                    controller: nameCtrl,
                    decoration: inputDeco('Name (e.g., Football)')),
                const SizedBox(height: 16),
                TextField(
                    controller: descCtrl, decoration: inputDeco('Description')),
                const SizedBox(height: 16),
                TextField(
                    controller: iconCtrl,
                    decoration: inputDeco('Icon Name (e.g., sports_tennis)')),
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
                        try {
                          final data = {
                            'name': nameCtrl.text,
                            'description': descCtrl.text,
                            'icon': iconCtrl.text.isEmpty
                                ? 'sports'
                                : iconCtrl.text,
                            'isActive': true,
                          };
                          if (sport == null) {
                            await _apiService.dio.post('/sports', data: data);
                          } else {
                            await _apiService.dio
                                .put('/sports/${sport['id']}', data: data);
                          }
                          if (context.mounted) Navigator.pop(context);
                          _fetchSports();
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                content: Text(
                                    'Error ${sport == null ? 'adding' : 'editing'} sport')));
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
                      child: Text(sport == null ? 'Add Sport' : 'Save Changes',
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                    )
                  ],
                )
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Sports')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _sports.length,
              itemBuilder: (context, index) {
                final sport = _sports[index];
                return ListTile(
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  leading: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: SizedBox(
                          width: 56,
                          child: ClubhouseImage(
                              sport: sport['name'],
                              imageUrl: sport['imageUrl'],
                              height: 56,
                              showCaption: false))),
                  title: Text(sport['name'],
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text('${sport['_count']?['venues'] ?? 0} Venues'),
                  trailing: PopupMenuButton<String>(
                      tooltip: 'Sport actions',
                      icon: const ArenaIcon(ArenaSymbol.more),
                      itemBuilder: (_) => const [
                            PopupMenuItem(
                                value: 'edit', child: Text('Edit sport')),
                            PopupMenuItem(
                                value: 'deactivate',
                                child: Text('Deactivate sport'))
                          ],
                      onSelected: (action) async {
                        if (action == 'edit') {
                          _showAddSportDialog(sport: sport);
                          return;
                        }
                        final confirmed = await showDialog<bool>(
                            context: context,
                            builder: (c) => AlertDialog(
                                    title: Text('Deactivate ${sport['name']}?'),
                                    content: const Text(
                                        'This hides the sport from the customer catalogue.'),
                                    actions: [
                                      TextButton(
                                          onPressed: () =>
                                              Navigator.pop(c, false),
                                          child: const Text('Cancel')),
                                      TextButton(
                                          onPressed: () =>
                                              Navigator.pop(c, true),
                                          child: const Text('Deactivate'))
                                    ]));
                        if (confirmed == true && mounted) {
                          _deleteSport(sport['id']);
                        }
                      }),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddSportDialog(),
        tooltip: 'Add sport',
        child: const ArenaIcon(ArenaSymbol.add),
      ),
    );
  }
}
