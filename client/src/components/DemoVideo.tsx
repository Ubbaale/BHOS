import demoVideo from "@assets/generated_videos/medical_transport_booking_demo.mp4";

export default function DemoVideo() {
  return (
    <section id="demo" className="py-20 bg-muted/30">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            See How It Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Watch how our medical transportation service provides safe, reliable rides 
            from home to medical appointments.
          </p>
        </div>

        <div className="rounded-md overflow-hidden shadow-lg">
          <video
            src={demoVideo}
            autoPlay
            loop
            muted
            playsInline
            className="w-full aspect-video object-cover"
            data-testid="video-demo"
          >
            Your browser does not support the video tag.
          </video>
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-6 text-center">
          <div className="p-4">
            <div className="text-4xl font-bold text-primary mb-2">1</div>
            <h3 className="font-semibold mb-1">Book Online</h3>
            <p className="text-sm text-muted-foreground">
              Schedule your ride with pickup and dropoff locations
            </p>
          </div>
          <div className="p-4">
            <div className="text-4xl font-bold text-primary mb-2">2</div>
            <h3 className="font-semibold mb-1">Get Picked Up</h3>
            <p className="text-sm text-muted-foreground">
              A trained driver arrives at your door with accessible vehicles
            </p>
          </div>
          <div className="p-4">
            <div className="text-4xl font-bold text-primary mb-2">3</div>
            <h3 className="font-semibold mb-1">Arrive Safely</h3>
            <p className="text-sm text-muted-foreground">
              We ensure you reach your appointment on time and stress-free
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
