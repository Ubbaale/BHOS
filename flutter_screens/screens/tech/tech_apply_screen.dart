import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class TechApplyScreen extends StatefulWidget {
  final String baseUrl;
  const TechApplyScreen({super.key, required this.baseUrl});

  @override
  State<TechApplyScreen> createState() => _TechApplyScreenState();
}

class _TechApplyScreenState extends State<TechApplyScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;
  int _step = 0;

  final _usernameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _fullNameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  final _zipCtrl = TextEditingController();
  final _bioCtrl = TextEditingController();
  final _hourlyRateCtrl = TextEditingController();
  String _experienceYears = '0-1';
  final List<String> _selectedSkills = [];

  static const _skillOptions = [
    'Network Administration', 'Hardware Repair', 'Software Support',
    'Printer/Copier', 'EHR Systems', 'Security Systems',
    'Phone/VoIP', 'Email Systems', 'Backup/Recovery',
    'Cloud Services', 'Server Management', 'Cabling',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Apply as IT Technician')),
      body: Form(
        key: _formKey,
        child: Stepper(
          currentStep: _step,
          onStepContinue: () {
            if (_step < 2) {
              setState(() => _step++);
            } else {
              _submit();
            }
          },
          onStepCancel: () {
            if (_step > 0) setState(() => _step--);
          },
          steps: [
            Step(
              title: const Text('Account'),
              isActive: _step >= 0,
              content: Column(
                children: [
                  TextFormField(
                    controller: _usernameCtrl,
                    decoration: const InputDecoration(labelText: 'Username *', border: OutlineInputBorder()),
                    validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email *', border: OutlineInputBorder()),
                    validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _passwordCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Password *', border: OutlineInputBorder()),
                    validator: (v) => v == null || v.length < 6 ? 'Min 6 characters' : null,
                  ),
                ],
              ),
            ),
            Step(
              title: const Text('Personal Info'),
              isActive: _step >= 1,
              content: Column(
                children: [
                  TextFormField(
                    controller: _fullNameCtrl,
                    decoration: const InputDecoration(labelText: 'Full Name *', border: OutlineInputBorder()),
                    validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Phone *', border: OutlineInputBorder()),
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
                ],
              ),
            ),
            Step(
              title: const Text('Skills & Experience'),
              isActive: _step >= 2,
              content: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DropdownButtonFormField<String>(
                    value: _experienceYears,
                    decoration: const InputDecoration(labelText: 'Experience', border: OutlineInputBorder()),
                    items: const [
                      DropdownMenuItem(value: '0-1', child: Text('0-1 years')),
                      DropdownMenuItem(value: '1-3', child: Text('1-3 years')),
                      DropdownMenuItem(value: '3-5', child: Text('3-5 years')),
                      DropdownMenuItem(value: '5-10', child: Text('5-10 years')),
                      DropdownMenuItem(value: '10+', child: Text('10+ years')),
                    ],
                    onChanged: (v) => setState(() => _experienceYears = v ?? '0-1'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _hourlyRateCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Desired Hourly Rate (\$)', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _bioCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: 'Bio / Summary', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  const Text('Skills', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: _skillOptions.map((skill) => FilterChip(
                      label: Text(skill, style: const TextStyle(fontSize: 12)),
                      selected: _selectedSkills.contains(skill),
                      onSelected: (selected) {
                        setState(() {
                          if (selected) _selectedSkills.add(skill);
                          else _selectedSkills.remove(skill);
                        });
                      },
                    )).toList(),
                  ),
                ],
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
      final response = await http.post(
        Uri.parse('${widget.baseUrl}/api/it/tech/apply'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': _usernameCtrl.text,
          'email': _emailCtrl.text,
          'password': _passwordCtrl.text,
          'fullName': _fullNameCtrl.text,
          'phone': _phoneCtrl.text,
          'city': _cityCtrl.text,
          'state': _stateCtrl.text,
          'zipCode': _zipCtrl.text,
          'bio': _bioCtrl.text,
          'hourlyRate': _hourlyRateCtrl.text,
          'experienceYears': _experienceYears,
          'skills': _selectedSkills,
        }),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Application submitted! You will be notified once approved.'), backgroundColor: Colors.green),
          );
          Navigator.pop(context);
        }
      } else {
        final body = jsonDecode(response.body);
        throw Exception(body['message'] ?? 'Application failed');
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
    _usernameCtrl.dispose(); _emailCtrl.dispose(); _passwordCtrl.dispose();
    _fullNameCtrl.dispose(); _phoneCtrl.dispose(); _cityCtrl.dispose();
    _stateCtrl.dispose(); _zipCtrl.dispose(); _bioCtrl.dispose();
    _hourlyRateCtrl.dispose();
    super.dispose();
  }
}
