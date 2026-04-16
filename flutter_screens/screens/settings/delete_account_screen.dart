import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/auth_service.dart';
import '../../services/local_cache_service.dart';

class DeleteAccountScreen extends StatefulWidget {
  final AuthService authService;
  final VoidCallback onAccountDeleted;

  const DeleteAccountScreen({
    super.key,
    required this.authService,
    required this.onAccountDeleted,
  });

  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  final _passwordController = TextEditingController();
  final _reasonController = TextEditingController();
  bool _isLoading = false;
  bool _confirmed = false;
  String? _error;
  String _selectedReason = '';

  final List<String> _reasons = [
    'I no longer need this service',
    'I found a better alternative',
    'I have privacy concerns',
    'I\'m having technical issues',
    'Other',
  ];

  Future<void> _deleteAccount() async {
    if (!_confirmed) {
      HapticFeedback.heavyImpact();
      setState(() => _error = 'Please confirm you understand this action is permanent.');
      return;
    }
    if (_passwordController.text.isEmpty) {
      HapticFeedback.heavyImpact();
      setState(() => _error = 'Please enter your password to confirm.');
      return;
    }

    final shouldProceed = await showCupertinoDialog<bool>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Delete Account Permanently'),
        content: const Text(
          'This will permanently delete your account and all associated data including ride history, payment information, and personal details. This action cannot be undone.',
        ),
        actions: [
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete Forever'),
          ),
        ],
      ),
    );

    if (shouldProceed != true) return;

    setState(() { _isLoading = true; _error = null; });
    try {
      await widget.authService.deleteAccount(
        password: _passwordController.text,
        reason: _selectedReason.isNotEmpty
            ? (_selectedReason == 'Other' ? _reasonController.text : _selectedReason)
            : null,
      );
      await LocalCacheService().clearAll();
      HapticFeedback.heavyImpact();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Your account has been deleted.'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
        widget.onAccountDeleted();
      }
    } catch (e) {
      HapticFeedback.heavyImpact();
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Delete Account'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.red[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.red[200]!),
              ),
              child: Row(
                children: [
                  Icon(Icons.warning_amber_rounded, color: Colors.red[700], size: 32),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Danger Zone', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red[700], fontSize: 16)),
                        const SizedBox(height: 4),
                        Text(
                          'Deleting your account is permanent and cannot be undone.',
                          style: TextStyle(color: Colors.red[600], fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text('What will be deleted:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            _deletionItem(Icons.person, 'Your profile and personal information'),
            _deletionItem(Icons.history, 'All ride and job history'),
            _deletionItem(Icons.payment, 'Payment methods and billing info'),
            _deletionItem(Icons.chat, 'Messages and chat history'),
            _deletionItem(Icons.description, 'Documents and uploaded files'),
            const SizedBox(height: 24),
            const Text('Why are you leaving?', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            const SizedBox(height: 12),
            ...(_reasons.map((reason) => RadioListTile<String>(
              value: reason,
              groupValue: _selectedReason,
              onChanged: (v) {
                HapticFeedback.selectionClick();
                setState(() => _selectedReason = v ?? '');
              },
              title: Text(reason, style: const TextStyle(fontSize: 14)),
              contentPadding: EdgeInsets.zero,
              dense: true,
            ))),
            if (_selectedReason == 'Other') ...[
              const SizedBox(height: 8),
              TextField(
                controller: _reasonController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Please tell us why...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
            const SizedBox(height: 24),
            const Text('Confirm your password', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            const SizedBox(height: 8),
            TextField(
              controller: _passwordController,
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'Current Password',
                prefixIcon: const Icon(Icons.lock_outlined),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                CupertinoSwitch(
                  value: _confirmed,
                  onChanged: (v) {
                    HapticFeedback.selectionClick();
                    setState(() => _confirmed = v);
                  },
                  activeColor: Colors.red,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'I understand this action is permanent and all my data will be deleted.',
                    style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                  ),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red[200]!),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, size: 18, color: Colors.red[700]),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!, style: TextStyle(color: Colors.red[700], fontSize: 13))),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _deleteAccount,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: _isLoading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Delete My Account', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _deletionItem(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.red[400]),
          const SizedBox(width: 12),
          Text(text, style: TextStyle(color: Colors.grey[700], fontSize: 14)),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _passwordController.dispose();
    _reasonController.dispose();
    super.dispose();
  }
}
