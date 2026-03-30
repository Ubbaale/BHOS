import 'package:flutter/material.dart';
import '../models/it_models.dart';

class TicketCard extends StatelessWidget {
  final ItServiceTicket ticket;
  final VoidCallback? onTap;
  final String? actionLabel;
  final Color? actionColor;
  final VoidCallback? onAction;

  const TicketCard({
    super.key,
    required this.ticket,
    this.onTap,
    this.actionLabel,
    this.actionColor,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _categoryIcon(ticket.category),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(ticket.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                        Text('#${ticket.ticketNumber}', style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                      ],
                    ),
                  ),
                  _statusChip(ticket.status),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                ticket.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Colors.grey[600], fontSize: 13),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  if (ticket.siteCity != null) ...[
                    Icon(Icons.location_on, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 4),
                    Text('${ticket.siteCity}, ${ticket.siteState ?? ''}',
                        style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                    const SizedBox(width: 12),
                  ],
                  if (ticket.scheduledDate != null) ...[
                    Icon(Icons.calendar_today, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 4),
                    Text('${ticket.scheduledDate!.month}/${ticket.scheduledDate!.day}',
                        style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                    const SizedBox(width: 12),
                  ],
                  if (ticket.payRate != null) ...[
                    Icon(Icons.attach_money, size: 14, color: Colors.grey[500]),
                    Text('${ticket.payRate}/${ticket.payType == 'hourly' ? 'hr' : 'fixed'}',
                        style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                  ],
                  const Spacer(),
                  _priorityChip(ticket.priority),
                ],
              ),
              if (ticket.etaStatus != 'none' && ticket.status == 'in_progress') ...[
                const SizedBox(height: 8),
                _etaBanner(ticket.etaStatus),
              ],
              if (actionLabel != null) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: onAction,
                    style: ElevatedButton.styleFrom(backgroundColor: actionColor ?? Colors.blue),
                    child: Text(actionLabel!),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _categoryIcon(String category) {
    IconData icon;
    switch (category) {
      case 'network': icon = Icons.wifi; break;
      case 'hardware': icon = Icons.computer; break;
      case 'software': icon = Icons.code; break;
      case 'printer': icon = Icons.print; break;
      case 'ehr_system': icon = Icons.local_hospital; break;
      case 'security': icon = Icons.security; break;
      case 'phone_system': icon = Icons.phone; break;
      case 'email': icon = Icons.email; break;
      case 'backup': icon = Icons.backup; break;
      default: icon = Icons.build;
    }
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.blue.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(icon, size: 20, color: Colors.blue),
    );
  }

  Widget _statusChip(String status) {
    Color color;
    switch (status) {
      case 'open': color = Colors.blue; break;
      case 'assigned': color = Colors.purple; break;
      case 'in_progress': color = Colors.orange; break;
      case 'resolved': case 'completed': color = Colors.green; break;
      case 'cancelled': color = Colors.red; break;
      default: color = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
      child: Text(status.replaceAll('_', ' ').toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color)),
    );
  }

  Widget _priorityChip(String priority) {
    Color color;
    switch (priority) {
      case 'urgent': color = Colors.red; break;
      case 'high': color = Colors.orange; break;
      case 'medium': color = Colors.blue; break;
      default: color = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
      child: Text(priority.toUpperCase(), style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: color)),
    );
  }

  Widget _etaBanner(String etaStatus) {
    Color color;
    String label;
    IconData icon;
    switch (etaStatus) {
      case 'en_route': color = Colors.blue; label = 'Tech En Route'; icon = Icons.directions_car; break;
      case 'arriving': color = Colors.orange; label = 'Tech Arriving'; icon = Icons.near_me; break;
      case 'on_site': color = Colors.green; label = 'Tech On Site'; icon = Icons.location_on; break;
      default: return const SizedBox.shrink();
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}
