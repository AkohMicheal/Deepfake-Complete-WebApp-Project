"use client";

import React from "react";

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-900 py-6 px-4 mt-auto z-10 transition-colors duration-200">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-500">
                <div>
                    <p className="text-slate-600 dark:text-slate-500">© {currentYear} Dual-Stream Detector. All rights reserved.</p>
                </div>
                <div className="flex items-center space-x-6">
                    <a href="/legal#privacy" className="text-slate-600 dark:text-slate-500 hover:text-blue-600 dark:hover:text-slate-300 transition duration-150">Privacy Policy</a>
                    <a href="/legal#terms" className="text-slate-600 dark:text-slate-500 hover:text-blue-600 dark:hover:text-slate-300 transition duration-150">Terms of Service</a>
                    <a href="/legal#ethics" className="text-slate-600 dark:text-slate-500 hover:text-blue-600 dark:hover:text-slate-300 transition duration-150">Ethical Framework</a>
                </div>
            </div>
        </footer>
    );
}