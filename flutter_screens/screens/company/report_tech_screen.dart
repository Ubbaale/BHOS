import 'package:flutter/material.dart';
import '../../services/it_api_service.dart';

class ReportTechScreen extends StatefulWidget {
  final ItApiService apiService;
  final String techUserId;
  final String ticketId;

  const ReportTechScreen({
    super.key,
    required this.apiService,
    required this.techUserId,
    required this.ticketId,
  });

  @override
  State<ReportTechScreen> createState() => _ReportTechScreenState();
}

class _ReportTechScreenState extends State<ReportTechScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;
  String _category = 'poor_work';
  final _reasonCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();

  static const _categories = {
    'time_padding': 'Time Padding',
    'no_show': 'No Show',
    'poor_work': 'Poor Work Quality',
    'unprofessional': 'Unprofessional Behavior',
    'damage': 'Property Damage',
    'safety_violation': 'Safety Violation',
    'misrepresentation': 'Misrepresentation',
    'other': 'Other',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report Technician')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: Colors.red[50],
              child: const Padding(
                padding: EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.warning, color: Colors.red),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Filing a complaint creates a formal record. Three verified complaints result in the tech being placed on hold pending admin review.',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _category,
              decoration: const InputDecoration(labelText: 'Complaint Category *', border: OutlineInputBorder()),
              items: _categories.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
              onChanged: (v) => setState(() => _category = v ?? 'poor_work'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _reasonCtrl,
              decoration: const InputDecoration(labelText: 'Brief Reason *', border: OutlineInputBorder()),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descriptionCtrl,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Detailed Description *',
                border: OutlineInputBorder(),
                helperText: 'Provide specific details about what happened',
              ),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                child: _isSubmitting
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('Submit Complaint'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);
    try {
      await widget.apiService.reportTech(
        widget.techUserId,
        widget.ticketId,
        _category,
        _reasonCtrl.text,
        _descriptionCtrl.text,
      );
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Complaint submitted'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }
}
