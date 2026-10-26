import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../utils/arena_desk.dart';
import 'clubhouse.dart';

enum ArenaSymbol {
  overview,
  calendar,
  court,
  more,
  scan,
  add,
  user,
  money,
  trophy,
  events,
  report,
  equipment,
  fixtures,
  settings,
  logout,
  arrow,
  sun,
  moon,
  refresh
}

/// A single stroke language for Arena Desk, independent of the Material icon font.
class ArenaIcon extends StatelessWidget {
  final ArenaSymbol symbol;
  final double size;
  final Color? color;
  const ArenaIcon(this.symbol, {super.key, this.size = 24, this.color});
  @override
  Widget build(BuildContext context) => Center(
      widthFactor: 1,
      heightFactor: 1,
      child: SizedBox(
          width: size,
          height: size,
          child: CustomPaint(
              painter: _ArenaIconPainter(
                  symbol,
                  color ??
                      IconTheme.of(context).color ??
                      Theme.of(context).colorScheme.onSurface))));
}

class _ArenaIconPainter extends CustomPainter {
  final ArenaSymbol symbol;
  final Color color;
  const _ArenaIconPainter(this.symbol, this.color);
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 24, size.height / 24);
    final pen = Paint()
      ..color = color
      ..strokeWidth = 1.65
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    void line(double x, double y, double a, double b) =>
        canvas.drawLine(Offset(x, y), Offset(a, b), pen);
    void box(double x, double y, double w, double h, [double r = 2]) =>
        canvas.drawRRect(
            RRect.fromRectAndRadius(
                Rect.fromLTWH(x, y, w, h), Radius.circular(r)),
            pen);
    void circle(double x, double y, double r) =>
        canvas.drawCircle(Offset(x, y), r, pen);
    switch (symbol) {
      case ArenaSymbol.overview:
        canvas.drawPath(
            Path()
              ..moveTo(3, 11)
              ..lineTo(12, 3)
              ..lineTo(21, 11)
              ..moveTo(5, 10)
              ..lineTo(5, 21)
              ..lineTo(10, 21)
              ..lineTo(10, 15)
              ..lineTo(14, 15)
              ..lineTo(14, 21)
              ..lineTo(19, 21)
              ..lineTo(19, 10),
            pen);
      case ArenaSymbol.calendar:
      case ArenaSymbol.events:
        box(3, 5, 18, 16);
        line(7, 3, 7, 8);
        line(17, 3, 17, 8);
        line(3, 10, 21, 10);
        if (symbol == ArenaSymbol.calendar) {
          box(7, 14, 3, 3, .3);
          line(14, 15, 17, 15);
        } else {
          circle(12, 15, 2);
        }
      case ArenaSymbol.court:
        box(3, 3, 18, 18, 1);
        line(12, 3, 12, 21);
        line(3, 9, 21, 9);
        line(3, 15, 21, 15);
        line(7, 9, 7, 15);
        line(17, 9, 17, 15);
      case ArenaSymbol.more:
        for (final x in [5.0, 12.0, 19.0]) {
          canvas.drawCircle(Offset(x, 12), 1.5, Paint()..color = color);
        }
      case ArenaSymbol.scan:
        for (final p in [
          const Offset(3, 3),
          const Offset(15, 3),
          const Offset(3, 15),
          const Offset(15, 15)
        ]) {
          box(p.dx, p.dy, 6, 6, 1);
        }
        line(2, 12, 22, 12);
      case ArenaSymbol.add:
        circle(9, 7, 3);
        canvas.drawArc(
            const Rect.fromLTWH(3, 12, 12, 9), math.pi, math.pi, false, pen);
        line(19, 12, 19, 20);
        line(15, 16, 23, 16);
      case ArenaSymbol.user:
        circle(12, 7, 4);
        canvas.drawArc(
            const Rect.fromLTWH(4, 13, 16, 12), math.pi, math.pi, false, pen);
        line(4, 19, 20, 19);
      case ArenaSymbol.money:
        canvas.drawOval(const Rect.fromLTWH(4, 3, 16, 6), pen);
        for (final y in [6.0, 10.0, 14.0]) {
          canvas.drawArc(Rect.fromLTWH(4, y, 16, 7), 0, math.pi, false, pen);
          line(4, y + 1, 4, y + 4);
          line(20, y + 1, 20, y + 4);
        }
      case ArenaSymbol.trophy:
        canvas.drawPath(
            Path()
              ..moveTo(7, 3)
              ..lineTo(17, 3)
              ..lineTo(16, 11)
              ..quadraticBezierTo(12, 18, 8, 11)
              ..close(),
            pen);
        line(12, 15, 12, 21);
        line(8, 21, 16, 21);
        canvas.drawArc(
            const Rect.fromLTWH(3, 4, 8, 8), math.pi / 2, math.pi, false, pen);
        canvas.drawArc(const Rect.fromLTWH(13, 4, 8, 8), -math.pi / 2, math.pi,
            false, pen);
      case ArenaSymbol.report:
        box(4, 3, 16, 18);
        line(8, 17, 8, 13);
        line(12, 17, 12, 9);
        line(16, 17, 16, 6);
      case ArenaSymbol.equipment:
        canvas.drawOval(const Rect.fromLTWH(3, 3, 12, 14), pen);
        line(12, 15, 20, 22);
        line(7, 5, 7, 14);
        line(11, 5, 11, 14);
        line(5, 8, 13, 8);
        line(5, 12, 13, 12);
      case ArenaSymbol.fixtures:
        box(3, 3, 6, 5, 1);
        box(15, 3, 6, 5, 1);
        box(9, 16, 6, 5, 1);
        line(6, 8, 6, 12);
        line(18, 8, 18, 12);
        line(6, 12, 18, 12);
        line(12, 12, 12, 16);
      case ArenaSymbol.settings:
        for (final y in [5.0, 12.0, 19.0]) {
          line(3, y, 21, y);
        }
        circle(8, 5, 2.5);
        circle(16, 12, 2.5);
        circle(10, 19, 2.5);
      case ArenaSymbol.logout:
        canvas.drawPath(
            Path()
              ..moveTo(11, 3)
              ..lineTo(4, 3)
              ..lineTo(4, 21)
              ..lineTo(11, 21),
            pen);
        line(10, 12, 22, 12);
        line(18, 8, 22, 12);
        line(18, 16, 22, 12);
      case ArenaSymbol.arrow:
        line(4, 12, 20, 12);
        line(14, 6, 20, 12);
        line(14, 18, 20, 12);
      case ArenaSymbol.sun:
        circle(12, 12, 4);
        for (var i = 0; i < 8; i++) {
          final a = i * math.pi / 4;
          line(12 + 7 * math.cos(a), 12 + 7 * math.sin(a),
              12 + 10 * math.cos(a), 12 + 10 * math.sin(a));
        }
      case ArenaSymbol.moon:
        canvas.drawPath(
            Path()
              ..moveTo(15, 3)
              ..cubicTo(5, 1, 0, 15, 10, 20)
              ..cubicTo(16, 23, 22, 18, 21, 12)
              ..cubicTo(14, 17, 9, 10, 15, 3),
            pen);
      case ArenaSymbol.refresh:
        canvas.drawArc(const Rect.fromLTWH(4, 4, 16, 16), .3, 5.1, false, pen);
        line(18, 2, 18, 7);
        line(18, 7, 13, 7);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_ArenaIconPainter old) =>
      old.symbol != symbol || old.color != color;
}

