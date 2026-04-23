import { useRef, useState } from 'react';
import {
  FileText,
  Gavel,
  Film,
  Stethoscope,
  FilePlus,
  FileCheck,
  UploadCloud,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';

// Per-domain typed slot schema. Mirrors the backend DocumentKind enum.
// The `intake_trigger` flag marks slots whose upload should kick off the
// extraction; the backend enforces the same list server-side.
const SLOT_SCHEMA = {
  traffic_violation: [
    {
      kind: 'notice_of_traffic_offence',
      label: 'Notice of Traffic Offence / Summons',
      icon: Gavel,
      required: true,
      multi: false,
      intake_trigger: true,
      accept: 'application/pdf,image/png,image/jpeg',
      hint: 'Police-issued notice. Required to start intake.',
    },
    {
      kind: 'charge_sheet',
      label: 'Charge Sheet',
      icon: FileText,
      required: false,
      multi: false,
      intake_trigger: true,
      accept: 'application/pdf,image/png,image/jpeg',
      hint: 'Optional if the matter has progressed beyond notice.',
    },
    {
      kind: 'evidence_bundle',
      label: 'Evidence bundle',
      icon: FilePlus,
      required: false,
      multi: true,
      accept: 'application/pdf,image/png,image/jpeg',
      hint: 'Affidavits, photos, diagrams. Multiple files allowed.',
    },
    {
      kind: 'in_car_camera',
      label: 'In-car camera footage',
      icon: Film,
      required: false,
      multi: true,
      accept: 'video/*,image/*',
      hint: 'Video clips from the accused’s or witness’s vehicle.',
    },
    {
      kind: 'medical_report',
      label: 'Medical report',
      icon: Stethoscope,
      required: false,
      multi: false,
      accept: 'application/pdf,image/png,image/jpeg',
      hint: 'Attached when injury or medical defence is relevant.',
    },
    {
      kind: 'letter_of_mitigation',
      label: 'Letter of mitigation',
      icon: FileCheck,
      required: false,
      multi: false,
      accept: 'application/pdf,image/png,image/jpeg,text/plain',
      hint: 'Attached when the accused has pleaded guilty with mitigation.',
    },
  ],
  // Small-claims intake is still served by the legacy form until we ingest
  // SCT rules into their own vector store and build typed slots for it.
  small_claims: [],
};

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MiB per file

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Grid of typed document-upload slots for the chat-first intake flow.
 *
 * Each slot is a shadcn Card with an Empty dropzone (or filename pill
 * once a file is attached). The parent owns the upload-progress map and
 * the file-per-slot state, since whether a slot is "filled" is part of
 * the intake wizard's step gating.
 */
export default function DocumentSlotGrid({
  domain,
  filesByKind,
  progressByKind,
  errorByKind,
  onFiles,
  onRemove,
  disabled,
}) {
  const slots = SLOT_SCHEMA[domain] || [];

  if (slots.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <UploadCloud />
        </EmptyMedia>
        <EmptyTitle>No typed slots for this domain yet</EmptyTitle>
        <EmptyDescription>
          Use the classic case-intake form for this jurisdiction.
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {slots.map((slot) => (
        <DocumentSlot
          key={slot.kind}
          slot={slot}
          attached={filesByKind[slot.kind] || []}
          progress={progressByKind[slot.kind]}
          error={errorByKind[slot.kind]}
          onFiles={onFiles}
          onRemove={onRemove}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function DocumentSlot({ slot, attached, progress, error, onFiles, onRemove, disabled }) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const Icon = slot.icon;

  const canAddMore = slot.multi || attached.length === 0;
  const showDropzone = canAddMore && !disabled;

  const acceptFiles = (files) => {
    if (disabled || !canAddMore) return;
    const accepted = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) continue;
      accepted.push(file);
      if (!slot.multi) break;
    }
    if (accepted.length > 0) onFiles(slot.kind, accepted);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    acceptFiles(e.dataTransfer.files);
  };

  return (
    <Card
      className={cn(
        'flex h-full flex-col',
        isDragOver && 'ring-2 ring-primary',
        error && 'border-destructive',
      )}
    >
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex min-w-0 items-start gap-2">
          <Icon data-icon="inline-start" className="mt-0.5" />
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{slot.label}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{slot.hint}</p>
          </div>
        </div>
        {slot.required ? (
          <Badge variant="secondary">Required</Badge>
        ) : (
          <Badge variant="outline">Optional</Badge>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {attached.length > 0 && (
          <ul className="flex flex-col gap-2">
            {attached.map((file, idx) => (
              <li
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 p-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
                {typeof progress === 'number' && progress < 100 ? (
                  <Progress value={progress} className="w-24" />
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => onRemove(slot.kind, idx)}
                    disabled={disabled}
                  >
                    <X />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {showDropzone && (
          <label
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors',
              'hover:border-primary hover:text-foreground',
              isDragOver && 'border-primary bg-primary/5 text-foreground',
            )}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
          >
            <UploadCloud data-icon="inline-start" />
            <span className="mt-2">
              {attached.length === 0
                ? 'Drop file here or click to browse'
                : 'Add another file'}
            </span>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept={slot.accept}
              multiple={slot.multi}
              onChange={(e) => {
                acceptFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

export { SLOT_SCHEMA };
