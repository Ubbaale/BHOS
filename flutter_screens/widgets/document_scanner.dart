import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

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

  Future<bool> _checkCameraPermission(BuildContext context) async {
    var status = await Permission.camera.status;
    if (status.isGranted) return true;

    if (status.isDenied) {
      status = await Permission.camera.request();
      if (status.isGranted) return true;
    }

    if (status.isPermanentlyDenied && context.mounted) {
      await showCupertinoDialog(
        context: context,
        builder: (ctx) => CupertinoAlertDialog(
          title: const Text('Camera Access Required'),
          content: const Text('Please enable camera access in your device Settings to take photos of documents.'),
          actions: [
            CupertinoDialogAction(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            CupertinoDialogAction(
              isDefaultAction: true,
              onPressed: () {
                Navigator.pop(ctx);
                openAppSettings();
              },
              child: const Text('Open Settings'),
            ),
          ],
        ),
      );
    }
    return false;
  }

  Future<bool> _checkPhotoLibraryPermission(BuildContext context) async {
    var status = await Permission.photos.status;
    if (status.isGranted || status.isLimited) return true;

    if (status.isDenied) {
      status = await Permission.photos.request();
      if (status.isGranted || status.isLimited) return true;
    }

    if (status.isPermanentlyDenied && context.mounted) {
      await showCupertinoDialog(
        context: context,
        builder: (ctx) => CupertinoAlertDialog(
          title: const Text('Photo Library Access Required'),
          content: const Text('Please enable photo library access in your device Settings to select documents.'),
          actions: [
            CupertinoDialogAction(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            CupertinoDialogAction(
              isDefaultAction: true,
              onPressed: () {
                Navigator.pop(ctx);
                openAppSettings();
              },
              child: const Text('Open Settings'),
            ),
          ],
        ),
      );
    }
    return false;
  }

  Future<void> _takePhoto(BuildContext context) async {
    final hasPermission = await _checkCameraPermission(context);
    if (!hasPermission) return;

    try {
      HapticFeedback.mediumImpact();
      final picker = ImagePicker();
      final photo = await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
        maxWidth: 2048,
        preferredCameraDevice: CameraDevice.rear,
      );
      if (photo != null) {
        HapticFeedback.heavyImpact();
        onDocumentCaptured(File(photo.path));
      }
    } on PlatformException catch (e) {
      if (context.mounted) {
        _showErrorDialog(context, 'Camera Error', 'Unable to access the camera. Please check your device settings and try again.\n\nError: ${e.message}');
      }
    } catch (e) {
      if (context.mounted) {
        _showErrorDialog(context, 'Error', 'Something went wrong while taking the photo. Please try again.');
      }
    }
  }

  Future<void> _pickFromGallery(BuildContext context) async {
    final hasPermission = await _checkPhotoLibraryPermission(context);
    if (!hasPermission) return;

    try {
      HapticFeedback.mediumImpact();
      final picker = ImagePicker();
      final photo = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
        maxWidth: 2048,
      );
      if (photo != null) {
        HapticFeedback.heavyImpact();
        onDocumentCaptured(File(photo.path));
      }
    } on PlatformException catch (e) {
      if (context.mounted) {
        _showErrorDialog(context, 'Gallery Error', 'Unable to access the photo library. Please check your device settings.\n\nError: ${e.message}');
      }
    } catch (e) {
      if (context.mounted) {
        _showErrorDialog(context, 'Error', 'Something went wrong while selecting the photo. Please try again.');
      }
    }
  }

  void _showErrorDialog(BuildContext context, String title, String message) {
    HapticFeedback.heavyImpact();
    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Navigator.pop(ctx),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Future<void> _showPicker(BuildContext context) async {
    HapticFeedback.lightImpact();

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
                onTap: () {
                  Navigator.pop(ctx);
                  _takePhoto(context);
                },
              ),
              const SizedBox(height: 12),
              _optionTile(
                context: ctx,
                icon: Icons.photo_library,
                color: Colors.green,
                label: 'Choose from Gallery',
                subtitle: 'Select an existing photo',
                onTap: () {
                  Navigator.pop(ctx);
                  _pickFromGallery(context);
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
            Text('Camera or gallery', style: TextStyle(color: Colors.grey[400], fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
