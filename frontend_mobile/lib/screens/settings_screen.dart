import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/theme_provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';
import '../widgets/clubhouse.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final ApiService _apiService = ApiService();

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  final _oldPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isProfileLoading = false;
  bool _isPasswordLoading = false;

  @override
  void initState() {
    super.initState();
    final user = Provider.of<AuthProvider>(context, listen: false).user;
    if (user != null) {
      _nameController.text = user['name'] ?? '';
      _phoneController.text = user['phone'] ?? '';
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _oldPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _updateProfile() async {
    setState(() => _isProfileLoading = true);
    try {
      await _apiService.dio.put('/auth/me', data: {
        'name': _nameController.text,
        'phone': _phoneController.text,
      });
      // Update in-memory user so dashboard name refreshes immediately
      if (mounted) {
        Provider.of<AuthProvider>(context, listen: false).updateUser({
          'name': _nameController.text,
          'phone': _phoneController.text,
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(apiErrorMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _isProfileLoading = false);
    }
  }

  Future<void> _changePassword() async {
    if (_newPasswordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('New passwords do not match')),
      );
      return;
    }

    setState(() => _isPasswordLoading = true);
    try {
      await _apiService.dio.put('/auth/password', data: {
        'oldPassword': _oldPasswordController.text,
        'newPassword': _newPasswordController.text,
      });

      _oldPasswordController.clear();
      _newPasswordController.clear();
      _confirmPasswordController.clear();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password changed successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(apiErrorMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _isPasswordLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final user = Provider.of<AuthProvider>(context).user;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile & appearance')),
      body: ListView(
        padding: const EdgeInsets.all(20.0),
        children: [
          Row(children: [
            CircleAvatar(
                radius: 28,
                backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                child: Icon(Icons.person_outline,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                    size: 30)),
            const SizedBox(width: 14),
            Expanded(
                child: Text(user?['name'] ?? 'Player',
                    style: const TextStyle(
                        fontSize: 26, fontWeight: FontWeight.w800))),
          ]),
          const SizedBox(height: 24),
          const ClubhouseHeading('Make yourself at home.'),
          const SizedBox(height: 24),
          Card(
              margin: EdgeInsets.zero,
              child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Your appearance',
                            style: TextStyle(
                                fontSize: 18, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        const Text(
                            'Warm days. Calm evenings. Choose what feels right.'),
                        const SizedBox(height: 16),
                        Wrap(spacing: 8, runSpacing: 8, children: [
                          for (final mode in ThemeMode.values)
                            ChoiceChip(
                                avatar: Icon(
                                    mode == ThemeMode.light
                                        ? Icons.light_mode_outlined
                                        : mode == ThemeMode.dark
                                            ? Icons.dark_mode_outlined
                                            : Icons.brightness_auto_outlined,
                                    size: 18),
                                label: Text(mode == ThemeMode.light
                                    ? 'Light'
                                    : mode == ThemeMode.dark
                                        ? 'Dark'
                                        : 'System'),
                                selected: themeProvider.themeMode == mode,
                                onSelected: (_) =>
                                    themeProvider.toggleTheme(mode)),
                        ]),
                      ]))),
          const SizedBox(height: 20),
          Card(
              margin: EdgeInsets.zero,
              child: Column(children: [
                ListTile(
                    leading: const Icon(Icons.receipt_long_outlined),
                    title: const Text('Payments & invoices'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.pushNamed(context, '/payments')),
                ListTile(
                    leading: const Icon(Icons.card_membership_outlined),
                    title: const Text('Membership'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.pushNamed(context, '/membership')),
                ListTile(
                    leading: const Icon(Icons.support_agent),
                    title: const Text('Help & support'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.pushNamed(context, '/complaints')),
              ])),
          const SizedBox(height: 28),
          // PROFILE SECTION
          const Text('Profile Information',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          TextField(
            controller: _nameController,
            decoration: const InputDecoration(
                labelText: 'Full Name', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 16),
          TextFormField(
            enabled: false,
            initialValue: user?['email'] ?? '',
            decoration: const InputDecoration(
                labelText: 'Email Address', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _phoneController,
            decoration: const InputDecoration(
                labelText: 'Phone Number', border: OutlineInputBorder()),
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _isProfileLoading ? null : _updateProfile,
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: _isProfileLoading
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text('Save Profile'),
          ),

          const SizedBox(height: 32),
          const Divider(),
          const SizedBox(height: 16),

          // PASSWORD SECTION
          const Text('Change Password',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          TextField(
            controller: _oldPasswordController,
            decoration: const InputDecoration(
                labelText: 'Current Password', border: OutlineInputBorder()),
            obscureText: true,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _newPasswordController,
            decoration: const InputDecoration(
                labelText: 'New Password', border: OutlineInputBorder()),
            obscureText: true,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _confirmPasswordController,
            decoration: const InputDecoration(
                labelText: 'Confirm New Password',
                border: OutlineInputBorder()),
            obscureText: true,
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _isPasswordLoading ? null : _changePassword,
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: _isPasswordLoading
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text('Update Password'),
          ),

          const SizedBox(height: 32),
          const Divider(),
          const SizedBox(height: 16),

          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Logout', style: TextStyle(color: Colors.red)),
            onTap: () {
              Provider.of<AuthProvider>(context, listen: false).logout();
            },
          ),
        ],
      ),
    );
  }
}
