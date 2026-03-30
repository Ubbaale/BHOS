import 'package:flutter/material.dart';

class RatingDialog extends StatefulWidget {
  final String title;
  final Future<void> Function(int rating, String? review) onSubmit;

  const RatingDialog({
    super.key,
    required this.title,
    required this.onSubmit,
  });

  @override
  State<RatingDialog> createState() => _RatingDialogState();
}

class _RatingDialogState extends State<RatingDialog> {
  int _rating = 0;
  final _reviewCtrl = TextEditingController();
  bool _isSubmitting = false;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (i) => IconButton(
              icon: Icon(
                i < _rating ? Icons.star : Icons.star_border,
                color: Colors.amber,
                size: 36,
              ),
              onPressed: () => setState(() => _rating = i + 1),
            )),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reviewCtrl,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Review (optional)',
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _isSubmitting || _rating == 0
              ? null
              : () async {
                  setState(() => _isSubmitting = true);
                  try {
                    await widget.onSubmit(
                      _rating,
                      _reviewCtrl.text.isNotEmpty ? _reviewCtrl.text : null,
                    );
                    if (context.mounted) {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Rating submitted'), backgroundColor: Colors.green),
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
                      );
                    }
                  } finally {
                    setState(() => _isSubmitting = false);
                  }
                },
          child: _isSubmitting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Submit'),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _reviewCtrl.dispose();
    super.dispose();
  }
}
