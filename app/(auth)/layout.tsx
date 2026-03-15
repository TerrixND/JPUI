import Image from "next/image";
import React, { ReactNode } from "react";

const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex bg-white min-h-screen">
      {/* Left Side */}
      <div className="w-full md:w-[60vw] px-12 pt-8 pb-12 jp-h-vh-screen">
        <Image
          src="/Jade-Palace-LOGO/noBgLogo.svg"
          alt="Jade Palace Logo"
          width={50}
          height={50}
          style={{ height: "auto" }}
          priority
        />

        {children}
      </div>

      {/* Right Side Image */}
      <div className="hidden md:block w-[40vw] relative jp-h-vh-screen">
        <Image
          src="/images/greenImg.jpg"
          alt="Jade background"
          fill
          sizes="40vw"
          className="object-cover"
          priority
        />
      </div>
    </div>
  );
};

export default AuthLayout;
