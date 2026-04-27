// Knowledge-base activation indicator for the intake page.
//
// Surfaces the RAG / vector-store status to the judge so they understand
// that selecting a case type also wires up the relevant reference
// library (statutes, practice directions, bench books, prior precedents).
// The card pulses once on activation to make the connection between
// "I picked traffic violation" and "the agents can now search the Road
// Traffic Act" obvious without requiring the judge to read about it.
//
// We only consume `has_vector_store` from the public domains list; doc
// counts and per-store metadata are admin-only by design (see
// PublicDomainResponse in the backend). If/when a public count endpoint
// is added, render it here next to the status pill.

import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Friendly per-domain blurbs describing what the vector store actually
// indexes. These are static today (one paragraph per domain); they live
// next to the slot schema philosophically — both describe how a given
// case type is set up. Move to backend metadata once we ingest more
// domains.
const DOMAIN_KNOWLEDGE_BLURB = {
  traffic_violation:
    'Singapore Road Traffic Act, Sentosa Development Corporation Regulations (Chapter 291), bench books on speeding and dangerous-driving sentencing, and calibration-certificate standards for speed-detection equipment.',
  small_claims:
    'Small Claims Tribunals Act, CPFTA, and tenancy / sale-of-goods practice directions. Note: ingestion in progress.',
};

export default function KnowledgeBaseCard({ domain, loading }) {
  const blurb = DOMAIN_KNOWLEDGE_BLURB[domain?.code] || null;
  const ready = !!domain?.has_vector_store;

  // Pulse the card briefly the first time a domain becomes ready —
  // makes the "I picked X → the library is now loaded" link visible.
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (ready) {
      // Intentional one-shot flash on ready transition; the timeout clears it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1400);
      return () => clearTimeout(t);
    }
  }, [ready, domain?.code]);

  return (
    <Card
      className={
        pulse
          ? 'border-emerald-500/60 ring-2 ring-emerald-500/30 transition-all'
          : 'transition-all'
      }
      data-testid="knowledge-base-card"
    >
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-sm font-semibold">Knowledge base</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reference material the agents can search while analysing this case.
          </p>
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading
          </span>
        ) : ready ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            data-testid="kb-status-ready"
          >
            <CheckCircle2 className="h-3 w-3" />
            Ready to search
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300"
            data-testid="kb-status-unavailable"
          >
            <AlertTriangle className="h-3 w-3" />
            Not yet ingested
          </span>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {blurb ?? 'Pick a case type to see the matching reference library.'}
        </p>
      </CardContent>
    </Card>
  );
}
