import { useState } from 'react';
import { Onboarding } from './components/Onboarding';
import { ResumeUpload } from './components/ResumeUpload';
import { ATSScoreView } from './components/ATSScoreView';
import { InterviewSession } from './components/InterviewSession';
import { FinalReport } from './components/FinalReport';
import { LandingPage } from './components/LandingPage';
import { GraduationCap } from 'lucide-react';
import axios from 'axios';

type Step = 'LANDING' | 'ONBOARDING' | 'UPLOAD' | 'ATS_CHECK' | 'SESSION' | 'REPORT';

interface UserData {
  name: string;
  target_role: string;
  target_company: string;
  api_key: string;
}

interface ResumeData {
  resumeId: string;
  skills: string[];
  sections: Record<string, string>;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [step, setStep] = useState<Step>('LANDING');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [token, setToken] = useState<string>('');
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleOnboardingComplete = async (data: UserData) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/onboard`, data);
      setToken(response.data.token);
      setUserData(data);
      setStep('UPLOAD');
    } catch (err) {
      console.error(err);
      alert(`Onboarding failed. Please ensure the backend server is running.`);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (data: ResumeData) => {
    setResumeData(data);
    setStep('ATS_CHECK');
  };

  const handleProceedToInterview = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/session/start`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      setSessionId(response.data.sessionId);
      setStep('SESSION');
    } catch (err) {
      console.error(err);
      alert('Failed to initialize mock session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setStep('LANDING');
    setUserData(null);
    setToken('');
    setResumeData(null);
    setSessionId('');
  };

  // Landing page has its own full-screen layout
  if (step === 'LANDING') {
    return <LandingPage onGetStarted={() => setStep('ONBOARDING')} />;
  }

  return (
    <div className="bg-glow-radial min-h-screen text-slate-800 flex flex-col justify-between selection:bg-brand-500/10 selection:text-brand-700">
      {/* Navbar */}
      <header className="border-b border-slate-100 bg-white/75 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={handleRestart}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="bg-gradient-to-tr from-brand-600 to-indigo-500 p-2 rounded-xl text-white shadow-lg shadow-brand-500/20">
              <GraduationCap size={22} />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900 flex items-center gap-1">
                PrepMate <span className="text-brand-500">AI</span>
              </span>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Interview sandbox</p>
            </div>
          </button>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            {userData && (
              <div className="bg-slate-100/60 border border-slate-200/80 px-3 py-1.5 rounded-lg flex items-center gap-2 text-slate-700">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                <span>{userData.target_role} @ {userData.target_company}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-12 flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-brand-500 animate-spin"></div>
            <p className="text-slate-500 text-sm animate-pulse">Initializing connection...</p>
          </div>
        ) : (
          <>
            {step === 'ONBOARDING' && (
              <Onboarding onComplete={handleOnboardingComplete} />
            )}
            {step === 'UPLOAD' && token && userData && (
              <ResumeUpload 
                token={token} 
                role={userData.target_role}
                company={userData.target_company}
                onUploadSuccess={handleUploadSuccess} 
                onBack={handleRestart}
              />
            )}
            {step === 'ATS_CHECK' && resumeData && userData && (
              <ATSScoreView
                token={token}
                resumeId={resumeData.resumeId}
                role={userData.target_role}
                company={userData.target_company}
                onProceed={handleProceedToInterview}
              />
            )}
            {step === 'SESSION' && resumeData && userData && (
              <InterviewSession
                token={token}
                sessionId={sessionId}
                skills={resumeData.skills}
                sections={resumeData.sections}
                role={userData.target_role}
                company={userData.target_company}
                onSessionComplete={() => setStep('REPORT')}
              />
            )}
            {step === 'REPORT' && userData && (
              <FinalReport
                token={token}
                sessionId={sessionId}
                role={userData.target_role}
                company={userData.target_company}
                onRestart={handleRestart}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white/40 py-6 text-center text-xs text-slate-500">
        <p>© 2026 PrepMate AI. Highly Tailored Mock Interview Simulator. Built with React + Node.js + Gemini.</p>
      </footer>
    </div>
  );
}

export default App;
