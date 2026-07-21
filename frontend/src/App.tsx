import { useState } from "react";
import { generateReply } from "./services/api";
import type { ReplyData } from "./services/api";

type Screen = "form" | "loading" | "preview" | "error";
type Tone = "professional" | "friendly" | "empathetic" | "concise";

interface FormData {
  subject: string;
  sender: string;
  senderName: string;
  body: string;
  tone: Tone;
}

interface DraftReply {
  subject: string;
  body: string;
  confidence: number;
  tags: string[];
}

const TONE_OPTIONS: {
  value: Tone;
  label: string;
  desc: string;
}[] = [
  {
    value: "professional",
    label: "Professional",
    desc: "Formal and authoritative",
  },
  {
    value: "friendly",
    label: "Friendly",
    desc: "Warm and approachable",
  },
  {
    value: "empathetic",
    label: "Empathetic",
    desc: "Caring and understanding",
  },
  {
    value: "concise",
    label: "Concise",
    desc: "Brief and to the point",
  },
];

function ConfidenceMeter({ score }: { score: number }) {
  const color =
    score >= 85
      ? "#16a34a"
      : score >= 65
        ? "#d97706"
        : "#dc2626";
  const bg =
    score >= 85
      ? "#dcfce7"
      : score >= 65
        ? "#fef3c7"
        : "#fee2e2";
  const label =
    score >= 85
      ? "High confidence"
      : score >= 65
        ? "Medium confidence"
        : "Low confidence";

  return (
    <div
      style={{
        background: bg,
        borderRadius: 8,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 44,
          height: 44,
          flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 44 44" width="44" height="44">
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="4"
          />
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={`${(score / 100) * 113} 113`}
            strokeLinecap="round"
            transform="rotate(-90 22 22)"
          />
        </svg>
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color,
          }}
        >
          {score}%
        </span>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            marginTop: 1,
          }}
        >
          AI confidence in this draft
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        border: "3px solid #dbeafe",
        borderTop: "3px solid #2563eb",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}

function FormScreen({
  onSubmit,
  onError,
}: {
  onSubmit: (d: FormData) => void;
  onError: () => void;
}) {
  const [form, setForm] = useState<FormData>({
    subject: "",
    sender: "",
    senderName: "",
    body: "",
    tone: "professional",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormData, string>>
  >({});

  const validate = () => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.subject.trim()) e.subject = "Subject is required";
    if (!form.senderName.trim()) e.senderName = "Sender name is required";
    if (!form.sender.trim()) e.sender = "Sender email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.sender))
      e.sender = "Enter a valid email address";
    if (!form.body.trim()) e.body = "Email body is required";
    else if (form.body.trim().length < 20)
      e.body =
        "Provide at least 20 characters for better results";
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    onSubmit(form);
  };

  const field = (key: keyof FormData) => ({
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement
      >,
    ) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      if (errors[key])
        setErrors((prev) => {
          const n = { ...prev };
          delete n[key];
          return n;
        });
    },
  });

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <Field label="Sender Name" error={errors.senderName}>
          <input
            type="text"
            placeholder="John Doe"
            value={form.senderName}
            {...field("senderName")}
            style={inputStyle(!!errors.senderName)}
          />
        </Field>
        <Field label="Sender Email" error={errors.sender}>
          <input
            type="text"
            placeholder="sarah.chen@example.com"
            value={form.sender}
            {...field("sender")}
            style={inputStyle(!!errors.sender)}
          />
        </Field>
      </div>

      <Field label="Subject Line" error={errors.subject}>
        <input
          type="text"
          placeholder="Re: Issue with billing statement"
          value={form.subject}
          {...field("subject")}
          style={inputStyle(!!errors.subject)}
        />
      </Field>

      <Field label="Email Body" error={errors.body}>
        <textarea
          placeholder="Paste the customer's email here..."
          value={form.body}
          rows={7}
          {...field("body")}
          style={{
            ...inputStyle(!!errors.body),
            resize: "vertical",
            lineHeight: "1.6",
          }}
        />
      </Field>

      <Field label="Reply Tone">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
          }}
        >
          {TONE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, tone: opt.value }))
              }
              style={{
                padding: "10px 8px",
                borderRadius: 8,
                border:
                  form.tone === opt.value
                    ? "2px solid #2563eb"
                    : "2px solid #e5e7eb",
                background:
                  form.tone === opt.value ? "#eff6ff" : "#fff",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color:
                    form.tone === opt.value
                      ? "#1d4ed8"
                      : "#374151",
                }}
              >
                {opt.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                  marginTop: 2,
                }}
              >
                {opt.desc}
              </div>
            </button>
          ))}
        </div>
      </Field>

      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button type="submit" style={btnPrimary}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Generate Reply
        </button>
        <button
          type="button"
          onClick={onError}
          style={btnSecondary}
        >
          Test Error State
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <label
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </label>
      {children}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            color: "#dc2626",
            fontSize: 12,
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}

