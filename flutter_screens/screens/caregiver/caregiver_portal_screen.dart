import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../patient/book_ride_screen.dart';
import '../../services/ride_service.dart';

class CaregiverPortalScreen extends StatefulWidget {
  final ApiClient client;
  final RideService rideService;

  const CaregiverPortalScreen({
    super.key,
    required this.client,
    required this.rideService,
  });

  @override
  State<CaregiverPortalScreen> createState() => _CaregiverPortalScreenState();
}

class _CaregiverPortalScreenState extends State<CaregiverPortalScreen> {
  List<Map<String, dynamic>> _patients = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadPatients();
  }

  Future<void> _loadPatients() async {
    setState(() => _isLoading = true);
    try {
      final data = await widget.client.getRaw('/api/caregiver/patients');
      final list = (data is Map && data.containsKey('data')) ? data['data'] : data;
      setState(() {
        _patients = (list as List).cast<Map<String, dynamic>>();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Caregiver Portal'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add),
            onPressed: _showAddPatientDialog,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _patients.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.family_restroom, size: 64, color: Colors.grey[400]),
                      const SizedBox(height: 16),
                      Text('No patients added yet', style: TextStyle(color: Colors.grey[600], fontSize: 16)),
                      const SizedBox(height: 8),
                      ElevatedButton.icon(
                        onPressed: _showAddPatientDialog,
                        icon: const Icon(Icons.person_add),
                        label: const Text('Add Patient'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadPatients,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _statsRow(),
                      const SizedBox(height: 16),
                      const Text('My Patients', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      ..._patients.map(_patientCard),
                    ],
                  ),
                ),
    );
  }

  Widget _statsRow() {
    return Row(
      children: [
        _statTile('Patients', _patients.length.toString(), Icons.people, Colors.blue),
        const SizedBox(width: 8),
        _statTile('Active Rides', '0', Icons.local_taxi, Colors.green),
        const SizedBox(width: 8),
        _statTile('Total Rides', '0', Icons.history, Colors.purple),
      ],
    );
  }

  Widget _statTile(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: color)),
            Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Widget _patientCard(Map<String, dynamic> patient) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: const Color(0xFF6366F1).withOpacity(0.15),
                  child: Text(
                    (patient['fullName'] ?? 'P')[0].toUpperCase(),
                    style: const TextStyle(color: Color(0xFF6366F1), fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(patient['fullName'] ?? 'Unknown', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      if (patient['phone'] != null)
                        Text(patient['phone'], style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    ],
                  ),
                ),
                PopupMenuButton(
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'edit', child: Text('Edit')),
                    const PopupMenuItem(value: 'ride', child: Text('Book Ride')),
                  ],
                  onSelected: (v) {
                    if (v == 'ride') {
                      Navigator.push(context, MaterialPageRoute(
                        builder: (_) => BookRideScreen(rideService: widget.rideService),
                      ));
                    }
                  },
                ),
              ],
            ),
            if (patient['medicalNotes'] != null && (patient['medicalNotes'] as String).isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(patient['medicalNotes'], style: TextStyle(color: Colors.blue[800], fontSize: 12)),
              ),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.push(context, MaterialPageRoute(
                    builder: (_) => BookRideScreen(rideService: widget.rideService),
                  ));
                },
                icon: const Icon(Icons.local_taxi, size: 18),
                label: const Text('Book Ride'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showAddPatientDialog() async {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final notesController = TextEditingController();

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Patient'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Full Name')),
              const SizedBox(height: 8),
              TextField(controller: phoneController, decoration: const InputDecoration(labelText: 'Phone'), keyboardType: TextInputType.phone),
              const SizedBox(height: 8),
              TextField(controller: notesController, decoration: const InputDecoration(labelText: 'Medical Notes'), maxLines: 2),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Add')),
        ],
      ),
    );
    if (result == true && nameController.text.isNotEmpty) {
      try {
        await widget.client.post('/api/caregiver/patients', {
          'fullName': nameController.text.trim(),
          'phone': phoneController.text.trim(),
          'medicalNotes': notesController.text.trim(),
        });
        _loadPatients();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
          );
        }
      }
    }
  }
}
