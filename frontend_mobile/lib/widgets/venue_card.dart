import 'package:flutter/material.dart';
import 'clubhouse.dart';

class VenueCard extends StatelessWidget {
  final Map<String, dynamic> venue;
  final VoidCallback onBook;
  final String? session;
  const VenueCard(
      {super.key, required this.venue, required this.onBook, this.session});
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final sport = venue['sport']?['name'] as String? ?? 'Sport';
    return Card(
      margin: const EdgeInsets.only(bottom: 18),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        ClubhouseImage(sport: sport, imageUrl: venue['imageUrl'] as String?),
        Padding(
            padding: const EdgeInsets.all(18),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(venue['name'] ?? 'Venue',
                  style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -.4)),
              const SizedBox(height: 8),
              Row(children: [
                Icon(sportIcon(sport), size: 18, color: colors.secondary),
                const SizedBox(width: 8),
                Expanded(
                    child: Text(sport,
                        style: TextStyle(color: colors.onSurfaceVariant)))
              ]),
              if ((venue['description'] as String? ?? '').isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(venue['description'],
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style:
                        TextStyle(color: colors.onSurfaceVariant, height: 1.4)),
              ],
              if (session != null) ...[
                const SizedBox(height: 12),
                Text(session!,
                    style: TextStyle(
                        color: colors.primary, fontWeight: FontWeight.w600))
              ],
              const SizedBox(height: 16),
              LayoutBuilder(builder: (context, constraints) {
                final price = Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(clubPrice(venue['pricePerSlot']),
                          style: const TextStyle(
                              fontSize: 19, fontWeight: FontWeight.w800)),
                      Text('per session',
                          style: TextStyle(
                              color: colors.onSurfaceVariant, fontSize: 12)),
                    ]);
                final button = ElevatedButton.icon(
                    onPressed: onBook,
                    icon: const Icon(Icons.arrow_forward, size: 18),
                    label: const Text('Book court'));
                if (constraints.maxWidth < 300 ||
                    MediaQuery.textScalerOf(context).scale(1) > 1.3) {
                  return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [price, const SizedBox(height: 12), button]);
                }
                return Row(children: [
                  Expanded(child: price),
                  const SizedBox(width: 10),
                  button
                ]);
              }),
            ])),
      ]),
    );
  }
}
