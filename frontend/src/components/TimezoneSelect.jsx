import { useMemo } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { listTimezones, tzOffsetLabel } from '../utils/tz';
export default function TimezoneSelect({ value, onChange, label = 'Timezone', helperText, disabled }) {
  const options = useMemo(
    () =>
      listTimezones()
        .map((tz) => ({ tz, label: `${tz.replace(/_/g, ' ')} (${tzOffsetLabel(tz)})` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    []
  );
  const selected = options.find((o) => o.tz === value) || null;

  return (
    <Autocomplete
      size="small"
      disabled={disabled}
      options={options}
      value={selected}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.tz === b.tz}
      onChange={(_, o) => o && onChange(o.tz)}
      disableClearable
      autoHighlight
      renderInput={(params) => <TextField {...params} label={label} helperText={helperText} />}
    />
  );
}