function PreviewScreen({
  draft,
  onBack,
  onCopy,
  onEscalate,
}: {
  draft: DraftReply;
  onBack: () => void;
  onCopy: () => void;
  onEscalate: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(draft.body).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <ConfidenceMeter score={draft.confidence} />

      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#6b7280",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Suggested Tags
        </div>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
        >
          {draft.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 20,
                background: "#dbeafe",
                color: "#1d4ed8",
                border: "1px solid #bfdbfe",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            background: "#f8fafc",
            borderBottom: "1px solid #e5e7eb",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Subject
            </span>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#111827",
                marginTop: 2,
              }}
            >
              {draft.subject}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Ready to send
            </span>
          </div>
        </div>
        <div
          style={{ padding: "16px 16px", background: "#fff" }}
        >
          <pre
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13.5,
              lineHeight: "1.75",
              color: "#1f2937",
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {draft.body}
          </pre>
        </div>
      </div>

      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <button onClick={handleCopy} style={btnPrimary}>
          {copied ? (
            <>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <rect
                  x="9"
                  y="9"
                  width="13"
                  height="13"
                  rx="2"
                />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy Draft
            </>
          )}
        </button>
        <button
          onClick={onEscalate}
          style={{
            ...btnSecondary,
            borderColor: "#fca5a5",
            color: "#dc2626",
            background: "#fff5f5",
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Escalate to Human
        </button>
        <button onClick={onBack} style={btnSecondary}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Edit Input
        </button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  const steps = [
    { label: "Analyzing email content", done: true },
    { label: "Detecting intent & sentiment", done: true },
    { label: "Generating reply draft", done: false },
    { label: "Scoring confidence", done: false },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 32,
        padding: "32px 0",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, #dbeafe, #eff6ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 12px #eff6ff",
          }}
        >
          <Spinner />
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          Generating your reply…
        </div>
        <div
          style={{
            fontSize: 14,
            color: "#6b7280",
            marginTop: 4,
          }}
        >
          Our AI is crafting a contextual response
        </div>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {steps.map((step, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                flexShrink: 0,
                background: step.done ? "#2563eb" : "#e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: step.done
                  ? "none"
                  : "2px dashed #d1d5db",
                transition: "all 0.3s",
              }}
            >
              {step.done && (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span
              style={{
                fontSize: 13,
                color: step.done ? "#1f2937" : "#9ca3af",
                fontWeight: step.done ? 500 : 400,
                transition: "all 0.3s",
              }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorScreen({
  onBack,
  errorMessage,
}: {
  onBack: () => void;
  errorMessage?: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div
        style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 10,
          padding: "16px 18px",
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#fee2e2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#991b1b",
            }}
          >
            Reply generation failed
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#b91c1c",
              marginTop: 3,
              lineHeight: "1.5",
            }}
          >
            {errorMessage ||
              "We could not generate a reply for this email. Please try again."}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Possible Issues
        </div>
        {[
          {
            field: "Backend Connection",
            message:
              "Make sure the backend server is running on http://localhost:8000",
          },
          {
            field: "Email Content",
            message:
              "Email body should be at least 20 characters with clear customer intent",
          },
          {
            field: "API Key",
            message:
              "Check that GEMINI_API_KEY is set in your .env file",
          },
        ].map((err, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "12px 14px",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f87171"
              strokeWidth="2.5"
              style={{ marginTop: 1, flexShrink: 0 }}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#374151",
                }}
              >
                {err.field}:{" "}
              </span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {err.message}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onBack} style={btnPrimary}>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back to Form
      </button>
    </div>
  );
}

const inputStyle = (
  hasError: boolean,
): React.CSSProperties => ({
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: `1.5px solid ${hasError ? "#fca5a5" : "#d1d5db"}`,
  background: hasError ? "#fff5f5" : "#fff",
  fontSize: 14,
  color: "#111827",
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
  boxSizing: "border-box",
  fontFamily: "Inter, sans-serif",
});

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "10px 18px",
  borderRadius: 8,
  background: "#2563eb",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
  transition: "background 0.15s",
  fontFamily: "Inter, sans-serif",
};

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "10px 18px",
  borderRadius: 8,
  background: "#fff",
  color: "#374151",
  fontSize: 14,
  fontWeight: 600,
  border: "1.5px solid #d1d5db",
  cursor: "pointer",
  transition: "all 0.15s",
  fontFamily: "Inter, sans-serif",
};

const SCREEN_META: Record<
  Screen,
  { title: string; subtitle: string; icon: React.ReactNode }
