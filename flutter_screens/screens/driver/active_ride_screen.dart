import 'dart:async';
import 'package:flutter/material.dart';
import '../../models/ride_models.dart';
import '../../services/ride_service.dart';
import '../../widgets/chat_bubble.dart';

class ActiveRideScreen extends StatefulWidget {
  final RideService rideService;
  final int rideId;

  const ActiveRideScreen({
    super.key,
    required this.rideService,
    required this.rideId,
  });

  @override
  State<ActiveRideScreen> createState() => _ActiveRideScreenState();
}

class _ActiveRideScreenState extends State<ActiveRideScreen> {
  Ride? _ride;
  List<RideMessage> _messages = [];
  bool _isLoading = true;
  bool _showChat = false;
  bool _isUpdating = false;
  final _messageController = TextEditingController();
  final _tollController = TextEditingController();
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loadData();
    _pollTimer = Timer.periodic(const Duration(seconds: 15), (_) => _refreshRide());
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final ride = await widget.rideService.getRide(widget.rideId);
      final messages = await widget.rideService.getMessages(widget.rideId);
      setState(() { _ride = ride; _messages = messages; _isLoading = false; });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _refreshRide() async {
    try {
      final ride = await widget.rideService.getRide(widget.rideId);
      if (mounted) setState(() => _ride = ride);
    } catch (_) {}
  }

