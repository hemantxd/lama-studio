import { Button } from "@/components/ui/button";
import Image from "next/image";
import {HomeHeroSection} from "@/components/HomeHeroSection";
import {GalleryShowcaseSection} from "@/components/GalleryShowcaseSection";
import {HowItWorksSection} from "@/components/HowItWorksSection";
import {Testimonials} from "@/components/Testimonials";

export default function Home() {
  return (
    <div className = "min-h-screen bg-background p-3 sm:p-4 lg:p-5 xl:p-7">

    <HomeHeroSection/>


 <GalleryShowcaseSection/>
 <HowItWorksSection/>

 <Testimonials/>


    </div>
  );
}
