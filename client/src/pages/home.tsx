import Header from "@/components/Header";
import Hero from "@/components/Hero";
import QuickActions from "@/components/QuickActions";
import Services from "@/components/Services";
import Stats from "@/components/Stats";
import JobMap from "@/components/JobMap";
import IssueReport from "@/components/IssueReport";
import Testimonials from "@/components/Testimonials";
import DemoVideo from "@/components/DemoVideo";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <QuickActions />
        <Services />
        <Stats />
        <JobMap />
        <IssueReport />
        <Testimonials />
        <DemoVideo />
      </main>
      <Footer />
    </div>
  );
}
