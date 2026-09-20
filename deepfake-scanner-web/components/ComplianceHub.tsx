"use client";

import React, { useState, useEffect } from 'react';
import { Shield, FileText, Scale, X } from 'lucide-react';

const getTabFromHash = (hash: string) => {
    if (hash === 'privacy' || hash === 'terms' || hash === 'ethics') {
        return hash;
    }
    return 'privacy';
};

export default function ComplianceHub() {
    const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'ethics'>('privacy');

    useEffect(() => {
        const updateFromHash = () => {
            const hash = window.location.hash.replace('#', '');
            setActiveTab(getTabFromHash(hash));
        };

        updateFromHash();
        window.addEventListener('hashchange', updateFromHash);
        return () => window.removeEventListener('hashchange', updateFromHash);
    }, []);

    return (
        <div className="max-w-4xl w-full mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl dark:shadow-2xl transition-colors duration-200">
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                <button
                    onClick={() => setActiveTab('privacy')}
                    className={`flex-1 py-4 flex items-center justify-center space-x-2 text-sm font-medium transition cursor-pointer ${activeTab === 'privacy' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-slate-900 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                >
                    <Shield size={18} /> <span>Privacy Policy</span>
                </button>
                <button
                    onClick={() => setActiveTab('terms')}
                    className={`flex-1 py-4 flex items-center justify-center space-x-2 text-sm font-medium transition cursor-pointer ${activeTab === 'terms' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-slate-900 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                >
                    <FileText size={18} /> <span>Terms of Service</span>
                </button>
                <button
                    onClick={() => setActiveTab('ethics')}
                    className={`flex-1 py-4 flex items-center justify-center space-x-2 text-sm font-medium transition cursor-pointer ${activeTab === 'ethics' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-slate-900 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                >
                    <Scale size={18} /> <span>Ethical Framework</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="p-8 text-slate-700 dark:text-slate-300 text-sm leading-relaxed h-100 overflow-y-auto custom-scrollbar">
                {activeTab === 'privacy' && (
                    <div id="privacy" className="space-y-4 animate-in fade-in duration-300">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Zero-Retention Privacy Policy</h2>
                        <p><strong>1. Data Collection & Processing:</strong> This application utilizes a Dual-Stream Neural Network to analyze video files for synthetic manipulation. The processing occurs in volatile memory (RAM).</p>
                        <p><strong>2. Absolute Zero-Retention:</strong> We do not store, save, or archive any video data. The moment the inference result is generated, your file is permanently deleted from our temporary server environment.</p>
                        <p><strong>3. Third-Party Sharing:</strong> Because no data is retained, no user data or facial biometric data is ever sold, shared, or distributed to third parties.</p>
                    </div>
                )}

                {activeTab === 'terms' && (
                    <div id="terms" className="space-y-4 animate-in fade-in duration-300">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Terms of Service</h2>
                        <p><strong>1. Intended Use:</strong> This tool is designed to assist in verifying the authenticity of digital media. It is not intended to be used as admissible legal evidence without human expert verification.</p>
                        <p><strong>2. Rate Limiting:</strong> To protect our infrastructure, users are limited to 10 scans per hour. Automated API abuse will result in an immediate IP ban.</p>
                        <p><strong>3. Limitation of Liability:</strong> AI models are probabilistic. The developer is not liable for damages resulting from False Positives (flagging real media as fake) or False Negatives (missing a deepfake).</p>
                    </div>
                )}

                {activeTab === 'ethics' && (
                    <div id="ethics" className="space-y-4 animate-in fade-in duration-300">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Our Ethical AI Framework</h2>
                        <p><strong>1. Transparency of Confidence:</strong> We never output a simple &quot;True/False&quot; binary. Our system always outputs the exact mathematical confidence threshold, ensuring users understand the probabilistic nature of the AI.</p>
                        <p><strong>2. Bias Mitigation:</strong> Our model was trained on the diverse Celeb-DF v2 dataset to minimize racial and gender biases commonly found in facial recognition backbones.</p>
                        <p><strong>3. Guardrails Against Weaponization:</strong> This tool is defensive. The underlying architecture cannot be reverse-engineered to *generate* deepfakes.</p>
                    </div>
                )}
            </div>
        </div>
    );
}