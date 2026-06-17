import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_URL = 'https://ai-interviewer-backend-lk0k.onrender.com';

interface ResumeUploadProps {
  token: string;
  role: string;
  company: string;
  onUploadSuccess: (data: {
    resumeId: string;
    skills: string[];
    sections: Record<string, string>;
  }) => void;
  onBack: () => void;
}

export const ResumeUpload: React.FC<ResumeUploadProps> = ({ token, role, company, onUploadSuccess, onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    
    if (validTypes.includes(selectedFile.type) || 
        selectedFile.name.endsWith('.pdf') || 
        selectedFile.name.endsWith('.docx') || 
        selectedFile.name.endsWith('.doc')) {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please upload a valid PDF or Word document (.docx/.doc).');
      setFile(null);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError('');
    setStatusText('Uploading resume file...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Step 1: Upload and parse
      setStatusText('Extracting raw text contents...');
      setTimeout(() => setStatusText('Structuring sections using LLM classifier...'), 1800);
      setTimeout(() => setStatusText('Matching key technical skills...'), 3800);

      const response = await axios.post(`${API_URL}/api/resume/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setStatusText('Resume parsed successfully!');
      setTimeout(() => {
        onUploadSuccess(response.data);
      }, 800);

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.response?.data?.details || 'Failed to upload and parse resume. Please ensure the API key is correct.');
      setLoading(false);
      setStatusText('');
    }
  };

  const handleUseDemo = () => {
    setLoading(true);
    setStatusText('Loading sample resume data...');
    
    // Dynamic mock generator based on role and company
    const rClean = role.toLowerCase();
    let sampleSkills = ['Python', 'JavaScript', 'React', 'Node.js', 'Express', 'FastAPI', 'PostgreSQL', 'Docker', 'Git'];
    let sampleSummary = `Passionate Full Stack Developer with 3+ years experience building scalable web applications matching ${company}'s standards.`;
    let sampleProjects = `Built PrepMate AI, an interactive mock interview sandbox that maps candidate transcripts, outputs communication pacing scores, and optimizes resume formatting. Successfully designed caching pipelines that scaled system capacity to handle 10,000 concurrent user sessions.`;
    let sampleExperience = `Software Engineering Intern at TechCorp. Redesigned backend REST API endpoints using Node.js and Express, improving query performance by 40% and deploying microservice pipelines to AWS.`;
    let sampleCerts = `AWS Certified Solutions Architect Associate (2025)`;
    
    if (rClean.includes('data') || rClean.includes('analyst')) {
      sampleSkills = ['SQL', 'Python', 'Pandas', 'NumPy', 'Tableau', 'PowerBI', 'Excel', 'R', 'Git', 'Stats'];
      sampleSummary = `Data Analyst with 3+ years experience turning raw transactional records into actionable insights for ${company}'s database objectives.`;
      sampleProjects = `Designed an automated ETL ingestion pipeline for user acquisition records, integrating Postgres with Tableau to query retention indexes and decreasing dashboard load times by 30%.`;
      sampleExperience = `Data Analytics Intern at RetailCorp. Cleaned and structured transactional records using Pandas/NumPy, identifying inventory bottlenecks that saved $25k in overhead.`;
      sampleCerts = `Google Advanced Data Analytics Professional Certificate (2025)`;
    } else if (rClean.includes('product') || rClean.includes('manager')) {
      sampleSkills = ['Agile', 'Jira', 'Product Roadmap', 'SQL', 'A/B Testing', 'User Research', 'Figma', 'Metrics'];
      sampleSummary = `Product Manager with experience steering cross-functional engineering teams, mapping product roadmaps, and optimizing conversion funnels for ${company}.`;
      sampleProjects = `Led redesign of core mobile onboarding flow, executing A/B tests on checkout parameters that successfully decreased drop-off rate by 15%.`;
      sampleExperience = `Associate Product Manager Intern at SaaSify. Documented user requirement specifications, built mock prototypes in Figma, and mapped user metrics dashboards.`;
      sampleCerts = `Certified Scrum Product Owner (CSPO, 2025)`;
    } else if (rClean.includes('frontend') || rClean.includes('design') || rClean.includes('ui')) {
      sampleSkills = ['React', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Tailwind', 'Next.js', 'Redux', 'Webpack', 'Git'];
      sampleSummary = `Frontend Developer with 3+ years experience building highly interactive user interfaces for ${company}'s frontend client environments.`;
      sampleProjects = `Designed modular React component libraries using TypeScript and Tailwind CSS, increasing team developer velocity and standardizing application aesthetic systems.`;
      sampleExperience = `Frontend Intern at WebStudio. Refactored context render cycles and dynamic viewport queries, improving web page accessibility indexes by 25%.`;
      sampleCerts = `Meta Front-End Developer Professional Certificate (2025)`;
    }
    
    setTimeout(() => {
      onUploadSuccess({
        resumeId: 'demo-resume-id',
        skills: sampleSkills,
        sections: {
          'Summary': sampleSummary,
          'Technical Skills': sampleSkills.join(', '),
          'Certifications': sampleCerts,
          'Projects': sampleProjects,
          'Internships/Experience': sampleExperience,
          'Education': 'B.S. in Computer Science, University of Technology, GPA: 3.8/4.0'
        }
      });
    }, 1200);
  };

  return (
    <div className="max-w-xl w-full mx-auto animate-slide-up">
      <div className="glass-panel p-8 border border-slate-800/80 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-white mb-2">
          Upload Your Resume
        </h2>
        <p className="text-sm text-slate-400 mb-8 max-w-sm mx-auto">
          We support PDF and DOCX formats. Our LLM parses your experience to curate section-specific follow-ups.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-left">
            {error}
          </div>
        )}

        {!loading ? (
          <div className="space-y-6">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              className="border-2 border-dashed border-slate-800 hover:border-brand-500/50 bg-slate-950/20 rounded-2xl p-10 cursor-pointer transition-all duration-200 group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.docx,.doc"
                className="hidden"
              />
              
              <div className="flex flex-col items-center justify-center">
                <UploadCloud size={48} className="text-slate-500 group-hover:text-brand-500 transition-colors mb-4" />
                {file ? (
                  <div className="flex items-center gap-2 text-brand-400 font-medium">
                    <FileText size={18} />
                    <span className="truncate max-w-xs">{file.name}</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-300">
                      Drag & drop your file here, or <span className="text-brand-500 group-hover:underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      PDF, DOCX up to 10MB
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-850 hover:bg-slate-900/60 font-semibold text-sm transition-all active:scale-95"
                >
                  Back to Settings
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!file}
                  className={`flex-1 glow-btn font-semibold text-sm ${!file ? 'opacity-50 cursor-not-allowed hover:bg-brand-600 hover:shadow-none active:scale-100' : ''}`}
                >
                  Upload & Process
                </button>
              </div>
              
              <div className="pt-2 border-t border-slate-900">
                <button
                  type="button"
                  onClick={handleUseDemo}
                  className="text-xs text-brand-500 hover:text-brand-400 hover:underline font-semibold"
                >
                  Or, skip upload and use a sample resume for testing
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-slate-850 border-t-brand-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <RefreshCw size={20} className="text-brand-500 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-slate-300 font-medium text-lg animate-pulse">{statusText}</p>
              <p className="text-xs text-slate-500">This might take a few seconds as LLM parses the details.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
