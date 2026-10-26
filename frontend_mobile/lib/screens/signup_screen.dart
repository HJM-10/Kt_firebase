import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/clubhouse.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});
  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _nameCtrl = TextEditingController(),
      _emailCtrl = TextEditingController(),
      _passwordCtrl = TextEditingController(),
      _phoneCtrl = TextEditingController();
  bool _loading = false, _obscure = true;
  @override
  void dispose() {
    for (final controller in [
      _nameCtrl,
      _emailCtrl,
      _passwordCtrl,
      _phoneCtrl
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _signup() async {
    if (_loading) return;
    if (_nameCtrl.text.trim().isEmpty ||
        _emailCtrl.text.trim().isEmpty ||
        _passwordCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Enter your name, email and password.')));
      return;
    }
    setState(() => _loading = true);
    final auth = context.read<AuthProvider>();
    final success = await auth.signup(_nameCtrl.text.trim(),
        _emailCtrl.text.trim(), _passwordCtrl.text, _phoneCtrl.text.trim());
    if (!mounted) return;
    setState(() => _loading = false);
    if (success) {
      Navigator.pushReplacementNamed(context, '/login');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(auth.lastError ?? 'Signup failed. Please try again.')));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
            title: const Text('Join the club'), actions: const [ThemeToggle()]),
        body: Center(
            child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: AutofillGroup(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                        const ClubhouseHeading('More play.\nBetter days.',
                            subtitle: 'Create your Smart Sports Hub account.'),
                        const SizedBox(height: 28),
                        TextField(
                            controller: _nameCtrl,
                            enabled: !_loading,
                            autofillHints: const [AutofillHints.name],
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(
                                labelText: 'Full Name',
                                prefixIcon: Icon(Icons.person_outline))),
                        const SizedBox(height: 16),
                        TextField(
                            controller: _emailCtrl,
                            enabled: !_loading,
                            autofillHints: const [AutofillHints.email],
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(
                                labelText: 'Email',
                                prefixIcon: Icon(Icons.mail_outline))),
                        const SizedBox(height: 16),
                        TextField(
                            controller: _phoneCtrl,
                            enabled: !_loading,
                            autofillHints: const [
                              AutofillHints.telephoneNumber
                            ],
                            keyboardType: TextInputType.phone,
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(
                                labelText: 'Phone',
                                prefixIcon: Icon(Icons.phone_outlined))),
                        const SizedBox(height: 16),
                        TextField(
                            controller: _passwordCtrl,
                            enabled: !_loading,
                            obscureText: _obscure,
                            autofillHints: const [AutofillHints.newPassword],
                            onSubmitted: (_) => _signup(),
                            decoration: InputDecoration(
                                labelText: 'Password',
                                prefixIcon: const Icon(Icons.lock_outline),
                                suffixIcon: IconButton(
                                    tooltip: _obscure
                                        ? 'Show password'
                                        : 'Hide password',
                                    onPressed: () =>
                                        setState(() => _obscure = !_obscure),
                                    icon: Icon(_obscure
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined)))),
                        const SizedBox(height: 24),
                        ElevatedButton(
                            onPressed: _loading ? null : _signup,
                            child: _loading
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: Colors.white))
                                : const Text('Create account')),
                        TextButton(
                            onPressed: _loading
                                ? null
                                : () => Navigator.pushReplacementNamed(
                                    context, '/login'),
                            child:
                                const Text('Already have an account? Login')),
                      ])),
                ))),
      );
}
