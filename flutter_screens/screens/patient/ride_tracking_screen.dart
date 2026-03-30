import 'dart:async';
import 'package:flutter/material.dart';
import '../../models/ride_models.dart';
import '../../services/ride_service.dart';
import '../../widgets/chat_bubble.dart';

class RideTrackingScreen extends StatefulWidget {
  final RideService rideService;
  final int rideId;

  const RideTrackingScreen({
    super.key,
    required this.rideService,
    required this.rideId,
  });

  @override
  State<RideTrackingScreen> createState() => _RideTrackingScreenState();
}

class _RideTrackingScreenState extends State<RideTrackingScreen> {
  Ride? _ride;
  List<RideMessage> _messages = [];
  bool _isLoading = true;
  bool _showChat = false;
  final _messageController = TextEditingController();
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loadData();
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) => _refreshRide());
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
      if (ride.isCompleted || ride.isCancelled) _pollTimer?.cancel();
    } catch (_) {}
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;
    _messageController.clear();
    try {
      final msg = await widget.rideService.sendMessage(widget.rideId, text);
      setState(() => _messages.add(msg));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to send: $e'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_ride != null ? 'Ride #${_ride!.id}' : 'Tracking'),
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
                  : _buildTrackingView(),
    );
  }

  Widget _buildTrackingView() {
    final ride = _ride!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            height: 200,
            decoration: BoxDecoration(
              color: Colors.grey[200],
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.map, size: 48, color: Colors.grey),
                  SizedBox(height: 8),
                  Text('Live Map', style: TextStyle(color: Colors.grey)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          _statusTimeline(ride),
          const SizedBox(height: 20),
          if (ride.driverName != null) ...[
            Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: const Color(0xFF6366F1).withOpacity(0.15),
                  child: const Icon(Icons.person, color: Color(0xFF6366F1)),
                ),
                title: Text(ride.driverName!, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text([ride.vehicleColor, ride.vehicleMake, ride.vehicleModel]
                    .where((v) => v != null).join(' ')),
                trailing: ride.vehiclePlate != null
                    ? Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.grey[100],
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.grey[300]!),
                        ),
                        child: Text(ride.vehiclePlate!, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      )
                    : null,
              ),
            ),
            if (ride.driverPhone != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {},
                        icon: const Icon(Icons.phone),
                        label: const Text('Call Driver'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => setState(() => _showChat = true),
                        icon: const Icon(Icons.chat),
                        label: const Text('Message'),
                      ),
                    ),
                  ],
                ),
              ),
          ],
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Trip Details', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  _detailRow(Icons.trip_origin, 'Pickup', ride.pickupAddress, Colors.green),
                  const SizedBox(height: 8),
                  _detailRow(Icons.location_on, 'Dropoff', ride.dropoffAddress, Colors.red),
                  if (ride.vehicleType != null) ...[
                    const SizedBox(height: 8),
                    _detailRow(Icons.directions_car, 'Vehicle', ride.vehicleType!, Colors.blue),
                  ],
                  if (ride.estimatedFare != null) ...[
                    const SizedBox(height: 8),
                    _detailRow(Icons.attach_money, 'Est. Fare', '\$${ride.estimatedFare}', Colors.orange),
                  ],
                ],
              ),
            ),
          ),
          if (ride.isActive && ride.status == 'requested') ...[
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => _cancelRide(),
                style: OutlinedButton.styleFrom(foregroundColor: Colors.red, side: const BorderSide(color: Colors.red)),
                child: const Text('Cancel Ride'),
              ),
            ),
          ],
          if (ride.isActive) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.share),
                label: const Text('Share Trip'),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.grey[800], foregroundColor: Colors.white),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.sos, color: Colors.white),
                label: const Text('SOS Emergency'),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _statusTimeline(Ride ride) {
    final steps = [
      {'status': 'requested', 'label': 'Requested', 'icon': Icons.fiber_manual_record},
      {'status': 'accepted', 'label': 'Driver Assigned', 'icon': Icons.check_circle},
      {'status': 'driver_enroute', 'label': 'Driver En Route', 'icon': Icons.directions_car},
      {'status': 'arrived', 'label': 'Driver Arrived', 'icon': Icons.location_on},
      {'status': 'picked_up', 'label': 'Picked Up', 'icon': Icons.airline_seat_recline_normal},
      {'status': 'completed', 'label': 'Completed', 'icon': Icons.flag},
    ];
    final statusOrder = steps.map((s) => s['status'] as String).toList();
    final currentIdx = statusOrder.indexOf(ride.status);

    return Column(
      children: List.generate(steps.length, (i) {
        final isCompleted = i <= currentIdx;
        final isCurrent = i == currentIdx;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isCompleted ? const Color(0xFF6366F1) : Colors.grey[300],
                    border: isCurrent ? Border.all(color: const Color(0xFF6366F1), width: 3) : null,
                  ),
                  child: Icon(
                    steps[i]['icon'] as IconData,
                    size: 14,
                    color: isCompleted ? Colors.white : Colors.grey,
                  ),
                ),
                if (i < steps.length - 1)
                  Container(width: 2, height: 24, color: isCompleted ? const Color(0xFF6366F1) : Colors.grey[300]),
              ],
            ),
            const SizedBox(width: 12),
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                steps[i]['label'] as String,
                style: TextStyle(
                  fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                  color: isCompleted ? Colors.black : Colors.grey,
                ),
              ),
            ),
          ],
        );
      }),
    );
  }

  Widget _detailRow(IconData icon, String label, String value, Color color) {
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 8),
        Text('$label: ', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
        Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
      ],
    );
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
                    return ChatBubble(message: msg, isMe: msg.senderRole == 'patient');
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

  Future<void> _cancelRide() async {
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final controller = TextEditingController();
        return AlertDialog(
          title: const Text('Cancel Ride'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(hintText: 'Reason (optional)'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Keep Ride')),
            TextButton(
              onPressed: () => Navigator.pop(ctx, controller.text),
              child: const Text('Cancel Ride', style: TextStyle(color: Colors.red)),
            ),
          ],
        );
      },
    );
    if (reason == null) return;
    try {
      final ride = await widget.rideService.cancelRide(widget.rideId, reason: reason.isNotEmpty ? reason : null);
      setState(() => _ride = ride);
      _pollTimer?.cancel();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _messageController.dispose();
    super.dispose();
  }
}
