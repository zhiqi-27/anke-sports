/** Decorative mark: the adjacent product name or parent link supplies its label. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    // SVG stays shared with the downloadable brand master; no image optimizer needed.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/mark.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    />
  );
}
