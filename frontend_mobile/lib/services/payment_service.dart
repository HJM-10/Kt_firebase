import 'package:url_launcher/url_launcher.dart';
import 'api_service.dart';

class PaymentService {
  static Future<void> checkout(int paymentId) async {
    final response = await ApiService().dio.post('/payments/checkout', data: {'paymentId': paymentId});
    final uri = Uri.parse(response.data['data']['url']);
    if (uri.scheme != 'https' || uri.host != 'checkout.stripe.com') throw Exception('Invalid checkout address');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) throw Exception('Could not open checkout');
  }
}

