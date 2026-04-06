import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../../models/courier_models.dart';
import '../../services/courier_api_service.dart';

class CourierDeliveryDetailScreen extends StatefulWidget {
  final CourierApiService apiService;
  final String deliveryId;
  final VoidCallback onUpdated;

  const CourierDeliveryDetailScreen({
    super.key,
    required this.apiService,
    required this.deliveryId,
    required this.onUpdated,
  });

  @override
  State<CourierDeliveryDetailScreen> createState() => _CourierDeliveryDetailScreenState();
}

class _CourierDeliveryDetailScreenState extends State<CourierDeliveryDetailScreen> {
  CourierDelivery? _delivery;
  List<CustodyLogEntry> _custodyLog = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final results = await Future.wait([
        widget.apiService.getDeliveryDetail(widget.deliveryId),
        widget.apiService.getCustodyLog(widget.deliveryId),
      ]);
      setState(() {
        _delivery = results[0] as CourierDelivery;
        _custodyLog = results[1] as List<CustodyLogEntry>;
        _isLoading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_delivery != null ? 'Delivery #${_delivery!.id.substring(0, 8)}' : 'Delivery Detail')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: TextStyle(color: Colors.red[700])))
              : _delivery == null
                  ? const Center(child: Text('Delivery not found'))
                  : RefreshIndicator(onRefresh: _loadData, child: _buildBody()),
    );
  }

  Widget _buildBody() {
    final d = _delivery!;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildInfoCard(d),
        const SizedBox(height: 16),
        _buildRouteCard(d),
        const SizedBox(height: 16),
        if (d.estimatedFare != null) ...[
          _buildFareCard(d),
          const SizedBox(height: 16),
        ],
        _buildActionsCard(d),
        const SizedBox(height: 16),
        _buildCustodyLogCard(),
        const SizedBox(height: 16),
        _buildAddCustodyLogButton(d),
      ],
    );
  }

  Widget _buildInfoCard(CourierDelivery d) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(d.packageType.replaceAll('_', ' ').toUpperCase(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
                _statusChip(d.status),
              ],
            ),
            const SizedBox(height: 8),
            if (d.packageDescription != null) Text(d.packageDescription!, style: const TextStyle(fontSize: 14)),
            const SizedBox(height: 8),
            if (d.priorityLevel != null) _infoRow(Icons.priority_high, 'Priority', d.priorityLevel!),
            if (d.temperatureRequirement != null) _infoRow(Icons.thermostat, 'Temperature', d.temperatureRequirement!),
            if (d.weightLbs != null) _infoRow(Icons.scale, 'Weight', '${d.weightLbs} lbs'),
            if (d.signatureRequired == true) _infoRow(Icons.draw, 'Signature', 'Required'),
          ],
        ),
      ),
    );
  }

  Widget _buildRouteCard(CourierDelivery d) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Route', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.arrow_upward, color: Colors.green, size: 18),
              const SizedBox(width: 8),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Pickup', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 12)),
                  Text(d.pickupAddress),
                  if (d.pickupContactName != null) Text('Contact: ${d.pickupContactName}', style: const TextStyle(fontSize: 13)),
                  if (d.pickupContactPhone != null) Text(d.pickupContactPhone!, style: const TextStyle(fontSize: 13)),
                ],
              )),
            ]),
            const Divider(height: 20),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.arrow_downward, color: Colors.red, size: 18),
              const SizedBox(width: 8),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Dropoff', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 12)),
                  Text(d.dropoffAddress),
                  if (d.dropoffContactName != null) Text('Contact: ${d.dropoffContactName}', style: const TextStyle(fontSize: 13)),
                  if (d.dropoffContactPhone != null) Text(d.dropoffContactPhone!, style: const TextStyle(fontSize: 13)),
                ],
              )),
            ]),
            if (d.distanceMiles != null) ...[
              const SizedBox(height: 8),
              Text('Distance: ${d.distanceMiles?.toStringAsFixed(1)} mi', style: TextStyle(color: Colors.grey[600])),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildFareCard(CourierDelivery d) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Fare', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            if (d.baseFare != null) _infoRow(Icons.receipt, 'Base', '\$${d.baseFare}'),
            if (d.mileageCharge != null) _infoRow(Icons.straighten, 'Mileage', '\$${d.mileageCharge}'),
            if (d.surcharges != null) _infoRow(Icons.add_circle_outline, 'Surcharges', '\$${d.surcharges}'),
            const Divider(),
            _infoRow(Icons.attach_money, 'Total', '\$${d.estimatedFare}'),
          ],
        ),
      ),
    );
  }

  Widget _buildActionsCard(CourierDelivery d) {
    final actions = <Widget>[];

    if (d.status == 'accepted' || d.status == 'assigned') {
      actions.add(SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: () => _updateStatus('picked_up'),
          icon: const Icon(Icons.inventory_2),
          label: const Text('Mark Picked Up'),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.orange, foregroundColor: Colors.white),
        ),
      ));
    }

    if (d.status == 'picked_up' || d.status == 'in_transit') {
      actions.add(SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: () => _updateStatus('in_transit'),
          icon: const Icon(Icons.local_shipping),
          label: const Text('In Transit'),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.blue, foregroundColor: Colors.white),
        ),
      ));
      actions.add(const SizedBox(height: 8));
      actions.add(SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: () => _updateStatus('delivered'),
          icon: const Icon(Icons.check_circle),
          label: const Text('Mark Delivered'),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
        ),
      ));
    }

    if (actions.isEmpty) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Actions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...actions,
          ],
        ),
      ),
    );
  }

  Widget _buildCustodyLogCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(child: Text('Chain of Custody', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
                Icon(Icons.verified_user, color: Colors.green[700], size: 20),
              ],
            ),
            const SizedBox(height: 12),
            if (_custodyLog.isEmpty)
              Text('No custody events recorded yet.', style: TextStyle(color: Colors.grey[600]))
            else
              ..._custodyLog.map((entry) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 8, height: 8, margin: const EdgeInsets.only(top: 6, right: 8),
                      decoration: BoxDecoration(color: Colors.green[700], shape: BoxShape.circle),
                    ),
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(entry.eventType.replaceAll('_', ' ').toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        if (entry.description != null) Text(entry.description!, style: const TextStyle(fontSize: 13)),
                        if (entry.temperature != null) Text('Temp: ${entry.temperature}', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                        if (entry.createdAt != null) Text(
                          '${entry.createdAt!.month}/${entry.createdAt!.day} ${entry.createdAt!.hour}:${entry.createdAt!.minute.toString().padLeft(2, '0')}',
                          style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                        ),
                      ],
                    )),
                  ],
                ),
              )),
          ],
        ),
      ),
    );
  }

  Widget _buildAddCustodyLogButton(CourierDelivery d) {
    if (d.status == 'delivered' || d.status == 'cancelled') return const SizedBox.shrink();
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: _showAddCustodyLogDialog,
        icon: const Icon(Icons.add),
        label: const Text('Add Custody Event'),
      ),
    );
  }

  Future<void> _showAddCustodyLogDialog() async {
    final eventTypes = ['pickup', 'handoff', 'temperature_check', 'transit_update', 'delivery', 'exception'];
    String selectedEvent = 'transit_update';
    final descController = TextEditingController();
    final tempController = TextEditingController();

    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Add Custody Event'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: selectedEvent,
                items: eventTypes.map((e) => DropdownMenuItem(value: e, child: Text(e.replaceAll('_', ' ').toUpperCase()))).toList(),
                onChanged: (v) => setDialogState(() => selectedEvent = v!),
                decoration: const InputDecoration(labelText: 'Event Type', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(controller: descController, decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              TextField(controller: tempController, decoration: const InputDecoration(labelText: 'Temperature (optional)', border: OutlineInputBorder())),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, {
                'eventType': selectedEvent,
                'description': descController.text,
                'temperature': tempController.text,
              }),
              child: const Text('Add'),
            ),
          ],
        ),
      ),
    );

    if (result == null) return;

    try {
      double? lat, lng;
      try {
        final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (_) {}

      await widget.apiService.addCustodyLog(widget.deliveryId, {
        'eventType': result['eventType'],
        if (result['description']!.isNotEmpty) 'description': result['description'],
        if (result['temperature']!.isNotEmpty) 'temperature': result['temperature'],
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Custody event recorded'), backgroundColor: Colors.green),
      );
      _loadData();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _updateStatus(String status) async {
    try {
      await widget.apiService.updateDeliveryStatus(widget.deliveryId, status);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Status updated to $status'), backgroundColor: Colors.green),
      );
      _loadData();
      widget.onUpdated();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Icon(icon, size: 16, color: Colors.grey[600]),
          const SizedBox(width: 8),
          Text('$label: ', style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }

  Widget _statusChip(String status) {
    Color color;
    switch (status) {
      case 'pending': color = Colors.blue; break;
      case 'accepted': case 'assigned': color = Colors.purple; break;
      case 'picked_up': case 'in_transit': color = Colors.orange; break;
      case 'delivered': color = Colors.green; break;
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
}
