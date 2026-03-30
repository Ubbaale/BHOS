import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../../models/it_models.dart';
import '../../services/it_api_service.dart';

class TechSettingsScreen extends StatefulWidget {
  final ItApiService apiService;
  const TechSettingsScreen({super.key, required this.apiService});

  @override
  State<TechSettingsScreen> createState() => _TechSettingsScreenState();
}

class _TechSettingsScreenState extends State<TechSettingsScreen> {
  ContractorStatus? _contractorStatus;
  bool _isLoading = true;

  final _ssnController = TextEditingController();
  final _businessNameController = TextEditingController();
  final _taxAddressController = TextEditingController();
  final _taxCityController = TextEditingController();
  final _taxStateController = TextEditingController();
  final _taxZipController = TextEditingController();
  final _legalNameController = TextEditingController();
  String _taxClassification = 'individual';

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    setState(() => _isLoading = true);
    try {
      final status = await widget.apiService.getContractorStatus();
      setState(() {
        _contractorStatus = status;
        if (status.ssnLast4 != null) _ssnController.text = status.ssnLast4!;
        if (status.businessName != null) _businessNameController.text = status.businessName!;
        if (status.taxAddress != null) _taxAddressController.text = status.taxAddress!;
        if (status.taxCity != null) _taxCityController.text = status.taxCity!;
        if (status.taxState != null) _taxStateController.text = status.taxState!;
        if (status.taxZip != null) _taxZipController.text = status.taxZip!;
        if (status.taxClassification != null) _taxClassification = status.taxClassification!;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildOnboardingProgress(),
        const SizedBox(height: 16),
        _buildIcAgreementCard(),
        const SizedBox(height: 16),
        _buildTaxInfoCard(),
        const SizedBox(height: 16),
        _buildCertificationsCard(),
      ],
    );
  }

