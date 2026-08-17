import { Label } from '@/components/ui/label';

interface QuestionCardLabelProps {
  id: string;
  label: string;
  required?: boolean;
  htmlFor?: string;
}

const CLASS_NAME =
  'text-muted-foreground mb-2 block text-xs font-semibold tracking-wide uppercase';

// Single-control cards get a real <label htmlFor>; group cards (choice
// questions, read-only views) get a <p> referenced via aria-labelledby.
export function QuestionCardLabel({
  id,
  label,
  required,
  htmlFor,
}: QuestionCardLabelProps) {
  const content = (
    <>
      {label}
      {required && (
        <>
          <span aria-hidden="true" className="text-destructive ml-1">
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </>
  );

  if (htmlFor)
    return (
      <Label htmlFor={htmlFor} id={id} className={CLASS_NAME}>
        {content}
      </Label>
    );

  return (
    <p id={id} className={CLASS_NAME}>
      {content}
    </p>
  );
}
