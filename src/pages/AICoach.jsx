import React, { useState, useRef, useEffect } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ProGate from '@/components/common/ProGate';
import OnboardingPrompt from '@/components/onboarding/OnboardingPrompt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/tspFunds';
import { useProStatus } from '@/lib/proGating';
import { getAccountBalance } from '@/lib/accountBalance';

const SUGGESTED = [
  'Am I on track for retirement?',
  'Should I change my allocation?',
  'What if the market drops 20%?',
  'Traditional vs Roth TSP?',
  'When can I retire comfortably?',
  'How much will I have at retirement?',
];

export default function AICoach() {
  const { activeProfile } = useProfile();
  const { isPro } = useProStatus();
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your AI Retirement Coach. I have access to your TSP data and can answer personalized questions about your retirement planning. What would you like to know?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const { data: funds = [] } = useQuery({
    queryKey: ['fund-allocations', activeProfile?.id],
    queryFn: () => base44.entities.FundAllocation.filter({ profile_id: activeProfile.id }),
    enabled: !!activeProfile?.id && isPro,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeProfile) return <OnboardingPrompt />;

  const totalBalance = getAccountBalance(activeProfile, funds);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const profile = activeProfile;
    const today = new Date();
    const retirementAge = 62;
    const birthYear = profile.date_of_birth ? new Date(profile.date_of_birth).getFullYear() : null;
    const currentAge = birthYear ? today.getFullYear() - birthYear : null;
    const yearsToRetirement = currentAge ? retirementAge - currentAge : null;

    const context = `
User's TSP Data:
- Profile: ${profile.name}
- Current Balance: ${formatCurrency(totalBalance)}
- Balance Goal: ${formatCurrency(profile.balance_goal || 1000000)}
- Opening Balance (this year): ${formatCurrency(profile.opening_balance || 0)}
- Annual Salary: ${formatCurrency(profile.current_annual_salary || 0)}
- Retirement System: ${profile.retirement_system || 'FERS'}
- Date of Birth: ${profile.date_of_birth || 'Not set'}
- Current Age: ${currentAge ? `${currentAge} years old` : 'Unknown'}
- Years to Retirement (at 62): ${yearsToRetirement ? `~${yearsToRetirement} years` : 'Unknown'}
- Career Start: ${profile.career_start_date || 'Not set'}
- Traditional Contributions (YTD): ${formatCurrency(profile.traditional_contributions || 0)}
- Roth Contributions (YTD): ${formatCurrency(profile.roth_contributions || 0)}
- Agency Match (YTD): ${formatCurrency(profile.agency_match || 0)}
- Selected Funds: ${funds.filter(f => f.is_selected).map(f => `${f.fund_name} (${f.allocation_percent}%)`).join(', ') || 'None set'}
- Goal Method: ${profile.goal_method || 'trailing'}
- Fixed Annual Return: ${profile.fixed_annual_return || 7}%
`;

    const prompt = `You are a knowledgeable TSP (Thrift Savings Plan) retirement coach for federal employees. 
You have access to the user's real TSP data below. Provide personalized, practical advice in plain English. 
Keep responses concise (2-4 sentences unless a detailed answer is needed). Be encouraging but honest.
Always end with: "⚠️ This is not financial advice. Consult a financial advisor for personalized guidance."

${context}

User question: ${text}`;

    const response = await base44.integrations.Core.InvokeLLM({ prompt });
    setMessages(prev => [...prev, { role: 'assistant', text: response }]);
    setLoading(false);
  };

  if (!isPro) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">AI Retirement Coach</h2>
        </div>
        <ProGate feature="ai_coach" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2 border-b border-border">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-bold">AI Retirement Coach</h2>
          <p className="text-xs text-muted-foreground">Personalized TSP guidance</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-xs text-primary font-semibold">PRO</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-card border border-border rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-card border border-border px-3 py-2 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {SUGGESTED.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="flex-shrink-0 text-xs bg-card border border-border rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask about your retirement..."
            className="flex-1"
          />
          <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim() || loading}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}