  Widget _buildOnboardingProgress() {
    final status = _contractorStatus;
    final icSigned = status?.icAgreementSignedAt != null;
    final w9Done = status?.w9ReceivedAt != null;
    final complete = status?.isContractorOnboarded ?? false;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(complete ? Icons.check_circle : Icons.pending, color: complete ? Colors.green : Colors.orange),
                const SizedBox(width: 8),
                Text(
                  complete ? 'Onboarding Complete' : 'Onboarding In Progress',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _progressStep('IC Agreement Signed', icSigned),
            _progressStep('Tax Info (W-9) Submitted', w9Done),
            _progressStep('Fully Onboarded', complete),
          ],
        ),
      ),
    );
  }

  Widget _progressStep(String label, bool done) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(done ? Icons.check_circle : Icons.radio_button_unchecked,
            color: done ? Colors.green : Colors.grey, size: 20),
          const SizedBox(width: 8),
          Text(label, style: TextStyle(color: done ? Colors.green[800] : Colors.grey[700])),
        ],
      ),
    );
  }

  Widget _buildIcAgreementCard() {
    final signed = _contractorStatus?.icAgreementSignedAt != null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Independent Contractor Agreement', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Divider(),
            if (signed) ...[
              Row(
                children: [
                  const Icon(Icons.verified, color: Colors.green),
                  const SizedBox(width: 8),
                  Text('Signed on ${_formatDate(_contractorStatus!.icAgreementSignedAt!)}'),
                ],
              ),
            ] else ...[
              const Text(
                'You must sign the Independent Contractor Agreement to accept jobs and receive payouts.',
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _legalNameController,
                decoration: const InputDecoration(
                  labelText: 'Legal Full Name',
                  border: OutlineInputBorder(),
                  helperText: 'Enter your full legal name as your digital signature',
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _signAgreement,
                  icon: const Icon(Icons.edit),
                  label: const Text('Sign Agreement'),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTaxInfoCard() {
    final w9Done = _contractorStatus?.w9ReceivedAt != null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('Tax Information (W-9)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                if (w9Done) ...[
                  const Spacer(),
                  const Icon(Icons.verified, color: Colors.green, size: 20),
                  const SizedBox(width: 4),
                  const Text('Submitted', style: TextStyle(color: Colors.green, fontSize: 12)),
                ],
              ],
            ),
            const Divider(),
            DropdownButtonFormField<String>(
              value: _taxClassification,
              decoration: const InputDecoration(labelText: 'Tax Classification', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'individual', child: Text('Individual / Sole Proprietor')),
                DropdownMenuItem(value: 'llc_single', child: Text('Single-member LLC')),
                DropdownMenuItem(value: 'llc_multi', child: Text('LLC (Multi-member)')),
                DropdownMenuItem(value: 'c_corp', child: Text('C Corporation')),
                DropdownMenuItem(value: 's_corp', child: Text('S Corporation')),
                DropdownMenuItem(value: 'partnership', child: Text('Partnership')),
                DropdownMenuItem(value: 'trust', child: Text('Trust / Estate')),
              ],
              onChanged: (v) => setState(() => _taxClassification = v ?? 'individual'),
            ),
            const SizedBox(height: 12),
            if (['llc_single', 'llc_multi', 'c_corp', 's_corp', 'partnership'].contains(_taxClassification))
              TextField(
                controller: _businessNameController,
                decoration: const InputDecoration(labelText: 'Business Name', border: OutlineInputBorder()),
              ),
            if (['llc_single', 'llc_multi', 'c_corp', 's_corp', 'partnership'].contains(_taxClassification))
              const SizedBox(height: 12),
            TextField(
              controller: _ssnController,
              keyboardType: TextInputType.number,
              maxLength: 4,
              decoration: const InputDecoration(
                labelText: 'SSN (Last 4 Digits)',
                border: OutlineInputBorder(),
                helperText: 'Used for 1099-NEC tax reporting',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _taxAddressController,
              decoration: const InputDecoration(labelText: 'Street Address', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: TextField(
                  controller: _taxCityController,
                  decoration: const InputDecoration(labelText: 'City', border: OutlineInputBorder()),
                )),
                const SizedBox(width: 8),
                SizedBox(width: 80, child: TextField(
                  controller: _taxStateController,
                  decoration: const InputDecoration(labelText: 'State', border: OutlineInputBorder()),
                )),
                const SizedBox(width: 8),
                SizedBox(width: 100, child: TextField(
                  controller: _taxZipController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'ZIP', border: OutlineInputBorder()),
                )),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _submitTaxInfo,
                child: Text(w9Done ? 'Update Tax Info' : 'Submit Tax Info'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCertificationsCard() {
    final certs = _contractorStatus?.certificationDocs ?? [];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('Certifications', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.add_circle, color: Colors.blue),
                  onPressed: _uploadCertification,
                ),
              ],
            ),
            const Divider(),
            if (certs.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: Text('No certifications uploaded yet')),
              )
            else
              ...certs.map<Widget>((cert) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  cert['verified'] == true ? Icons.verified : Icons.description,
                  color: cert['verified'] == true ? Colors.green : Colors.grey,
                ),
                title: Text(cert['name'] ?? 'Certificate'),
                subtitle: Text(cert['issuer'] ?? ''),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (cert['verified'] == true)
                      const Chip(label: Text('Verified', style: TextStyle(fontSize: 11, color: Colors.white)), backgroundColor: Colors.green)
                    else
                      const Chip(label: Text('Pending', style: TextStyle(fontSize: 11)), backgroundColor: Colors.amber),
                    IconButton(
                      icon: const Icon(Icons.delete, color: Colors.red, size: 20),
                      onPressed: () => _deleteCert(cert['id']),
                    ),
                  ],
                ),
              )),
          ],
        ),
      ),
    );
  }

  Future<void> _signAgreement() async {
    final name = _legalNameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your legal name'), backgroundColor: Colors.red),
      );
      return;
    }
    try {
      await widget.apiService.signIcAgreement(name);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('IC Agreement signed successfully'), backgroundColor: Colors.green),
      );
      _loadStatus();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _submitTaxInfo() async {
    if (_ssnController.text.length != 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SSN must be exactly 4 digits'), backgroundColor: Colors.red),
      );
      return;
    }
    try {
      await widget.apiService.submitContractorOnboarding(
        ssnLast4: _ssnController.text,
        taxClassification: _taxClassification,
        businessName: _businessNameController.text.isNotEmpty ? _businessNameController.text : null,
        taxAddress: _taxAddressController.text,
        taxCity: _taxCityController.text,
        taxState: _taxStateController.text,
        taxZip: _taxZipController.text,
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tax info submitted successfully'), backgroundColor: Colors.green),
      );
      _loadStatus();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _uploadCertification() async {
    final nameCtrl = TextEditingController();
    final issuerCtrl = TextEditingController();
    final expiryCtrl = TextEditingController();

    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Upload Certification'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Certification Name *')),
              const SizedBox(height: 8),
              TextField(controller: issuerCtrl, decoration: const InputDecoration(labelText: 'Issuing Organization')),
              const SizedBox(height: 8),
              TextField(controller: expiryCtrl, decoration: const InputDecoration(labelText: 'Expiry Date (MM/YYYY)')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, {
              'name': nameCtrl.text,
              'issuer': issuerCtrl.text,
              'expiry': expiryCtrl.text,
            }),
            child: const Text('Pick File & Upload'),
          ),
        ],
      ),
    );

    if (result == null || result['name']!.isEmpty) return;

    final picked = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png']);
    if (picked == null || picked.files.isEmpty) return;

    try {
      await widget.apiService.uploadCertification(
        File(picked.files.first.path!),
        result['name']!,
        result['issuer']!.isNotEmpty ? result['issuer'] : null,
        result['expiry']!.isNotEmpty ? result['expiry'] : null,
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Certification uploaded'), backgroundColor: Colors.green),
      );
      _loadStatus();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _deleteCert(String certId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Certification'),
        content: const Text('Are you sure you want to remove this certification?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await widget.apiService.deleteCertification(certId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Certification removed'), backgroundColor: Colors.green),
      );
      _loadStatus();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  String _formatDate(DateTime dt) => '${dt.month}/${dt.day}/${dt.year}';

  @override
  void dispose() {
    _ssnController.dispose();
    _businessNameController.dispose();
    _taxAddressController.dispose();
    _taxCityController.dispose();
    _taxStateController.dispose();
    _taxZipController.dispose();
    _legalNameController.dispose();
    super.dispose();
  }
}
