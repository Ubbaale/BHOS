import 'package:flutter/material.dart';
import '../../services/it_api_service.dart';

class CreateTicketScreen extends StatefulWidget {
  final ItApiService apiService;
  final VoidCallback onCreated;
  const CreateTicketScreen({super.key, required this.apiService, required this.onCreated});

  @override
  State<CreateTicketScreen> createState() => _CreateTicketScreenState();
}

class _CreateTicketScreenState extends State<CreateTicketScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;

  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  final _zipCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _instructionsCtrl = TextEditingController();
  final _equipmentCtrl = TextEditingController();
  final _payRateCtrl = TextEditingController();
  final _durationCtrl = TextEditingController();

  String _category = 'network';
  String _priority = 'medium';
  String _payType = 'hourly';
  String _paymentTerms = 'instant';
  DateTime? _scheduledDate;
  TimeOfDay? _scheduledTime;

  static const _categories = [
    'network', 'hardware', 'software', 'printer', 'ehr_system',
    'security', 'phone_system', 'email', 'backup', 'general',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Ticket')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _titleCtrl,
              decoration: const InputDecoration(labelText: 'Title *', border: OutlineInputBorder()),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descCtrl,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Description *', border: OutlineInputBorder()),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _category,
                    decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
                    items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c.replaceAll('_', ' ').toUpperCase()))).toList(),
                    onChanged: (v) => setState(() => _category = v ?? 'network'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _priority,
                    decoration: const InputDecoration(labelText: 'Priority', border: OutlineInputBorder()),
                    items: ['low', 'medium', 'high', 'urgent'].map((p) => DropdownMenuItem(value: p, child: Text(p.toUpperCase()))).toList(),
                    onChanged: (v) => setState(() => _priority = v ?? 'medium'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text('Site Location', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _addressCtrl,
              decoration: const InputDecoration(labelText: 'Street Address *', border: OutlineInputBorder()),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: TextFormField(controller: _cityCtrl, decoration: const InputDecoration(labelText: 'City', border: OutlineInputBorder()))),
                const SizedBox(width: 8),
                SizedBox(width: 80, child: TextFormField(controller: _stateCtrl, decoration: const InputDecoration(labelText: 'State', border: OutlineInputBorder()))),
                const SizedBox(width: 8),
                SizedBox(width: 100, child: TextFormField(controller: _zipCtrl, decoration: const InputDecoration(labelText: 'ZIP', border: OutlineInputBorder()))),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: TextFormField(controller: _contactCtrl, decoration: const InputDecoration(labelText: 'On-site Contact', border: OutlineInputBorder()))),
                const SizedBox(width: 8),
                Expanded(child: TextFormField(controller: _phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder()))),
              ],
            ),
            const SizedBox(height: 16),
            const Text('Schedule', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final date = await showDatePicker(context: context, initialDate: DateTime.now().add(const Duration(days: 1)), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
                      if (date != null) setState(() => _scheduledDate = date);
                    },
                    icon: const Icon(Icons.calendar_today),
                    label: Text(_scheduledDate != null ? '${_scheduledDate!.month}/${_scheduledDate!.day}/${_scheduledDate!.year}' : 'Pick Date'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 9, minute: 0));
                      if (time != null) setState(() => _scheduledTime = time);
                    },
                    icon: const Icon(Icons.access_time),
                    label: Text(_scheduledTime != null ? _scheduledTime!.format(context) : 'Pick Time'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(controller: _durationCtrl, decoration: const InputDecoration(labelText: 'Estimated Duration (e.g. 2 hours)', border: OutlineInputBorder())),
            const SizedBox(height: 16),
            const Text('Payment', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _payType,
                    decoration: const InputDecoration(labelText: 'Pay Type', border: OutlineInputBorder()),
                    items: const [
                      DropdownMenuItem(value: 'hourly', child: Text('Hourly')),
                      DropdownMenuItem(value: 'fixed', child: Text('Fixed')),
                    ],
                    onChanged: (v) => setState(() => _payType = v ?? 'hourly'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _payRateCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(labelText: _payType == 'hourly' ? 'Rate (\$/hr)' : 'Fixed Price (\$)', border: const OutlineInputBorder()),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _paymentTerms,
              decoration: const InputDecoration(labelText: 'Payment Terms', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'instant', child: Text('Instant (15% fee)')),
                DropdownMenuItem(value: 'net7', child: Text('Net 7 (12% fee)')),
                DropdownMenuItem(value: 'net14', child: Text('Net 14 (10% fee)')),
                DropdownMenuItem(value: 'net30', child: Text('Net 30 (8% fee)')),
              ],
              onChanged: (v) => setState(() => _paymentTerms = v ?? 'instant'),
            ),
            const SizedBox(height: 16),
            TextFormField(controller: _instructionsCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Special Instructions', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextFormField(controller: _equipmentCtrl, decoration: const InputDecoration(labelText: 'Equipment Needed', border: OutlineInputBorder())),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                child: _isSubmitting ? const CircularProgressIndicator(color: Colors.white) : const Text('Create Ticket'),
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
      await widget.apiService.createTicket({
        'title': _titleCtrl.text,
        'description': _descCtrl.text,
        'category': _category,
        'priority': _priority,
        'siteAddress': _addressCtrl.text,
        'siteCity': _cityCtrl.text,
        'siteState': _stateCtrl.text,
        'siteZipCode': _zipCtrl.text,
        'contactOnSite': _contactCtrl.text,
        'contactPhone': _phoneCtrl.text,
        'specialInstructions': _instructionsCtrl.text,
        'equipmentNeeded': _equipmentCtrl.text,
        'payType': _payType,
        'payRate': _payRateCtrl.text,
        'paymentTerms': _paymentTerms,
        'estimatedDuration': _durationCtrl.text,
        if (_scheduledDate != null) 'scheduledDate': _scheduledDate!.toIso8601String(),
        if (_scheduledTime != null) 'scheduledTime': _scheduledTime!.format(context),
      });
      widget.onCreated();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ticket created successfully'), backgroundColor: Colors.green),
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
    _titleCtrl.dispose(); _descCtrl.dispose(); _addressCtrl.dispose();
    _cityCtrl.dispose(); _stateCtrl.dispose(); _zipCtrl.dispose();
    _contactCtrl.dispose(); _phoneCtrl.dispose(); _instructionsCtrl.dispose();
    _equipmentCtrl.dispose(); _payRateCtrl.dispose(); _durationCtrl.dispose();
    super.dispose();
  }
}
