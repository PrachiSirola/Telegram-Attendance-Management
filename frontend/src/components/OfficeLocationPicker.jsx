import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../services/api';
import { brand } from '../theme/theme';

export default function OfficeLocationPicker({
  address = '',
  lat = '',
  lng = '',
  radiusMeters = '500',
  onChange,
}) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState(null);
  const [showCoords, setShowCoords] = useState(false);

  async function handleGeocode() {
    const query = address?.trim();
    if (!query) return;
    setGeoLoading(true);
    setGeoMsg(null);
    try {
      const { data } = await api.get(`/organizations/geocode?q=${encodeURIComponent(query)}`);
      if (data?.data) {
        onChange({
          address,
          lat: data.data.lat,
          lng: data.data.lng,
          radiusMeters: radiusMeters || '500',
        });
        setGeoMsg({
          type: 'success',
          text: `Coordinates found: ${data.data.lat.toFixed(4)}, ${data.data.lng.toFixed(4)}`,
        });
      }
    } catch (err) {
      setGeoMsg({
        type: 'warning',
        text: err.response?.data?.message || 'Could not find coordinates for this address. You can adjust the address or enter coordinates below.',
      });
    } finally {
      setGeoLoading(false);
    }
  }

  function handleCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoMsg({ type: 'error', text: 'Geolocation is not supported by your browser.' });
      return;
    }
    setGeoLoading(true);
    setGeoMsg({ type: 'info', text: 'Getting your current location…' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        let detectedAddress = address;

        try {
          const { data } = await api.get(`/organizations/reverse-geocode?lat=${userLat}&lng=${userLng}`);
          if (data?.data?.address) {
            detectedAddress = data.data.address;
          }
        } catch {
        }

        onChange({
          address: detectedAddress,
          lat: userLat,
          lng: userLng,
          radiusMeters: radiusMeters || '500',
        });
        setGeoMsg({
          type: 'success',
          text: `Current location set: ${userLat.toFixed(4)}, ${userLng.toFixed(4)}`,
        });
        setGeoLoading(false);
      },
      (err) => {
        setGeoMsg({ type: 'error', text: `Location error: ${err.message}` });
        setGeoLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  const hasCoords = lat !== '' && lat != null && lng !== '' && lng != null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Office Location & Geofence (optional)
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Enter your office address. Telegram punch-ins will verify employees are within the allowed radius of this location.
        </Typography>
      </Box>

      {/* Address Input */}
      <TextField
        label="Office Address"
        size="small"
        fullWidth
        value={address || ''}
        onChange={(e) =>
          onChange({
            address: e.target.value,
            lat,
            lng,
            radiusMeters,
          })
        }
        placeholder="e.g. Building 4, Downtown Dubai, UAE or Cyber City, Gurugram"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <LocationOnIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title="Find address coordinates">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleGeocode}
                    disabled={geoLoading || !address?.trim()}
                  >
                    {geoLoading ? <CircularProgress size={16} /> : <SearchIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </InputAdornment>
          ),
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleGeocode();
          }
        }}
      />

      {/* Action buttons */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={geoLoading ? <CircularProgress size={14} /> : <SearchIcon fontSize="small" />}
          onClick={handleGeocode}
          disabled={geoLoading || !address?.trim()}
          sx={{ textTransform: 'none' }}
        >
          Locate Address
        </Button>
        <Button
          size="small"
          variant="text"
          startIcon={<MyLocationIcon fontSize="small" />}
          onClick={handleCurrentLocation}
          disabled={geoLoading}
          sx={{ textTransform: 'none' }}
        >
          Use Current Location
        </Button>
      </Box>

      {/* Geocode notification message */}
      {geoMsg && (
        <Alert
          severity={geoMsg.type}
          onClose={() => setGeoMsg(null)}
          sx={{ py: 0, '& .MuiAlert-message': { py: 0.5, fontSize: '0.8rem' } }}
        >
          {geoMsg.text}
        </Alert>
      )}

      {/* Detected coordinates chip & map preview */}
      {hasCoords && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: brand.slate50 || '#f8fafc',
            border: '1px solid',
            borderColor: 'divider',
            px: 1.5,
            py: 0.8,
            borderRadius: 1.5,
          }}
        >
          <CheckCircleIcon color="success" sx={{ fontSize: 16 }} />
          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
            {Number(lat).toFixed(4)}°, {Number(lng).toFixed(4)}°
          </Typography>
          <Link
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              ml: 'auto',
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.3,
            }}
          >
            Google Maps <OpenInNewIcon sx={{ fontSize: 12 }} />
          </Link>
        </Box>
      )}

      {/* Radius setting */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2, alignItems: 'center', mt: 0.5 }}>
        <TextField
          label="Allowed Radius (meters)"
          size="small"
          type="number"
          value={radiusMeters ?? '500'}
          onChange={(e) =>
            onChange({
              address,
              lat,
              lng,
              radiusMeters: e.target.value,
            })
          }
          placeholder="500"
          helperText="Default 500m"
        />
        <Typography variant="caption" color="text.secondary">
          Employees punching in further than this radius from the office address will be blocked.
        </Typography>
      </Box>

      {/* Advanced coordinates toggle */}
      <Box sx={{ mt: 0.5 }}>
        <Button
          size="small"
          variant="text"
          onClick={() => setShowCoords((v) => !v)}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            color: 'text.secondary',
            p: 0,
            minWidth: 0,
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          {showCoords ? '▾ Hide GPS Coordinates' : '▸ Fine-tune GPS Coordinates (Advanced)'}
        </Button>

        {showCoords && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1 }}>
            <TextField
              label="Latitude"
              size="small"
              type="number"
              value={lat ?? ''}
              onChange={(e) =>
                onChange({
                  address,
                  lat: e.target.value,
                  lng,
                  radiusMeters,
                })
              }
              placeholder="e.g. 25.1970"
            />
            <TextField
              label="Longitude"
              size="small"
              type="number"
              value={lng ?? ''}
              onChange={(e) =>
                onChange({
                  address,
                  lat,
                  lng: e.target.value,
                  radiusMeters,
                })
              }
              placeholder="e.g. 55.2741"
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
