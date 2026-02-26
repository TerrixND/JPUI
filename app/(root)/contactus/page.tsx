"use client";

import React, { useState } from "react";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert("Message sent successfully.");
      setForm({ name: "", email: "", message: "" });
    } catch {
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className=" relative min-h-screen bg-white overflow-hidden">
      <div className="">
        {/* Decorative Lines */}
      <div className="absolute top-0 left-0 w-full h-px bg-neutral-200" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-neutral-200" />

      <div className="max-w-6xl mx-auto px-6 sm:px-12 lg:px-20 py-32 grid md:grid-cols-2 gap-24 items-center">
        
        {/* Left Section */}
        <div className="space-y-8">
          <div>
            <p className="text-xs tracking-[0.4em] uppercase text-neutral-400 mb-6">
              Contact
            </p>
            <h1 className="text-5xl md:text-6xl font-light leading-tight text-neutral-900">
              Let’s Build
              <br />
              Something Timeless.
            </h1>
          </div>

          <p className="text-neutral-500 text-lg leading-relaxed max-w-md">
            We value refined conversations and meaningful collaborations.
            Share your thoughts with us — our team will respond with precision.
          </p>

          <div className="pt-10 space-y-4 text-neutral-600 text-sm">
            <p>info@jadepalacept.com</p>
            <p>Private Inquiries</p>
          </div>
        </div>

        {/* Right Form */}
        <form onSubmit={handleSubmit} className="space-y-14">
          
          {/* Name */}
          <div>
            <label className="block text-sm text-neutral-400 mb-3 tracking-wide">
              Name
            </label>
            <input
              type="text"
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              className="w-full bg-transparent border-b border-neutral-300 pb-4 text-xl text-neutral-900 outline-none transition-all duration-300 focus:border-neutral-900"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-neutral-400 mb-3 tracking-wide">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              value={form.email}
              onChange={handleChange}
              className="w-full bg-transparent border-b border-neutral-300 pb-4 text-xl text-neutral-900 outline-none transition-all duration-300 focus:border-neutral-900"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm text-neutral-400 mb-3 tracking-wide">
              Message
            </label>
            <textarea
              name="message"
              rows={4}
              required
              value={form.message}
              onChange={handleChange}
              className="w-full bg-transparent border-b border-neutral-300 pb-4 text-xl text-neutral-900 outline-none resize-none transition-all duration-300 focus:border-neutral-900"
            />
          </div>

          {/* Button */}
          <div className="pt-8">
            <button
              type="submit"
              disabled={loading}
              className="
                cursor-pointer
                inline-flex items-center justify-center
                px-8 py-3
                text-sm tracking-widest uppercase
                border border-neutral-900
                bg-neutral-900 text-white
                transition-all duration-300
                hover:bg-white hover:text-neutral-900
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {loading ? "Sending..." : "Send Message"}
            </button>
          </div>
        </form>
      </div>
      </div>
    </section>
  );
}