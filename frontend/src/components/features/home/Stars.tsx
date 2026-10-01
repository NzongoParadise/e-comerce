export function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5 text-[#e6a400]" aria-label={`${count} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index}>{index < count ? "★" : "☆"}</span>
      ))}
    </div>
  );
}
