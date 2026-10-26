import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class EntryQrScannerScreen extends StatefulWidget {
  const EntryQrScannerScreen({super.key});

  @override
  State<EntryQrScannerScreen> createState() => _EntryQrScannerScreenState();
}

class _EntryQrScannerScreenState extends State<EntryQrScannerScreen>
    with WidgetsBindingObserver {
  final _camera = MobileScannerController(
      autoStart: false, formats: const [BarcodeFormat.qrCode]);
  bool _captured = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  Future<void> _start() async {
    if (!mounted || _captured) return;
    setState(() => _error = null);
    try {
      await _camera.start();
    } catch (_) {
      if (mounted) {
        setState(() => _error =
            'Camera unavailable. Allow camera access in your device or browser settings, then try again. You can also enter the pass code manually.');
      }
    }
  }

  Future<void> _stop() async {
    try {
      await _camera.stop();
    } catch (_) {
      // The camera may already be stopped when the app loses focus.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_camera.value.hasCameraPermission) return;
    if (state == AppLifecycleState.resumed) {
      unawaited(_start());
    } else {
      unawaited(_stop());
    }
  }

  void _detect(BarcodeCapture capture) {
    if (_captured) return;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue?.trim();
      if (value == null || value.isEmpty) continue;
      _captured = true;
      unawaited(_finish(value));
      break;
    }
  }

  Future<void> _finish(String value) async {
    await _stop();
    if (mounted) Navigator.pop(context, value);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_camera.dispose());
    super.dispose();
  }

  Widget _cameraError() => Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.no_photography_outlined, size: 44),
            const SizedBox(height: 16),
            Text(
                _error ??
                    'Camera unavailable. Allow camera access in settings or use the pass code instead.',
                textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(
                onPressed: _start, child: const Text('Try camera again')),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Scan entry pass')),
        body: Column(children: [
          const Padding(
            padding: EdgeInsets.all(20),
            child: Text(
                'Point the camera at the player’s booking QR code. '
                'You will confirm check-in on the next screen.',
                textAlign: TextAlign.center),
          ),
          Expanded(
            child: _error != null
                ? _cameraError()
                : ClipRect(
                    child: MobileScanner(
                      controller: _camera,
                      onDetect: _detect,
                      errorBuilder: (context, error) => _cameraError(),
                    ),
                  ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: OutlinedButton.icon(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.keyboard_outlined),
                label: const Text('Enter code instead'),
              ),
            ),
          ),
        ]),
      );
}
