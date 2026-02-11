import { useEffect, useState, useMemo, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

import type { BundledLanguage, BundledTheme, HighlighterGeneric } from 'shiki';

// ---------------------------------------------------------------------------
// Shiki highlighter singleton
// ---------------------------------------------------------------------------

let highlighterPromise: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> | null = null;
let highlighterInstance: HighlighterGeneric<BundledLanguage, BundledTheme> | null = null;

async function getHighlighter() {
  if (highlighterInstance) return highlighterInstance;
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([
      import('shiki'),
      import('shiki/engine/javascript'),
    ]).then(async ([{ createHighlighter }, { createJavaScriptRegexEngine }]) => {
      const instance = await createHighlighter({
        themes: ['github-light', 'github-dark'],
        langs: [
          'typescript',
          'javascript',
          'python',
          'rust',
          'go',
          'java',
          'css',
          'html',
          'json',
          'markdown',
          'yaml',
          'bash',
          'sql',
          'ruby',
          'swift',
          'kotlin',
          'c',
          'cpp',
          'csharp',
          'php',
          'tsx',
          'jsx',
        ],
        engine: createJavaScriptRegexEngine(),
      });
      highlighterInstance = instance;
      return instance;
    });
  }
  return highlighterPromise;
}

/**
 * React hook that lazily initialises the shiki highlighter and triggers a
 * re-render once it is ready. Returns `null` until loaded.
 */
function useHighlighter() {
  const [ready, setReady] = useState(!!highlighterInstance);

  useEffect(() => {
    if (highlighterInstance) {
      setReady(true);
      return;
    }
    let cancelled = false;
    getHighlighter().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready ? highlighterInstance : null;
}

// ---------------------------------------------------------------------------
// Sanitization schema — allow shiki output (spans with style/class attrs)
// ---------------------------------------------------------------------------

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), 'style', 'className', 'class'],
    pre: [...(defaultSchema.attributes?.pre ?? []), 'style', 'className', 'class', 'tabIndex'],
    code: [...(defaultSchema.attributes?.code ?? []), 'style', 'className', 'class'],
  },
};

// ---------------------------------------------------------------------------
// Highlighted code block component
// ---------------------------------------------------------------------------

function HighlightedCode({
  highlighter,
  code,
  language,
}: {
  highlighter: HighlighterGeneric<BundledLanguage, BundledTheme> | null;
  code: string;
  language: string;
}) {
  const html = useMemo(() => {
    if (!highlighter) return null;

    // Check if language is loaded; fall back to plain text
    const loadedLangs = highlighter.getLoadedLanguages();
    const lang = loadedLangs.includes(language as BundledLanguage) ? language : 'text';

    try {
      return highlighter.codeToHtml(code, {
        lang: lang as BundledLanguage,
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
      });
    } catch {
      return null;
    }
  }, [highlighter, code, language]);

  if (!html) {
    // Fallback: plain <pre><code> until highlighter loads
    return (
      <pre className="my-2 p-3 rounded-lg bg-muted overflow-x-auto">
        <code className="text-xs font-mono">{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="shiki-wrapper my-2 rounded-lg overflow-x-auto [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:text-xs [&_pre]:leading-relaxed [&_code]:text-xs [&_code]:bg-transparent [&_code]:p-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ---------------------------------------------------------------------------
// Markdown component
// ---------------------------------------------------------------------------

interface MarkdownProps {
  children: string;
  className?: string;
  /** Text size variant. `sm` (default) for panels; `md` for modals/previews. */
  size?: 'sm' | 'md';
}

const sizeStyles = {
  sm: [
    '[&_h2]:text-sm [&_h2]:mt-3 [&_h2]:mb-1',
    '[&_h3]:text-xs [&_h3]:mt-2 [&_h3]:mb-1',
    '[&_p]:text-xs [&_p]:my-1',
    '[&_li]:text-xs',
    '[&_code]:text-[11px]',
    '[&_table]:text-xs',
    '[&_blockquote]:text-xs',
  ],
  md: [
    '[&_h2]:text-lg [&_h2]:mt-4 [&_h2]:mb-2',
    '[&_h3]:text-base [&_h3]:mt-3 [&_h3]:mb-1.5',
    '[&_p]:text-sm [&_p]:my-1.5',
    '[&_li]:text-sm',
    '[&_code]:text-xs',
    '[&_table]:text-sm',
    '[&_blockquote]:text-sm',
  ],
};

/**
 * Render Markdown content (including inline HTML) as styled React elements
 * with GitHub-flavored markdown support and syntax highlighting for code
 * blocks via shiki.
 *
 * @param children  - The Markdown source to render.
 * @param className - Optional additional CSS classes.
 * @param size      - Text size variant: `'sm'` (default) or `'md'`.
 */
export function Markdown({ children, className, size = 'sm' }: MarkdownProps) {
  const highlighter = useHighlighter();

  // Component overrides for ReactMarkdown — recreated when highlighter loads
  // so fenced code blocks get shiki highlighting.
  const components = useMemo(
    () => ({
      code({ className: codeClassName, children: codeChildren, ...rest }: ComponentPropsWithoutRef<'code'>) {
        // react-markdown adds className="language-xxx" for fenced code blocks
        const match = /language-(\w+)/.exec(codeClassName ?? '');

        if (match) {
          const code = String(codeChildren).replace(/\n$/, '');
          return <HighlightedCode highlighter={highlighter} code={code} language={match[1]} />;
        }

        // Inline code
        return (
          <code className={cn('text-chart-2 bg-muted px-1.5 py-0.5 rounded font-mono', codeClassName)} {...rest}>
            {codeChildren}
          </code>
        );
      },
      // Override pre to avoid double-wrapping when HighlightedCode handles
      // the fenced block rendering.
      pre({ children: preChildren }: ComponentPropsWithoutRef<'pre'>) {
        return <>{preChildren}</>;
      },
    }),
    [highlighter],
  );

  return (
    <div
      className={cn(
        'prose prose-sm prose-invert max-w-none',
        // Headings
        '[&_h2]:text-foreground [&_h2]:font-semibold',
        '[&_h3]:text-foreground [&_h3]:font-semibold',
        // Paragraphs
        '[&_p]:text-foreground-secondary [&_p]:leading-relaxed',
        // Lists
        '[&_ul]:my-1 [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:pl-4',
        '[&_li]:text-foreground-secondary [&_li]:my-0.5',
        // Strong
        '[&_strong]:text-foreground [&_strong]:font-semibold',
        // Links
        '[&_a]:text-primary [&_a]:no-underline [&_a]:hover:underline',
        // Tables
        '[&_table]:border-collapse [&_table]:w-full',
        '[&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:py-1',
        '[&_td]:text-foreground-secondary [&_td]:border-b [&_td]:border-border/50 [&_td]:px-2 [&_td]:py-1',
        // Blockquotes
        '[&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
        // Size variant styles
        ...sizeStyles[size],
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={components as never}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
