import 'package:flutter/material.dart';
import '../../models/it_models.dart';
import '../../services/it_api_service.dart';
import '../../widgets/rating_dialog.dart';
import 'report_tech_screen.dart';

class CompanyTicketDetailScreen extends StatefulWidget {
  final ItApiService apiService;
  final String ticketId;
  final VoidCallback onUpdated;

  const CompanyTicketDetailScreen({
    super.key,
    required this.apiService,
    required this.ticketId,
    required this.onUpdated,
  });

  @override
  State<CompanyTicketDetailScreen> createState() => _CompanyTicketDetailScreenState();
}

class _CompanyTicketDetailScreenState extends State<CompanyTicketDetailScreen> {
  Map<String, dynamic>? _ticketData;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadTicket();
  }

  Future<void> _loadTicket() async {
    setState(() => _isLoading = true);
    try {
      final data = await widget.apiService.getTicketDetail(widget.ticketId);
      setState(() { _ticketData = data; _isLoading = false; });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  ItServiceTicket? get _ticket =>
      _ticketData != null ? ItServiceTicket.fromJson(_ticketData!) : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_ticket?.title ?? 'Ticket Detail'),
        actions: [
          if (_ticket != null)
            PopupMenuButton<String>(
              onSelected: _handleAction,
              itemBuilder: (_) => [
                if (_ticket!.status == 'resolved' || _ticket!.status == 'completed')
                  const PopupMenuItem(value: 'rate', child: Text('Rate Tech')),
                if (_ticket!.assignedTo != null)
                  const PopupMenuItem(value: 'report', child: Text('Report Tech')),
                if (_ticket!.status != 'cancelled' && _ticket!.status != 'resolved')
                  const PopupMenuItem(value: 'cancel', child: Text('Cancel Ticket')),
                if (_ticket!.status == 'resolved' && _ticket!.companyApproval == null)
                  const PopupMenuItem(value: 'approve', child: Text('Approve Work')),
                if (_ticket!.status == 'resolved' && _ticket!.mediationStatus == null)
                  const PopupMenuItem(value: 'mediate', child: Text('Request Mediation')),
                if (_ticket!.escrowStatus == null || _ticket!.escrowStatus == 'pending')
                  const PopupMenuItem(value: 'fund', child: Text('Fund Escrow')),
              ],
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _ticket == null
              ? const Center(child: Text('Ticket not found'))
              : RefreshIndicator(onRefresh: _loadTicket, child: _buildBody()),
    );
  }

  Widget _buildBody() {
    final ticket = _ticket!;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildInfoSection(ticket),
        const SizedBox(height: 16),
        _buildLocationSection(ticket),
        const SizedBox(height: 16),
        _buildPaymentSection(ticket),
        const SizedBox(height: 16),
        if (ticket.assignedTo != null) _buildTechSection(ticket),
        if (ticket.assignedTo != null) const SizedBox(height: 16),
        _buildTimelineSection(ticket),
        const SizedBox(height: 16),
        if (ticket.deliverables.isNotEmpty) _buildDeliverablesSection(ticket),
        if (ticket.mediationStatus != null) _buildMediationSection(ticket),
        const SizedBox(height: 16),
        _buildNotesSection(),
      ],
    );
  }

  Widget _buildInfoSection(ItServiceTicket ticket) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(ticket.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
                _statusChip(ticket.status),
              ],
            ),
            const SizedBox(height: 4),
            Text('#${ticket.ticketNumber}', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
            const SizedBox(height: 8),
            Text(ticket.description),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                Chip(label: Text(ticket.category), avatar: const Icon(Icons.category, size: 16)),
                Chip(
                  label: Text(ticket.priority.toUpperCase()),
                  backgroundColor: ticket.priority == 'urgent' ? Colors.red[100] : ticket.priority == 'high' ? Colors.orange[100] : null,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationSection(ItServiceTicket ticket) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Location & Schedule', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Divider(),
            if (ticket.siteAddress != null)
              _infoRow(Icons.location_on, '${ticket.siteAddress}, ${ticket.siteCity ?? ''} ${ticket.siteState ?? ''} ${ticket.siteZipCode ?? ''}'),
            if (ticket.contactOnSite != null) _infoRow(Icons.person, ticket.contactOnSite!),
            if (ticket.contactPhone != null) _infoRow(Icons.phone, ticket.contactPhone!),
            if (ticket.scheduledDate != null) _infoRow(Icons.calendar_today, '${ticket.scheduledDate!.month}/${ticket.scheduledDate!.day}/${ticket.scheduledDate!.year}'),
            if (ticket.scheduledTime != null) _infoRow(Icons.access_time, ticket.scheduledTime!),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentSection(ItServiceTicket ticket) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Payment', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Divider(),
            _labeledRow('Pay Type', ticket.payType),
            if (ticket.payRate != null) _labeledRow('Rate', '\$${ticket.payRate}'),
            if (ticket.totalPay != null) _labeledRow('Total', '\$${ticket.totalPay}'),
            _labeledRow('Status', ticket.paymentStatus),
            _labeledRow('Terms', ticket.paymentTerms),
            if (ticket.escrowStatus != null) _labeledRow('Escrow', ticket.escrowStatus!),
            if (ticket.escrowAmount != null) _labeledRow('Escrow Amount', '\$${ticket.escrowAmount}'),
          ],
        ),
      ),
    );
  }

  Widget _buildTechSection(ItServiceTicket ticket) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Assigned Tech', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Divider(),
            _labeledRow('ETA Status', ticket.etaStatus),
            if (ticket.checkInTime != null) _labeledRow('Checked In', _formatDT(ticket.checkInTime!)),
            if (ticket.checkOutTime != null) _labeledRow('Checked Out', _formatDT(ticket.checkOutTime!)),
            if (ticket.hoursWorked != null) _labeledRow('Hours Worked', ticket.hoursWorked!),
            if (ticket.customerRating != null) _labeledRow('Your Rating', '${ticket.customerRating}/5'),
          ],
        ),
      ),
    );
  }

  Widget _buildTimelineSection(ItServiceTicket ticket) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Timeline', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Divider(),
            if (ticket.createdAt != null) _timelineItem('Created', ticket.createdAt!, Colors.blue),
            if (ticket.checkInTime != null) _timelineItem('Check In', ticket.checkInTime!, Colors.green),
            if (ticket.checkOutTime != null) _timelineItem('Check Out', ticket.checkOutTime!, Colors.orange),
          ],
        ),
      ),
    );
  }

  Widget _buildDeliverablesSection(ItServiceTicket ticket) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Deliverables / Proof of Work', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Divider(),
            ...ticket.deliverables.map<Widget>((d) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.attachment),
              title: Text(d['notes'] ?? 'Deliverable'),
              subtitle: d['urls'] != null ? Text((d['urls'] as List).join(', ')) : null,
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildMediationSection(ItServiceTicket ticket) {
    return Card(
      color: Colors.amber[50],
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.gavel, color: Colors.amber),
                const SizedBox(width: 8),
                const Text('Dispute / Mediation', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            const Divider(),
            if (ticket.disputeReason != null) _labeledRow('Reason', ticket.disputeReason!),
            _labeledRow('Status', ticket.mediationStatus ?? 'pending'),
            if (ticket.mediationResolution != null) _labeledRow('Resolution', ticket.mediationResolution!),
            if (ticket.mediationNotes != null) _labeledRow('Notes', ticket.mediationNotes!),
          ],
        ),
      ),
    );
  }

  Widget _buildNotesSection() {
    final noteCtrl = TextEditingController();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Add Note', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextField(
              controller: noteCtrl,
              maxLines: 3,
              decoration: const InputDecoration(hintText: 'Write a note...', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () async {
                  if (noteCtrl.text.isEmpty) return;
                  try {
                    await widget.apiService.addTicketNote(widget.ticketId, noteCtrl.text);
                    noteCtrl.clear();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Note added'), backgroundColor: Colors.green),
                    );
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
                    );
                  }
                },
                child: const Text('Submit Note'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _handleAction(String action) {
    switch (action) {
      case 'rate':
        showDialog(
          context: context,
          builder: (_) => RatingDialog(
            title: 'Rate Technician',
            onSubmit: (rating, review) async {
              await widget.apiService.rateTicket(widget.ticketId, rating, review);
              _loadTicket();
              widget.onUpdated();
            },
          ),
        );
        break;
      case 'report':
        Navigator.push(context, MaterialPageRoute(
          builder: (_) => ReportTechScreen(
            apiService: widget.apiService,
            techUserId: _ticket!.assignedTo!,
            ticketId: widget.ticketId,
          ),
        ));
        break;
      case 'cancel':
        _showCancelDialog();
        break;
      case 'approve':
        _showApproveDialog();
        break;
      case 'mediate':
        _requestMediation();
        break;
      case 'fund':
        _fundEscrow();
        break;
    }
  }

  Future<void> _showCancelDialog() async {
    final reasonCtrl = TextEditingController();
    final confirm = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel Ticket'),
        content: TextField(controller: reasonCtrl, decoration: const InputDecoration(labelText: 'Cancellation Reason')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Back')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, reasonCtrl.text),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Cancel Ticket'),
          ),
        ],
      ),
    );
    if (confirm == null) return;
    try {
      await widget.apiService.cancelTicket(widget.ticketId, confirm);
      _loadTicket();
      widget.onUpdated();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: Colors.red));
    }
  }

  Future<void> _showApproveDialog() async {
    final notesCtrl = TextEditingController();
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Approve Work'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Confirm that the work was completed satisfactorily.'),
            const SizedBox(height: 12),
            TextField(controller: notesCtrl, decoration: const InputDecoration(labelText: 'Notes (optional)', border: OutlineInputBorder())),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Approve')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await widget.apiService.approveWork(widget.ticketId, notesCtrl.text.isNotEmpty ? notesCtrl.text : null);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Work approved'), backgroundColor: Colors.green));
      _loadTicket();
      widget.onUpdated();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: Colors.red));
    }
  }

  Future<void> _requestMediation() async {
    try {
      await widget.apiService.requestMediation(widget.ticketId);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Mediation requested'), backgroundColor: Colors.blue));
      _loadTicket();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: Colors.red));
    }
  }

  Future<void> _fundEscrow() async {
    try {
      await widget.apiService.fundEscrow(widget.ticketId);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Escrow funded'), backgroundColor: Colors.green));
      _loadTicket();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: Colors.red));
    }
  }

  Widget _infoRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey[600]),
          const SizedBox(width: 8),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }

  Widget _labeledRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          SizedBox(width: 120, child: Text(label, style: TextStyle(color: Colors.grey[600]))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500))),
        ],
      ),
    );
  }

  Widget _statusChip(String status) {
    Color color;
    switch (status) {
      case 'open': color = Colors.blue; break;
      case 'assigned': color = Colors.purple; break;
      case 'in_progress': color = Colors.orange; break;
      case 'resolved': case 'completed': color = Colors.green; break;
      case 'cancelled': color = Colors.red; break;
      default: color = Colors.grey;
    }
    return Chip(
      label: Text(status.replaceAll('_', ' ').toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 11)),
      backgroundColor: color,
    );
  }

  Widget _timelineItem(String label, DateTime dt, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
          const Spacer(),
          Text(_formatDT(dt), style: TextStyle(color: Colors.grey[600], fontSize: 12)),
        ],
      ),
    );
  }

  String _formatDT(DateTime dt) => '${dt.month}/${dt.day}/${dt.year} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
}
