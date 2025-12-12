import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import Stats from "@/components/Stats";
import JobMap from "@/components/JobMap";
import IssueReport from "@/components/IssueReport";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Services />
        <Stats />
        <JobMap />
        <IssueReport />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
}
