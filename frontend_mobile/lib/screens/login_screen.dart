import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/clubhouse.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _isLoading = false, _obscure = true;
  Future<void> _login() async {
    if (_isLoading) return;
    if (_emailCtrl.text.trim().isEmpty || _passwordCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Enter your email and password to sign in.')));
      return;
    }
    setState(() => _isLoading = true);
    final error = await context
        .read<AuthProvider>()
        .login(_emailCtrl.text.trim(), _passwordCtrl.text);
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (error != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error)));
    }
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
          centerTitle: true,
          leading: const SizedBox(width: 48),
          title: const Text('KT Smart Sport Hub',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          actions: const [ThemeToggle()]),
      body: Center(
          child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                child: AutofillGroup(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                      ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: const ClubhouseImage(height: 170)),
                      const SizedBox(height: 24),
                      const ClubhouseEntrance(
                          child: ClubhouseHeading('Good to have\nyou back.',
                              subtitle: 'Your next game starts here.')),
                      const SizedBox(height: 26),
                      TextField(
                          controller: _emailCtrl,
                          enabled: !_isLoading,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          autofillHints: const [AutofillHints.username],
                          decoration: const InputDecoration(
                              labelText: 'Email',
                              prefixIcon: Icon(Icons.mail_outline))),
                      const SizedBox(height: 16),
                      TextField(
                          controller: _passwordCtrl,
                          enabled: !_isLoading,
                          obscureText: _obscure,
                          autofillHints: const [AutofillHints.password],
                          onSubmitted: (_) => _login(),
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
                      const SizedBox(height: 22),
                      ElevatedButton(
                          onPressed: _isLoading ? null : _login,
                          child: _isLoading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white))
                              : const Text('Login')),
                      const SizedBox(height: 8),
                      TextButton(
                          onPressed: _isLoading
                              ? null
                              : () => Navigator.pushReplacementNamed(
                                  context, '/signup'),
                          child: const Text("Don't have an account? Sign up")),
                      const SizedBox(height: 16),
                      Text('BOOK  /  PLAY  /  BELONG',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              color: colors.secondary,
                              letterSpacing: 3,
                              fontSize: 10,
                              fontWeight: FontWeight.w700)),
                    ])),
              ))),
    );
  }
}
