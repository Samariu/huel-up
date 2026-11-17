export function Stepper(props: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  format?: (v: number) => string;
}) {
  const { value, onChange, min = 0, max = 99, step = 1 } = props;
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  return (
    <div class="stepper" role="group" aria-label={props.label}>
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => set(value - step)}>
        −
      </button>
      <output>{props.format ? props.format(value) : value}</output>
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => set(value + step)}>
        +
      </button>
    </div>
  );
}
