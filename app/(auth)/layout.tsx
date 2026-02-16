import React, { ReactNode } from "react";

const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex bg-white">
      <div className="w-screen h-screen md:w-[60vw] px-12 pt-8 pb-12">
        <h2 className="text-xl font-semibold text-black">Jade Palace</h2>
        {children}
      </div>
      <img
        src={"/greenImg.jpg"}
        className="hidden md:block w-[40vw] h-screen bg-contain bg-no-repeat bg-center overflow-hidden relative"
      />
    </div>
  );
};

export default AuthLayout;
