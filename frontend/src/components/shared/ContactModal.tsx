import React, { useState, useEffect, useRef, useCallback } from 'react';
import contactApi, { type ContactTicket } from '@/api/contact';
import { useAuth } from '@/context/AuthContext';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormFields {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  general?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields: FormFields): FieldErrors {
  const errors: FieldErrors = {};
  if (!fields.name.trim()) {
    errors.name = 'Name is required.';
  } else if (fields.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters.';
  } else if (fields.name.trim().length > 80) {
    errors.name = 'Name must be 80 characters or fewer.';
  }

  if (!fields.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(fields.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!fields.subject.trim()) {
    errors.subject = 'Subject is required.';
  } else if (fields.subject.trim().length < 2) {
    errors.subject = 'Subject must be at least 2 characters.';
  } else if (fields.subject.trim().length > 120) {
    errors.subject = 'Subject must be 120 characters or fewer.';
  }

  if (!fields.message.trim()) {
    errors.message = 'Message is required.';
  } else if (fields.message.trim().length < 10) {
    errors.message = 'Message must be at least 10 characters.';
  } else if (fields.message.trim().length > 2000) {
    errors.message = 'Message must be 2000 characters or fewer.';
  }

  return errors;
}

const EMPTY_FIELDS: FormFields = { name: '', email: '', subject: '', message: '' };

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const { user, supabaseUser } = useAuth();
  const [fields, setFields] = useState<FormFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormFields, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<ContactTicket[]>([]);
  const [rateLimited, setRateLimited] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setTouched({});
      setSubmitting(false);
      setSubmitted(false);
      setTicketId(null);
      setRateLimited(false);
      setFields({
        name: user?.full_name || '',
        email: user?.email || supabaseUser?.email || '',
        subject: '',
        message: '',
      });
      setTimeout(() => firstInputRef.current?.focus(), 80);
      contactApi.list().then(setTickets).catch(() => setTickets([]));
    }
  }, [isOpen, user?.full_name, user?.email, supabaseUser?.email]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFields(prev => ({ ...prev, [name]: value }));
    if (touched[name as keyof FormFields]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [touched]);

  const handleBlur = useCallback((
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const fieldErrors = validate({ ...fields });
    setErrors(prev => ({ ...prev, [name]: fieldErrors[name as keyof FieldErrors] }));
  }, [fields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched = { name: true, email: true, subject: true, message: true };
    setTouched(allTouched);
    const validationErrors = validate(fields);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const data = await contactApi.submit({
        name: fields.name.trim(),
        email: fields.email.trim(),
        subject: fields.subject.trim(),
        message: fields.message.trim(),
      });
      setTicketId(data.submission_id || null);
      setSubmitted(true);
      contactApi.list().then(setTickets).catch(() => undefined);
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: { detail?: unknown; message?: string } };
        message?: string;
      };
      if (ax.response?.status === 429) {
        setRateLimited(true);
        setErrors({ general: 'Too many submissions. Please wait a minute before trying again.' });
        return;
      }
      const detail = ax.response?.data?.detail;
      let text = 'Could not send the message. Confirm the API is running.';
      if (typeof detail === 'string') text = detail;
      else if (Array.isArray(detail)) {
        text = detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(' ') || text;
      } else if (ax.response?.data?.message) {
        text = ax.response.data.message;
      } else if (ax.message) {
        text = ax.message;
      }
      setErrors({ general: text });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const errBorder = (key: keyof FormFields): React.CSSProperties | undefined =>
    (touched[key] && errors[key] ? { borderColor: 'var(--crit)' } : undefined);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 1040,
          background: 'rgba(6, 9, 18, 0.78)',
          backdropFilter: 'blur(8px)',
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        ref={modalRef}
        style={{
          position: 'fixed', inset: 0, zIndex: 1050,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          pointerEvents: 'none',
        }}
      >
        <div
          className="card"
          style={{
            width: '100%',
            maxWidth: 480,
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'all',
            margin: 0,
            boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          }}
        >
          <div
            className="card-header"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              padding: '16px 20px',
              flexShrink: 0,
            }}
          >
            <div>
              <h2 id="contact-modal-title" className="card-title" style={{ margin: 0 }}>
                Contact &amp; Support
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--txt-secondary)', fontWeight: 400 }}>
                Officer help desk — we reply to this inbox as soon as we can.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              aria-label="Close contact form"
              style={{ padding: '6px 10px' }}
            >
              ✕
            </button>
          </div>

          <div className="card-body" style={{ overflowY: 'auto', flexGrow: 1, padding: 20 }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '28px 8px' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 8, margin: '0 auto 16px',
                  background: 'var(--ok-dim)', border: '1px solid rgba(34,211,238,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ok)', fontSize: 20, fontWeight: 700,
                }}>
                  ✓
                </div>
                <h3 style={{ color: 'var(--txt-heading)', fontSize: 16, fontWeight: 650, margin: '0 0 8px' }}>
                  Message received
                </h3>
                <p style={{ color: 'var(--txt-secondary)', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>
                  Your note is in the support queue. An officer will reply to the email you entered.
                </p>
                {ticketId && (
                  <p style={{ fontSize: 12, color: 'var(--txt-muted)', margin: '0 0 20px', fontFamily: 'var(--font-mono)' }}>
                    Ticket {ticketId.slice(0, 8)}
                  </p>
                )}
                <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
              </div>
            ) : (
              <form id="contact-form" onSubmit={handleSubmit} noValidate>
                {errors.general && (
                  <div style={{
                    background: rateLimited ? 'var(--warn-dim)' : 'var(--crit-dim)',
                    border: `1px solid ${rateLimited ? 'rgba(245,158,11,0.35)' : 'rgba(244,63,94,0.35)'}`,
                    borderRadius: 8, padding: '10px 12px', marginBottom: 16,
                    fontSize: 13, color: rateLimited ? 'var(--warn)' : 'var(--crit)',
                  }}>
                    {errors.general}
                  </div>
                )}

                <Field id="contact-name" label="Full name" required error={touched.name ? errors.name : undefined}>
                  <input
                    ref={firstInputRef}
                    id="contact-name"
                    name="name"
                    type="text"
                    className="form-control"
                    autoComplete="name"
                    placeholder="Officer name"
                    value={fields.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    maxLength={80}
                    style={errBorder('name')}
                  />
                </Field>

                <Field id="contact-email" label="Email address" required error={touched.email ? errors.email : undefined}>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    className="form-control"
                    autoComplete="email"
                    placeholder="name@agency.gov"
                    value={fields.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    style={errBorder('email')}
                  />
                </Field>

                <Field id="contact-subject" label="Subject" required error={touched.subject ? errors.subject : undefined}>
                  <input
                    id="contact-subject"
                    name="subject"
                    type="text"
                    className="form-control"
                    placeholder="Bug report, access issue, or general enquiry"
                    value={fields.subject}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    maxLength={120}
                    style={errBorder('subject')}
                  />
                </Field>

                <Field
                  id="contact-message"
                  label="Message"
                  required
                  error={touched.message ? errors.message : undefined}
                  hint={`${fields.message.length}/2000`}
                >
                  <textarea
                    id="contact-message"
                    name="message"
                    className="form-control"
                    rows={5}
                    placeholder="Describe the issue, FIR number if relevant, and what you already tried."
                    value={fields.message}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    maxLength={2000}
                    style={{ resize: 'none', minHeight: 110, ...errBorder('message') }}
                  />
                </Field>

                {tickets.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border-1)' }}>
                    <div className="form-label" style={{ marginBottom: 8 }}>Recent tickets</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 140, overflowY: 'auto' }}>
                      {tickets.slice(0, 5).map((t) => (
                        <div key={t.id} style={{ fontSize: 12, color: 'var(--txt-secondary)' }}>
                          <span style={{ color: 'var(--txt-heading)' }}>{t.subject}</span>
                          {' · '}
                          {t.email}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>

          {!submitted && (
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexShrink: 0,
              background: 'rgba(8, 13, 22, 0.45)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--txt-muted)', lineHeight: 1.4 }}>
                Sent to the CCID support inbox. Not shared outside this platform.
              </span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" form="contact-form" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({
  id, label, required, error, hint, children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <label htmlFor={id} className="form-label" style={{ marginBottom: 0 }}>
          {label}
          {required && <span style={{ color: 'var(--crit)', marginLeft: 4 }} aria-hidden="true">*</span>}
        </label>
        {hint && (
          <span style={{ fontSize: 11, color: 'var(--txt-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p role="alert" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--crit)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
