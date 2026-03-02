"use client";

import { useState } from "react";
import Image from "next/image";
import { Mail, Phone, MapPin, Edit, X } from "lucide-react";

type Profile = {
  name: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  lineId: string;
  facebook: string;
  instagram: string;
};

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);

  const [profile, setProfile] = useState<Profile>({
    name: "Uzumaki Naruto",
    role: "Regular Client",
    email: "hello@gmail.com",
    phone: "+66 987654321",
    location: "Myanmar, Mandalay",
    lineId: "CS2025-0912",
    facebook: "Uzumaki Naruto",
    instagram: "@UzumakiNaruto",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSave = () => {
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-6 py-16">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">

        {/* Edit Button */}
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-md hover:shadow-lg transition"
        >
          {isEditing ? (
            <X className="w-5 h-5 text-red-500" />
          ) : (
            <Edit className="w-5 h-5 text-emerald-600" />
          )}
        </button>

        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600" />

        <div className="relative px-8 pb-8">

          {/* Profile Image */}
          <div className="flex justify-center -mt-16">
            <div className="relative w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden">
              <Image
                src="/images/naruto.jpg"
                alt="Profile"
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Name */}
          <div className="text-center mt-6">
            {!isEditing ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900">
                  {profile.name}
                </h2>
                <p className="text-sm text-emerald-600 font-medium mt-1">
                  {profile.role}
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-600">
                  Full Name
                </label>
                <input
                  name="name"
                  value={profile.name}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>

          <div className="my-6 border-t border-gray-200" />

          {/* VIEW MODE */}
          {!isEditing && (
            <>
              <Info icon={<Mail className="w-5 h-5 text-emerald-600" />} value={profile.email} />
              <Info icon={<Phone className="w-5 h-5 text-emerald-600" />} value={profile.phone} />
              <Info icon={<MapPin className="w-5 h-5 text-emerald-600" />} value={profile.location} />

              <div className="mt-8 space-y-3 text-sm">
                <FooterRow label="Line ID" value={profile.lineId} />
                <FooterRow label="Facebook" value={profile.facebook} />
                <FooterRow label="Instagram" value={profile.instagram} />
              </div>
            </>
          )}

          {/* EDIT MODE */}
          {isEditing && (
            <div className="space-y-4 mt-6">

              <FormField
                label="Email"
                name="email"
                value={profile.email}
                onChange={handleChange}
              />

              <FormField
                label="Phone Number"
                name="phone"
                value={profile.phone}
                onChange={handleChange}
              />

              <FormField
                label="Location"
                name="location"
                value={profile.location}
                onChange={handleChange}
              />

              <FormField
                label="Line ID"
                name="lineId"
                value={profile.lineId}
                onChange={handleChange}
              />

              <FormField
                label="Facebook"
                name="facebook"
                value={profile.facebook}
                onChange={handleChange}
              />

              <FormField
                label="Instagram"
                name="instagram"
                value={profile.instagram}
                onChange={handleChange}
              />

              <button
                onClick={handleSave}
                className="w-full mt-6 bg-emerald-600 text-white py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition"
              >
                Save Changes
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ---------- Components ---------- */

function Info({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm text-gray-700 mt-3">
      {icon}
      <span>{value}</span>
    </div>
  );
}

function FooterRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-xs text-gray-500 uppercase tracking-widest">
        {label}
      </span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-600">
        {label}
      </label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}