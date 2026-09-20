import Link from "next/link";
import ComplianceHub from "@/components/ComplianceHub";

export default function LegalPage() {
    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-16 px-4 transition-colors duration-200">
            <div className="max-w-6xl mx-auto space-y-10">
                <div className="text-center">
                    <p className="text-sm uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400 font-bold">Transparency & Trust</p>
                    <h1 className="mt-4 text-4xl font-bold text-slate-900 dark:text-white sm:text-5xl">Legal & Compliance</h1>
                    <p className="mt-4 max-w-2xl mx-auto text-slate-600 dark:text-slate-400 text-base sm:text-lg">
                        Review our privacy policy, terms of service, and ethical framework in one place.
                    </p>
                    <div className="mt-8">
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-medium text-slate-800 dark:text-slate-100 transition hover:border-blue-500 hover:text-blue-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs"
                        >
                            Back to Scanner
                        </Link>
                    </div>
                </div>

                <ComplianceHub />
            </div>
        </main>
    );
}
