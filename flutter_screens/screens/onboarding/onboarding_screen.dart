import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

class OnboardingScreen extends StatefulWidget {
  final VoidCallback onComplete;

  const OnboardingScreen({super.key, required this.onComplete});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _controller = PageController();
  int _currentPage = 0;

  final List<_OnboardingPage> _pages = [
    _OnboardingPage(
      icon: Icons.local_hospital,
      iconColor: const Color(0xFF6366F1),
      title: 'Healthcare at Your Fingertips',
      description: 'Book medical transportation, find healthcare jobs, and access IT services — all in one app.',
      gradient: [Color(0xFF6366F1), Color(0xFF818CF8)],
    ),
    _OnboardingPage(
      icon: Icons.local_taxi,
      iconColor: const Color(0xFF10B981),
      title: 'Safe Medical Rides',
      description: 'Non-emergency medical transportation with real-time tracking, in-app chat, and wheelchair-accessible vehicles.',
      gradient: [Color(0xFF10B981), Color(0xFF34D399)],
    ),
    _OnboardingPage(
      icon: Icons.notifications_active,
      iconColor: const Color(0xFFF59E0B),
      title: 'Real-Time Updates',
      description: 'Get instant notifications for ride status, job opportunities, and important alerts. Never miss a moment.',
      gradient: [Color(0xFFF59E0B), Color(0xFFFBBF24)],
    ),
    _OnboardingPage(
      icon: Icons.security,
      iconColor: const Color(0xFFEF4444),
      title: 'Safety First',
      description: 'Trip sharing with loved ones, SOS emergency button, driver verification, and HIPAA-compliant data protection.',
      gradient: [Color(0xFFEF4444), Color(0xFFF87171)],
    ),
    _OnboardingPage(
      icon: Icons.face,
      iconColor: const Color(0xFF8B5CF6),
      title: 'Quick & Secure Login',
      description: 'Sign in instantly with Face ID or Touch ID. Your data stays protected with biometric authentication.',
      gradient: [Color(0xFF8B5CF6), Color(0xFFA78BFA)],
    ),
  ];

  void _next() {
    HapticFeedback.selectionClick();
    if (_currentPage < _pages.length - 1) {
      _controller.nextPage(duration: const Duration(milliseconds: 400), curve: Curves.easeInOut);
    } else {
      _complete();
    }
  }

  void _skip() {
    HapticFeedback.lightImpact();
    _complete();
  }

  Future<void> _complete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_complete', true);
    widget.onComplete();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Image.asset('assets/logo.png', height: 32, errorBuilder: (_, __, ___) =>
                    const Text('CareHub', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF6366F1)))),
                  if (_currentPage < _pages.length - 1)
                    TextButton(
                      onPressed: _skip,
                      child: const Text('Skip', style: TextStyle(color: Colors.grey)),
                    ),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _pages.length,
                onPageChanged: (i) {
                  HapticFeedback.selectionClick();
                  setState(() => _currentPage = i);
                },
                itemBuilder: (context, index) {
                  final page = _pages[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 140,
                          height: 140,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: page.gradient,
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: page.gradient.first.withOpacity(0.3),
                                blurRadius: 30,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: Icon(page.icon, size: 64, color: Colors.white),
                        ),
                        const SizedBox(height: 48),
                        Text(
                          page.title,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, height: 1.2),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          page.description,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 16, color: Colors.grey[600], height: 1.5),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_pages.length, (i) {
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: i == _currentPage ? 24 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: i == _currentPage ? const Color(0xFF6366F1) : Colors.grey[300],
                          borderRadius: BorderRadius.circular(4),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: ElevatedButton(
                      onPressed: _next,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6366F1),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      child: Text(
                        _currentPage == _pages.length - 1 ? 'Get Started' : 'Continue',
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardingPage {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String description;
  final List<Color> gradient;

  _OnboardingPage({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.description,
    required this.gradient,
  });
}