class ArenaEmpty extends StatelessWidget {
  final String title, message;
  final ArenaSymbol symbol;
  final VoidCallback? onRetry;
  const ArenaEmpty(
      {super.key,
      required this.title,
      required this.message,
      this.symbol = ArenaSymbol.court,
      this.onRetry});
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 12),
      child: Column(children: [
        ArenaIcon(symbol,
            size: 34, color: Theme.of(context).colorScheme.secondary),
        const SizedBox(height: 14),
        Text(title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
        const SizedBox(height: 8),
        Text(message,
            textAlign: TextAlign.center,
            style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                height: 1.4)),
        if (onRetry != null) ...[
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Try again'))
        ],
      ]));
}

class ArenaStatus extends StatelessWidget {
  final String label;
  const ArenaStatus(this.label, {super.key});
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final muted = [
      'Cancelled',
      'Inactive',
      'Past session',
      'Past schedule',
      'Day complete',
      'No sessions published'
    ].contains(label);
    final pending = label.toLowerCase().contains('payment');
    final color = muted
        ? colors.onSurfaceVariant
        : pending
            ? colors.secondary
            : colors.primary;
    return Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
            color: color.withValues(alpha: .12),
            borderRadius: BorderRadius.circular(8)),
        child: Text(label,
            style: TextStyle(
                color: color, fontSize: 11, fontWeight: FontWeight.w700)));
  }
}

/// A sport diagram, never presented as a measured plan of a real facility.
class ArenaCourtPlan extends StatelessWidget {
  final String sport;
  const ArenaCourtPlan(this.sport, {super.key});
  @override
  Widget build(BuildContext context) => Semantics(
      label: '$sport court diagram',
      image: true,
      child: AspectRatio(
          aspectRatio: 1.5,
          child: CustomPaint(painter: _CourtPlanPainter(sport))));
}

