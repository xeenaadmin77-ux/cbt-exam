import React, { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    // If running Vite directly, redirect to the CBT portal landing page
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
      // In Vite, files in public/ are served at root
      // e.g., /student-login.html, /teacher-login.html, /teacher-dashboard.html
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl p-8 border border-slate-700 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg">
          🏛️
        </div>
        <h1 className="text-xl font-bold text-white mb-1">XEENA INSTITUTE</h1>
        <p className="text-sm text-slate-400 mb-6">Computer Based Test (CBT) Examination Lab</p>

        <div className="space-y-3">
          <a
            href="/student-login.html"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 font-semibold rounded-lg shadow transition"
          >
            <span>🎓</span> Student Examination Login
          </a>

          <a
            href="/teacher-login.html"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-700 hover:bg-slate-600 font-semibold rounded-lg border border-slate-600 transition"
          >
            <span>👨‍🏫</span> Faculty &amp; Invigilator Portal
          </a>

          <a
            href="/teacher-dashboard.html"
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-transparent hover:bg-slate-700/50 text-slate-300 text-xs rounded transition"
          >
            Direct Faculty Overview ➔
          </a>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-700/60 text-xs text-slate-500">
          Industrial Training Institute • Production CBT Platform
        </div>
      </div>
    </div>
  );
}
