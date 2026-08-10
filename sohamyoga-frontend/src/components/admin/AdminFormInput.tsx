'use client';

interface AdminFormInputProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'tel' | 'color' | 'date';
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

interface AdminFormTextareaProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  error?: string;
  className?: string;
}

interface AdminFormSelectProps {
  label: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { label: string; value: string | number }[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

interface AdminFormCheckboxProps {
  label: string;
  name: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  description?: string;
}

export function AdminFormInput({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  className = '',
}: AdminFormInputProps) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-medium text-dark-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm disabled:bg-dark-50 disabled:text-dark-400 ${
          error ? 'border-red-500' : 'border-dark-300'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function AdminFormTextarea({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  rows = 4,
  error,
  className = '',
}: AdminFormTextareaProps) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-medium text-dark-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-vertical disabled:bg-dark-50 disabled:text-dark-400 ${
          error ? 'border-red-500' : 'border-dark-300'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function AdminFormSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  disabled = false,
  error,
  className = '',
}: AdminFormSelectProps) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-medium text-dark-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm disabled:bg-dark-50 disabled:text-dark-400 ${
          error ? 'border-red-500' : 'border-dark-300'
        }`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function AdminFormCheckbox({
  label,
  name,
  checked,
  onChange,
  disabled = false,
  description,
}: AdminFormCheckboxProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={name}
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
      />
      <div>
        <label htmlFor={name} className="text-sm font-medium text-dark-700 cursor-pointer">
          {label}
        </label>
        {description && <p className="text-xs text-dark-400 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}
