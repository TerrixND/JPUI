import React, { useState } from "react";
import {FaRegEye, FaRegEyeSlash} from "react-icons/fa6"

type InputProps = {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  label: string;
  type: string;
};

const InputBox = ({ value, onChange, placeholder, label, type }: InputProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div>
      <label className="text-[13px] text-slate-800 ">{label}</label>
      <div className="w-full flex justify-between gap-3 text-sm text-black bg-slate-100 rounded px-4 py-3 mb-4 mt-3 border border-slate-200 outline-none">
        <input
          type={
            type == "password" ? (showPassword ? "text" : "password") : type
          }
          placeholder={placeholder}
          className="w-full bg-transparent outline-none"
          value = {value}
          onChange={onChange}
        />

        {type === "password" && (
            <>
                {showPassword ?(
                    <FaRegEye
                        size={22}
                        className="text-black-800 cursor-pointer"
                        onClick={()=>toggleShowPassword()}
                    />
                ):(
                    <FaRegEyeSlash
                        size={22}
                        className="text-slate-400 cursor-pointer"
                        onClick={()=>toggleShowPassword()}
                    />
                )}
            </>
        )}
      </div>
    </div>
  );
};

export default InputBox;
