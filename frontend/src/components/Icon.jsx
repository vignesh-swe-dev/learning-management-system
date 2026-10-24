/**
 * Icon.jsx
 * Thin wrapper around Bootstrap Icons.
 * Always sets aria-hidden="true" — put meaning in nearby text or an aria-label.
 *
 * Usage:
 *   <Icon name="bell" size="md" />
 *   <Icon name="check-circle-fill" size="lg" className="text-success" />
 *
 * size: "sm" (16 px) | "md" (20 px) | "lg" (24 px) | "xl" (40 px)
 */
const SIZE_CLASS = {
  sm: 'bi-sz-sm',
  md: 'bi-sz-md',
  lg: 'bi-sz-lg',
  xl: 'bi-sz-xl',
};

export default function Icon({ name, size = 'sm', className = '', ...rest }) {
  const sizeClass = SIZE_CLASS[size] || 'bi-sz-sm';
  return (
    <i
      className={`bi bi-${name} ${sizeClass}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      {...rest}
    />
  );
}

