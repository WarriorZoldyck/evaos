import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingTestimonials } from "@/components/landing/LandingTestimonials";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFAQ } from "@/components/landing/LandingFAQ";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";

export default function LandingPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[hsl(220,30%,4%)] text-[hsl(210,30%,92%)] overflow-x-hidden relative">
      {/* Global animated glow orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            top: "10%",
            left: "-10%",
            background: "radial-gradient(circle, hsl(195 100% 50% / 0.08), transparent 70%)",
            animation: "float-orb-1 20s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-20"
          style={{
            top: "50%",
            right: "-8%",
            background: "radial-gradient(circle, hsl(200 100% 45% / 0.1), transparent 70%)",
            animation: "float-orb-2 25s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-15"
          style={{
            bottom: "20%",
            left: "30%",
            background: "radial-gradient(circle, hsl(195 100% 55% / 0.06), transparent 70%)",
            animation: "float-orb-3 18s ease-in-out infinite",
          }}
        />
        {/* Horizontal light lines */}
        <div className="absolute top-1/4 left-0 right-0 h-px opacity-10" style={{ background: "linear-gradient(to right, transparent, hsl(195 100% 50%), transparent)" }} />
        <div className="absolute top-2/3 left-0 right-0 h-px opacity-8" style={{ background: "linear-gradient(to right, transparent, hsl(195 100% 50% / 0.6), transparent)" }} />
      </div>

      <style>{`
        @keyframes float-orb-1 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(40px, -30px); }
          66% { transform: translate(-20px, 20px); }
        }
        @keyframes float-orb-2 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-30px, 40px); }
          66% { transform: translate(20px, -20px); }
        }
        @keyframes float-orb-3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -40px); }
        }
      `}</style>

      <div className="relative z-10">
        <LandingNav />
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingTestimonials />
        <LandingPricing />
        <LandingFAQ />
        <LandingFooter />
      </div>
    </div>
  );
}
