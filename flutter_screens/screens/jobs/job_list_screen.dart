import 'package:flutter/material.dart';
import '../../models/job_models.dart';
import '../../services/api_client.dart';
import '../../services/job_service.dart';

class JobListScreen extends StatefulWidget {
  final String baseUrl;
  final ApiClient? client;

  const JobListScreen({super.key, required this.baseUrl, this.client});

  @override
  State<JobListScreen> createState() => _JobListScreenState();
}

class _JobListScreenState extends State<JobListScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Job> _jobs = [];
  List<ExternalJob> _externalJobs = [];
  bool _isLoading = true;
  String? _error;
  JobService? _jobService;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    if (widget.client != null) {
      _jobService = JobService(client: widget.client!);
      _loadJobs();
    } else {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _loadJobs() async {
    if (_jobService == null) return;
    setState(() { _isLoading = true; _error = null; });
    try {
      final results = await Future.wait([
        _jobService!.getJobs(),
        _jobService!.getExternalJobs(),
      ]);
      setState(() {
        _jobs = results[0] as List<Job>;
        _externalJobs = results[1] as List<ExternalJob>;
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
        title: const Text('Healthcare Jobs'),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(text: 'Jobs (${_jobs.length})'),
            Tab(text: 'External (${_externalJobs.length})'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: TextStyle(color: Colors.red[700])),
                      const SizedBox(height: 16),
                      ElevatedButton(onPressed: _loadJobs, child: const Text('Retry')),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildJobsList(),
                    _buildExternalJobsList(),
                  ],
                ),
    );
  }

  Widget _buildJobsList() {
    if (_jobs.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.work_off, size: 48, color: Colors.grey[400]),
            const SizedBox(height: 12),
            Text('No jobs available', style: TextStyle(color: Colors.grey[600])),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadJobs,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _jobs.length,
        itemBuilder: (context, index) => _jobCard(_jobs[index]),
      ),
    );
  }

  Widget _jobCard(Job job) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => _showJobDetail(job),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(job.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              if (job.company != null) ...[
                const SizedBox(height: 4),
                Text(job.company!, style: TextStyle(color: Colors.grey[600])),
              ],
              const SizedBox(height: 8),
              Row(
                children: [
                  if (job.location != null) ...[
                    Icon(Icons.location_on, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 4),
                    Text(job.location!, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                    const SizedBox(width: 12),
                  ],
                  if (job.salary != null) ...[
                    Icon(Icons.attach_money, size: 14, color: Colors.grey[500]),
                    Text(job.salary!, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                    const SizedBox(width: 12),
                  ],
                  if (job.jobType != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.blue.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(job.jobType!, style: const TextStyle(fontSize: 11, color: Colors.blue)),
                    ),
                ],
              ),
              if (job.specialty != null) ...[
                const SizedBox(height: 8),
                Chip(
                  label: Text(job.specialty!, style: const TextStyle(fontSize: 11)),
                  backgroundColor: const Color(0xFF6366F1).withOpacity(0.1),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildExternalJobsList() {
    if (_externalJobs.isEmpty) {
      return Center(child: Text('No external jobs found', style: TextStyle(color: Colors.grey[600])));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _externalJobs.length,
      itemBuilder: (context, index) {
        final job = _externalJobs[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            title: Text(job.title, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (job.company != null) Text(job.company!),
                if (job.location != null) Text(job.location!, style: TextStyle(color: Colors.grey[500], fontSize: 12)),
              ],
            ),
            trailing: job.source != null
                ? Chip(label: Text(job.source!, style: const TextStyle(fontSize: 10)), visualDensity: VisualDensity.compact)
                : null,
            isThreeLine: job.company != null && job.location != null,
          ),
        );
      },
    );
  }

  void _showJobDetail(Job job) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.9,
        builder: (ctx, scrollController) => SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 20),
              Text(job.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              if (job.company != null) ...[
                const SizedBox(height: 4),
                Text(job.company!, style: TextStyle(fontSize: 16, color: Colors.grey[600])),
              ],
              const SizedBox(height: 16),
              if (job.location != null) _infoRow(Icons.location_on, job.location!),
              if (job.salary != null) _infoRow(Icons.attach_money, job.salary!),
              if (job.jobType != null) _infoRow(Icons.work, job.jobType!),
              if (job.specialty != null) _infoRow(Icons.medical_services, job.specialty!),
              const SizedBox(height: 16),
              if (job.description != null) ...[
                const Text('Description', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 8),
                Text(job.description!),
              ],
              if (job.requirements != null) ...[
                const SizedBox(height: 16),
                const Text('Requirements', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 8),
                Text(job.requirements!),
              ],
              if (job.benefits != null) ...[
                const SizedBox(height: 16),
                const Text('Benefits', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 8),
                Text(job.benefits!),
              ],
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1), foregroundColor: Colors.white),
                  child: const Text('Apply Now'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey[600]),
          const SizedBox(width: 8),
          Text(text, style: const TextStyle(fontSize: 14)),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
}
