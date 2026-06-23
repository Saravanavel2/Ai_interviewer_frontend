import React, { useState, useEffect, useRef } from 'react';
import { Square, Mic, Send, ArrowRight, Award, ShieldAlert, Sparkles, MessageSquare } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface InterviewSessionProps {
  token: string;
  sessionId: string;
  skills: string[];
  sections: Record<string, string>;
  role: string;
  company: string;
  onSessionComplete: () => void;
}

// Order of resume section examination: Technical Skills → Certifications → Projects → Internships → Education
const SECTION_ORDER = [
  'Technical Skills',
  'Certifications',
  'Projects',
  'Internships/Experience',
  'Education'
];


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

export const InterviewSession: React.FC<InterviewSessionProps> = ({
  token,
  sessionId,
  skills,
  sections,
  role,
  company,
  onSessionComplete
}) => {
  // Determine which sections are present in the parsed resume and follow the order
  const availableSections = SECTION_ORDER.filter(s => {
    // Check if section content is present in the resume
    const content = sections[s] || sections[s.replace('/', '_')];
    return content && content.trim().length > 10;
  });

  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [stage, setStage] = useState<'SECTION_INTRO' | 'QUESTIONS' | 'TECH_ROUND_INTRO' | 'TECH_ROUND'>('SECTION_INTRO');
  
  // Q&A State
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [apiLoading, setApiLoading] = useState(false);
  
  // Feedback view state
  const [lastFeedback, setLastFeedback] = useState<any>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Audio / Speech Recognition
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setUserAnswer(prev => prev + ' ' + finalTranscript);
        }
      };

      rec.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
        setIsRecording(false);
        if (e.error === 'network') {
          alert('Voice recognition failed due to a network connection timeout. Please type your answer directly.');
        } else if (e.error === 'not-allowed') {
          alert('Microphone access was blocked. Please permit microphone access in your browser settings or type your answer.');
        } else if (e.error === 'no-speech') {
          console.warn('Speech recognition: No speech detected.');
        } else {
          alert(`Voice input error: ${e.error || 'unknown'}. Please type your answer instead.`);
        }
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech-to-text is not supported in this browser. Please type your answer.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setUserAnswer('');
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  // Get current active section metadata
  const currentSectionName = availableSections[currentSectionIdx];
  const currentSectionContent = sections[currentSectionName] || '';

  // Step 1: Generate questions for the current section
  const handleStartSection = async () => {
    setApiLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/session/${sessionId}/generate-questions`, {
        section_name: currentSectionName,
        section_content: currentSectionContent
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setQuestions(response.data.questions || []);
      setCurrentQIdx(0);
      setStage('QUESTIONS');
      setShowFeedback(false);
      setLastFeedback(null);
    } catch (err) {
      console.error(err);
      alert('Failed to generate interview questions. Please check details and retry.');
    } finally {
      setApiLoading(false);
    }
  };

  // Step 2: Submit Answer & Fetch Score
  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) return;

    setApiLoading(true);
    const activeQuestion = questions[currentQIdx];

    try {
      const response = await axios.post(`${API_URL}/api/session/${sessionId}/answer`, {
        question_id: activeQuestion.id,
        answer_text: userAnswer
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setLastFeedback(response.data);
      setShowFeedback(true);
      setUserAnswer('');
    } catch (err) {
      console.error(err);
      alert('Error submitting your answer. Please try again.');
    } finally {
      setApiLoading(false);
    }
  };



  const handleNextQuestion = () => {
    setShowFeedback(false);
    setLastFeedback(null);
    
    // Proceed to the next question/stage
    if (currentQIdx < questions.length - 1) {
      setCurrentQIdx(prev => prev + 1);
    } else {
      // Current section completed! Check what to do next
      if (stage === 'QUESTIONS') {
        if (currentSectionIdx < availableSections.length - 1) {
          setCurrentSectionIdx(prev => prev + 1);
          setStage('SECTION_INTRO');
        } else {
          // Finished all resume sections! Proceed to Technical Round
          setStage('TECH_ROUND_INTRO');
        }
      } else if (stage === 'TECH_ROUND') {
        // Technical round completed! Final Session Completion
        onSessionComplete();
      }
    }
  };

  // Step 4: Generate Technical Round Questions
  const handleStartTechRound = async () => {
    setApiLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/session/${sessionId}/generate-technical-round`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setQuestions(response.data.questions || []);
      setCurrentQIdx(0);
      setStage('TECH_ROUND');
      setShowFeedback(false);
      setLastFeedback(null);
    } catch (err) {
      console.error(err);
      alert('Failed to generate technical round questions.');
    } finally {
      setApiLoading(false);
    }
  };



  // Progress computation
  const totalSteps = availableSections.length + 1; // resume sections + 1 technical
  const currentStepNum = stage === 'TECH_ROUND_INTRO' || stage === 'TECH_ROUND' 
    ? totalSteps
    : currentSectionIdx + 1;

  let progressPercent = ((currentStepNum - 1) / totalSteps) * 100;
  if ((stage === 'QUESTIONS' || stage === 'TECH_ROUND') && questions.length > 0) {
    const qProgress = currentQIdx / questions.length;
    progressPercent = ((currentStepNum - 1 + qProgress) / totalSteps) * 100;
  }

  return (
    <div className="max-w-4xl w-full mx-auto animate-slide-up flex flex-col space-y-6">
      {/* Header Info */}
      <div className="glass-panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-slate-100 shadow-sm">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-full">
            Interview Mode
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Preparing for {role} at {company}
          </h1>
        </div>
        
        {/* Progress Tracker */}
        <div className="w-full md:w-auto flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-400 font-medium">Progress</p>
            <p className="text-sm font-semibold text-slate-700 font-sans">
              Step {currentStepNum} of {totalSteps}
            </p>
          </div>
          <div className="w-32 bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-200">
            <div 
              className="bg-brand-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Sandbox Panel */}
      {stage === 'SECTION_INTRO' && (
        <div className="glass-panel p-8 flex flex-col space-y-6 border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-650 font-bold">
              {currentStepNum}
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Verify Resume Section</p>
              <h2 className="text-xl font-extrabold text-slate-900">{currentSectionName}</h2>
            </div>
          </div>

          <div className="bg-slate-5 border border-slate-200/60 rounded-xl p-6">
            <p className="text-xs text-slate-500 font-bold mb-2 uppercase tracking-wide">Extracted Content</p>
            <pre className="text-sm text-slate-700 font-sans whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto pr-2">
              {currentSectionContent}
            </pre>
          </div>

          <p className="text-sm text-slate-500 leading-relaxed font-normal">
            Let's verify this section. The AI will ask follow-up questions to probe technical depth, clarify project scale, and help you structure descriptions for <strong>{company}</strong>'s hiring bar.
          </p>

          <button 
            type="button" 
            onClick={handleStartSection} 
            disabled={apiLoading}
            className="glow-btn flex items-center justify-center gap-2 py-4"
          >
            {apiLoading ? 'Generating Questions...' : 'Start Section Interview'}
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {stage === 'QUESTIONS' && questions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Question & Answer Column */}
          <div className="lg:col-span-2 flex flex-col space-y-6">
            <div className="glass-panel p-8 flex flex-col space-y-6 relative overflow-hidden border-slate-100 shadow-sm">
              {/* Radial background flare */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-full">
                  {currentSectionName} — Q{currentQIdx + 1} of {questions.length}
                </span>
                {apiLoading && <span className="text-xs text-slate-400 animate-pulse">Processing response...</span>}
              </div>

              {/* Question Text */}
              <div className="space-y-3 bg-indigo-50/40 border border-indigo-100 rounded-xl p-5">
                <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare size={12} />
                  Interviewer Question
                </p>
                <p className="text-base font-semibold text-slate-800 leading-relaxed">
                  {cleanQuestionText(questions[currentQIdx]?.question_text || '')}
                </p>
              </div>

              {!showFeedback ? (
                /* Answer input */
                <div className="space-y-4">
                  <div className="relative">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Your Answer</p>
                    <textarea
                      rows={5}
                      className="glass-input w-full pr-12 resize-none"
                      placeholder="Type your response here or click the microphone to speak..."
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      disabled={apiLoading}
                    ></textarea>
                    
                    {/* Speech Record Button */}
                    <button
                      type="button"
                      onClick={toggleRecording}
                      disabled={apiLoading}
                      className={`absolute right-4 bottom-4 p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-850'}`}
                      title={isRecording ? 'Stop Recording' : 'Record Voice'}
                    >
                      {isRecording ? <Square size={16} /> : <Mic size={16} />}
                    </button>
                  </div>

                  {isRecording && (
                    <div className="flex items-center gap-2 text-xs text-red-500 animate-pulse font-semibold px-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                      Listening... Speak clearly. (The transcript will update live).
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmitAnswer}
                    disabled={apiLoading || !userAnswer.trim()}
                    className="glow-btn w-full py-3.5 flex items-center justify-center gap-2"
                  >
                    {apiLoading ? 'Submitting...' : 'Submit Answer'}
                    <Send size={16} />
                  </button>
                </div>
              ) : (
                /* Scores Display Only */
                <div className="space-y-6 pt-4 border-t border-slate-100 animate-fade-in">
                  <div className="flex items-center gap-2 text-brand-650">
                    <Sparkles size={16} />
                    <h4 className="text-sm font-bold uppercase tracking-wider">Evaluation Scores</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* Overall Score Card */}
                    <div className="md:col-span-2 glass-panel bg-brand-50 border border-brand-100 p-5 rounded-xl flex flex-col justify-center items-center text-center">
                      <p className="text-xs text-brand-600 font-bold uppercase tracking-wider">
                        Communication Score
                      </p>
                      <p className="text-5xl font-extrabold text-slate-800 mt-3">
                        {lastFeedback?.communication?.overall || 0}<span className="text-xl text-slate-400">/100</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        Clarity, structure & pacing
                      </p>
                    </div>

                    {/* Breakdown Progress Bars */}
                    <div className="md:col-span-3 bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                        Dimension Breakdown
                      </p>
                      
                      {/* Clarity */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600">Clarity</span>
                          <span className="text-brand-600 font-bold">{lastFeedback?.communication?.clarity || 0}/100</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-brand-500 h-full rounded-full transition-all duration-500" style={{ width: `${lastFeedback?.communication?.clarity || 0}%` }}></div>
                        </div>
                      </div>

                      {/* Structure */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600">Structure</span>
                          <span className="text-emerald-600 font-bold">{lastFeedback?.communication?.structure || 0}/100</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${lastFeedback?.communication?.structure || 0}%` }}></div>
                        </div>
                      </div>

                      {/* Confidence */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600">Confidence</span>
                          <span className="text-indigo-600 font-bold">{lastFeedback?.communication?.confidence || 0}/100</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${lastFeedback?.communication?.confidence || 0}%` }}></div>
                        </div>
                      </div>

                      {/* Conciseness */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600">Conciseness</span>
                          <span className="text-rose-600 font-bold">{lastFeedback?.communication?.conciseness || 0}/100</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${lastFeedback?.communication?.conciseness || 0}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="glow-btn w-full py-4 flex items-center justify-center gap-2"
                  >
                    {currentQIdx < questions.length - 1 ? 'Next Question' : 'Next Section Step'}
                    <ArrowRight size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section details Sidebar */}
          <div className="space-y-6">
            <div className="glass-panel p-6 flex flex-col space-y-4 border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Resume Fragment</h3>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl max-h-80 overflow-y-auto text-xs font-mono text-slate-600 whitespace-pre-wrap leading-relaxed">
                {currentSectionContent}
              </div>
            </div>

            <div className="glass-panel p-6 flex flex-col space-y-4 border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-indigo-600" />
                Scoring Rubric
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Answers are scored on clarity, structure, conciseness, and confidence — matched to <strong className="text-slate-700">{company}</strong>'s hiring bar (STAR format recommended).
              </p>
            </div>
          </div>
        </div>
      )}

      {stage === 'TECH_ROUND_INTRO' && (
        <div className="glass-panel p-8 text-center flex flex-col space-y-6 max-w-xl mx-auto border-slate-100 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-brand-5 border border-brand-100 flex items-center justify-center text-brand-650 mx-auto">
            <Award size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">Technical Interview Round</h2>
            <p className="text-sm text-slate-500 mt-2 font-normal leading-relaxed">
              Excellent job completing the resume review! Next, we'll run a technical interview round. The AI will generate 3-5 questions testing tech stack fundamentals, architecture, and problem scenarios tailored to <strong>{role}</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartTechRound}
            disabled={apiLoading}
            className="glow-btn py-4 flex items-center justify-center gap-2"
          >
            {apiLoading ? 'Generating Tech Questions...' : 'Start Technical Round'}
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {stage === 'TECH_ROUND' && questions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Question/Answer Box */}
          <div className="lg:col-span-2 flex flex-col space-y-6">
            <div className="glass-panel p-8 flex flex-col space-y-6 relative border-slate-100 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-600 uppercase tracking-wider bg-rose-5 border border-rose-100 px-2.5 py-1 rounded-full">
                    Technical Round
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Question {currentQIdx + 1} of {questions.length}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  Topic: {questions[currentQIdx]?.topic}
                </span>
              </div>

              {/* Question Text */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Technical Question:
                </p>
                <p className="text-lg font-semibold text-slate-700 leading-relaxed">
                  {cleanQuestionText(questions[currentQIdx]?.question_text || '')}
                </p>
              </div>

              {!showFeedback ? (
                /* Text/Voice Input */
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="relative">
                    <textarea
                      rows={5}
                      className="glass-input w-full pr-12 resize-none"
                      placeholder="Type your response here or click the microphone to speak..."
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      disabled={apiLoading}
                    ></textarea>
                    
                    <button
                      type="button"
                      onClick={toggleRecording}
                      disabled={apiLoading}
                      className={`absolute right-4 bottom-4 p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-850'}`}
                    >
                      {isRecording ? <Square size={16} /> : <Mic size={16} />}
                    </button>
                  </div>

                  {isRecording && (
                    <div className="flex items-center gap-2 text-xs text-red-500 animate-pulse font-semibold px-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                      Listening... Speak clearly.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmitAnswer}
                    disabled={apiLoading || !userAnswer.trim()}
                    className="glow-btn w-full py-3.5 flex items-center justify-center gap-2"
                  >
                    {apiLoading ? 'Submitting...' : 'Submit Technical Answer'}
                    <Send size={16} />
                  </button>
                </div>
              ) : (
                /* Technical Scores Display Only */
                <div className="space-y-6 pt-4 border-t border-slate-100 animate-fade-in">
                  <div className="flex items-center gap-2 text-brand-650">
                    <Sparkles size={16} />
                    <h4 className="text-sm font-bold uppercase tracking-wider">Technical Evaluation</h4>
                  </div>

                  {/* Primary Scores Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="glass-panel bg-brand-5 border border-brand-100 p-5 rounded-xl flex flex-col justify-center items-center text-center">
                      <p className="text-xs text-brand-600 font-bold uppercase tracking-wider">
                        Technical Correctness
                      </p>
                      <p className="text-4xl font-extrabold text-slate-850 mt-3">
                        {lastFeedback?.technical?.correctness_score || 0}/100
                      </p>
                    </div>

                    <div className="glass-panel bg-emerald-5 border border-emerald-100 p-5 rounded-xl flex flex-col justify-center items-center text-center">
                      <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">
                        Communication Score
                      </p>
                      <p className="text-4xl font-extrabold text-slate-850 mt-3">
                        {lastFeedback?.communication?.overall || 0}/100
                      </p>
                    </div>
                  </div>

                  {/* Dimension Breakdown */}
                  <div className="glass-panel bg-slate-5 border border-slate-150 p-5 rounded-xl space-y-4">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                      Communication Breakdown
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Clarity */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600">Clarity</span>
                          <span className="text-brand-600 font-bold">{lastFeedback?.communication?.clarity || 0}/100</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div className="bg-brand-500 h-full rounded-full transition-all duration-500" style={{ width: `${lastFeedback?.communication?.clarity || 0}%` }}></div>
                        </div>
                      </div>

                      {/* Structure */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600">Structure</span>
                          <span className="text-emerald-600 font-bold">{lastFeedback?.communication?.structure || 0}/100</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${lastFeedback?.communication?.structure || 0}%` }}></div>
                        </div>
                      </div>

                      {/* Confidence */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600">Confidence</span>
                          <span className="text-indigo-600 font-bold">{lastFeedback?.communication?.confidence || 0}/100</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${lastFeedback?.communication?.confidence || 0}%` }}></div>
                        </div>
                      </div>

                      {/* Conciseness */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600">Conciseness</span>
                          <span className="text-rose-600 font-bold">{lastFeedback?.communication?.conciseness || 0}/100</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${lastFeedback?.communication?.conciseness || 0}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="glow-btn w-full py-4 flex items-center justify-center gap-2"
                  >
                    {currentQIdx < questions.length - 1 ? 'Next Question' : 'View Session Report'}
                    <ArrowRight size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Technical Info Sidebar */}
          <div className="space-y-6">
            <div className="glass-panel p-6 flex flex-col space-y-4 border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-850 text-md">Role Core Skills</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                This round tests technical mastery. Questions are derived from your skills:
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {skills.slice(0, 10).map(s => (
                  <span key={s} className="bg-slate-50 border border-slate-200/80 text-slate-600 text-xs px-2.5 py-1 rounded-md font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};
