import 'package:flutter/material.dart';
import '../models/it_models.dart';

class AccountStatusBanner extends StatelessWidget {
  final TechAccountStatus status;

  const AccountStatusBanner({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color textColor;
    IconData icon;
    String title;
    String message;

    switch (status.accountStatus) {
      case 'on_hold':
        bgColor = Colors.orange[50]!;
        textColor = Colors.orange[900]!;
        icon = Icons.pause_circle;
        title = 'Account On Hold';
        message = 'Your account has been placed on hold due to ${status.complaintCount} complaint(s). You cannot accept new tickets until an admin reviews your account.';
        break;
      case 'suspended':
        bgColor = Colors.red[50]!;
        textColor = Colors.red[900]!;
        icon = Icons.block;
        title = 'Account Suspended';
        message = status.suspensionReason ?? 'Your account has been suspended.';
        if (status.suspendedUntil != null) {
          message += ' Suspension ends: ${status.suspendedUntil!.month}/${status.suspendedUntil!.day}/${status.suspendedUntil!.year}';
        }
        break;
      case 'banned':
        bgColor = Colors.red[100]!;
        textColor = Colors.red[900]!;
        icon = Icons.gpp_bad;
        title = 'Account Banned';
        message = status.banReason ?? 'Your account has been permanently banned.';
        break;
      default:
        return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: textColor.withOpacity(0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: textColor, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: textColor)),
                const SizedBox(height: 4),
                Text(message, style: TextStyle(color: textColor, fontSize: 13)),
                if (status.complaintCount > 0) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Complaints: ${status.complaintCount} total, ${status.verifiedComplaintCount} verified',
                    style: TextStyle(color: textColor.withOpacity(0.7), fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
