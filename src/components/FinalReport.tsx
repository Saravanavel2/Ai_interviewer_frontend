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
      <div className="glass-panel p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-xs font-bold text-brand-500 uppercase tracking-widest bg-brand-500/10 px-3 py-1.5 rounded-full print:hidden">
            Consolidated Feedback
          </span>
          <h1 className="text-3xl font-extrabold text-white mt-3 print:text-black">
            PrepMate AI Prep Report
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Targeting <strong>{role}</strong> at <strong>{company}</strong>
          </p>
        </div>
        <div className="flex gap-4 print:hidden">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white px-5 py-3 rounded-xl transition-all">
            <Printer size={16} /> Export PDF
          </button>
          <button onClick={onRestart} className="glow-btn flex items-center gap-2">
            <RotateCcw size={16} /> New Prep
          </button>
        </div>
      </div>

      {/* ── Score Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: <Award size={28} />, bg: 'bg-red-500/10 text-red-500',      label: 'Technical Readiness',  val: `${avgTech}%`,               sub: 'Average correctness', bar: avgTech,  color: 'bg-red-400' },
          { icon: <TrendingUp size={28} />, bg: 'bg-emerald-500/10 text-emerald-500', label: 'Communication Score', val: `${avgComm}%`,  sub: 'Tone, structure & pacing', bar: avgComm, color: 'bg-emerald-400' },
          { icon: <FileText size={28} />, bg: 'bg-indigo-500/10 text-indigo-500',    label: 'Sections Reviewed',   val: `${resumeSections.length}`, sub: 'Resume sections analysed', bar: resumeSections.length > 0 ? Math.round((optimized / resumeSections.length) * 100) : 0, color: 'bg-indigo-400' }
        ].map((c, i) => (
          <div key={i} className="glass-panel p-6 border border-slate-800/60 space-y-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${c.bg}`}>{c.icon}</div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">{c.label}</p>
                <p className="text-3xl font-extrabold text-white mt-1">{c.val}</p>
                <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
              </div>
            </div>
            <div className="bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-900">
              <div className={`${c.color} h-full rounded-full transition-all duration-700`} style={{ width: `${c.bar}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart + AI Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp size={18} className="text-brand-500" /> Communication Score Trend
          </h3>
          {chartPts.length > 0 ? (
            <div className="relative pt-2">
              <svg className="w-full h-44 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                {[25, 50, 75].map(g => <line key={g} x1="0" y1={g} x2="100" y2={g} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />)}
                {pathD && <path d={pathD} fill="none" stroke="url(#iGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
                {chartPts.map((p: any, i: number) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4.5" fill="#6366f1" stroke="#0f172a" strokeWidth="2" />
                    <text x={p.x} y={p.y - 8} fill="#94a3b8" fontSize="6" fontWeight="bold" textAnchor="middle">{p.score}</text>
                  </g>
                ))}
                <defs>
                  <linearGradient id="iGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="flex justify-between text-xs text-slate-500 mt-3 border-t border-slate-900 pt-2">
                <span>Session Start</span><span>Session End</span>
              </div>
            </div>
          ) : <p className="text-slate-500 text-sm text-center py-10">No score data logged.</p>}
        </div>

        <div className="glass-panel p-6 flex flex-col space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Award size={18} className="text-red-500" /> AI Session Summary
          </h3>
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="bg-slate-950/40 p-4 border border-indigo-500/10 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen size={12} /> Resume Fit Critique
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {report?.resume_summary || 'No summary available.'}
              </p>
            </div>
            <div className="bg-slate-950/40 p-4 border border-red-500/10 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                <Target size={12} /> Technical Evaluation
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {report?.technical_summary || 'No technical summary available.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Prioritized Action Plan ── */}
      <div className="glass-panel p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800/60 pb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500">
            <CheckCircle size={20} />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-white">Prioritized Action Plan</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tailored for <strong className="text-slate-400">{role}</strong> at <strong className="text-slate-400">{company}</strong>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {action_plan?.length > 0 ? action_plan.map((plan: any, idx: number) => {
            const s = PRIORITY_STYLES[plan.priority] || PRIORITY_STYLES.Medium;
            return (
              <div key={plan.id || idx}
                className={`bg-slate-950/40 border border-slate-900 border-l-4 ${s.border} p-5 rounded-xl space-y-3 hover:bg-slate-950/60 transition-all`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${s.dot} mt-0.5 flex-shrink-0`} />
                    <span className="text-xs font-bold text-slate-500">Action #{idx + 1}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border ${s.badge} flex-shrink-0`}>
                    {plan.priority} Priority
                  </span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{plan.recommendation}</p>
              </div>
            );
          }) : <p className="text-slate-500 text-sm col-span-2">No action plan items generated.</p>}
        </div>
      </div>

      {/* ── Section-by-Section Review ── */}
      {resumeSections?.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 px-1">
            <Sparkles size={22} className="text-indigo-400" />
            <div>
              <h3 className="text-xl font-extrabold text-white">Section-by-Section Review &amp; Suggestions</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Targeted practice questions, strengths, and <strong className="text-slate-400">{company} · {role}</strong>-specific improvement tips per section
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
              const icon = SECTION_ICONS[section.section_type] || <FileText size={16} className="text-slate-400" />;

              return (
                <div key={idx} className="glass-panel border border-slate-800/60 rounded-2xl overflow-hidden">
                  {/* Header */}
                  <button
                    onClick={() => toggle(idx)}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-900/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
                        {icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-white">{section.section_type}</h4>
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
                    <div className="border-t border-slate-800/40 px-5 pb-6 pt-5 space-y-5">

                      {/* Practice Question */}
                      {practiceQna ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <HelpCircle size={15} className="text-brand-500" />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                              Practice Question — {company} · {role}
                            </span>
                          </div>
                          <div className="bg-brand-500/5 border border-brand-500/15 rounded-xl p-4 space-y-3">
                            <p className="text-sm font-semibold text-white leading-relaxed">
                              {practiceQna.question_text}
                            </p>
                            {practiceQna.answer_text && (
                              <div className="border-t border-slate-800/50 pt-3 space-y-1">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
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
                        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                          <p className="text-xs text-slate-500">
                            No questions were answered for this section during the session.
                          </p>
                        </div>
                      )}

                      {/* Strengths */}
                      {strong && strong.toLowerCase() !== 'none' && !strong.toLowerCase().startsWith('none') && (
                        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <ThumbsUp size={14} className="text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Strengths Identified</span>
                          </div>
                          <p className="text-sm text-slate-300 leading-relaxed">{strong}</p>
                        </div>
                      )}

                      {/* Company+Role+Stack Suggestions */}
                      {weak && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Lightbulb size={15} className="text-amber-400" />
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                              Suggestions — {company} · {role}
                            </span>
                          </div>
                          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{weak}</p>
                          </div>
                        </div>
                      )}

                      {/* Fallback: No feedback available */}
                      {!strong && !weak && !practiceQna && (
                        <p className="text-xs text-slate-500">
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
                              <div key={qi} className="bg-slate-950/40 border border-slate-900 rounded-lg p-3 flex items-start justify-between gap-3">
                                <p className="text-xs text-slate-400 leading-relaxed flex-1">{q.question_text}</p>
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
        <div className="glass-panel p-6 md:p-8 space-y-4">
          <h3 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <Target size={22} className="text-amber-400" />
            Full Q&amp;A Performance Log
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-800/60">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Question</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Section</th>
                  <th className="text-center px-4 py-3 font-bold uppercase tracking-wider">Comm.</th>
                  <th className="text-center px-4 py-3 font-bold uppercase tracking-wider">Tech.</th>
                </tr>
              </thead>
              <tbody>
                {qnas.map((q: any, idx: number) => {
                  let questionText = q.question_text;
                  if (q.is_technical === 2) {
                    try {
                      const parsed = JSON.parse(q.question_text);
                      questionText = `[Coding] ${parsed.title || 'Coding Challenge'}`;
                    } catch (e) {
                      questionText = q.question_text;
                    }
                  }
                  return (
                    <tr key={idx} className="border-b border-slate-900 hover:bg-slate-950/40 transition-colors">
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-slate-300 max-w-xs">
                        <p className="line-clamp-2" title={questionText}>{questionText}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          q.is_technical === 1 ? 'bg-red-500/10 text-red-400' :
                          q.is_technical === 2 ? 'bg-amber-500/10 text-amber-400' :
                          'bg-indigo-500/10 text-indigo-400'
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
