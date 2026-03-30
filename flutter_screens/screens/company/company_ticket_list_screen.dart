import 'package:flutter/material.dart';
import '../../models/it_models.dart';
import '../../services/it_api_service.dart';
import '../../widgets/ticket_card.dart';
import 'company_ticket_detail_screen.dart';
import 'create_ticket_screen.dart';

class CompanyTicketListScreen extends StatefulWidget {
  final ItApiService apiService;
  const CompanyTicketListScreen({super.key, required this.apiService});

  @override
  State<CompanyTicketListScreen> createState() => _CompanyTicketListScreenState();
}

class _CompanyTicketListScreenState extends State<CompanyTicketListScreen> {
  List<ItServiceTicket> _tickets = [];
  bool _isLoading = true;
  String _statusFilter = 'all';

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  Future<void> _loadTickets() async {
    setState(() => _isLoading = true);
    try {
      final tickets = await widget.apiService.getCompanyTickets();
      setState(() { _tickets = tickets; _isLoading = false; });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  List<ItServiceTicket> get _filteredTickets =>
      _statusFilter == 'all' ? _tickets : _tickets.where((t) => t.status == _statusFilter).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('IT Service Tickets'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.filter_list),
            onSelected: (v) => setState(() => _statusFilter = v),
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'all', child: Text('All')),
              const PopupMenuItem(value: 'open', child: Text('Open')),
              const PopupMenuItem(value: 'assigned', child: Text('Assigned')),
              const PopupMenuItem(value: 'in_progress', child: Text('In Progress')),
              const PopupMenuItem(value: 'resolved', child: Text('Resolved')),
              const PopupMenuItem(value: 'cancelled', child: Text('Cancelled')),
            ],
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.push(context, MaterialPageRoute(
          builder: (_) => CreateTicketScreen(
            apiService: widget.apiService,
            onCreated: _loadTickets,
          ),
        )),
        icon: const Icon(Icons.add),
        label: const Text('New Ticket'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                _buildStatsBar(),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadTickets,
                    child: _filteredTickets.isEmpty
                        ? const Center(child: Text('No tickets found'))
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _filteredTickets.length,
                            itemBuilder: (context, i) => TicketCard(
                              ticket: _filteredTickets[i],
                              onTap: () => Navigator.push(context, MaterialPageRoute(
                                builder: (_) => CompanyTicketDetailScreen(
                                  apiService: widget.apiService,
                                  ticketId: _filteredTickets[i].id,
                                  onUpdated: _loadTickets,
                                ),
                              )),
                            ),
                          ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildStatsBar() {
    final open = _tickets.where((t) => t.status == 'open').length;
    final active = _tickets.where((t) => t.status == 'in_progress').length;
    final done = _tickets.where((t) => t.status == 'resolved' || t.status == 'completed').length;

    return Container(
      padding: const EdgeInsets.all(12),
      color: Colors.grey[50],
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _statPill('Open', open, Colors.blue),
          _statPill('Active', active, Colors.orange),
          _statPill('Done', done, Colors.green),
          _statPill('Total', _tickets.length, Colors.grey),
        ],
      ),
    );
  }

  Widget _statPill(String label, int count, Color color) {
    return Column(
      children: [
        Text('$count', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
      ],
    );
  }
}
