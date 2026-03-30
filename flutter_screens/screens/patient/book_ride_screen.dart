import 'package:flutter/material.dart';
import '../../services/ride_service.dart';
import '../../services/api_client.dart';

class BookRideScreen extends StatefulWidget {
  final RideService rideService;
  const BookRideScreen({super.key, required this.rideService});

  @override
  State<BookRideScreen> createState() => _BookRideScreenState();
}

class _BookRideScreenState extends State<BookRideScreen> {
  final _pickupController = TextEditingController();
  final _dropoffController = TextEditingController();
  final _notesController = TextEditingController();
  String _vehicleType = 'sedan';
  String? _specialNeeds;
  bool _isRoundTrip = false;
  DateTime? _scheduledTime;
  bool _isLoading = false;
  String? _error;

  final _vehicleTypes = [
    {'value': 'sedan', 'label': 'Sedan', 'icon': Icons.directions_car},
    {'value': 'wheelchair_van', 'label': 'Wheelchair Van', 'icon': Icons.accessible},
    {'value': 'stretcher', 'label': 'Stretcher', 'icon': Icons.local_hospital},
    {'value': 'gurney', 'label': 'Gurney', 'icon': Icons.airline_seat_flat},
  ];

  Future<void> _bookRide() async {
    if (_pickupController.text.trim().isEmpty || _dropoffController.text.trim().isEmpty) {
      setState(() => _error = 'Please enter pickup and dropoff addresses');
      return;
    }
    setState(() { _isLoading = true; _error = null; });
    try {
      final ride = await widget.rideService.bookRide(
        pickupAddress: _pickupController.text.trim(),
        dropoffAddress: _dropoffController.text.trim(),
        vehicleType: _vehicleType,
        specialNeeds: _specialNeeds,
        medicalNotes: _notesController.text.trim().isNotEmpty ? _notesController.text.trim() : null,
        isRoundTrip: _isRoundTrip,
        scheduledTime: _scheduledTime?.toIso8601String(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ride #${ride.id} booked!'), backgroundColor: Colors.green),
        );
        Navigator.pop(context, ride);
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to book ride. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(hours: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (time == null) return;
    setState(() {
      _scheduledTime = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Book a Ride')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_error != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red[50],
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red[200]!),
                  ),
                  child: Text(_error!, style: TextStyle(color: Colors.red[700], fontSize: 13)),
                ),
              const Text('Pickup Location', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              TextField(
                controller: _pickupController,
                decoration: InputDecoration(
                  hintText: 'Enter pickup address',
                  prefixIcon: const Icon(Icons.trip_origin, color: Colors.green),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Dropoff Location', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              TextField(
                controller: _dropoffController,
                decoration: InputDecoration(
                  hintText: 'Enter dropoff address',
                  prefixIcon: const Icon(Icons.location_on, color: Colors.red),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),
              const Text('Vehicle Type', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _vehicleTypes.map((v) => ChoiceChip(
                  avatar: Icon(v['icon'] as IconData, size: 18),
                  label: Text(v['label'] as String),
                  selected: _vehicleType == v['value'],
                  onSelected: (_) => setState(() => _vehicleType = v['value'] as String),
                  selectedColor: const Color(0xFF6366F1).withOpacity(0.2),
                )).toList(),
              ),
              const SizedBox(height: 20),
              const Text('Schedule', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: _pickDateTime,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey[400]!),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.schedule, color: Colors.grey),
                      const SizedBox(width: 12),
                      Text(
                        _scheduledTime != null
                            ? '${_scheduledTime!.month}/${_scheduledTime!.day} at ${_scheduledTime!.hour}:${_scheduledTime!.minute.toString().padLeft(2, '0')}'
                            : 'ASAP (tap to schedule)',
                        style: TextStyle(color: _scheduledTime != null ? Colors.black : Colors.grey[600]),
                      ),
                      const Spacer(),
                      if (_scheduledTime != null)
                        GestureDetector(
                          onTap: () => setState(() => _scheduledTime = null),
                          child: const Icon(Icons.close, size: 18, color: Colors.grey),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              SwitchListTile(
                title: const Text('Round Trip'),
                subtitle: const Text('Driver will wait and bring you back'),
                value: _isRoundTrip,
                onChanged: (v) => setState(() => _isRoundTrip = v),
                contentPadding: EdgeInsets.zero,
              ),
              const SizedBox(height: 8),
              const Text('Special Needs', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: ['Wheelchair', 'Oxygen', 'Bariatric', 'None'].map((s) => ChoiceChip(
                  label: Text(s),
                  selected: _specialNeeds == (s == 'None' ? null : s.toLowerCase()),
                  onSelected: (_) => setState(() => _specialNeeds = s == 'None' ? null : s.toLowerCase()),
                  selectedColor: const Color(0xFF6366F1).withOpacity(0.2),
                )).toList(),
              ),
              const SizedBox(height: 16),
              const Text('Medical Notes (for driver)', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              TextField(
                controller: _notesController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Any notes for the driver (optional)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _bookRide,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6366F1),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isLoading
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Book Ride', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _pickupController.dispose();
    _dropoffController.dispose();
    _notesController.dispose();
    super.dispose();
  }
}
