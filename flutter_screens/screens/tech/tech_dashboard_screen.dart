import 'package:flutter/material.dart';
import '../../models/it_models.dart';
import '../../services/it_api_service.dart';
import '../../widgets/account_status_banner.dart';
import '../../widgets/ticket_card.dart';
import 'tech_ticket_detail_screen.dart';
import 'tech_earnings_screen.dart';
import 'tech_settings_screen.dart';

class TechDashboardScreen extends StatefulWidget {
  final ItApiService apiService;
  const TechDashboardScreen({super.key, required this.apiService});

  @override
  State<TechDashboardScreen> createState() => _TechDashboardScreenState();
}

class _TechDashboardScreenState extends State<TechDashboardScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<ItServiceTicket> _availableTickets = [];
  List<ItServiceTicket> _myJobs = [];
  TechAccountStatus? _accountStatus;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final results = await Future.wait([
        widget.apiService.getAvailableTickets(),
        widget.apiService.getMyJobs(),
        widget.apiService.getAccountStatus(),
      ]);
      setState(() {
        _availableTickets = results[0] as List<ItServiceTicket>;
        _myJobs = results[1] as List<ItServiceTicket>;
        _accountStatus = results[2] as TechAccountStatus;
        _isLoading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  List<ItServiceTicket> get _activeJobs =>
      _myJobs.where((j) => j.status == 'in_progress').toList();

  List<ItServiceTicket> get _completedJobs =>
      _myJobs.where((j) => j.status == 'resolved' || j.status == 'closed' || j.status == 'completed').toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('IT Tech Dashboard'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: [
            Tab(text: 'Available (${_availableTickets.length})'),
            Tab(text: 'Active (${_activeJobs.length})'),
            Tab(text: 'Completed (${_completedJobs.length})'),
            const Tab(text: 'Earnings'),
            const Tab(text: 'Settings'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, style: TextStyle(color: Colors.red[700])),
                    const SizedBox(height: 16),
                    ElevatedButton(onPressed: _loadData, child: const Text('Retry')),
                  ],
                ))
              : Column(
                  children: [
                    if (_accountStatus != null && _accountStatus!.isBlocked)
                      AccountStatusBanner(status: _accountStatus!),
                    _buildStatsRow(),
                    Expanded(
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          _buildAvailableTab(),
                          _buildActiveTab(),
                          _buildCompletedTab(),
                          TechEarningsScreen(apiService: widget.apiService),
                          TechSettingsScreen(apiService: widget.apiService),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildStatsRow() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          _statCard('Available', _availableTickets.length.toString(), Colors.blue),
          _statCard('Active', _activeJobs.length.toString(), Colors.orange),
          _statCard('Completed', _completedJobs.length.toString(), Colors.green),
          _statCard('Rating', (_accountStatus != null ? '—' : '—'), Colors.amber),
        ],
      ),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Column(
            children: [
              Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
              const SizedBox(height: 4),
              Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAvailableTab() {
    if (_availableTickets.isEmpty) {
      return const Center(child: Text('No available tickets right now'));
    }
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _availableTickets.length,
        itemBuilder: (context, index) {
          final ticket = _availableTickets[index];
          return TicketCard(
            ticket: ticket,
            actionLabel: 'Accept',
            actionColor: Colors.green,
            onAction: () => _acceptTicket(ticket),
            onTap: () => _openTicketDetail(ticket),
          );
        },
      ),
    );
  }

  Widget _buildActiveTab() {
    if (_activeJobs.isEmpty) {
      return const Center(child: Text('No active jobs'));
    }
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _activeJobs.length,
        itemBuilder: (context, index) => TicketCard(
          ticket: _activeJobs[index],
          onTap: () => _openTicketDetail(_activeJobs[index]),
        ),
      ),
    );
  }

  Widget _buildCompletedTab() {
    if (_completedJobs.isEmpty) {
      return const Center(child: Text('No completed jobs yet'));
    }
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _completedJobs.length,
        itemBuilder: (context, index) => TicketCard(
          ticket: _completedJobs[index],
          onTap: () => _openTicketDetail(_completedJobs[index]),
        ),
      ),
    );
  }

  Future<void> _acceptTicket(ItServiceTicket ticket) async {
    try {
      await widget.apiService.acceptTicket(ticket.id);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Accepted: ${ticket.title}'), backgroundColor: Colors.green),
      );
      _loadData();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  void _openTicketDetail(ItServiceTicket ticket) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => TechTicketDetailScreen(
        apiService: widget.apiService,
        ticketId: ticket.id,
        onUpdated: _loadData,
      ),
    ));
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
}