  Future<void> _updateStatus(String status) async {
    setState(() => _isUpdating = true);
    try {
      final ride = await widget.rideService.updateRideStatus(widget.rideId, status);
      setState(() { _ride = ride; _isUpdating = false; });
    } catch (e) {
      setState(() => _isUpdating = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _completeRide() async {
    String? tollActual;
    if (_ride?.tollEstimate != null && _ride!.tollEstimate != '0') {
      tollActual = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Confirm Tolls'),
          content: TextField(
            controller: _tollController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'Actual toll amount',
              hintText: _ride!.tollEstimate,
              prefixText: '\$',
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, _ride!.tollEstimate), child: const Text('Use Estimate')),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, _tollController.text.isNotEmpty ? _tollController.text : _ride!.tollEstimate),
              child: const Text('Confirm'),
            ),
          ],
        ),
      );
      if (tollActual == null) return;
    }
    setState(() => _isUpdating = true);
    try {
      final ride = await widget.rideService.completeRide(widget.rideId, tollActual: tollActual);
      setState(() { _ride = ride; _isUpdating = false; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ride completed!'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      setState(() => _isUpdating = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;
    _messageController.clear();
    try {
      final msg = await widget.rideService.sendMessage(widget.rideId, text);
      setState(() => _messages.add(msg));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_ride != null ? 'Ride #${_ride!.id}' : 'Active Ride'),
        actions: [
          if (_ride != null && _ride!.isActive)
            IconButton(
              icon: Icon(_showChat ? Icons.map : Icons.chat),
              onPressed: () => setState(() => _showChat = !_showChat),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _ride == null
              ? const Center(child: Text('Ride not found'))
              : _showChat
                  ? _buildChatView()
                  : _buildRideView(),
    );
  }

  Widget _buildRideView() {
    final ride = _ride!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            height: 160,
            decoration: BoxDecoration(
              color: Colors.grey[200],
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Center(child: Icon(Icons.map, size: 48, color: Colors.grey)),
          ),
          const SizedBox(height: 20),
          if (ride.patientName != null)
            Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: Colors.blue.withOpacity(0.15),
                  child: const Icon(Icons.person, color: Colors.blue),
                ),
                title: Text(ride.patientName!, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: ride.patientPhone != null ? Text(ride.patientPhone!) : null,
                trailing: ride.patientPhone != null
                    ? IconButton(icon: const Icon(Icons.phone, color: Colors.green), onPressed: () {})
                    : null,
              ),
            ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Row(
                    children: [
                      const Icon(Icons.trip_origin, color: Colors.green, size: 16),
                      const SizedBox(width: 8),
                      Expanded(child: Text(ride.pickupAddress, style: const TextStyle(fontSize: 13))),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(left: 7),
                    child: Container(width: 2, height: 20, color: Colors.grey[300]),
                  ),
                  Row(
                    children: [
                      const Icon(Icons.location_on, color: Colors.red, size: 16),
                      const SizedBox(width: 8),
                      Expanded(child: Text(ride.dropoffAddress, style: const TextStyle(fontSize: 13))),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (ride.medicalNotes != null && ride.medicalNotes!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.blue[200]!),
              ),
              child: Row(
                children: [
                  Icon(Icons.medical_information, color: Colors.blue[700], size: 18),
                  const SizedBox(width: 8),
                  Expanded(child: Text(ride.medicalNotes!, style: TextStyle(color: Colors.blue[800], fontSize: 13))),
                ],
              ),
            ),
          ],
          if (ride.specialNeeds != null) ...[
            const SizedBox(height: 8),
            Chip(
              avatar: const Icon(Icons.accessible, size: 16),
              label: Text(ride.specialNeeds!),
              backgroundColor: Colors.orange.withOpacity(0.1),
            ),
          ],
          const SizedBox(height: 20),
          Row(
            children: [
              if (ride.estimatedFare != null)
                _infoTile('Fare', '\$${ride.estimatedFare}', Icons.attach_money, Colors.green),
              if (ride.distance != null) ...[
                const SizedBox(width: 8),
                _infoTile('Distance', '${ride.distance} mi', Icons.straighten, Colors.blue),
              ],
              if (ride.vehicleType != null) ...[
                const SizedBox(width: 8),
                _infoTile('Type', ride.vehicleType!, Icons.directions_car, Colors.purple),
              ],
            ],
          ),
          const SizedBox(height: 24),
          if (ride.isActive) _buildActionButtons(ride),
          if (ride.isCompleted)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.green[50],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  const Icon(Icons.check_circle, color: Colors.green, size: 48),
                  const SizedBox(height: 8),
                  const Text('Ride Completed', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                  Text('Final fare: \$${ride.finalFare ?? ride.estimatedFare}',
                      style: TextStyle(color: Colors.grey[600])),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _infoTile(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: color)),
            Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons(Ride ride) {
    Widget actionButton(String label, IconData icon, Color color, VoidCallback onPressed) {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton.icon(
          onPressed: _isUpdating ? null : onPressed,
          icon: _isUpdating
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : Icon(icon),
          label: Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          style: ElevatedButton.styleFrom(
            backgroundColor: color,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      );
    }

    switch (ride.status) {
      case 'accepted':
        return actionButton('Start Driving to Pickup', Icons.directions_car, Colors.blue,
            () => _updateStatus('driver_enroute'));
      case 'driver_enroute':
        return actionButton('Arrived at Pickup', Icons.location_on, Colors.orange,
            () => _updateStatus('arrived'));
      case 'arrived':
        return actionButton('Patient Picked Up', Icons.airline_seat_recline_normal, Colors.purple,
            () => _updateStatus('picked_up'));
      case 'picked_up': case 'in_progress':
        return actionButton('Complete Ride', Icons.flag, Colors.green, _completeRide);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildChatView() {
    return Column(
      children: [
        Expanded(
          child: _messages.isEmpty
              ? Center(child: Text('No messages yet', style: TextStyle(color: Colors.grey[500])))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  reverse: true,
                  itemCount: _messages.length,
                  itemBuilder: (context, index) {
                    final msg = _messages[_messages.length - 1 - index];
                    return ChatBubble(message: msg, isMe: msg.senderRole == 'driver');
                  },
                ),
        ),
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, -2))],
          ),
          child: SafeArea(
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _sendMessage(),
                    decoration: InputDecoration(
                      hintText: 'Type a message...',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.send, color: Color(0xFF6366F1)),
                  onPressed: _sendMessage,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _messageController.dispose();
    _tollController.dispose();
    super.dispose();
  }
}
