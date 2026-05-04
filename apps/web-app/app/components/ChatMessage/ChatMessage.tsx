import { ManaSymbol } from '../ManaSymbol/ManaSymbol';
import './ChatMessage.css';

interface ChatMessageProps {
  message: {
    role: 'oracle' | 'user';
    content: string;
    format?: string;
  };
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className="chat-message"
      style={{ justifyContent: isUser ? 'flex-end' : 'flex-start' }}
    >
      <div
        className="chat-message-inner"
        style={{ flexDirection: isUser ? 'row-reverse' : 'row' }}
      >
        <div
          className={`seal chat-message-seal`}
          style={{
            background: isUser
              ? 'radial-gradient(circle at 35% 30%, var(--void-3), var(--void-1))'
              : 'radial-gradient(circle at 35% 30%, var(--void-2), var(--void-0))',
          }}
        >
          {/* <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 12, fontStyle: 'italic' }}>
            {isUser ? 'style' : '✦'}
          </span> */}
        </div>
        <div>
          <div className="h-ui chat-message-label" style={{ textAlign: isUser ? 'right' : 'left' }}>
            {isUser ? `You` : 'Grimoire'}
          </div>
          <div
            style={{
              background: isUser
                ? 'linear-gradient(135deg, rgba(232, 199, 106, 0.12), rgba(139, 111, 46, 0.08))'
                : 'linear-gradient(135deg, rgba(28, 22, 40, 0.6), rgba(14, 11, 20, 0.8))',
              backdropFilter: isUser ? 'none' : 'blur(8px)',
              border: isUser ? '1px solid rgba(var(--accent-glow), 0.3)' : '1px solid rgba(var(--accent-glow), 0.18)',
              borderRadius: '8px',
              padding: '12px 16px',
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              lineHeight: 1.5,
              color: 'var(--cream)',
            }}
          >
            {
            /*
            TODO:
            Split on **bold** tokens; odd indices are captured bold text, even are plain
            For example, "Cast **Llanowar Elves** early" becomes:

            "Cast " → plain span
            "Llanowar Elves" → <strong> in accent color
            " early" → plain span
            */}
            {message.content.split(/\*\*(.+?)\*\*/g).map((part, i) =>
              i % 2 === 1
                ? <strong key={i} style={{ color: 'var(--accent)', fontWeight: 600 }}>{part}</strong>
                : part
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
