import 'package:flutter/material.dart';

class DeliverablesForm extends StatefulWidget {
  final List<Map<String, dynamic>> existingDeliverables;
  final Future<void> Function(String notes, List<String> urls) onSubmit;

  const DeliverablesForm({
    super.key,
    this.existingDeliverables = const [],
    required this.onSubmit,
  });

  @override
  State<DeliverablesForm> createState() => _DeliverablesFormState();
}

class _DeliverablesFormState extends State<DeliverablesForm> {
  final _notesCtrl = TextEditingController();
  final _urlCtrl = TextEditingController();
  final List<String> _urls = [];
  bool _isSubmitting = false;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Deliverables / Proof of Work', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Divider(),
            if (widget.existingDeliverables.isNotEmpty) ...[
              ...widget.existingDeliverables.map<Widget>((d) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.check_circle, color: Colors.green, size: 20),
                title: Text(d['notes'] ?? '', style: const TextStyle(fontSize: 13)),
              )),
              const Divider(),
            ],
            TextField(
              controller: _notesCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Work Summary / Notes',
                border: OutlineInputBorder(),
                helperText: 'Describe the work completed',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _urlCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Photo/Document URL',
                      border: OutlineInputBorder(),
                      hintText: 'https://...',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: () {
                    if (_urlCtrl.text.isNotEmpty) {
                      setState(() {
                        _urls.add(_urlCtrl.text);
                        _urlCtrl.clear();
                      });
                    }
                  },
                  icon: const Icon(Icons.add_circle, color: Colors.blue),
                ),
              ],
            ),
            if (_urls.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: _urls.asMap().entries.map((entry) => Chip(
                  label: Text('Attachment ${entry.key + 1}', style: const TextStyle(fontSize: 11)),
                  deleteIcon: const Icon(Icons.close, size: 16),
                  onDeleted: () => setState(() => _urls.removeAt(entry.key)),
                )).toList(),
              ),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isSubmitting
                    ? null
                    : () async {
                        if (_notesCtrl.text.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Please add work summary notes'), backgroundColor: Colors.red),
                          );
                          return;
                        }
                        setState(() => _isSubmitting = true);
                        try {
                          await widget.onSubmit(_notesCtrl.text, _urls);
                          _notesCtrl.clear();
                          _urls.clear();
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Deliverables submitted'), backgroundColor: Colors.green),
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
                      },
                icon: const Icon(Icons.upload),
                label: _isSubmitting ? const Text('Submitting...') : const Text('Submit Deliverables'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    _urlCtrl.dispose();
    super.dispose();
  }
}
