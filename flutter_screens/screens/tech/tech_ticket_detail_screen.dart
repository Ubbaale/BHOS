import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../../models/it_models.dart';
import '../../services/it_api_service.dart';
import '../../widgets/eta_controls.dart';
import '../../widgets/deliverables_form.dart';
import '../../widgets/rating_dialog.dart';
import '../../widgets/signature_pad.dart';

class TechTicketDetailScreen extends StatefulWidget {
  final ItApiService apiService;
  final String ticketId;
  final VoidCallback onUpdated;

  const TechTicketDetailScreen({
    super.key,
    required this.apiService,
    required this.ticketId,
    required this.onUpdated,
  });

  @override
  State<TechTicketDetailScreen> createState() => _TechTicketDetailScreenState();
}

class _TechTicketDetailScreenState extends State<TechTicketDetailScreen> {
  Map<String, dynamic>? _ticketData;
  bool _isLoading = true;
  String? _error;
  Timer? _locationTimer;
  Map<String, dynamic>? _locationInfo;

  @override
  void initState() {
    super.initState();
    _loadTicket();
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    super.dispose();
  }

  void _startLocationTracking() {
    _locationTimer?.cancel();
    _sendLocationPing();
    _locationTimer = Timer.periodic(const Duration(minutes: 2), (_) => _sendLocationPing());
  }

  void _stopLocationTracking() {
    _locationTimer?.cancel();
    _locationTimer = null;
    setState(() => _locationInfo = null);
  }

  Future<void> _sendLocationPing() async {
    final ticket = _ticket;
    if (ticket == null || ticket.checkInTime == null || ticket.checkOutTime != null) return;
    try {
      final position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      final data = await widget.apiService.sendLocationPing(ticket.id, position.latitude, position.longitude);
      if (mounted) setState(() => _locationInfo = data);
    } catch (_) {
      try {
        final data = await widget.apiService.getLocationStatus(ticket.id);
        if (mounted) setState(() => _locationInfo = data);
      } catch (_) {}
    }
  }

