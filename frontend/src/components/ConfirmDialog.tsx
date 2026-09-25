import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { FONT_DISPLAY } from "../theme/theme";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: { m: { xs: 2, sm: 3 } },
        },
      }}
    >
      <DialogTitle
        sx={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          pb: 1,
        }}
      >
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText dir="auto">{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={loading}
          startIcon={
            loading ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
