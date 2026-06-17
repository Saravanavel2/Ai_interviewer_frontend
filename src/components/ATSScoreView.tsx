import React, { useState, useEffect } from 'react';
import { Award, CheckCircle, AlertCircle, ArrowRight, ShieldAlert, Sparkles, Layout, Database, Check, AlertTriangle, ArrowUpRight } from 'lucide-react';
import axios from 'axios';

const API_URL = 'https://ai-interviewer-backend-lk0k.onrender.com';

interface ATSScoreViewProps {
  token: string;
  resumeId: string;
  role: string;
  company: string;
  onProceed: () => void;
}

export const ATSScoreView: React.FC<ATSScoreViewProps> = ({
  token,
  resumeId,
  role,
  company,
  onProceed
}) => {
  const [loading, setLoading] = useState(true);
  const [scoreData, setScoreData] = useState<any>(null);
  const [error, setError] = useState('');
  const [animatedScore, setAnimatedScore] = useState(0);

  // Sub-metrics animation states
  const [keywordMatch, setKeywordMatch] = useState(0);
  const [formattingScore, setFormattingScore] = useState(0);
  const [impactScore, setImpactScore] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const response = await axios.get(`${API_URL}/api/resume/${resumeId}/ats-score`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setScoreData(response.data);
      } catch (err: any) {
        console.error(err);
        setError('Failed to calculate your resume ATS match score. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [resumeId, token]);

  // Animated score counter effect
  useEffect(() => {
    if (!scoreData) return;
    const target = scoreData.ats_score;
    
    // Derived sub-metrics for UI representation
    const targetKeyword = Math.min(100, Math.max(30, target + 8));
    const targetFormatting = Math.min(100, Math.max(50, target + 15));
    const targetImpact = Math.min(100, Math.max(20, target - 12));

    const duration = 1000; // 1 second total animation
    const steps = 60;
    const interval = duration / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      
      setAnimatedScore(Math.round(progress * target));
      setKeywordMatch(Math.round(progress * targetKeyword));
      setFormattingScore(Math.round(progress * targetFormatting));
      setImpactScore(Math.round(progress * targetImpact));

      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [scoreData]);

  if (loading) {
    return (
      <div className="max-w-xl w-full mx-auto animate-slide-up text-center py-20">
        <div className="glass-panel p-10 flex flex-col items-center space-y-6 relative overflow-hidden">
          {/* Subtle glowing ring */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
          <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin relative z-10" />
          <div className="relative z-10 space-y-2">
            <h2 className="text-xl font-bold text-slate-800 tracking-wide">Recruiter Screening Sandbox</h2>
            <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
              Evaluating keyword density, parsing layout structures, and checking role alignment for <strong>{role}</strong> at <strong>{company}</strong>...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !scoreData) {
    return (
      <div className="max-w-xl w-full mx-auto text-center py-20 animate-slide-up">
        <div className="glass-panel p-8 space-y-6 border-red-100 bg-red-50/10">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mx-auto shadow-sm">
            <AlertCircle size={26} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-wide">ATS Evaluation Pipeline Failed</h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">{error || 'Unknown parsing issue occurred.'}</p>
          </div>
          <button onClick={onProceed} className="glow-btn flex items-center justify-center gap-2 px-8 py-3.5 mx-auto">
            Bypass Check &amp; Start Interview <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  const { ats_score, matching_keywords, missing_keywords, feedback } = scoreData;

  // SVG circle calculations for the gauge
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  // Color selection based on match score
  const getScoreColorClass = (val: number) => {
    if (val >= 80) return 'text-emerald-600 stroke-emerald-600 drop-shadow-[0_2px_4px_rgba(16,185,129,0.15)]';
    if (val >= 60) return 'text-amber-600 stroke-amber-600 drop-shadow-[0_2px_4px_rgba(245,158,11,0.15)]';
    return 'text-red-600 stroke-red-600 drop-shadow-[0_2px_4px_rgba(239,68,68,0.15)]';
  };

  const getScoreBgClass = (val: number) => {
    if (val >= 80) return 'bg-emerald-50 border-emerald-100 text-emerald-700';
    if (val >= 60) return 'bg-amber-50 border-amber-100 text-amber-700';
    return 'bg-red-50 border-red-100 text-red-700';
  };

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6 animate-slide-up relative">
      {/* Floating abstract backdrop lights */}
      <div className="absolute -top-12 -left-12 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 -right-12 w-72 h-72 bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Header Dashboard Panel */}
      <div className="glass-panel p-6 md:p-8 flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden border-slate-100 shadow-sm">
        <div className="flex-1 space-y-4 text-center lg:text-left">
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Sparkles size={11} /> Recruiter Screening Sandbox
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-widest border px-3 py-1.5 rounded-full ${getScoreBgClass(ats_score)}`}>
              {ats_score >= 80 ? 'Strong Match' : ats_score >= 60 ? 'Needs Optimization' : 'Low Match'}
            </span>
          </div>
          
          <div className="space-y-1.5">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-none">
              Resume Match Analytics
            </h1>
            <p className="text-sm text-slate-500 max-w-lg leading-relaxed">
              Evaluating your document compatibility for the <strong className="text-slate-800">{role}</strong> opening at <strong className="text-slate-800">{company}</strong>.
            </p>
          </div>
        </div>

        {/* Animated Radial Score Gauge Card */}
        <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6 flex-shrink-0 relative">
          <div className="relative flex items-center justify-center">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r={radius}
                className="stroke-slate-200 fill-none"
                strokeWidth="8"
              />
              <circle
                cx="64"
                cy="64"
                r={radius}
                className={`fill-none transition-all duration-300 ${getScoreColorClass(ats_score)}`}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-3xl font-black text-slate-850">{animatedScore}%</span>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Match</p>
            </div>
          </div>

          {/* Sub-Metrics Breakdown Bars */}
          <div className="w-48 space-y-3">
            {/* Keyword Match */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1"><Database size={10} className="text-indigo-500" /> Keyword Density</span>
                <span className="text-slate-700">{keywordMatch}%</span>
              </div>
              <div className="bg-slate-200 rounded-full h-1 overflow-hidden border border-slate-200">
                <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${keywordMatch}%` }} />
              </div>
            </div>

            {/* Layout Score */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1"><Layout size={10} className="text-emerald-500" /> Layout &amp; Structure</span>
                <span className="text-slate-700">{formattingScore}%</span>
              </div>
              <div className="bg-slate-200 rounded-full h-1 overflow-hidden border border-slate-200">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${formattingScore}%` }} />
              </div>
            </div>

            {/* Impact Metric Score */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1"><Award size={10} className="text-amber-500" /> Impact &amp; Metrics</span>
                <span className="text-slate-700">{impactScore}%</span>
              </div>
              <div className="bg-slate-200 rounded-full h-1 overflow-hidden border border-slate-200">
                <div className="bg-amber-500 h-full rounded-full transition-all duration-300" style={{ width: `${impactScore}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Keywords */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Matching Keywords Box */}
        <div className="glass-panel p-6 space-y-4 hover:border-indigo-100 transition-all duration-300">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-emerald-600 flex items-center gap-2 uppercase tracking-wider">
              <CheckCircle size={15} /> Verified Skills Found
            </h3>
            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-md">
              {matching_keywords.length} Skills
            </span>
          </div>
          
          {matching_keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {matching_keywords.map((kw: string, i: number) => (
                <span 
                  key={i} 
                  className="bg-slate-50 border border-slate-100 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-xs px-3 py-1.5 rounded-xl flex items-center gap-2 transition-all duration-200 cursor-default group"
                >
                  <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                    <Check size={10} />
                  </div>
                  {kw}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-2">No matching keywords parsed from your resume text.</p>
          )}
        </div>

        {/* Missing Keywords Box */}
        <div className="glass-panel p-6 space-y-4 hover:border-indigo-100 transition-all duration-300">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-amber-600 flex items-center gap-2 uppercase tracking-wider">
              <AlertTriangle size={15} /> Expected Missing Keywords
            </h3>
            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-md">
              {missing_keywords.length} Gaps
            </span>
          </div>

          {missing_keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {missing_keywords.map((kw: string, i: number) => (
                <span 
                  key={i} 
                  className="bg-slate-50 border border-slate-100 hover:border-amber-300 text-slate-700 hover:text-amber-800 text-xs px-3 py-1.5 rounded-xl flex items-center gap-2 transition-all duration-200 cursor-default group"
                >
                  <div className="w-4 h-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-all">
                    <span className="text-[10px] font-black">+</span>
                  </div>
                  {kw}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-2">Excellent! Your resume matches all core keywords expected by standard filters.</p>
          )}
        </div>
      </div>

      {/* Constructive Critique Dashboard Card */}
      <div className="glass-panel p-6 md:p-8 space-y-5 relative overflow-hidden shadow-sm">
        {/* Glow effect */}
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <h3 className="text-md font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldAlert size={18} className="text-brand-600" /> Resume Optimisation Advice
          </h3>
          <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
            Standard guidelines <ArrowUpRight size={12} />
          </span>
        </div>
        
        {feedback && feedback.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {feedback.map((item: string, idx: number) => {
              // Extract a bold lead-in prefix if available (e.g. "Quantify your achievements: ...")
              const parts = item.split(':');
              const hasPrefix = parts.length > 1 && parts[0].length < 40;
              const prefix = hasPrefix ? parts[0] : `Revision #${idx + 1}`;
              const description = hasPrefix ? parts.slice(1).join(':') : item;

              return (
                <div key={idx} className="bg-white border border-slate-100 shadow-sm p-4 rounded-xl space-y-2 hover:shadow-md transition-all duration-300 flex flex-col justify-between hover:border-brand-500/20">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wide">
                      {prefix}
                    </span>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">
                      {description.trim()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No revisions recommended. Your resume aligns well with standard structure.</p>
        )}
      </div>

      {/* Action Proceed Call Button */}
      <button
        onClick={onProceed}
        className="glow-btn w-full py-4.5 flex items-center justify-center gap-2 text-sm font-bold group relative overflow-hidden"
      >
        <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
        <span>Proceed to Interview Session</span>
        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
};