  Future<void> _loadTicket() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final data = await widget.apiService.getTicketDetail(widget.ticketId);
      setState(() { _ticketData = data; _isLoading = false; });
      final ticket = _ticket;
      if (ticket != null && ticket.checkInTime != null && ticket.checkOutTime == null) {
        _startLocationTracking();
      } else {
        _stopLocationTracking();
      }
    } catch (e) {
      setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  ItServiceTicket? get _ticket =>
      _ticketData != null ? ItServiceTicket.fromJson(_ticketData!) : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_ticket?.title ?? 'Ticket Detail')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: TextStyle(color: Colors.red[700])))
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
        _buildInfoCard(ticket),
        const SizedBox(height: 16),
        _buildScheduleCard(ticket),
        const SizedBox(height: 16),
        _buildPaymentCard(ticket),
        const SizedBox(height: 16),
        if (ticket.status == 'in_progress') ...[
          EtaControls(
            currentStatus: ticket.etaStatus,
            onUpdateEta: (status) async {
              await widget.apiService.updateEta(ticket.id, status);
              _loadTicket();
              widget.onUpdated();
            },
          ),
          const SizedBox(height: 16),
          _buildCheckInOutCard(ticket),
          if (_locationInfo != null && ticket.checkInTime != null && ticket.checkOutTime == null) ...[
            const SizedBox(height: 8),
            _buildLocationBanner(),
          ],
          const SizedBox(height: 16),
          DeliverablesForm(
            existingDeliverables: ticket.deliverables,
            onSubmit: (notes, urls) async {
              await widget.apiService.addDeliverables(ticket.id, notes, urls);
              _loadTicket();
            },
          ),
          const SizedBox(height: 16),
          _buildCompleteCard(ticket),
        ],
        if ((ticket.status == 'resolved' || ticket.status == 'completed') && ticket.techRating == null) ...[
          const SizedBox(height: 16),
          _buildRateCard(ticket),
        ],
        const SizedBox(height: 16),
        _buildMileageCard(ticket),
      ],
    );
  }

  Widget _buildInfoCard(ItServiceTicket ticket) {
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
            const SizedBox(height: 8),
            Text('Ticket #${ticket.ticketNumber}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
            const SizedBox(height: 8),
            Text(ticket.description),
            const SizedBox(height: 12),
            _infoRow(Icons.category, 'Category', ticket.category),
            _infoRow(Icons.flag, 'Priority', ticket.priority),
            if (ticket.contactOnSite != null)
              _infoRow(Icons.person, 'On-site Contact', ticket.contactOnSite!),
            if (ticket.contactPhone != null)
              _infoRow(Icons.phone, 'Phone', ticket.contactPhone!),
            if (ticket.specialInstructions != null)
              _infoRow(Icons.notes, 'Instructions', ticket.specialInstructions!),
            if (ticket.equipmentNeeded != null)
              _infoRow(Icons.build, 'Equipment', ticket.equipmentNeeded!),
          ],
        ),
      ),
    );
  }

  Widget _buildScheduleCard(ItServiceTicket ticket) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Location & Schedule', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            if (ticket.siteAddress != null)
              _infoRow(Icons.location_on, 'Address',
                  '${ticket.siteAddress}, ${ticket.siteCity ?? ''}, ${ticket.siteState ?? ''} ${ticket.siteZipCode ?? ''}'),
            if (ticket.scheduledDate != null)
              _infoRow(Icons.calendar_today, 'Date', _formatDate(ticket.scheduledDate!)),
            if (ticket.scheduledTime != null)
              _infoRow(Icons.access_time, 'Time', ticket.scheduledTime!),
            if (ticket.estimatedDuration != null)
              _infoRow(Icons.timer, 'Duration', ticket.estimatedDuration!),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentCard(ItServiceTicket ticket) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Payment', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _infoRow(Icons.payment, 'Pay Type', ticket.payType),
            if (ticket.payRate != null) _infoRow(Icons.attach_money, 'Rate', '\$${ticket.payRate}/hr'),
            if (ticket.totalPay != null) _infoRow(Icons.money, 'Total', '\$${ticket.totalPay}'),
            if (ticket.techPayout != null) _infoRow(Icons.account_balance_wallet, 'Your Payout', '\$${ticket.techPayout}'),
            _infoRow(Icons.receipt, 'Status', ticket.paymentStatus),
            _infoRow(Icons.schedule, 'Terms', ticket.paymentTerms),
            if (ticket.hoursWorked != null) _infoRow(Icons.timer_outlined, 'Hours Worked', ticket.hoursWorked!),
          ],
        ),
      ),
    );
  }

  Widget _buildCheckInOutCard(ItServiceTicket ticket) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Check In / Out', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            if (ticket.checkInTime != null)
              _infoRow(Icons.login, 'Checked In', _formatDateTime(ticket.checkInTime!))
            else
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _handleCheckIn,
                  icon: const Icon(Icons.login),
                  label: const Text('Check In'),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
                ),
              ),
            const SizedBox(height: 8),
            if (ticket.checkInTime != null && ticket.checkOutTime == null)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _handleCheckOut,
                  icon: const Icon(Icons.logout),
                  label: const Text('Check Out'),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
                ),
              ),
            if (ticket.checkOutTime != null)
              _infoRow(Icons.logout, 'Checked Out', _formatDateTime(ticket.checkOutTime!)),
          ],
        ),
      ),
    );
  }

  Widget _buildCompleteCard(ItServiceTicket ticket) {
    if (ticket.checkOutTime == null) return const SizedBox.shrink();
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: () => _handleComplete(ticket),
        icon: const Icon(Icons.check_circle),
        label: const Text('Mark Complete'),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.green,
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
      ),
    );
  }

  Widget _buildRateCard(ItServiceTicket ticket) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Rate Customer', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _showRatingDialog(ticket),
                icon: const Icon(Icons.star),
                label: const Text('Submit Rating'),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.amber[700]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMileageCard(ItServiceTicket ticket) {
    final mileageController = TextEditingController();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Travel Mileage', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextField(
              controller: mileageController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Miles traveled',
                border: OutlineInputBorder(),
                suffixText: 'mi',
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () async {
                  final miles = double.tryParse(mileageController.text);
                  if (miles == null || miles <= 0) return;
                  try {
                    await widget.apiService.setMileage(ticket.id, miles);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Mileage recorded'), backgroundColor: Colors.green),
                    );
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
                    );
                  }
                },
                child: const Text('Record Mileage'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationBanner() {
    final status = _locationInfo?['locationStatus'] as String? ?? 'unknown';
    final isOnSite = status == 'on_site';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isOnSite ? Colors.green[50] : Colors.orange[50],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: isOnSite ? Colors.green[300]! : Colors.orange[300]!),
      ),
      child: Row(
        children: [
          Icon(
            isOnSite ? Icons.location_on : Icons.location_off,
            color: isOnSite ? Colors.green[700] : Colors.orange[700],
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              isOnSite ? 'On Site - GPS tracking active' : 'Away from site - Please return to work area',
              style: TextStyle(
                color: isOnSite ? Colors.green[800] : Colors.orange[800],
                fontWeight: FontWeight.w500,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: Colors.grey[600]),
          const SizedBox(width: 8),
          Text('$label: ', style: const TextStyle(fontWeight: FontWeight.w500)),
          Expanded(child: Text(value)),
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
      padding: EdgeInsets.zero,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    );
  }

  Future<void> _handleCheckIn() async {
    try {
      double lat = 0, lng = 0;
      try {
        final position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
        lat = position.latitude;
        lng = position.longitude;
      } catch (_) {}
      await widget.apiService.checkIn(widget.ticketId, lat, lng);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Checked in successfully'), backgroundColor: Colors.green),
      );
      _loadTicket();
      widget.onUpdated();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _handleCheckOut() async {
    try {
      await widget.apiService.checkOut(widget.ticketId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Checked out successfully'), backgroundColor: Colors.green),
      );
      _loadTicket();
      widget.onUpdated();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _handleComplete(ItServiceTicket ticket) async {
    final hasSignature = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Complete Job'),
        content: const Text('Would you like to capture the customer\'s signature before completing?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Skip Signature')),
          ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Get Signature')),
        ],
      ),
    );
    if (hasSignature == null) return;

    if (hasSignature) {
      final result = await showModalBottomSheet<Map<String, String>>(
        context: context,
        isScrollControlled: true,
        builder: (_) => Padding(
          padding: EdgeInsets.only(
            left: 16, right: 16, top: 16,
            bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: SignaturePad(
            onComplete: (dataUrl, name) => Navigator.pop(context, {'dataUrl': dataUrl, 'name': name}),
            onCancel: () => Navigator.pop(context),
          ),
        ),
      );
      if (result != null) {
        try {
          await widget.apiService.captureSignature(ticket.id, result['dataUrl']!, result['name']!);
        } catch (_) {}
      }
    }

    try {
      await widget.apiService.completeTicket(ticket.id);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Job completed!'), backgroundColor: Colors.green),
      );
      _loadTicket();
      widget.onUpdated();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  void _showRatingDialog(ItServiceTicket ticket) {
    showDialog(
      context: context,
      builder: (_) => RatingDialog(
        title: 'Rate Customer',
        onSubmit: (rating, review) async {
          await widget.apiService.rateCustomer(ticket.id, rating, review);
          _loadTicket();
        },
      ),
    );
  }

  String _formatDate(DateTime dt) => '${dt.month}/${dt.day}/${dt.year}';
  String _formatDateTime(DateTime dt) => '${dt.month}/${dt.day}/${dt.year} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
}
