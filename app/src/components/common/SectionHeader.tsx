interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, right }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h1 className="section-title">{title}</h1>
        {subtitle && <p className="section-sub">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
