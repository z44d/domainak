import { Box, CircularProgress, Typography } from "@mui/material";

export function LoadingScreen({
  label = "Loading...",
}: {
  label?: string;
}) {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      sx={{
        minHeight: { xs: "65vh", md: "70vh" },
        display: "grid",
        placeContent: "center",
        justifyItems: "center",
        gap: 2,
        py: 6,
      }}
    >
      <CircularProgress size={38} thickness={4} />
      <Typography variant="body2" color="textSecondary">
        {label}
      </Typography>
    </Box>
  );
}
