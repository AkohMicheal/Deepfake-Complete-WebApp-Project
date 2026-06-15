"use client";

import React from "react";

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full bg-slate-950 border-t border-slate-900 py-6 px-4 mt-auto z-10">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
                <div>
                    <p>© {currentYear} Dual-Stream Detector. All rights reserved.</p>
                </div>
                <div className="flex items-center space-x-6">
                    <a href="/legal#privacy" className="hover:text-slate-300 transition duration-150">Privacy Policy</a>
                    <a href="/legal#terms" className="hover:text-slate-300 transition duration-150">Terms of Service</a>
                    <a href="/legal#ethics" className="hover:text-slate-300 transition duration-150">Ethical Framework</a>
                </div>
            </div>
        </footer>
    );
}