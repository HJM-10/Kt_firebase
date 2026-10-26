import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/theme_provider.dart';

const clubhouseForest = Color(0xFF174C36);
const clubhouseBrass = Color(0xFFB28C45);

/// Bundled category imagery for the complete current sports catalogue.
String? sportImageAsset(String sport) {
  final name = sport.trim().toLowerCase();
  if (name.contains('basketball')) return 'basketball';
  if (name.contains('chess')) return 'chess';
  if (name.contains('cricket')) return 'cricket';
  if (name.contains('football')) return 'football';
  if (name.contains('hockey')) return 'hockey';
  if (name.contains('swim')) return 'swimming';
  if (name.contains('padel') ||
      name.contains('paddle') ||
      name.contains('tennis')) {
    return 'padel-v2';
  }
  if (name.contains('polo')) return 'polo';
  return null;
}

String clubPrice(dynamic value) {
  final amount = num.tryParse('$value');
  if (amount == null) return 'Price unavailable';
  if (amount == 0) return 'Free';
  final parts = amount.toStringAsFixed(amount % 1 == 0 ? 0 : 2).split('.');
  final whole = parts.first
      .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  return 'PKR $whole${parts.length > 1 ? '.${parts[1]}' : ''}';
}

IconData sportIcon(String name) {
  final sport = name.toLowerCase();
  if (sport.contains('padel') || sport.contains('tennis')) {
    return Icons.sports_tennis;
  }
  if (sport.contains('football')) return Icons.sports_soccer;
  if (sport.contains('cricket')) return Icons.sports_cricket;
  if (sport.contains('swim')) return Icons.pool;
  if (sport.contains('basket')) return Icons.sports_basketball;
  if (sport.contains('hockey')) return Icons.sports_hockey;
  if (sport.contains('chess')) return Icons.extension_outlined;
  if (sport.contains('polo')) return Icons.sports;
  return Icons.sports_outlined;
}

/// Prefer the venue's supplied photo; generated fallbacks are explicitly labelled.
class ClubhouseImage extends StatelessWidget {
  final String sport;
  final String? imageUrl;
  final double height;
  final bool showCaption;
  const ClubhouseImage(
      {super.key,
      this.sport = 'Padel',
      this.imageUrl,
      this.height = 190,
      this.showCaption = true});

  @override
  Widget build(BuildContext context) {
    final asset = sportImageAsset(sport);
    Widget fallback() => Stack(fit: StackFit.expand, children: [
          if (asset != null)
            Image.asset('assets/clubhouse/$asset.png',
                fit: BoxFit.cover,
                cacheWidth: 1000,
                excludeFromSemantics: true,
                frameBuilder: (_, child, frame, __) =>
                    frame == null ? _SportArtwork(sport: sport) : child,
                errorBuilder: (_, __, ___) => _SportArtwork(sport: sport))
          else
            _SportArtwork(sport: sport),
          if (showCaption)
            Positioned(
                right: 10,
                bottom: 10,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: .65),
                      borderRadius: BorderRadius.circular(6)),
                  child: const Text('Illustrative image',
                      style: TextStyle(color: Colors.white, fontSize: 10)),
                )),
        ]);
    final uri = Uri.tryParse(imageUrl ?? '');
    final remote = uri != null && ['http', 'https'].contains(uri.scheme);
    return Semantics(
        label: '$sport venue image',
        image: true,
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: remote
              ? Image.network(imageUrl!,
                  fit: BoxFit.cover,
                  excludeFromSemantics: true,
                  loadingBuilder: (_, child, progress) =>
                      progress == null ? child : fallback(),
                  errorBuilder: (_, __, ___) => fallback())
              : fallback(),
        ));
  }
}

class _SportArtwork extends StatelessWidget {
  final String sport;
  const _SportArtwork({required this.sport});
  @override
  Widget build(BuildContext context) => ColoredBox(
        color: clubhouseForest,
        child: Stack(alignment: Alignment.center, children: [
          Positioned.fill(child: CustomPaint(painter: _CourtLines())),
          Icon(sportIcon(sport), color: const Color(0xFFE9E5D2), size: 70),
        ]),
      );
}

class _CourtLines extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..color = Colors.white.withValues(alpha: .12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final rect = Rect.fromLTWH(size.width * .08, size.height * .12,
        size.width * .84, size.height * .76);
    canvas.drawRect(rect, line);
    canvas.drawLine(Offset(size.width / 2, rect.top),
        Offset(size.width / 2, rect.bottom), line);
    canvas.drawCircle(size.center(Offset.zero), size.height * .22, line);
  }

  @override
  bool shouldRepaint(_CourtLines oldDelegate) => false;
}

class ThemeToggle extends StatelessWidget {
  const ThemeToggle({super.key});
  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: 'Toggle light or dark theme',
        onPressed: () => context.read<ThemeProvider>().toggleTheme(
            Theme.of(context).brightness == Brightness.dark
                ? ThemeMode.light
                : ThemeMode.dark),
        icon: Icon(Theme.of(context).brightness == Brightness.dark
            ? Icons.light_mode_outlined
            : Icons.dark_mode_outlined),
      );
}

class ClubhouseHeading extends StatelessWidget {
  final String title;
  final String? subtitle;
  const ClubhouseHeading(this.title, {super.key, this.subtitle});
  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: const TextStyle(
                fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -.8)),
        if (subtitle != null) ...[
          const SizedBox(height: 6),
          Text(subtitle!,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  height: 1.4)),
        ],
      ]);
}

class ClubhouseEmpty extends StatelessWidget {
  final String title;
  final String message;
  final IconData icon;
  final VoidCallback? onRetry;
  const ClubhouseEmpty(
      {super.key,
      required this.title,
      required this.message,
      this.icon = Icons.sports_tennis,
      this.onRetry});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 12),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          CircleAvatar(
              radius: 30,
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
              child: Icon(icon,
                  size: 28,
                  color: Theme.of(context).colorScheme.onPrimaryContainer)),
          const SizedBox(height: 16),
          Text(title,
              textAlign: TextAlign.center,
              style:
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(message,
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant)),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('Try again'))
          ],
        ]),
      );
}

class ClubhouseEntrance extends StatelessWidget {
  final Widget child;
  const ClubhouseEntrance({super.key, required this.child});
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 350),
        builder: (_, value, child) => Opacity(
            opacity: value,
            child: Transform.translate(
                offset: Offset(0, 10 * (1 - value)), child: child)),
        child: child,
      );
}
