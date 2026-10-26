import { cloneElement, useId } from 'react';

export default function FormField({ label, children, hint }) {
  const generatedId = useId();
  const id = children.props.id || generatedId;
  return <div className="form-group">
    <label className="form-label" htmlFor={id}>{label}</label>
    <div className="form-field-control">
      {cloneElement(children, { id, 'aria-describedby': hint ? `${id}-hint` : children.props['aria-describedby'] })}
      {hint && <p id={`${id}-hint`} className="form-hint">{hint}</p>}
    </div>
  </div>;
}
