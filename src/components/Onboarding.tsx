import React, { useState } from 'react';
import { Briefcase, Building, User, ArrowRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: (data: {
    name: string;
    target_role: string;
    target_company: string;
    api_key: string;
  }) => void;
}

const ROLES = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Fullstack Developer',
  'Data Analyst',
  'Data Scientist',
  'Product Manager',
  'DevOps Engineer'
];

const COMPANIES = [
  'Google',
  'Meta',
  'Amazon',
  'Microsoft',
  'Netflix',
  'TCS',
  'Infosys',
  'Start-up (General)',
  'Early Stage SaaS'
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [company, setCompany] = useState('');
  const [customCompany, setCustomCompany] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRole = role === 'Other' ? customRole : role;
    const finalCompany = company === 'Other' ? customCompany : company;

    if (!finalRole) {
      setError('Please select or specify a target role.');
      return;
    }
    if (!finalCompany) {
      setError('Please select or specify a target company.');
      return;
    }

    setError('');
    onComplete({
      name: name.trim() || 'Candidate',
      target_role: finalRole,
      target_company: finalCompany,
      api_key: ''
    });
  };

  return (
    <div className="max-w-xl w-full mx-auto animate-slide-up">
      <div className="glass-panel p-8 md:p-10 border border-slate-100">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Let's Customize Your Prep
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Tell us about your target role and company. We'll tailor the entire mock interview to their specific hiring bar.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <User size={16} className="text-brand-500" />
              Full Name (Optional)
            </label>
            <input
              type="text"
              className="glass-input w-full"
              placeholder="e.g. Alex Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Target Role */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Briefcase size={16} className="text-brand-500" />
              Target Role
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                className="glass-input w-full bg-white text-slate-800"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  if (e.target.value !== 'Other') setCustomRole('');
                }}
                required
              >
                <option value="">Select Role...</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value="Other">Other (Type custom...)</option>
              </select>

              {role === 'Other' && (
                <input
                  type="text"
                  className="glass-input w-full"
                  placeholder="Type custom role..."
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  required
                />
              )}
            </div>
          </div>

          {/* Target Company */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Building size={16} className="text-brand-500" />
              Target Company
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                className="glass-input w-full bg-white text-slate-800"
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  if (e.target.value !== 'Other') setCustomCompany('');
                }}
                required
              >
                <option value="">Select Company...</option>
                {COMPANIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="Other">Other (Type custom...)</option>
              </select>

              {company === 'Other' && (
                <input
                  type="text"
                  className="glass-input w-full"
                  placeholder="Type custom company..."
                  value={customCompany}
                  onChange={(e) => setCustomCompany(e.target.value)}
                  required
                />
              )}
            </div>
          </div>

          <button type="submit" className="glow-btn w-full mt-4 flex items-center justify-center gap-2 py-4">
            Proceed to Resume Upload
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
