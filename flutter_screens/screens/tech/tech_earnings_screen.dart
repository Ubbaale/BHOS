import 'package:flutter/material.dart';
import '../../services/it_api_service.dart';

class TechEarningsScreen extends StatefulWidget {
  final ItApiService apiService;
  const TechEarningsScreen({super.key, required this.apiService});

  @override
  State<TechEarningsScreen> createState() => _TechEarningsScreenState();
}

class _TechEarningsScreenState extends State<TechEarningsScreen> {
  Map<String, dynamic>? _earnings;
  Map<String, dynamic>? _paymentHistory;
  Map<String, dynamic>? _taxYears;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        widget.apiService.getEarnings(),
        widget.apiService.getPaymentHistory(),
        widget.apiService.getTaxYears(),
      ]);
      setState(() {
        _earnings = results[0];
        _paymentHistory = results[1];
        _taxYears = results[2];
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildSummaryCards(),
          const SizedBox(height: 16),
          _buildPerformanceCard(),
          const SizedBox(height: 16),
          _buildPaymentHistoryCard(),
          const SizedBox(height: 16),
          _buildTaxFormsCard(),
        ],
      ),
    );
  }

  Widget _buildSummaryCards() {
    final total = _earnings?['totalEarnings']?.toString() ?? '0';
    final pending = _earnings?['pendingPayouts']?.toString() ?? '0';
    final jobs = _earnings?['totalJobs']?.toString() ?? '0';

    return Row(
      children: [
        _summaryCard('Total Earnings', '\$$total', Colors.green, Icons.attach_money),
        const SizedBox(width: 8),
        _summaryCard('Pending', '\$$pending', Colors.orange, Icons.hourglass_empty),
        const SizedBox(width: 8),
        _summaryCard('Jobs', jobs, Colors.blue, Icons.work),
      ],
    );
  }

  Widget _summaryCard(String label, String value, Color color, IconData icon) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 8),
              Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPerformanceCard() {
    final rating = _earnings?['averageRating']?.toString() ?? '—';
    final timeliness = _earnings?['timelinessScore']?.toString() ?? '—';
    final onTime = _earnings?['onTimeCheckIns']?.toString() ?? '0';
    final late = _earnings?['lateCheckIns']?.toString() ?? '0';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Performance', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Divider(),
            _statRow('Average Rating', '$rating / 5', Icons.star, Colors.amber),
            _statRow('Timeliness Score', '$timeliness%', Icons.timer, Colors.blue),
            _statRow('On-time Check-ins', onTime, Icons.check_circle, Colors.green),
            _statRow('Late Check-ins', late, Icons.warning, Colors.orange),
          ],
        ),
      ),
    );
  }

  Widget _statRow(String label, String value, IconData icon, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildPaymentHistoryCard() {
    final history = (_paymentHistory?['history'] as List?) ?? [];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Recent Payments', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Divider(),
            if (history.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: Text('No payment history yet')),
              )
            else
              ...history.take(10).map<Widget>((item) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.payment, color: Colors.green),
                title: Text(item['ticketTitle'] ?? 'Job'),
                subtitle: Text(item['payoutDate'] ?? ''),
                trailing: Text(
                  '\$${item['techPayout'] ?? '0'}',
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
                ),
              )),
          ],
        ),
      ),
    );
  }

  Widget _buildTaxFormsCard() {
    final years = (_taxYears?['years'] as List?) ?? [];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Tax Documents', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Divider(),
            if (years.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: Text('No tax documents available')),
              )
            else
              ...years.map<Widget>((year) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.description, color: Colors.blue),
                title: Text('1099-NEC — Tax Year ${year['taxYear']}'),
                subtitle: Text('Earnings: \$${year['totalGrossEarnings'] ?? '0'}'),
                trailing: IconButton(
                  icon: const Icon(Icons.download),
                  onPressed: () => _download1099(year['taxYear']),
                ),
              )),
          ],
        ),
      ),
    );
  }

  Future<void> _download1099(int year) async {
    try {
      final data = await widget.apiService.get1099(year);
      if (mounted) {
        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            title: Text('1099-NEC — $year'),
            content: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  _taxRow('Payer', 'CareHub IT Services'),
                  _taxRow('Recipient', data['recipientName'] ?? ''),
                  _taxRow('SSN (last 4)', '***-**-${data['ssnLast4'] ?? '****'}'),
                  _taxRow('Nonemployee Compensation', '\$${data['totalGrossEarnings'] ?? '0'}'),
                  _taxRow('Tax Year', '$year'),
                  _taxRow('Total Jobs', '${data['totalJobs'] ?? 0}'),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  Widget _taxRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 140, child: Text(label, style: const TextStyle(fontWeight: FontWeight.w500))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