class _CourtPlanPainter extends CustomPainter {
  final String sport;
  const _CourtPlanPainter(this.sport);
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRRect(
        RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(8)),
        Paint()..color = clubhouseForest);
    canvas.save();
    canvas.translate(size.width * .08, size.height * .12);
    canvas.scale(size.width * .84 / 100, size.height * .76 / 60);
    final pen = Paint()
      ..color = const Color(0xFFE5E8CF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final name = sport.toLowerCase();
    if (name.contains('chess')) {
      for (var y = 0; y < 8; y++) {
        for (var x = 0; x < 8; x++) {
          canvas.drawRect(
              Rect.fromLTWH(x * 12.5, y * 7.5, 12.5, 7.5),
              Paint()
                ..color = (x + y).isEven
                    ? const Color(0xFFE5E8CF)
                    : const Color(0xFF356A4D));
        }
      }
    } else {
      canvas.drawRect(const Rect.fromLTWH(0, 0, 100, 60), pen);
      if (name.contains('swim')) {
        for (var i = 1; i < 6; i++) {
          canvas.drawLine(Offset(0, i * 10), Offset(100, i * 10), pen);
        }
      } else if (name.contains('cricket')) {
        canvas.drawOval(const Rect.fromLTWH(5, 3, 90, 54), pen);
        canvas.drawRect(const Rect.fromLTWH(42, 12, 16, 36), pen);
      } else {
        canvas.drawLine(const Offset(50, 0), const Offset(50, 60), pen);
        if (name.contains('padel') || name.contains('tennis')) {
          canvas.drawRect(const Rect.fromLTWH(20, 10, 60, 40), pen);
          canvas.drawLine(const Offset(20, 30), const Offset(80, 30), pen);
        } else if (name.contains('basket')) {
          canvas.drawCircle(const Offset(50, 30), 9, pen);
          canvas.drawRect(const Rect.fromLTWH(0, 20, 16, 20), pen);
          canvas.drawRect(const Rect.fromLTWH(84, 20, 16, 20), pen);
          canvas.drawArc(const Rect.fromLTWH(-20, 7, 42, 46), -math.pi / 2,
              math.pi, false, pen);
          canvas.drawArc(const Rect.fromLTWH(78, 7, 42, 46), math.pi / 2,
              math.pi, false, pen);
        } else if (name.contains('hockey')) {
          canvas.drawCircle(const Offset(50, 30), 1, pen);
          canvas.drawArc(const Rect.fromLTWH(-18, 10, 36, 40), -math.pi / 2,
              math.pi, false, pen);
          canvas.drawArc(const Rect.fromLTWH(82, 10, 36, 40), math.pi / 2,
              math.pi, false, pen);
        } else if (name.contains('polo')) {
          canvas.drawCircle(const Offset(50, 30), 1, pen);
          for (final x in [0.0, 100.0]) {
            canvas.drawLine(Offset(x, 23), Offset(x, 27), pen);
            canvas.drawLine(Offset(x, 33), Offset(x, 37), pen);
          }
        } else {
          canvas.drawCircle(const Offset(50, 30), 10, pen);
          canvas.drawRect(const Rect.fromLTWH(0, 14, 15, 32), pen);
          canvas.drawRect(const Rect.fromLTWH(85, 14, 15, 32), pen);
        }
      }
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_CourtPlanPainter old) => old.sport != sport;
}

