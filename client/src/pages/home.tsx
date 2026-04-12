import Header from "@/components/Header";
import Hero from "@/components/Hero";
import QuickActions from "@/components/QuickActions";
import Services from "@/components/Services";
import HealthcareProducts from "@/components/HealthcareProducts";
import Stats from "@/components/Stats";
import JobMap from "@/components/JobMap";
import IssueReport from "@/components/IssueReport";
import Testimonials from "@/components/Testimonials";
import DemoVideo from "@/components/DemoVideo";
import Footer from "@/components/Footer";
import { usePlatform } from "@/hooks/use-platform";

export default function Home() {
  const { showMobileUI } = usePlatform();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className={showMobileUI ? "native-scroll" : ""}>
        <Hero />
        <QuickActions />
        <Services />
        <HealthcareProducts />
        <Stats />
        <JobMap />
        <IssueReport />
        <Testimonials />
        <DemoVideo />
      </main>
      {!showMobileUI && <Footer />}
    </div>
  );
}
