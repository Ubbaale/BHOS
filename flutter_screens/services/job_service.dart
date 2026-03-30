import '../models/job_models.dart';
import 'api_client.dart';

class JobService {
  final ApiClient client;

  JobService({required this.client});

  Future<List<Job>> getJobs() async {
    final data = await client.getRaw('/api/mobile/jobs');
    final inner = (data is Map && data.containsKey('data')) ? data['data'] : data;
    return (inner as List).map((j) => Job.fromJson(j)).toList();
  }

  Future<List<ExternalJob>> getExternalJobs({String? query, String? location}) async {
    String path = '/api/external-jobs?';
    if (query != null) path += 'q=$query&';
    if (location != null) path += 'location=$location&';
    final data = await client.getRaw(path);
    final inner = (data is Map && data.containsKey('data')) ? data['data'] : data;
    return (inner as List).map((j) => ExternalJob.fromJson(j)).toList();
  }
}
