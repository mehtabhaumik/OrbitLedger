type BrandOrbitalLoaderProps = {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
};

export function BrandOrbitalLoader({ size = 'md', label }: BrandOrbitalLoaderProps) {
  return (
    <div className={`ol-brand-orbit-loader ol-brand-orbit-loader--${size}`} aria-hidden="true">
      <div className="ol-brand-orbit-loader__ring ol-brand-orbit-loader__ring--outer" />
      <div className="ol-brand-orbit-loader__ring ol-brand-orbit-loader__ring--middle" />
      <div className="ol-brand-orbit-loader__ring ol-brand-orbit-loader__ring--inner" />
      <div className="ol-brand-orbit-loader__core">
        <span>O</span>
      </div>
      {label ? <span className="ol-sr-only">{label}</span> : null}
    </div>
  );
}
