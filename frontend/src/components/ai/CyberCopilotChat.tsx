import React, { useState, useRef, useEffect } from 'react';
import { aiApi, AIResponse } from '@/api/ai';

interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
  status?: 'success' | 'blocked' | 'failed' | 'disabled';
  review_status?: 'ai_draft' | 'officer_approved';
  audit_log_id?: string;
}

export const CyberCopilotChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'copilot',
      text: 'Greetings. I am the CCID Cyber Copilot. I can guide you through cyber security incidents (like a hacked phone or financial fraud), as well as answer questions about digital forensics or your CCID dashboard.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      review_status: 'officer_approved'
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userText = question.trim();
    setQuestion('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentHistory = messages
      .filter((m) => m.id !== 'welcome-1')
      .map((m) => ({
        role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text
      }));

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res: AIResponse = await aiApi.askCopilot({
        question: userText,
        data_classification: 'synthetic',
        history: currentHistory
      });

      setMessages((prev) => [...prev, {
        id: `copilot-${Date.now()}`,
        sender: 'copilot',
        text: res.success ? (res.answer || 'No response generated.') : (res.answer || res.error_message || 'AI features not yet enabled for this deployment.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: res.status,
        review_status: res.success ? 'ai_draft' : undefined,
        audit_log_id: res.audit_log_id
      }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        id: `copilot-err-${Date.now()}`,
        sender: 'copilot',
        text: `[Service Notice] ${err.response?.data?.detail || err.message || 'AI features not yet enabled for this deployment.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'failed'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMessage = (index: number) => {
    const msgToEdit = messages[index];
    if (!msgToEdit || msgToEdit.sender !== 'user') return;
    setQuestion(msgToEdit.text);
    setMessages(messages.slice(0, index));
  };

  const handleApproveDraft = async (msgId: string, auditLogId?: string) => {
    if (!auditLogId) {
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, review_status: 'officer_approved' } : m));
      return;
    }
    try {
      await aiApi.approveDraft(auditLogId);
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, review_status: 'officer_approved' } : m));
    } catch (err) {
      console.error('Failed to approve draft:', err);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
      {!isOpen && (
        <button type="button" onClick={() => setIsOpen(true)} style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: '#ffffff', border: 'none', borderRadius: '50px', padding: '14px 22px', fontWeight: 600, fontSize: '14px', boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🤖</span>
          <span>Cyber Copilot</span>
        </button>
      )}

      {isOpen && (
        <div style={{ width: '400px', height: '560px', background: '#0f172a', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '14px 18px', background: 'rgba(30, 41, 59, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #3b82f6', fontSize: '16px' }}>🤖</div>
              <div>
                <h6 style={{ margin: 0, color: '#f8fafc', fontSize: '14px', fontWeight: 600 }}>Cyber Copilot AI</h6>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Law Enforcement Assistance</span>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg, index) => (
              <div key={msg.id} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{ padding: '10px 14px', borderRadius: '12px', fontSize: '13px', lineHeight: '1.4', background: msg.sender === 'user' ? '#2563eb' : (msg.status === 'blocked' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(30, 41, 59, 0.9)'), color: msg.sender === 'user' ? '#ffffff' : '#e2e8f0', border: msg.sender === 'copilot' ? (msg.status === 'blocked' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)') : 'none' }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.text}</p>

                  {/* Human-in-the-Loop Verification Block */}
                  {msg.sender === 'copilot' && (msg.text.toLowerCase().includes('freeze') || msg.text.toLowerCase().includes('section 91') || msg.text.toLowerCase().includes('trace') || msg.text.toLowerCase().includes('dispatch')) && (
                    <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5', fontWeight: 600, fontSize: '11px', marginBottom: '8px' }}>
                        ⚠️ Officer Sign-off Required
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '8px', lineHeight: 1.4 }}>
                        AI has suggested a high-risk action. You must manually authorize this before it can be executed on the CCID platform.
                      </div>
                      {msg.review_status === 'officer_approved' ? (
                        <button disabled style={{ width: '100%', padding: '6px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                          ✓ Authorized & Logged
                        </button>
                      ) : (
                        <button onClick={() => handleApproveDraft(msg.id)} style={{ width: '100%', padding: '6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                          Authorize & Log Action
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start', gap: '8px' }}>
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'user' && (
                    <button type="button" onClick={() => handleEditMessage(index)} title="Edit & re-send" style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', padding: '0 2px' }}>✏️ Edit</button>
                  )}
                </div>
              </div>
            ))}
            {loading && <div style={{ alignSelf: 'flex-start', color: '#94a3b8', fontSize: '12px' }}>Thinking...</div>}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={{ padding: '12px', background: '#0f172a', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', gap: '8px' }}>
            <input type="text" placeholder="Ask Cyber Copilot..." value={question} onChange={(e) => setQuestion(e.target.value)} disabled={loading} style={{ flex: 1, padding: '10px 14px', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }} />
            <button type="submit" disabled={loading || !question.trim()} style={{ padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: (loading || !question.trim()) ? 'not-allowed' : 'pointer', opacity: (loading || !question.trim()) ? 0.6 : 1 }}>Send</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default CyberCopilotChat;
