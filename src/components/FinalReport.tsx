import React, { useState, useEffect } from 'react';
import {
  Award, CheckCircle, TrendingUp, AlertTriangle, FileText,
  Printer, RotateCcw, Sparkles, ThumbsUp, Lightbulb,
  Target, ChevronDown, ChevronUp, BookOpen, HelpCircle,
  MessageSquare, Star, Zap
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface FinalReportProps {
  token: string;
  sessionId: string;
  role: string;
  company: string;
  onRestart: () => void;
}

/** Parse "Strong: ...\n\nWeaknesses: ...\n\nSuggested Resume Revision:\n..." into parts */
function parseFeedback(raw: string) {
  if (!raw) return { strong: '', weak: '' };
  const strongMatch = raw.match(/Strong:\s*([\s\S]*?)(?=\n\nWeaknesses:|$)/i);
  const weakMatch   = raw.match(/Weaknesses:\s*([\s\S]*?)(?=\n\nSuggested Resume Revision:|$)/i);
  return {
    strong: strongMatch ? strongMatch[1].trim() : '',
    weak:   weakMatch   ? weakMatch[1].trim()   : ''
  };
}

// Helper to clean and strip JSON wrappers or numbering from question text
function cleanQuestionText(text: string): string {
  if (!text) return '';
  let clean = text.trim();
  
  function extractStringValue(obj: any): string | null {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'object') {
      if (obj.question && typeof obj.question === 'string') return obj.question;
      if (obj.question_text && typeof obj.question_text === 'string') return obj.question_text;
      if (obj.text && typeof obj.text === 'string') return obj.text;
      if (obj.description && typeof obj.description === 'string') return obj.description;
      
      const vals = Object.values(obj);
      for (const val of vals) {
        const found = extractStringValue(val);
        if (found) return found;
      }
    }
    return null;
  }

  if (clean.startsWith('{') && clean.endsWith('}')) {
    try {
      const parsed = JSON.parse(clean);
      if (parsed && (parsed.title || parsed.description || parsed.templates)) {
        return text; // Preserve coding question JSON format as-is
      }
      const extracted = extractStringValue(parsed);
      if (extracted) {
        clean = extracted.trim();
      }
    } catch (e) {
      const match = clean.match(/^\{\s*["']?[a-zA-Z0-9_-]+["']?\s*:\s*["']([\s\S]*?)["']\s*\}$/);
      if (match) {
        clean = match[1].trim();
      }
    }
  }

  // Also remove any leading numbering like "1. ", "q1: ", "q2. ", "(1) ", "1) ", etc.
  clean = clean.replace(/^(?:q?\d+[\.\):\-\s]+)+/i, '');
  return clean.trim();
}

/** Section icon map */
const SECTION_ICONS: Record<string, React.ReactNode> = {
  'Technical Skills':      <Zap size={16} className="text-brand-500" />,
  'Projects':              <Star size={16} className="text-indigo-400" />,
  'Internships/Experience':<TrendingUp size={16} className="text-emerald-400" />,
  'Education':             <BookOpen size={16} className="text-amber-400" />,
  'Certifications':        <Award size={16} className="text-rose-400" />,
};

/** Priority badge colours */
const PRIORITY_STYLES: Record<string, { badge: string; border: string; dot: string }> = {
  High:   { badge: 'bg-red-500/10 text-red-400 border-red-500/20',      border: 'border-l-red-500',    dot: 'bg-red-400' },
  Medium: { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', border: 'border-l-amber-500',  dot: 'bg-amber-400' },
  Low:    { badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', border: 'border-l-brand-500', dot: 'bg-indigo-400' }
};

/** Score colour */
const scoreColor = (val: number) =>
  val >= 75 ? 'text-emerald-400' : val >= 50 ? 'text-amber-400' : 'text-red-400';

export const FinalReport: React.FC<FinalReportProps> = ({
  token, sessionId, role, company, onRestart
}) => {
  const [loading, setLoading]   = useState(true);
  const [data, setData]         = useState<any>(null);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/session/${sessionId}/report`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data);
      } catch (e: any) {
        setError('Failed to generate the final interview report.');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, token]);

  const toggle = (idx: number) =>
    setExpanded(prev => { const s = new Set(prev); s.has(idx) ? s.delete(idx) : s.add(idx); return s; });

  /* ── Loading ── */
  if (loading) return (
    <div className="max-w-xl w-full mx-auto animate-slide-up text-center py-20">
      <div className="glass-panel p-8 flex flex-col items-center space-y-6">
        <div className="w-16 h-16 rounded-full border-4 border-slate-850 border-t-indigo-500 animate-spin" />
        <div>
          <h2 className="text-xl font-bold text-white">Synthesizing Session Data...</h2>
          <p className="text-sm text-slate-400 mt-2">
            Generating your personalised preparation handbook for <strong>{role}</strong> at <strong>{company}</strong>.
          </p>
        </div>
      </div>
    </div>
  );

  /* ── Error ── */
  if (error || !data) return (
    <div className="max-w-xl w-full mx-auto text-center py-20">
      <div className="glass-panel p-8 space-y-6">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto">
          <AlertTriangle size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Analysis Synthesis Failed</h2>
          <p className="text-sm text-slate-400 mt-2">{error || 'Unknown error.'}</p>
        </div>
        <button onClick={onRestart} className="glow-btn">Try Onboarding Again</button>
      </div>
    </div>
  );

  const { report, action_plan, resumeSections, qnas } = data;

  /* ── Score calculations ── */
  const techScores  = qnas.filter((q: any) => q.is_technical === 1 || q.is_technical === 2).map((q: any) => q.correctness_score).filter((s: any) => s != null);
  const commScores  = qnas.map((q: any) => q.comm_overall).filter((s: any) => s != null);
  const avgTech     = techScores.length  ? Math.round(techScores.reduce((a: number, b: number) => a + b, 0) / techScores.length)  : 0;
  const avgComm     = commScores.length  ? Math.round(commScores.reduce((a: number, b: number) => a + b, 0) / commScores.length)   : 0;
  const optimized   = resumeSections.filter((s: any) => s.improved_version).length;

  /* ── Chart ── */
  const chartPts = commScores.map((score: number, idx: number) => ({
    x: commScores.length > 1 ? (idx / (commScores.length - 1)) * 100 : 50,
    y: 100 - score, score
  }));
  const pathD = chartPts.length > 1 ? `M ${chartPts.map((p: any) => `${p.x},${p.y}`).join(' L ')}` : '';

  /* ── Section Q&A lookup ── */
  // Map section_name → all Q&A rows answered in that section (resume round only)
  const sectionQnas: Record<string, any[]> = {};
  qnas.filter((q: any) => q.is_technical === 0).forEach((q: any) => {
    const key = q.section_name || '';
    if (!sectionQnas[key]) sectionQnas[key] = [];
    sectionQnas[key].push(q);
  });

  return (
    <div className="max-w-5xl w-full mx-auto space-y-8 animate-slide-up print:bg-white print:text-black">

      {/* ── Banner ── */}
      <div className="glass-panel p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-slate-100 shadow-sm">
        <div>
          <span className="text-xs font-bold text-brand-600 uppercase tracking-widest bg-brand-50 border border-brand-100 px-3 py-1.5 rounded-full print:hidden">
            Consolidated Feedback
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 mt-3 print:text-black font-sans">
            PrepMate AI Prep Report
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-normal leading-relaxed">
            Targeting <strong className="text-slate-800">{role}</strong> at <strong className="text-slate-800">{company}</strong>
          </p>
        </div>
        <div className="flex gap-4 print:hidden">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-800 px-5 py-3 rounded-xl transition-all font-semibold text-xs shadow-sm">
            <Printer size={16} /> Export PDF
          </button>
          <button onClick={onRestart} className="glow-btn flex items-center gap-2 text-xs">
            <RotateCcw size={16} /> New Prep
          </button>
        </div>
      </div>

      {/* ── Score Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: <Award size={28} />, bg: 'bg-red-50 text-red-650 border border-red-100',      label: 'Technical Readiness',  val: `${avgTech}%`,               sub: 'Average correctness', bar: avgTech,  color: 'bg-rose-500' },
          { icon: <TrendingUp size={28} />, bg: 'bg-emerald-55 text-emerald-700 border border-emerald-100', label: 'Communication Score', val: `${avgComm}%`,  sub: 'Tone, structure & pacing', bar: avgComm, color: 'bg-emerald-500' },
          { icon: <FileText size={28} />, bg: 'bg-indigo-50 text-indigo-750 border border-indigo-100',    label: 'Sections Reviewed',   val: `${resumeSections.length}`, sub: 'Resume sections analysed', bar: resumeSections.length > 0 ? Math.round((optimized / resumeSections.length) * 100) : 0, color: 'bg-indigo-500' }
        ].map((c, i) => (
          <div key={i} className="glass-panel p-6 border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${c.bg}`}>{c.icon}</div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{c.label}</p>
                <p className="text-3xl font-extrabold text-slate-850 mt-1 font-sans">{c.val}</p>
                <p className="text-xs text-slate-500 mt-0.5 font-normal">{c.sub}</p>
              </div>
            </div>
            <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/50">
              <div className={`${c.color} h-full rounded-full transition-all duration-700`} style={{ width: `${c.bar}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart + AI Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 space-y-4 border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-850 flex items-center gap-2">
            <TrendingUp size={18} className="text-brand-655" /> Communication Score Trend
          </h3>
          {chartPts.length > 0 ? (
            <div className="relative pt-2">
              <svg className="w-full h-44 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                {[25, 50, 75].map(g => <line key={g} x1="0" y1={g} x2="100" y2={g} stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />)}
                {pathD && <path d={pathD} fill="none" stroke="url(#iGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
                {chartPts.map((p: any, i: number) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4.5" fill="#4f46e5" stroke="#ffffff" strokeWidth="2" />
                    <text x={p.x} y={p.y - 8} fill="#64748b" fontSize="6" fontWeight="bold" textAnchor="middle">{p.score}</text>
                  </g>
                ))}
                <defs>
                  <linearGradient id="iGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="flex justify-between text-xs text-slate-500 mt-3 border-t border-slate-100 pt-2 font-medium">
                <span>Session Start</span><span>Session End</span>
              </div>
            </div>
          ) : <p className="text-slate-550 text-sm text-center py-10 font-normal">No score data logged.</p>}
        </div>

        <div className="glass-panel p-6 flex flex-col space-y-4 border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-850 flex items-center gap-2">
            <Award size={18} className="text-rose-650" /> AI Session Summary
          </h3>
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="bg-slate-5 p-4 border border-indigo-100/50 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-indigo-755 uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen size={12} /> Resume Fit Critique
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-line">
                {report?.resume_summary || 'No summary available.'}
              </p>
            </div>
            <div className="bg-slate-5 p-4 border border-rose-100/50 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-rose-750 uppercase tracking-wide flex items-center gap-1.5">
                <Target size={12} /> Technical Evaluation
              </h4>
              <p className="text-sm text-slate-655 leading-relaxed font-normal whitespace-pre-line">
                {report?.technical_summary || 'No technical summary available.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Prioritized Action Plan ── */}
      <div className="glass-panel p-6 md:p-8 space-y-6 border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
            <CheckCircle size={20} />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">Prioritized Action Plan</h3>
            <p className="text-xs text-slate-500 mt-1 font-normal">
              Tailored for <strong className="text-slate-700">{role}</strong> at <strong className="text-slate-700">{company}</strong>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {action_plan?.length > 0 ? action_plan.map((plan: any, idx: number) => {
            const s = PRIORITY_STYLES[plan.priority] || PRIORITY_STYLES.Medium;
            return (
              <div key={plan.id || idx}
                className={`bg-slate-5 border border-slate-150 border-l-4 ${s.border} p-5 rounded-xl space-y-3 hover:bg-slate-100/50 hover:border-slate-200 transition-all shadow-sm`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${s.dot} mt-0.5 flex-shrink-0`} />
                    <span className="text-xs font-bold text-slate-450">Action #{idx + 1}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${s.badge} flex-shrink-0 font-bold uppercase tracking-wider`}>
                    {plan.priority} Priority
                  </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">{plan.recommendation}</p>
              </div>
            );
          }) : <p className="text-slate-500 text-sm col-span-2 font-normal">No action plan items generated.</p>}
        </div>
      </div>

      {/* ── Section-by-Section Review ── */}
      {resumeSections?.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 px-1">
            <Sparkles size={22} className="text-indigo-650 animate-pulse" />
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">Section-by-Section Review &amp; Suggestions</h3>
              <p className="text-xs text-slate-500 mt-1 font-normal">
                Targeted practice questions, strengths, and <strong className="text-slate-700">{company} · {role}</strong>-specific improvement tips per section
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {resumeSections.map((section: any, idx: number) => {
              const sectionQnaList: any[] = sectionQnas[section.section_type] || [];
              // pick the best (highest-scored) or first question to display as practice
              const practiceQna = sectionQnaList.length > 0
                ? [...sectionQnaList].sort((a, b) => (b.comm_overall || 0) - (a.comm_overall || 0))[0]
                : null;

              // Gather all feedback texts for this section
              const allFeedback = sectionQnaList.map(q => q.ai_feedback || '').filter(Boolean);
              // Try to get structured feedback from the last answered question
              const lastFeedbackRaw = allFeedback[allFeedback.length - 1] || '';
              const { strong, weak } = parseFeedback(lastFeedbackRaw);

              // If no structured feedback, try the improved_version field as a proxy
              const isExpanded = expanded.has(idx);
              const icon = SECTION_ICONS[section.section_type] || <FileText size={16} className="text-slate-500" />;

              return (
                <div key={idx} className="glass-panel border-slate-100 shadow-sm rounded-2xl overflow-hidden">
                  {/* Header */}
                  <button
                    onClick={() => toggle(idx)}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                        {icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">{section.section_type}</h4>
                        <p className="text-xs text-slate-500">
                          {sectionQnaList.length > 0
                            ? `${sectionQnaList.length} question${sectionQnaList.length > 1 ? 's' : ''} answered`
                            : 'No questions answered — placeholder section'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {sectionQnaList.length > 0 && (
                        <span className={`text-xs font-bold ${scoreColor(practiceQna?.comm_overall || 0)}`}>
                          Comm: {practiceQna?.comm_overall || 0}/100
                        </span>
                      )}
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>

                  {/* Body */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 pb-6 pt-5 space-y-5">

                      {/* Practice Question */}
                      {practiceQna ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <HelpCircle size={15} className="text-brand-600" />
                            <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                              Practice Question — {company} · {role}
                            </span>
                          </div>
                          <div className="bg-brand-5/30 border border-brand-100/50 rounded-xl p-4 space-y-3">
                            <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                              {cleanQuestionText(practiceQna.question_text || '')}
                            </p>
                            {practiceQna.answer_text && (
                              <div className="border-t border-slate-150 pt-3 space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                  <MessageSquare size={10} /> Your Answer
                                </p>
                                <p className="text-xs text-slate-400 leading-relaxed italic line-clamp-3">
                                  "{practiceQna.answer_text}"
                                </p>
                              </div>
                            )}
                            <div className="flex items-center gap-4 pt-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Communication</span>
                                <span className={`text-sm font-extrabold ${scoreColor(practiceQna.comm_overall || 0)}`}>
                                  {practiceQna.comm_overall || 0}/100
                                </span>
                              </div>
                              {practiceQna.correctness_score != null && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-500 uppercase font-bold">Technical</span>
                                  <span className={`text-sm font-extrabold ${scoreColor(practiceQna.correctness_score || 0)}`}>
                                    {practiceQna.correctness_score}/100
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-5 border border-slate-150 rounded-xl p-4">
                          <p className="text-xs text-slate-500 font-normal">
                            No questions were answered for this section during the session.
                          </p>
                        </div>
                      )}

                      {/* Strengths */}
                      {strong && strong.toLowerCase() !== 'none' && !strong.toLowerCase().startsWith('none') && (
                        <div className="bg-emerald-5 border border-emerald-100 rounded-xl p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <ThumbsUp size={14} className="text-emerald-700" />
                            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Strengths Identified</span>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed font-normal">{strong}</p>
                        </div>
                      )}

                      {/* Company+Role+Stack Suggestions */}
                      {weak && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Lightbulb size={15} className="text-amber-750" />
                            <span className="text-xs font-bold text-amber-705 uppercase tracking-wider">
                              Suggestions — {company} · {role}
                            </span>
                          </div>
                          <div className="bg-amber-5 border border-amber-100 rounded-xl p-4">
                            <p className="text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-line">{weak}</p>
                          </div>
                        </div>
                      )}

                      {/* Fallback: No feedback available */}
                      {!strong && !weak && !practiceQna && (
                        <p className="text-xs text-slate-500 font-normal">
                          No feedback data available for this section. Ensure questions were answered during the interview.
                        </p>
                      )}

                      {/* Additional questions asked this section */}
                      {sectionQnaList.length > 1 && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Other Questions Asked ({sectionQnaList.length - 1} more)
                          </p>
                          <div className="space-y-2">
                            {sectionQnaList.slice(1).map((q: any, qi: number) => (
                              <div key={qi} className="bg-slate-5 border border-slate-150 rounded-lg p-3 flex items-start justify-between gap-3 shadow-xs">
                                <p className="text-xs text-slate-500 leading-relaxed flex-1 font-normal">{cleanQuestionText(q.question_text || '')}</p>
                                <span className={`text-xs font-bold flex-shrink-0 ${scoreColor(q.comm_overall || 0)}`}>
                                  {q.comm_overall || 0}/100
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Q&A Performance Log ── */}
      {qnas?.length > 0 && (
        <div className="glass-panel p-6 md:p-8 space-y-4 border-slate-100 shadow-sm">
          <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <Target size={22} className="text-amber-600" />
            Full Q&amp;A Performance Log
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-150 shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Question</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Section</th>
                  <th className="text-center px-4 py-3 font-bold uppercase tracking-wider">Comm.</th>
                  <th className="text-center px-4 py-3 font-bold uppercase tracking-wider">Tech.</th>
                </tr>
              </thead>
              <tbody>
                {qnas.map((q: any, idx: number) => {
                  let questionText = cleanQuestionText(q.question_text || '');
                  if (q.is_technical === 2) {
                    try {
                      const parsed = JSON.parse(q.question_text);
                      questionText = `[Coding] ${parsed.title || 'Coding Challenge'}`;
                    } catch (e) {
                      questionText = q.question_text;
                    }
                  }
                  return (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-slate-450">{idx + 1}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs font-normal">
                        <p className="line-clamp-2" title={questionText}>{questionText}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                          q.is_technical === 1 ? 'bg-rose-50 border-rose-100 text-rose-700' :
                          q.is_technical === 2 ? 'bg-amber-55 border-amber-100 text-amber-700' :
                          'bg-indigo-50 border-indigo-100 text-indigo-700'
                        }`}>
                          {q.is_technical === 1 ? 'Technical' :
                           q.is_technical === 2 ? 'Coding' :
                           (q.section_name || 'Resume')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${scoreColor(q.comm_overall || 0)}`}>
                          {q.comm_overall != null ? `${q.comm_overall}/100` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${scoreColor(q.correctness_score || 0)}`}>
                          {q.correctness_score != null ? `${q.correctness_score}/100` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
