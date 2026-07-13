import React, { useState } from 'react';
import { Mail, MessageSquare, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setError('');

    try {
      await base44.integrations.Core.SendEmail({
        to: 'support@hack-quest.com',
        subject: `[HackQuest Contact] ${form.subject}`,
        body: `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`,
      });
      setStatus('success');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setStatus('error');
      setError('Failed to send message. Please email us directly at support@hack-quest.com');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10 py-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 mb-2">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-foreground">Contact Us</h1>
        <p className="text-muted-foreground text-lg">
          Have a question, idea, or bug report? We're happy to hear from you.
        </p>
      </div>

      {/* Contact form */}
      <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <MessageSquare className="w-5 h-5 text-primary" />
          Send us a message
        </div>

        {status === 'success' ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="w-12 h-12 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Message sent!</h3>
            <p className="text-muted-foreground text-sm">Thanks for reaching out. We'll get back to you as soon as possible.</p>
            <Button variant="outline" className="mt-2" onClick={() => setStatus('idle')}>
              Send another message
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Your Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/40 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Email Address</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/40 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Subject</label>
              <input
                type="text"
                name="subject"
                required
                value={form.subject}
                onChange={handleChange}
                placeholder="e.g. Bug report, Feature request, General question"
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/40 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Message</label>
              <textarea
                name="message"
                required
                value={form.message}
                onChange={handleChange}
                placeholder="Tell us what's on your mind..."
                rows={6}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/40 text-sm resize-none"
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button type="submit" disabled={status === 'sending'} className="w-full gap-2">
              {status === 'sending' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" /> Send Message</>
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Direct email */}
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Prefer email?</p>
          <a href="mailto:support@hack-quest.com" className="text-primary text-sm hover:underline">
            support@hack-quest.com
          </a>
        </div>
      </div>
    </div>
  );
}