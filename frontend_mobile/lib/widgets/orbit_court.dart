import 'package:flutter/material.dart';

/// Decorative court illustration, independent of venue photos and availability.
class OrbitCourt extends StatelessWidget {
  final double height;
  const OrbitCourt({super.key, this.height = 180});
  @override
  Widget build(BuildContext context) => SizedBox(
        height: height,
        width: double.infinity,
        child: CustomPaint(painter: _CourtPainter()),
      );
}

class _CourtPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(
        rect,
        Paint()
          ..shader = const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF214E37), Color(0xFF081C14), Color(0xFF386247)],
          ).createShader(rect));
    final glow = Paint()
      ..color = const Color(0xFFA3D9B9).withValues(alpha: .12);
    canvas.drawCircle(
        Offset(size.width * .8, size.height * .15), size.height * .7, glow);
    final court = Path()
      ..moveTo(size.width * .12, size.height * .84)
      ..lineTo(size.width * .35, size.height * .34)
      ..lineTo(size.width * .85, size.height * .34)
      ..lineTo(size.width * .98, size.height * .84)
      ..close();
    canvas.drawPath(court, Paint()..color = const Color(0xFF275E40));
    final line = Paint()
      ..color = const Color(0xFFE6E6D4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.3;
    canvas.drawPath(court, line);
    canvas.drawLine(Offset(size.width * .24, size.height * .59),
        Offset(size.width * .92, size.height * .59), line);
    canvas.drawLine(Offset(size.width * .6, size.height * .34),
        Offset(size.width * .55, size.height * .84), line);
    for (final x in [.18, .88]) {
      canvas.drawLine(Offset(size.width * x, size.height * .15),
          Offset(size.width * x, size.height * .82), line);
      canvas.drawCircle(
          Offset(size.width * x, size.height * .15),
          7,
          Paint()
            ..color = const Color(0xFFFFD9AD)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8));
      canvas.drawCircle(Offset(size.width * x, size.height * .15), 3,
          Paint()..color = const Color(0xFFFFEACF));
    }
    canvas.drawOval(
        Rect.fromCenter(
            center: Offset(size.width * .75, size.height * .28),
            width: size.width * .42,
            height: size.height * .28),
        line);
  }

  @override
  bool shouldRepaint(_CourtPainter oldDelegate) => false;
}
