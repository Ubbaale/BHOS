import 'package:flutter/material.dart';
import '../../models/courier_models.dart';
import '../../services/courier_api_service.dart';
import 'courier_delivery_detail_screen.dart';

class CourierDashboardScreen extends StatefulWidget {
  final CourierApiService apiService;
  const CourierDashboardScreen({super.key, required this.apiService});

  @override
  State<CourierDashboardScreen> createState() => _CourierDashboardScreenState();
}

class _CourierDashboardScreenState extends State<CourierDashboardScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<CourierDelivery> _poolDeliveries = [];
  List<CourierDelivery> _activeDeliveries = [];
  List<CourierDelivery> _historyDeliveries = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final results = await Future.wait([
        widget.apiService.getDeliveryPool(),
        widget.apiService.getActiveDeliveries(),
        widget.apiService.getDriverHistory(),
      ]);
      setState(() {
        _poolDeliveries = results[0];
        _activeDeliveries = results[1];
        _historyDeliveries = results[2];
        _isLoading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Medical Courier'),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(text: 'Available (${_poolDeliveries.length})'),
            Tab(text: 'Active (${_activeDeliveries.length})'),
            Tab(text: 'History (${_historyDeliveries.length})'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, style: TextStyle(color: Colors.red[700])),
                    const SizedBox(height: 8),
                    ElevatedButton(onPressed: _loadData, child: const Text('Retry')),
                  ],
                ))
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildDeliveryList(_poolDeliveries, isPool: true),
                      _buildDeliveryList(_activeDeliveries),
                      _buildDeliveryList(_historyDeliveries),
                    ],
                  ),
                ),
    );
  }

  Widget _buildDeliveryList(List<CourierDelivery> deliveries, {bool isPool = false}) {
    if (deliveries.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.local_shipping_outlined, size: 48, color: Colors.grey[400]),
            const SizedBox(height: 8),
            Text(
              isPool ? 'No deliveries available' : 'No deliveries',
              style: TextStyle(color: Colors.grey[600], fontSize: 16),
            ),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: deliveries.length,
      itemBuilder: (context, index) => _buildDeliveryCard(deliveries[index], isPool: isPool),
    );
  }

  Widget _buildDeliveryCard(CourierDelivery delivery, {bool isPool = false}) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => CourierDeliveryDetailScreen(
              apiService: widget.apiService,
              deliveryId: delivery.id,
              onUpdated: _loadData,
            ),
          ),
        ),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _packageIcon(delivery.packageType),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      delivery.packageType.replaceAll('_', ' ').toUpperCase(),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                  _statusChip(delivery.status),
                ],
              ),
              if (delivery.priorityLevel != null) ...[
                const SizedBox(height: 6),
                Row(children: [
                  Icon(Icons.priority_high, size: 16, color: delivery.priorityLevel == 'stat' ? Colors.red : Colors.orange),
                  const SizedBox(width: 4),
                  Text('Priority: ${delivery.priorityLevel}',
                    style: TextStyle(color: delivery.priorityLevel == 'stat' ? Colors.red : Colors.orange[800], fontWeight: FontWeight.w500, fontSize: 13),
                  ),
                ]),
              ],
              const SizedBox(height: 8),
              Row(children: [
                const Icon(Icons.arrow_upward, size: 16, color: Colors.green),
                const SizedBox(width: 4),
                Expanded(child: Text(delivery.pickupAddress, style: const TextStyle(fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
              const SizedBox(height: 4),
              Row(children: [
                const Icon(Icons.arrow_downward, size: 16, color: Colors.red),
                const SizedBox(width: 4),
                Expanded(child: Text(delivery.dropoffAddress, style: const TextStyle(fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
              if (delivery.estimatedFare != null || delivery.distanceMiles != null) ...[
                const SizedBox(height: 8),
                Row(children: [
                  if (delivery.estimatedFare != null) ...[
                    const Icon(Icons.attach_money, size: 16, color: Colors.green),
                    Text('\$${delivery.estimatedFare}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Colors.green)),
                    const SizedBox(width: 12),
                  ],
                  if (delivery.distanceMiles != null) ...[
                    Icon(Icons.straighten, size: 16, color: Colors.grey[600]),
                    const SizedBox(width: 4),
                    Text('${delivery.distanceMiles?.toStringAsFixed(1)} mi', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                  ],
                ]),
              ],
              if (isPool) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _acceptDelivery(delivery),
                    icon: const Icon(Icons.check_circle_outline, size: 18),
                    label: const Text('Accept Delivery'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6366F1),
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _packageIcon(String type) {
    IconData icon;
    Color color;
    switch (type) {
      case 'specimen': icon = Icons.science; color = Colors.purple; break;
      case 'medication': icon = Icons.medication; color = Colors.blue; break;
      case 'blood': icon = Icons.bloodtype; color = Colors.red; break;
      case 'organ': icon = Icons.favorite; color = Colors.red; break;
      case 'equipment': icon = Icons.medical_services; color = Colors.teal; break;
      case 'documents': icon = Icons.description; color = Colors.orange; break;
      default: icon = Icons.local_shipping; color = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
      child: Icon(icon, size: 20, color: color),
    );
  }

  Widget _statusChip(String status) {
    Color color;
    switch (status) {
      case 'pending': color = Colors.blue; break;
      case 'accepted': case 'assigned': color = Colors.purple; break;
      case 'picked_up': case 'in_transit': color = Colors.orange; break;
      case 'delivered': color = Colors.green; break;
      case 'cancelled': color = Colors.red; break;
      default: color = Colors.grey;
    }
    return Chip(
      label: Text(status.replaceAll('_', ' ').toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 11)),
      backgroundColor: color,
      padding: EdgeInsets.zero,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    );
  }

  Future<void> _acceptDelivery(CourierDelivery delivery) async {
    try {
      await widget.apiService.acceptDelivery(delivery.id);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Delivery accepted!'), backgroundColor: Colors.green),
      );
      _loadData();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
}
