import 'package:flutter/material.dart';
import '../../services/driver_service.dart';
import '../../services/api_client.dart';

class DriverApplyScreen extends StatefulWidget {
  final DriverService driverService;
  final VoidCallback? onApplied;

  const DriverApplyScreen({
    super.key,
    required this.driverService,
    this.onApplied,
  });

  @override
  State<DriverApplyScreen> createState() => _DriverApplyScreenState();
}

class _DriverApplyScreenState extends State<DriverApplyScreen> {
  final _formKey = GlobalKey<FormState>();
  int _step = 0;
  bool _isLoading = false;
  String? _error;

  final _fullNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _licenseNumberController = TextEditingController();
  final _licenseStateController = TextEditingController();
  final _licenseExpiryController = TextEditingController();
  final _vehicleMakeController = TextEditingController();
  final _vehicleModelController = TextEditingController();
  final _vehicleYearController = TextEditingController();
  final _vehicleColorController = TextEditingController();
  final _vehiclePlateController = TextEditingController();
  String _vehicleType = 'sedan';
  final _insuranceProviderController = TextEditingController();
  final _insurancePolicyController = TextEditingController();
  final _insuranceExpiryController = TextEditingController();

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _isLoading = true; _error = null; });
    try {
      await widget.driverService.applyAsDriver(
        fullName: _fullNameController.text.trim(),
        phone: _phoneController.text.trim(),
        licenseNumber: _licenseNumberController.text.trim(),
        licenseState: _licenseStateController.text.trim(),
        licenseExpiry: _licenseExpiryController.text.trim(),
        vehicleMake: _vehicleMakeController.text.trim(),
        vehicleModel: _vehicleModelController.text.trim(),
        vehicleYear: _vehicleYearController.text.trim(),
        vehicleColor: _vehicleColorController.text.trim(),
        vehiclePlate: _vehiclePlateController.text.trim(),
        vehicleType: _vehicleType,
        insuranceProvider: _insuranceProviderController.text.trim().isNotEmpty ? _insuranceProviderController.text.trim() : null,
        insurancePolicyNumber: _insurancePolicyController.text.trim().isNotEmpty ? _insurancePolicyController.text.trim() : null,
        insuranceExpiry: _insuranceExpiryController.text.trim().isNotEmpty ? _insuranceExpiryController.text.trim() : null,
      );
      widget.onApplied?.call();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Application submitted! We will review it shortly.'), backgroundColor: Colors.green),
        );
        Navigator.pop(context);
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to submit. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Driver Application')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: List.generate(3, (i) => Expanded(
                    child: Container(
                      height: 4,
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      decoration: BoxDecoration(
                        color: i <= _step ? const Color(0xFF6366F1) : Colors.grey[300],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  )),
                ),
              ),
              Expanded(
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
                            color: Colors.red[50], borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.red[200]!),
                          ),
                          child: Text(_error!, style: TextStyle(color: Colors.red[700], fontSize: 13)),
                        ),
                      if (_step == 0) ..._personalStep(),
                      if (_step == 1) ..._vehicleStep(),
                      if (_step == 2) ..._insuranceStep(),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    if (_step > 0)
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => setState(() => _step--),
                          child: const Text('Back'),
                        ),
                      ),
                    if (_step > 0) const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : () {
                          if (_step < 2) {
                            setState(() => _step++);
                          } else {
                            _submit();
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF6366F1),
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 48),
                        ),
                        child: _isLoading
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : Text(_step < 2 ? 'Next' : 'Submit Application'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _personalStep() => [
    const Text('Personal Information', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
    const SizedBox(height: 16),
    _field(_fullNameController, 'Full Name', validator: _required),
    _field(_phoneController, 'Phone Number', keyboard: TextInputType.phone, validator: _required),
    _field(_licenseNumberController, 'Driver License Number', validator: _required),
    _field(_licenseStateController, 'License State', validator: _required),
    _field(_licenseExpiryController, 'License Expiry (MM/YYYY)', validator: _required),
  ];

  List<Widget> _vehicleStep() => [
    const Text('Vehicle Information', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
    const SizedBox(height: 16),
    _field(_vehicleMakeController, 'Make (e.g. Toyota)', validator: _required),
    _field(_vehicleModelController, 'Model (e.g. Camry)', validator: _required),
    _field(_vehicleYearController, 'Year', keyboard: TextInputType.number, validator: _required),
    _field(_vehicleColorController, 'Color', validator: _required),
    _field(_vehiclePlateController, 'License Plate', validator: _required),
    const SizedBox(height: 8),
    const Text('Vehicle Type', style: TextStyle(fontWeight: FontWeight.w600)),
    const SizedBox(height: 8),
    Wrap(
      spacing: 8,
      children: ['sedan', 'wheelchair_van', 'stretcher', 'gurney'].map((t) => ChoiceChip(
        label: Text(t.replaceAll('_', ' ').toUpperCase()),
        selected: _vehicleType == t,
        onSelected: (_) => setState(() => _vehicleType = t),
        selectedColor: const Color(0xFF6366F1).withOpacity(0.2),
      )).toList(),
    ),
  ];

  List<Widget> _insuranceStep() => [
    const Text('Insurance (Optional)', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
    const SizedBox(height: 8),
    Text('You can add this later from your profile.', style: TextStyle(color: Colors.grey[600])),
    const SizedBox(height: 16),
    _field(_insuranceProviderController, 'Insurance Provider'),
    _field(_insurancePolicyController, 'Policy Number'),
    _field(_insuranceExpiryController, 'Expiry Date (MM/YYYY)'),
  ];

  Widget _field(TextEditingController controller, String label,
      {TextInputType? keyboard, String? Function(String?)? validator}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboard,
        validator: validator,
        decoration: InputDecoration(
          labelText: label,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }

  String? _required(String? v) => v == null || v.trim().isEmpty ? 'Required' : null;

  @override
  void dispose() {
    _fullNameController.dispose();
    _phoneController.dispose();
    _licenseNumberController.dispose();
    _licenseStateController.dispose();
    _licenseExpiryController.dispose();
    _vehicleMakeController.dispose();
    _vehicleModelController.dispose();
    _vehicleYearController.dispose();
    _vehicleColorController.dispose();
    _vehiclePlateController.dispose();
    _insuranceProviderController.dispose();
    _insurancePolicyController.dispose();
    _insuranceExpiryController.dispose();
    super.dispose();
  }
}
