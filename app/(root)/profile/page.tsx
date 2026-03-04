"use client";

import { useState } from "react";
import Image from "next/image";
import { Edit, X, Save, LogOut } from "lucide-react";
import Link from "next/link";

type Profile = {
  name: string;
  tier: string;
  email: string;
  phone: string;
  location: string;
  lineId: string;
  language: string; // ✅ single language
};

export default function ProfilePage() {
  const initialData: Profile = {
    name: "Uzumaki Naruto",
    tier: "Regular Client",
    email: "hello@gmail.com",
    phone: "+66 987654321",
    location: "Myanmar, Mandalay",
    lineId: "CS2025-0912",
    language: "English",
  };

  const [profile, setProfile] = useState<Profile>(initialData);
  const [originalProfile, setOriginalProfile] = useState<Profile>(initialData);
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (key: keyof Profile, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleEdit = () => {
    setOriginalProfile(profile);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setProfile(originalProfile);
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      console.log("Saving profile:", profile);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 sm:px-12 lg:px-20 py-20">
      {/* ================= HEADER ================= */}
      <div className="mt-6 flex flex-col md:flex-row md:justify-between md:items-center gap-6">
        {/* LEFT SIDE */}
        <div className="flex gap-6 items-center">
          <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white shadow-xl overflow-hidden">
            <Image
              src="/images/naruto.jpg"
              alt="Profile"
              fill
              className="object-cover"
            />
          </div>

          <div className="flex flex-col gap-1">
            <h4 className="text-lg font-semibold tracking-wide">
              {profile.name}
            </h4>
            <p className="text-sm text-gray-500">{profile.tier}</p>
          </div>
        </div>

        {/* RIGHT SIDE BUTTONS */}
        <div className="w-full md:w-auto">
          {!isEditing ? (
            <button
              onClick={handleEdit}
              className="w-full md:w-auto bg-blue-500 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm tracking-widest text-white hover:bg-blue-600 transition cursor-pointer"
            >
              <Edit size={16} />
              Edit
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button
                onClick={handleCancel}
                className="w-full sm:w-auto bg-gray-200 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm tracking-widest hover:bg-gray-300 transition cursor-pointer"
              >
                <X size={16} />
                Cancel
              </button>

              <button
                onClick={handleSave}
                className="w-full sm:w-auto bg-emerald-600 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm tracking-widest text-white hover:bg-emerald-700 transition cursor-pointer"
              >
                <Save size={16} />
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= GRID ================= */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        {(
          [
            ["name", "Full Name"],
            ["email", "Email Address"],
            ["phone", "Phone Number"],
            ["location", "Location"],
            ["lineId", "LINE ID"],
          ] as [keyof Profile, string][]
        ).map(([key, label]) => (
          <div key={key} className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-600">{label}</label>
            <input
              type="text"
              value={profile[key]}
              readOnly={!isEditing}
              onChange={(e) => handleChange(key, e.target.value)}
              className={`border rounded-lg px-4 py-3 text-sm outline-none transition ${
                isEditing
                  ? "border-gray-300 focus:border-blue-500 bg-white"
                  : "border-gray-200 bg-gray-100 cursor-not-allowed"
              }`}
            />
          </div>
        ))}

        {/* ===== LANGUAGE SELECT ===== */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-600">Language</label>

          <select
            disabled={!isEditing}
            value={profile.language}
            onChange={(e) => handleChange("language", e.target.value)}
            className={`border rounded-lg px-4 py-3 text-sm outline-none transition ${
              isEditing
                ? "border-gray-300 focus:border-blue-500 bg-white"
                : "border-gray-200 bg-gray-100 cursor-not-allowed"
            }`}
          >
            <option value="English">English</option>
            <option value="Chinese">Chinese</option>
            <option value="Thai">Thai</option>
            <option value="Myanmar">Myanmar</option>
          </select>
        </div>
      </div>
      {/* ================= TIER INFORMATION ================= */}
      <div className="mt-16 bg-gray-50 border border-gray-200 rounded-2xl p-8">
        <h3 className="text-lg font-semibold mb-6">
          Membership Tiers & Benefits
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* REGULAR */}
          <div
            className={`p-6 rounded-xl border transition ${
              profile.tier === "Regular Client"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white"
            }`}
          >
            <h4 className="text-base font-semibold mb-2">Regular</h4>
            <p className="text-sm text-gray-500 mb-4">
              Default membership level.
            </p>
            <p className="text-sm">• No minimum spending required</p>
            <p className="text-sm">• Standard purchase access</p>
          </div>

          {/* VIP */}
          <div
            className={`p-6 rounded-xl border transition ${
              profile.tier === "VIP"
                ? "border-emerald-600 bg-emerald-50"
                : "border-gray-200 bg-white"
            }`}
          >
            <h4 className="text-base font-semibold mb-2">VIP</h4>
            <p className="text-sm text-gray-500 mb-4">
              Spend over <span className="font-medium">$5,000</span> total
            </p>
            <p className="text-sm">• Priority customer support</p>
            <p className="text-sm">• Early access to new collections</p>
            <p className="text-sm">• Exclusive promotions</p>
          </div>

          {/* VVIP */}
          <div
            className={`p-6 rounded-xl border transition ${
              profile.tier === "VVIP"
                ? "border-purple-600 bg-purple-50"
                : "border-gray-200 bg-white"
            }`}
          >
            <h4 className="text-base font-semibold mb-2">VVIP</h4>
            <p className="text-sm text-gray-500 mb-4">
              Spend over <span className="font-medium">$20,000</span> total
            </p>
            <p className="text-sm">• Dedicated account manager</p>
            <p className="text-sm">• Private invitation events</p>
            <p className="text-sm">• Maximum loyalty rewards</p>
          </div>
        </div>
      </div>
      <div className="mt-10">
        <div className="mb-6 bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-gray-600 leading-relaxed tracking-wide">
            Are you sure you want to log out at this time? You will need to sign
            back in to manage your account, view your profile, or access member
            benefits.
          </p>
        </div>
        <Link
          href={"/login"}
          className="w-full md:w-auto bg-red-400 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm tracking-widest text-white hover:bg-red-500 transition cursor-pointer"
        >
          <LogOut size={16} />
          Logout
        </Link>
      </div>
    </div>
  );
}