> = {
  form: {
    title: "New Reply Request",
    subtitle:
      "Paste the customer email and configure your preferences",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2563eb"
        strokeWidth="2"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 7l-10 7L2 7" />
      </svg>
    ),
  },
  loading: {
    title: "Processing Email",
    subtitle:
      "AI is analyzing context and generating a tailored response",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2563eb"
        strokeWidth="2"
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
  preview: {
    title: "Draft Ready",
    subtitle: "Review the AI-generated reply before sending",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2563eb"
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  error: {
    title: "Generation Failed",
    subtitle:
      "Review the validation issues below and adjust your input",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#dc2626"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
};

// Map knowledge base filenames to natural language tags
function mapContextToTags(contextUsed: string[]): string[] {
  const tagMap: Record<string, string> = {
    "reset_password": "Password Reset",
    "account_settings": "Account Settings",
    "general_inquiries": "General Inquiries",
    "privacy_policy": "Privacy Policy",
    "governance": "Governance & Compliance",
  };

  return contextUsed
    .map((filename) => {
      const key = filename.replace(".txt", "");
      return tagMap[key] || key;
    })
    .filter(Boolean);
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("form");
  const [draftData, setDraftData] = useState<ReplyData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (data: FormData) => {
    setScreen("loading");

    try {
      const response = await generateReply({
        email_subject: data.subject,
        email_body: data.body,
        sender: data.sender,
        sender_name: data.senderName,
        tone: data.tone,
        include_context: true,
        max_length: 150,
        language: "en",
      });

      if (response.status === "success" && response.data) {
        setDraftData(response.data);
        setScreen("preview");
      } else {
        setErrorMessage(response.message || "Something went wrong");
        setScreen("error");
      }
    } catch (err) {
      setErrorMessage(
        "Cannot connect to backend. Make sure the server is running on http://localhost:8000"
      );
      setScreen("error");
    }
  };

  const meta = SCREEN_META[screen];

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        button:hover { opacity: 0.88; }
        input:focus, textarea:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important; outline: none !important; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#f0f4f8",
          padding: "32px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background:
                  "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.2"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0f172a",
                  letterSpacing: "-0.01em",
                }}
              >
                SmartReply
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                  fontWeight: 500,
                }}
              >
                AI Helpdesk Assistant
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 0 3px #dcfce7",
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: "#6b7280",
                fontWeight: 500,
              }}
            >
              Model online
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            display: "flex",
            gap: 4,
            marginBottom: 20,
            background: "#e2e8f0",
            borderRadius: 10,
            padding: 4,
          }}
        >
          {(
            ["form", "loading", "preview", "error"] as Screen[]
          ).map((s) => (
            <button
              key={s}
              onClick={() => {
                if (s === "form") {
                  setScreen("form");
                  setDraftData(null);
                  setErrorMessage(null);
                }
              }}
              style={{
                flex: 1,
                padding: "7px 0",
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                background:
                  screen === s ? "#fff" : "transparent",
                color: screen === s ? "#1d4ed8" : "#6b7280",
                fontSize: 12,
                fontWeight: 600,
                boxShadow:
                  screen === s
                    ? "0 1px 4px rgba(0,0,0,0.08)"
                    : "none",
                transition: "all 0.18s",
                textTransform: "capitalize",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {s === "form"
                ? "Input"
                : s === "loading"
                  ? "Loading"
                  : s === "preview"
                    ? "Draft"
                    : "Error"}
            </button>
          ))}
        </div>

        {/* Main card */}
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            background: "#fff",
            borderRadius: 12,
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.07)",
            overflow: "hidden",
          }}
        >
          {/* Card header */}
          <div
            style={{
              padding: "20px 28px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              gap: 14,
              background:
                screen === "error" ? "#fff5f5" : "#fff",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background:
                  screen === "error" ? "#fee2e2" : "#eff6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {meta.icon}
            </div>
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0f172a",
                  letterSpacing: "-0.01em",
                }}
              >
                {meta.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  marginTop: 2,
                }}
              >
                {meta.subtitle}
              </div>
            </div>
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: 20,
                  background:
                    screen === "error" ? "#fee2e2" : "#dbeafe",
                  color:
                    screen === "error" ? "#b91c1c" : "#1e40af",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {screen === "form"
                  ? "Input"
                  : screen === "loading"
                    ? "Processing"
                    : screen === "preview"
                      ? "Ready"
                      : "Error"}
              </span>
            </div>
          </div>

          {/* Card body */}
          <div style={{ padding: "24px 28px" }}>
            {screen === "form" && (
              <FormScreen
                onSubmit={handleSubmit}
                onError={() => {
                  setErrorMessage("Simulated error for testing");
                  setScreen("error");
                }}
              />
            )}
            {screen === "loading" && <LoadingScreen />}
            {screen === "preview" && draftData && (
              <PreviewScreen
                draft={{
                  subject: draftData.subject,
                  body: draftData.body,
                  confidence: Math.round(draftData.confidence * 100),
                  tags: mapContextToTags(draftData.context_used),
                }}
                onBack={() => {
                  setScreen("form");
                  setDraftData(null);
                }}
                onCopy={() => {}}
                onEscalate={() => {
                  setScreen("form");
                  setDraftData(null);
                }}
              />
            )}
            {screen === "error" && (
              <ErrorScreen
                onBack={() => {
                  setScreen("form");
                  setErrorMessage(null);
                }}
                errorMessage={errorMessage}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 20,
            fontSize: 12,
            color: "#94a3b8",
            textAlign: "center",
          }}
        >
          SmartReply Agent · Powered by Gemini 2.5-flash · Responses are
          AI-generated — always review before sending
        </div>
      </div>
    </>
  );
}