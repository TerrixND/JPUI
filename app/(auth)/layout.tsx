import React, { ReactNode } from "react";

const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex bg-white">
      <div className="w-full h-screen md:w-[60vw] px-12 pt-8 pb-12">
        <h2 className="text-xl font-semibold text-black">Jade Palace</h2>
        {children}
      </div>
      <img
        src={"/images/greenImg.jpg"}
        className="hidden md:block w-[40vw] h-screen object-cover"
      />
    </div>
  );
};

export default AuthLayout;