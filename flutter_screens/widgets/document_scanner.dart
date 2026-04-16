import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

class DocumentScanner extends StatelessWidget {
  final String title;
  final String description;
  final Function(File file) onDocumentCaptured;

  const DocumentScanner({
    super.key,
    required this.title,
    required this.description,
    required this.onDocumentCaptured,
  });

  Future<void> _showPicker(BuildContext context) async {
    HapticFeedback.lightImpact();
    final picker = ImagePicker();

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(description, style: TextStyle(color: Colors.grey[600], fontSize: 14), textAlign: TextAlign.center),
              const SizedBox(height: 24),
              _optionTile(
                context: ctx,
                icon: Icons.camera_alt,
                color: const Color(0xFF6366F1),
                label: 'Take Photo',
                subtitle: 'Use camera to scan document',
                onTap: () async {
                  Navigator.pop(ctx);
                  HapticFeedback.mediumImpact();
                  final photo = await picker.pickImage(
                    source: ImageSource.camera,
                    imageQuality: 85,
                    maxWidth: 2048,
                  );
                  if (photo != null) {
                    onDocumentCaptured(File(photo.path));
                  }
                },
              ),
              const SizedBox(height: 12),
              _optionTile(
                context: ctx,
                icon: Icons.photo_library,
                color: Colors.green,
                label: 'Choose from Gallery',
                subtitle: 'Select an existing photo',
                onTap: () async {
                  Navigator.pop(ctx);
                  HapticFeedback.mediumImpact();
                  final photo = await picker.pickImage(
                    source: ImageSource.gallery,
                    imageQuality: 85,
                    maxWidth: 2048,
                  );
                  if (photo != null) {
                    onDocumentCaptured(File(photo.path));
                  }
                },
              ),
              const SizedBox(height: 12),
              _optionTile(
                context: ctx,
                icon: Icons.picture_as_pdf,
                color: Colors.red,
                label: 'Upload PDF',
                subtitle: 'Select a PDF document',
                onTap: () {
                  Navigator.pop(ctx);
                  HapticFeedback.lightImpact();
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _optionTile({
    required BuildContext context,
    required IconData icon,
    required Color color,
    required String label,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.15)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                  Text(subtitle, style: TextStyle(color: Colors.grey[500], fontSize: 13)),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: Colors.grey[400]),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showPicker(context),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey[300]!, style: BorderStyle.solid),
          borderRadius: BorderRadius.circular(12),
          color: Colors.grey[50],
        ),
        child: Column(
          children: [
            Icon(Icons.document_scanner_outlined, size: 40, color: Colors.grey[400]),
            const SizedBox(height: 12),
            Text('Tap to scan or upload', style: TextStyle(color: Colors.grey[600], fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text('Camera, gallery, or PDF', style: TextStyle(color: Colors.grey[400], fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
