interface PlaceholderCardProps {
  title: string;
  children: React.ReactNode;
}

export function PlaceholderCard({ title, children }: PlaceholderCardProps) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-stone-600">{children}</div>
    </section>
  );
}