class ArenaSchedule extends StatelessWidget {
  final List<Map<String, dynamic>> venues;
  final String date;
  final DateTime now;
  final void Function(Map<String, dynamic>, Map<String, dynamic>) onSlot;
  const ArenaSchedule(
      {super.key,
      required this.venues,
      required this.date,
      required this.now,
      required this.onSlot});
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final slots = venues.expand((v) => arenaMaps(v['slots'])).toList();
    if (slots.isEmpty) {
      return const ArenaEmpty(
          title: 'A clear schedule.',
          message: 'Publish sessions from Courts to start planning the day.',
          symbol: ArenaSymbol.calendar);
    }
    final first = math.min(21,
        slots.map((s) => arenaMinutes(s['startTime']) ~/ 60).reduce(math.min));
    final last = math.min(
        24,
        math.max(
            first + 3,
            slots
                .map((s) => (arenaMinutes(s['endTime']) / 60).ceil())
                .reduce(math.max)));
    final width = (last - first) * 96.0;
    final rowHeight =
        64.0 * MediaQuery.textScalerOf(context).scale(1).clamp(1, 1.7);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Swipe the timetable to see more hours.',
          style: TextStyle(color: colors.onSurfaceVariant, fontSize: 12)),
      const SizedBox(height: 12),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
            width: 96,
            child: Column(children: [
              const SizedBox(height: 32),
              ...venues.map((v) => SizedBox(
                  height: rowHeight,
                  child: Align(
                      alignment: Alignment.centerLeft,
                      child: Padding(
                          padding: const EdgeInsets.only(right: 10),
                          child: Text(v['name'],
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600))))))
            ])),
        Expanded(
            child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                    width: width,
                    child: Column(children: [
                      SizedBox(
                          height: 32,
                          child: Row(children: [
                            for (var hour = first; hour < last; hour++)
                              SizedBox(
                                  width: 96,
                                  child: Text(
                                      arenaTime(
                                          '${hour.toString().padLeft(2, '0')}:00'),
                                      style: TextStyle(
                                          fontSize: 11,
                                          color: colors.onSurfaceVariant)))
                          ])),
                      ...venues.map((venue) => SizedBox(
                          height: rowHeight,
                          child: Stack(children: [
                            Positioned.fill(
                                child: Row(children: [
                              for (var hour = first; hour < last; hour++)
                                Container(
                                    width: 96,
                                    decoration: BoxDecoration(
                                        border: Border(
                                            left: BorderSide(
                                                color: colors.outlineVariant),
                                            bottom: BorderSide(
                                                color: colors.outlineVariant))))
                            ])),
                            ...arenaMaps(venue['slots']).map((slot) {
                              final booking = slotBooking(slot);
                              final inactive = venue['isActive'] == false ||
                                  venue['sport']?['isActive'] == false;
                              final label = inactive && booking == null
                                  ? 'Inactive'
                                  : slotLabel(slot, date, now);
                              final open = label == 'Open session',
                                  pending = label == 'Awaiting payment',
                                  past = label == 'Past session' ||
                                      label == 'Inactive';
                              final bg = pending
                                  ? colors.secondaryContainer
                                  : open
                                      ? colors.surface
                                      : past
                                          ? colors.surfaceContainerHighest
                                          : clubhouseForest;
                              final fg = pending
                                  ? colors.onSecondaryContainer
                                  : open || past
                                      ? colors.onSurface
                                      : Colors.white;
                              final start = arenaMinutes(slot['startTime']),
                                  end = arenaMinutes(slot['endTime']);
                              return Positioned(
                                  left: (start - first * 60) * 1.6 + 2,
                                  top: 6,
                                  width: math.max(12, (end - start) * 1.6 - 4),
                                  height: rowHeight - 12,
                                  child: Semantics(
                                      button: true,
                                      label:
                                          '${venue['name']}, ${arenaTime(slot['startTime'])} to ${arenaTime(slot['endTime'])}, $label',
                                      child: Material(
                                          color: bg,
                                          shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(6),
                                              side: BorderSide(
                                                  color: open
                                                      ? colors.outline
                                                      : Colors.transparent)),
                                          child: InkWell(
                                              borderRadius:
                                                  BorderRadius.circular(6),
                                              onTap: () => onSlot(venue, slot),
                                              child: Padding(
                                                  padding:
                                                      const EdgeInsets.all(6),
                                                  child: Center(
                                                      child: Text(
                                                          booking?['user']?['name'] ??
                                                              label,
                                                          maxLines: 2,
                                                          overflow: TextOverflow
                                                              .ellipsis,
                                                          style: TextStyle(
                                                              color: fg,
                                                              fontSize: 11,
                                                              fontWeight: FontWeight.w600))))))));
                            }),
                          ]))),
                    ])))),
      ]),
      const SizedBox(height: 12),
      Wrap(spacing: 14, runSpacing: 8, children: [
        _legend(context, 'Reserved', clubhouseForest),
        _legend(context, 'Open session', colors.surface, outline: true),
        _legend(context, 'Awaiting payment', colors.secondaryContainer)
      ]),
      const SizedBox(height: 8),
      Text('Blank areas have no published session.',
          style: TextStyle(color: colors.onSurfaceVariant, fontSize: 11)),
    ]);
  }

  Widget _legend(BuildContext context, String label, Color color,
          {bool outline = false}) =>
      Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                border: outline
                    ? Border.all(color: Theme.of(context).colorScheme.outline)
                    : null)),
        const SizedBox(width: 5),
        Text(label,
            style: TextStyle(
                fontSize: 10,
                color: Theme.of(context).colorScheme.onSurfaceVariant))
      ]);
}
